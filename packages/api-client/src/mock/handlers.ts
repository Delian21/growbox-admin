/**
 * MSW request handlers for the Phase 1 /admin/v1 contract (openapi/admin-v1.yaml).
 *
 * Every handler: auth → RBAC → validate → mutate store → audit (mutations) →
 * respond with contract-shaped JSON. Illegal transitions return 409; missing
 * reasons 400; role violations 403; money ops replay via Idempotency-Key.
 */

import { http, HttpResponse } from "msw";
import type { components } from "../generated/schema";
import {
  DISPUTE_TRANSITIONS,
  LISTING_TRANSITIONS,
  ORDER_TRANSITIONS,
  PAYOUT_TRANSITIONS,
  PROMO_TRANSITIONS,
  VENDOR_TRANSITIONS,
  type DisputeStatus,
  type ListingStatus,
  type OrderStatus,
  type PayoutStatus,
  type VendorStatus,
} from "../policy";
import {
  MockHttpError,
  audit,
  errorResponse,
  parsePagination,
  paginated,
  requirePermission,
  requireReason,
  simulate,
} from "./http";
import { SESSION_TTL_MS, ipFor, newId, store } from "./store";

type Dispute = components["schemas"]["Dispute"];
type DisputeComment = components["schemas"]["DisputeComment"];

import type { Payout } from "../payout-types";
import type { ListingComment } from "../listing-types";

import type { Notification, Promotion } from "../seed/promotions";

const json = (body: unknown, status = 200) => HttpResponse.json(body as never, { status });

/** Narrow an unknown JSON body to a record; empty object when absent. */
async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MockHttpError) return errorResponse(err);
    return errorResponse(new MockHttpError(500, "INTERNAL", "Unexpected mock failure"));
  }
}

function notFound(entity: string, id: unknown): MockHttpError {
  return new MockHttpError(404, "NOT_FOUND", `${entity} ${String(id)} not found`);
}

/** Compact per-status document counts for audit before/after snapshots. */
function summarizeKyc(vendor: { kyc_documents: { status: string }[] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of vendor.kyc_documents) out[d.status] = (out[d.status] ?? 0) + 1;
  return out;
}

// --------------------------------------------------------------------- auth

export const authHandlers = [
  http.post("*/admin/v1/auth/login", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      const body = await readJson(request);
      const email = String(body.email ?? "").toLowerCase();
      const admin = store.admins.find((a) => a.email.toLowerCase() === email && a.status === "ACTIVE");
      if (!admin) {
        throw new MockHttpError(401, "UNAUTHORIZED", "Unknown or disabled admin account");
      }
      const mfaToken = newId("mfa");
      store.sessions.set(mfaToken, {
        mfaToken,
        admin,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return json({ mfa_required: true, mfa_token: mfaToken });
    });
  }),

  http.post("*/admin/v1/auth/mfa/verify", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      const body = await readJson(request);
      const mfaToken = String(body.mfa_token ?? "");
      const code = String(body.code ?? "");
      const session = store.sessions.get(mfaToken);
      if (!session || Date.now() > session.expiresAt) {
        throw new MockHttpError(401, "UNAUTHORIZED", "MFA challenge expired. Sign in again");
      }
      if (!/^\d{6,8}$/.test(code)) {
        throw new MockHttpError(401, "UNAUTHORIZED", "Invalid MFA code format");
      }
      // Demo convenience: any well-formed code verifies (see seed README).
      store.sessions.delete(mfaToken);
      const token = newId("tok");
      store.sessions.set(token, {
        mfaToken,
        admin: session.admin,
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      });
      return json({
        access_token: token,
        token_type: "Bearer",
        expires_in: Math.round(SESSION_TTL_MS / 1000),
        admin: session.admin,
      });
    });
  }),
];

// ------------------------------------------------------------------- orders

export const orderHandlers = [
  http.get("*/admin/v1/orders", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "orders:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");
      const sla = url.searchParams.get("sla");
      const vendorId = url.searchParams.get("vendor_id");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      let rows = [...store.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (status) rows = rows.filter((o) => o.status === status);
      if (vendorId) rows = rows.filter((o) => o.vendor_id === vendorId);
      if (sla === "breached") rows = rows.filter((o) => o.sla?.breached);
      if (dateFrom) rows = rows.filter((o) => o.created_at >= dateFrom);
      if (dateTo) rows = rows.filter((o) => o.created_at <= `${dateTo}T23:59:59.999Z`);
      return json(paginated(rows, cursor, limit));
    });
  }),

  http.get("*/admin/v1/orders/:order_id", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "orders:read");
      const order = store.orders.find((o) => o.id === params.order_id);
      if (!order) throw notFound("Order", params.order_id);
      return json(order);
    });
  }),

  http.post("*/admin/v1/orders/:order_id/status-override", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "orders:override-status");
      const body = await readJson(request);
      const reason = requireReason(body);
      const order = store.orders.find((o) => o.id === params.order_id);
      if (!order) throw notFound("Order", params.order_id);

      const to = String(body.to ?? "") as OrderStatus;
      const legal = ORDER_TRANSITIONS[order.status] ?? [];
      if (!legal.includes(to)) {
        throw new MockHttpError(409, "CONFLICT", `Illegal transition ${order.status} → ${to || "(missing)"}`, {
          legal_targets: legal,
        });
      }
      const from = order.status;
      order.status = to;
      order.updated_at = new Date().toISOString();
      order.admin_overrides.push({ admin_id: admin.id, from, to, reason, at: order.updated_at });
      audit({
        actor_admin_id: admin.id,
        action: "order.status-override",
        entity_type: "ORDER",
        entity_id: order.id,
        reason,
        before: { status: from },
        after: { status: to },
        ip: ipFor(request),
      });
      return json(order);
    });
  }),

  http.post("*/admin/v1/orders/:order_id/assign-logistics", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "orders:assign-logistics");
      const body = await readJson(request);
      const reason = requireReason(body);
      const order = store.orders.find((o) => o.id === params.order_id);
      if (!order) throw notFound("Order", params.order_id);

      const provider = String(body.provider ?? "").trim();
      const trackingRef = String(body.tracking_ref ?? "").trim();
      if (!provider || !trackingRef) {
        throw new MockHttpError(400, "BAD_REQUEST", "provider and tracking_ref are required");
      }
      order.assigned_logistics = { provider, tracking_ref: trackingRef, at: new Date().toISOString() };
      order.updated_at = order.assigned_logistics.at;
      audit({
        actor_admin_id: admin.id,
        action: "order.assign-logistics",
        entity_type: "ORDER",
        entity_id: order.id,
        reason,
        before: null,
        after: { provider, tracking_ref: trackingRef },
        ip: ipFor(request),
      });
      return json(order);
    });
  }),
];

// ----------------------------------------------------------------- disputes

const RESOLUTION_STATUS: Record<string, DisputeStatus> = {
  REFUND: "RESOLVED_REFUND",
  WALLET_CREDIT: "RESOLVED_CREDIT",
  PARTIAL: "RESOLVED_PARTIAL_RECON",
};

export const disputeHandlers = [
  http.get("*/admin/v1/disputes", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "disputes:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");
      const category = url.searchParams.get("category");

      let rows = [...store.disputes].sort((a, b) => {
        const openFirst = Number(a.status === "OPEN") - Number(b.status === "OPEN");
        return openFirst !== 0 ? -openFirst : a.opened_at.localeCompare(b.opened_at);
      });
      if (status) rows = rows.filter((d) => d.status === status);
      if (category) rows = rows.filter((d) => d.category === category);
      return json(paginated(rows, cursor, limit));
    });
  }),

  http.get("*/admin/v1/disputes/:dispute_id", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "disputes:read");
      const dispute = store.disputes.find((d) => d.id === params.dispute_id);
      if (!dispute) throw notFound("Dispute", params.dispute_id);
      return json(dispute);
    });
  }),

  http.post("*/admin/v1/disputes/:dispute_id/start-review", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "disputes:start-review");
      const body = await readJson(request);
      const reason = requireReason(body);
      const dispute = store.disputes.find((d) => d.id === params.dispute_id);
      if (!dispute) throw notFound("Dispute", params.dispute_id);

      const legal = DISPUTE_TRANSITIONS[dispute.status] ?? [];
      if (!legal.includes("UNDER_REVIEW")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot start review from ${dispute.status}`, {
          legal_targets: legal,
        });
      }
      dispute.status = "UNDER_REVIEW";
      audit({
        actor_admin_id: admin.id,
        action: "dispute.start-review",
        entity_type: "DISPUTE",
        entity_id: dispute.id,
        reason,
        before: { status: "OPEN" },
        after: { status: "UNDER_REVIEW" },
        ip: ipFor(request),
      });
      return json(dispute);
    });
  }),

  http.post("*/admin/v1/disputes/:dispute_id/resolve", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "disputes:resolve");
      const body = await readJson(request);
      const reason = requireReason(body);
      const dispute = store.disputes.find((d) => d.id === params.dispute_id);
      if (!dispute) throw notFound("Dispute", params.dispute_id);

      const idemKey = request.headers.get("idempotency-key") ?? "";
      if (idemKey.length < 8) {
        throw new MockHttpError(
          400,
          "BAD_REQUEST",
          "Idempotency-Key header (min 8 chars) is required for money operations",
        );
      }
      // Money-op replay: same key returns the original response (§5 invariant).
      const cacheKey = `${dispute.id}:${idemKey}`;
      const cached = store.idempotencyCache.get(cacheKey);
      if (cached) {
        return new HttpResponse(cached, { headers: { "Content-Type": "application/json" } });
      }

      const legal = DISPUTE_TRANSITIONS[dispute.status] ?? [];
      const type = String(body.type ?? "");
      const target = RESOLUTION_STATUS[type];
      if (!target || !legal.includes(target)) {
        throw new MockHttpError(409, "CONFLICT", `Cannot resolve from ${dispute.status} via ${type || "(missing)"}`, {
          legal_targets: legal,
        });
      }
      const amount = Number(body.amount_cents);
      if (!Number.isInteger(amount) || amount < 1) {
        throw new MockHttpError(400, "BAD_REQUEST", "amount_cents must be a positive integer");
      }
      if (amount > dispute.amount_disputed_cents) {
        throw new MockHttpError(422, "UNPROCESSABLE", "Resolution amount exceeds the disputed amount");
      }

      const beforeStatus = dispute.status;
      dispute.status = target;
      dispute.resolution = {
        type: type as "REFUND" | "WALLET_CREDIT" | "PARTIAL",
        amount_cents: amount,
        admin_id: admin.id,
        notes: reason,
        at: new Date().toISOString(),
      };
      audit({
        actor_admin_id: admin.id,
        action: "dispute.resolve",
        entity_type: "DISPUTE",
        entity_id: dispute.id,
        reason,
        before: { status: beforeStatus },
        after: { status: target, amount_cents: amount },
        ip: ipFor(request),
      });
      const serialized = JSON.stringify(dispute);
      store.idempotencyCache.set(cacheKey, serialized);
      return new HttpResponse(serialized, { headers: { "Content-Type": "application/json" } });
    });
  }),

  http.post("*/admin/v1/disputes/:dispute_id/comments", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "disputes:comment");
      const body = await readJson(request);
      const dispute = store.disputes.find((d) => d.id === params.dispute_id);
      if (!dispute) throw notFound("Dispute", params.dispute_id);

      const commentBody = String(body.body ?? "").trim();
      if (commentBody.length < 1 || commentBody.length > 2000) {
        throw new MockHttpError(400, "BAD_REQUEST", "Comment body must be 1–2000 characters");
      }
      const comment: DisputeComment = {
        id: newId("cmt"),
        author_admin_id: admin.id,
        body: commentBody,
        at: new Date().toISOString(),
      };
      dispute.comments.push(comment);
      // Documented deviation: no `reason` — the comment body is the record.
      audit({
        actor_admin_id: admin.id,
        action: "dispute.comment",
        entity_type: "DISPUTE",
        entity_id: dispute.id,
        reason: commentBody,
        before: null,
        after: { comment_added: true },
        ip: ipFor(request),
      });
      return json(comment, 201);
    });
  }),
];

// ------------------------------------------------------------------ vendors

export const vendorHandlers = [
  http.get("*/admin/v1/vendors", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "vendors:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");
      const performance = url.searchParams.get("performance");

      let rows = [...store.vendors].sort((a, b) => a.business_name.localeCompare(b.business_name));
      if (status) rows = rows.filter((v) => v.status === status);
      if (performance === "poor") {
        rows = rows.filter(
          (v) =>
            v.performance.cancellation_rate >= 0.1 ||
            v.performance.late_shipment_rate >= 0.15 ||
            v.performance.spoilage_complaints >= 20,
        );
      }
      return json(paginated(rows, cursor, limit));
    });
  }),

  http.get("*/admin/v1/vendors/:vendor_id", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "vendors:read");
      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);
      return json(vendor);
    });
  }),

  http.post("*/admin/v1/vendors/:vendor_id/warn", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "vendors:warn");
      const body = await readJson(request);
      const reason = requireReason(body);
      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);

      vendor.warning_history.push({
        id: newId("wrn"),
        reason,
        admin_id: admin.id,
        at: new Date().toISOString(),
      });
      audit({
        actor_admin_id: admin.id,
        action: "vendor.warn",
        entity_type: "VENDOR",
        entity_id: vendor.id,
        reason,
        before: { warning_count: vendor.warning_history.length - 1 },
        after: { warning_count: vendor.warning_history.length },
        ip: ipFor(request),
      });
      return json(vendor);
    });
  }),

  http.post("*/admin/v1/vendors/:vendor_id/suspend", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "vendors:suspend");
      const body = await readJson(request);
      const reason = requireReason(body);
      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);

      const legal = VENDOR_TRANSITIONS[vendor.status] ?? [];
      if (!legal.includes("SUSPENDED")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot suspend from ${vendor.status}`, { legal_targets: legal });
      }
      const before = vendor.status;
      vendor.status = "SUSPENDED";
      audit({
        actor_admin_id: admin.id,
        action: "vendor.suspend",
        entity_type: "VENDOR",
        entity_id: vendor.id,
        reason,
        before: { status: before },
        after: { status: "SUSPENDED" },
        ip: ipFor(request),
      });
      return json(vendor);
    });
  }),

  http.post("*/admin/v1/vendors/:vendor_id/reinstate", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "vendors:reinstate");
      const body = await readJson(request);
      const reason = requireReason(body);
      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);

      const legal = VENDOR_TRANSITIONS[vendor.status] ?? [];
      if (!legal.includes("APPROVED")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot reinstate from ${vendor.status}`, { legal_targets: legal });
      }
      const before = vendor.status;
      vendor.status = "APPROVED";
      audit({
        actor_admin_id: admin.id,
        action: "vendor.reinstate",
        entity_type: "VENDOR",
        entity_id: vendor.id,
        reason,
        before: { status: before },
        after: { status: "APPROVED" },
        ip: ipFor(request),
      });
      return json(vendor);
    });
  }),

  /**
   * KYC review workflow (§5): three actions, each gated on the current vendor
   * status so the machine stays intact. `reject` deliberately makes NO status
   * hop — the vendor sits in KYC_REVIEW until it resubmits.
   */
  http.post("*/admin/v1/vendors/:vendor_id/kyc-review", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "vendors:kyc-review");
      const body = await readJson(request);
      const reason = requireReason(body);
      const notes = String(body.notes ?? "").trim();
      const action = String(body.action ?? "");
      if (action !== "open" && action !== "verify" && action !== "reject") {
        throw new MockHttpError(400, "BAD_REQUEST", "action must be open, verify, or reject");
      }

      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);
      if (vendor.kyc_documents.length === 0) {
        throw new MockHttpError(422, "UNPROCESSABLE", "No KYC documents submitted; nothing to review");
      }

      // §5 gate: which action this status allows.
      const requires: Record<typeof action, VendorStatus[]> = {
        open: ["PENDING_KYC"],
        verify: ["KYC_REVIEW"],
        reject: ["KYC_REVIEW"],
      };
      if (!requires[action].includes(vendor.status)) {
        throw new MockHttpError(409, "CONFLICT", `Cannot ${action} while vendor is ${vendor.status}`, {
          legal_actions: (Object.keys(requires) as (typeof action)[]).filter((a) =>
            requires[a].includes(vendor.status),
          ),
        });
      }

      const before = { status: vendor.status, kyc: summarizeKyc(vendor) };
      const at = new Date().toISOString();
      let stamped = 0;

      if (action === "open") {
        vendor.status = "KYC_REVIEW";
      } else if (action === "verify") {
        // Accept the submission as it stands: every outstanding document is
        // stamped VERIFIED, including one previously bounced on resubmission.
        for (const d of vendor.kyc_documents) {
          if (d.status === "VERIFIED") continue;
          d.status = "VERIFIED";
          d.reviewed_by_admin_id = admin.id;
          d.reviewed_at = at;
          if (notes) d.notes = notes;
          stamped += 1;
        }
        vendor.status = "APPROVED";
      } else {
        // Bounce every outstanding document. No status hop (see contract).
        for (const d of vendor.kyc_documents) {
          if (d.status !== "PENDING") continue;
          d.status = "REJECTED";
          d.reviewed_by_admin_id = admin.id;
          d.reviewed_at = at;
          if (notes) d.notes = notes;
          stamped += 1;
        }
        if (stamped === 0) {
          throw new MockHttpError(422, "UNPROCESSABLE", "No pending documents to reject");
        }
      }

      audit({
        actor_admin_id: admin.id,
        action: "vendor.kyc_review",
        entity_type: "VENDOR",
        entity_id: vendor.id,
        reason,
        before,
        after: { status: vendor.status, action, documents_stamped: stamped, kyc: summarizeKyc(vendor) },
        ip: ipFor(request),
      });
      return json(vendor);
    });
  }),

  http.post("*/admin/v1/vendors/:vendor_id/ban", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "vendors:ban");
      const body = await readJson(request);
      const reason = requireReason(body);
      const vendor = store.vendors.find((v) => v.id === params.vendor_id);
      if (!vendor) throw notFound("Vendor", params.vendor_id);

      const legal = VENDOR_TRANSITIONS[vendor.status] ?? [];
      if (!legal.includes("BANNED")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot ban from ${vendor.status}`, { legal_targets: legal });
      }
      const before = vendor.status;
      vendor.status = "BANNED";
      audit({
        actor_admin_id: admin.id,
        action: "vendor.ban",
        entity_type: "VENDOR",
        entity_id: vendor.id,
        reason,
        before: { status: before },
        after: { status: "BANNED" },
        ip: ipFor(request),
      });
      return json(vendor);
    });
  }),
];

// ----------------------------------------------------------------- listings

// NOTE: the audit log's entity_type enum (ORDER | DISPUTE | VENDOR) predates
// listings; LISTING entries reuse VENDOR — the `listing.` action prefix is
// the real discriminator. Same approach the real backend will need until the
// contract grows a LISTING entity type.
export const listingHandlers = [
  http.get("*/admin/v1/listings", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "listings:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");
      const vendorId = url.searchParams.get("vendor_id");

      // Queue semantics: pending first (oldest submission first), then the rest.
      const STATUS_RANK: Record<ListingStatus, number> = {
        PENDING_REVIEW: 0,
        DRAFT: 1,
        APPROVED: 2,
        REJECTED: 3,
        ARCHIVED: 4,
      };
      let rows = [...store.listings].sort((a, b) => {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        return (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
      });
      if (vendorId) rows = rows.filter((l) => l.vendor_id === vendorId);
      // counts=status: per-status totals BEFORE the status filter is applied,
      // so dashboards see accurate queue sizes beyond the first page.
      const extra: Record<string, unknown> = {};
      if (url.searchParams.get("counts") === "status") {
        const total_by_status: Partial<Record<ListingStatus, number>> = {};
        for (const l of rows) total_by_status[l.status] = (total_by_status[l.status] ?? 0) + 1;
        extra.total_by_status = total_by_status;
      }
      if (status) rows = rows.filter((l) => l.status === status);
      return json(paginated(rows, cursor, limit, extra));
    });
  }),

  http.get("*/admin/v1/listings/:listing_id", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "listings:read");
      const listing = store.listings.find((l) => l.id === params.listing_id);
      if (!listing) throw notFound("Listing", params.listing_id);
      return json(listing);
    });
  }),

  http.post("*/admin/v1/listings/:listing_id/comments", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "listings:read");
      const body = await readJson(request);
      const listing = store.listings.find((l) => l.id === params.listing_id);
      if (!listing) throw notFound("Listing", params.listing_id);

      const commentBody = String(body.body ?? "").trim();
      if (commentBody.length < 1 || commentBody.length > 2000) {
        throw new MockHttpError(400, "BAD_REQUEST", "Comment body must be 1-2000 characters");
      }
      const comment: ListingComment = {
        id: newId("cmt"),
        author_admin_id: admin.id,
        body: commentBody,
        at: new Date().toISOString(),
      };
      listing.comments.push(comment);
      // Documented deviation: no `reason` — the comment body is the record.
      audit({
        actor_admin_id: admin.id,
        action: "listing.comment",
        entity_type: "VENDOR", // enum predates listings (see note above)
        entity_id: listing.id,
        reason: commentBody,
        before: null,
        after: { comment_added: true },
        ip: ipFor(request),
      });
      return json(comment, 201);
    });
  }),

  ...(() => {
    /** Shared decide/archive mutation factory: reason-audited, §5-gated. */
    const reviewAction = (
      path: "approve" | "reject" | "archive",
      target: ListingStatus,
      action: "APPROVED" | "REJECTED" | "ARCHIVED",
      permission: "listings:approve" | "listings:reject",
      auditAction: string,
    ) =>
      http.post(`*/admin/v1/listings/:listing_id/${path}`, async ({ request, params }) => {
        return handle(async () => {
          await simulate(request);
          const { admin } = requirePermission(request, permission);
          const body = await readJson(request);
          const reason = requireReason(body);
          const listing = store.listings.find((l) => l.id === params.listing_id);
          if (!listing) throw notFound("Listing", params.listing_id);

          const legal = LISTING_TRANSITIONS[listing.status] ?? [];
          if (!legal.includes(target)) {
            throw new MockHttpError(409, "CONFLICT", `Cannot ${path} from ${listing.status}`, {
              legal_targets: legal,
            });
          }
          const before = listing.status;
          listing.status = target;
          listing.reviewed_at = new Date().toISOString();
          listing.review_history.push({ action, admin_id: admin.id, reason, at: listing.reviewed_at });
          audit({
            actor_admin_id: admin.id,
            action: auditAction,
            entity_type: "VENDOR", // see note above: enum predates listings
            entity_id: listing.id,
            reason,
            before: { status: before },
            after: { status: target },
            ip: ipFor(request),
          });
          return json(listing);
        });
      });

    return [
      reviewAction("approve", "APPROVED", "APPROVED", "listings:approve", "listing.approve"),
      reviewAction("reject", "REJECTED", "REJECTED", "listings:reject", "listing.reject"),
      reviewAction("archive", "ARCHIVED", "ARCHIVED", "listings:approve", "listing.archive"),
    ];
  })(),
];

// ------------------------------------------------------------------ payouts

// NOTE: same audit enum workaround as listings — entity_type reuses VENDOR;
// the `payout.` action prefix is the discriminator.
export const payoutHandlers = [
  http.get("*/admin/v1/payouts", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "payouts:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");
      const vendorId = url.searchParams.get("vendor_id");

      // Queue semantics: actionable batches first (oldest period first),
      // then settled ones. FAILED sorts just under PENDING_APPROVAL so it
      // never sinks below a wall of PAID history.
      const STATUS_RANK: Record<PayoutStatus, number> = {
        PENDING_APPROVAL: 0,
        FAILED: 1,
        CALCULATED: 2,
        APPROVED: 3,
        PAID: 4,
      };
      let rows = [...store.payouts].sort((a, b) => {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        return a.period_start.localeCompare(b.period_start);
      });
      if (vendorId) rows = rows.filter((p) => p.vendor_id === vendorId);
      // counts=status: per-status totals BEFORE the status filter is applied.
      const extra: Record<string, unknown> = {};
      if (url.searchParams.get("counts") === "status") {
        const total_by_status: Partial<Record<PayoutStatus, number>> = {};
        for (const p of rows) total_by_status[p.status] = (total_by_status[p.status] ?? 0) + 1;
        extra.total_by_status = total_by_status;
      }
      if (status) rows = rows.filter((p) => p.status === status);
      return json(paginated(rows, cursor, limit, extra));
    });
  }),

  http.get("*/admin/v1/payouts/:payout_id", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "payouts:read");
      const payout = store.payouts.find((p) => p.id === params.payout_id);
      if (!payout) throw notFound("Payout", params.payout_id);
      return json(payout);
    });
  }),

  http.post("*/admin/v1/payouts/calculate", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "payouts:calculate");
      const body = await readJson(request);
      const reason = requireReason(body);
      const vendorId = String(body.vendor_id ?? "");
      const periodStart = String(body.period_start ?? "");
      const periodEnd = String(body.period_end ?? "");

      const vendor = store.vendors.find((v) => v.id === vendorId);
      if (!vendor) {
        throw new MockHttpError(422, "UNPROCESSABLE", `Unknown vendor ${vendorId || "(missing)"}`);
      }
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(periodStart) || !dateRe.test(periodEnd) || periodStart > periodEnd) {
        throw new MockHttpError(
          400,
          "BAD_REQUEST",
          "period_start and period_end (YYYY-MM-DD, start on or before end) are required",
        );
      }

      // Only orders that can still settle count: cancelled and refunded sales
      // never pay out.
      const eligible = store.orders.filter(
        (o) =>
          o.vendor_id === vendorId &&
          o.created_at.slice(0, 10) >= periodStart &&
          o.created_at.slice(0, 10) <= periodEnd &&
          o.status !== "CANCELLED" &&
          o.status !== "REFUNDED",
      );
      if (eligible.length === 0) {
        throw new MockHttpError(422, "UNPROCESSABLE", "No eligible orders in the period; nothing to settle");
      }
      const gross = eligible.reduce((s, o) => s + o.totals.total_cents, 0);
      const commission = eligible.reduce((s, o) => s + o.totals.commission_amount_cents, 0);
      const net = gross - commission;

      // Amount invariant (§5): net must equal gross minus commission, and any
      // caller-supplied figures must match what the orders actually sum to.
      // Badly computed batches are declined rather than stored.
      const claimedGross = body.gross_cents == null ? null : Number(body.gross_cents);
      const claimedCommission = body.commission_cents == null ? null : Number(body.commission_cents);
      if (net <= 0) {
        throw new MockHttpError(422, "UNPROCESSABLE", "Commission consumes the whole batch; nothing to pay out");
      }
      if ((claimedGross != null && claimedGross !== gross) || (claimedCommission != null && claimedCommission !== commission)) {
        throw new MockHttpError(
          422,
          "UNPROCESSABLE",
          `Amount invariant violated: orders in the period sum to gross ${gross} / commission ${commission} kobo`,
        );
      }

      // One live batch per vendor + period: recalculate after it settles or fails.
      const duplicate = store.payouts.find(
        (p) =>
          p.vendor_id === vendorId &&
          p.period_start === periodStart &&
          p.period_end === periodEnd &&
          p.status !== "PAID" &&
          p.status !== "FAILED",
      );
      if (duplicate) {
        throw new MockHttpError(409, "CONFLICT", `A ${duplicate.status.toLowerCase().replaceAll("_", " ")} batch already exists for this period`);
      }

      const payout: Payout = {
        id: newId("pay"),
        vendor_id: vendorId,
        period_start: periodStart,
        period_end: periodEnd,
        gross_cents: gross,
        commission_cents: commission,
        net_cents: net,
        orders_count: eligible.length,
        status: "CALCULATED",
        decision_history: [],
      };
      store.payouts.push(payout);
      audit({
        actor_admin_id: admin.id,
        action: "payout.calculate",
        entity_type: "VENDOR", // enum predates payouts (see note above)
        entity_id: payout.id,
        reason,
        before: null,
        after: { period: `${periodStart} to ${periodEnd}`, gross_cents: gross, commission_cents: commission, net_cents: net, orders_count: eligible.length },
        ip: ipFor(request),
      });
      return json(payout, 201);
    });
  }),

  ...(() => {
    /**
     * Shared reason-audited decision factory for the simple transitions
     * (submit / approve / retry). mark-paid is separate: it is a money op
     * and carries the idempotency + replay rules.
     */
    const decisionAction = (
      path: "submit" | "approve" | "retry",
      from: PayoutStatus,
      to: PayoutStatus,
      decision: Payout["decision_history"][number]["action"],
      permission: "payouts:submit" | "payouts:approve" | "payouts:retry",
      auditAction: string,
    ) =>
      http.post(`*/admin/v1/payouts/:payout_id/${path}`, async ({ request, params }) => {
        return handle(async () => {
          await simulate(request);
          const { admin } = requirePermission(request, permission);
          const body = await readJson(request);
          const reason = requireReason(body);
          const payout = store.payouts.find((p) => p.id === params.payout_id);
          if (!payout) throw notFound("Payout", params.payout_id);

          const legal = PAYOUT_TRANSITIONS[payout.status] ?? [];
          if (!legal.includes(to)) {
            throw new MockHttpError(409, "CONFLICT", `Cannot ${path} a payout from ${payout.status}`, {
              legal_targets: legal,
            });
          }
          const before = payout.status;
          payout.status = to;
          if (path === "approve") {
            payout.approved_by_admin_id = admin.id;
            payout.approved_at = new Date().toISOString();
          }
          if (path === "retry") delete payout.failure_reason;
          payout.decision_history.push({ action: decision, admin_id: admin.id, reason, at: new Date().toISOString() });
          audit({
            actor_admin_id: admin.id,
            action: auditAction,
            entity_type: "VENDOR", // see note above: enum predates payouts
            entity_id: payout.id,
            reason,
            before: { status: before },
            after: { status: to },
            ip: ipFor(request),
          });
          return json(payout);
        });
      });

    return [
      decisionAction("submit", "CALCULATED", "PENDING_APPROVAL", "SUBMITTED", "payouts:submit", "payout.submit"),
      decisionAction("approve", "PENDING_APPROVAL", "APPROVED", "APPROVED", "payouts:approve", "payout.approve"),
      decisionAction("retry", "FAILED", "PENDING_APPROVAL", "RETRY", "payouts:retry", "payout.retry"),
    ];
  })(),

  http.post("*/admin/v1/payouts/:payout_id/mark-paid", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "payouts:mark-paid");
      const body = await readJson(request);
      const reason = requireReason(body);
      const payout = store.payouts.find((p) => p.id === params.payout_id);
      if (!payout) throw notFound("Payout", params.payout_id);

      const idemKey = request.headers.get("idempotency-key") ?? "";
      if (idemKey.length < 8) {
        throw new MockHttpError(
          400,
          "BAD_REQUEST",
          "Idempotency-Key header (min 8 chars) is required for money operations",
        );
      }
      // Money-op replay: same key returns the original response (§5 invariant).
      const cacheKey = `payout:${payout.id}:${idemKey}`;
      const cached = store.idempotencyCache.get(cacheKey);
      if (cached) {
        return new HttpResponse(cached, { headers: { "Content-Type": "application/json" } });
      }

      const legal = PAYOUT_TRANSITIONS[payout.status] ?? [];
      if (!legal.includes("PAID")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot mark a payout PAID from ${payout.status}`, {
          legal_targets: legal,
        });
      }
      const before = payout.status;
      payout.status = "PAID";
      payout.paid_at = new Date().toISOString();
      payout.decision_history.push({ action: "PAID", admin_id: admin.id, reason, at: payout.paid_at });
      audit({
        actor_admin_id: admin.id,
        action: "payout.mark-paid",
        entity_type: "VENDOR", // see note above: enum predates payouts
        entity_id: payout.id,
        reason,
        before: { status: before },
        after: { status: "PAID", net_cents: payout.net_cents },
        ip: ipFor(request),
      });
      const serialized = JSON.stringify(payout);
      store.idempotencyCache.set(cacheKey, serialized);
      return new HttpResponse(serialized, { headers: { "Content-Type": "application/json" } });
    });
  }),
];

// -------------------------------------------------------------------- audit

export const auditHandlers = [
  http.get("*/admin/v1/audit", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "audit:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const actor = url.searchParams.get("actor");
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      let rows = [...store.audit];
      if (actor) rows = rows.filter((a) => a.actor_admin_id === actor);
      if (entityType) rows = rows.filter((a) => a.entity_type === entityType);
      if (entityId) rows = rows.filter((a) => a.entity_id === entityId);
      if (dateFrom) rows = rows.filter((a) => a.at >= dateFrom);
      if (dateTo) rows = rows.filter((a) => a.at <= `${dateTo}T23:59:59.999Z`);
      return json(paginated(rows, cursor, limit));
    });
  }),
];

// ---------------------------------------------------------------- marketing

/**
 * Promotion/notifications (§6). Status moves only through PROMO_TRANSITIONS;
 * DRAFT has no `end` path, ENDED is terminal. Every decision is reason-audited.
 */
export const marketingHandlers = [
  http.get("*/admin/v1/promotions", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "promotions:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const status = url.searchParams.get("status");

      const DRAFT_FIRST: Record<string, number> = { LIVE: 0, SCHEDULED: 1, DRAFT: 2, ENDED: 3 };
      let rows = [...store.promotions].sort((a, b) => {
        const rank = (DRAFT_FIRST[a.status] ?? 9) - (DRAFT_FIRST[b.status] ?? 9);
        if (rank !== 0) return rank;
        return a.starts_at.localeCompare(b.starts_at);
      });
      const extra: Record<string, unknown> = {};
      if (url.searchParams.get("counts") === "status") {
        const total_by_status: Partial<Record<string, number>> = {};
        for (const p of rows) total_by_status[p.status] = (total_by_status[p.status] ?? 0) + 1;
        extra.total_by_status = total_by_status;
      }
      if (status) rows = rows.filter((p) => p.status === status);
      return json(paginated(rows, cursor, limit, extra));
    });
  }),

  http.post("*/admin/v1/promotions", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "promotions:create");
      const body = await readJson(request);
      const reason = requireReason(body);
      const code = String(body.code ?? "").trim().toUpperCase();
      const type = String(body.type ?? "");
      const scope = String(body.scope ?? "");
      const startsAt = String(body.starts_at ?? "");
      const endsAt = String(body.ends_at ?? "");
      const value = Number(body.value ?? 0);
      const usageLimit = Number(body.usage_limit ?? 0);

      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
        throw new MockHttpError(400, "BAD_REQUEST", "code must be 3-24 chars of A-Z, 0-9, _ or -");
      }
      if (type !== "PERCENT" && type !== "FIXED" && type !== "FREE_SHIPPING") {
        throw new MockHttpError(400, "BAD_REQUEST", "type must be PERCENT, FIXED, or FREE_SHIPPING");
      }
      if (scope !== "GLOBAL" && scope !== "CATEGORY" && scope !== "VENDOR") {
        throw new MockHttpError(400, "BAD_REQUEST", "scope must be GLOBAL, CATEGORY, or VENDOR");
      }
      if (!Number.isInteger(value) || value < 0) {
        throw new MockHttpError(400, "BAD_REQUEST", "value must be a non-negative integer");
      }
      if (type === "PERCENT" && (value < 1 || value > 100)) {
        throw new MockHttpError(422, "UNPROCESSABLE", "PERCENT discount must be 1 to 100");
      }
      if (type === "FIXED" && value === 0) {
        throw new MockHttpError(422, "UNPROCESSABLE", "FIXED discount needs a value in kobo");
      }
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        throw new MockHttpError(400, "BAD_REQUEST", "usage_limit must be a positive integer");
      }
      if (!startsAt || !endsAt || startsAt >= endsAt) {
        throw new MockHttpError(422, "UNPROCESSABLE", "ends_at must be after starts_at");
      }
      if (scope !== "GLOBAL" && !String(body.scope_ref ?? "")) {
        throw new MockHttpError(422, "UNPROCESSABLE", `scope_ref is required for ${scope} scope`);
      }
      if (store.promotions.some((p) => p.code === code && p.status !== "ENDED")) {
        throw new MockHttpError(409, "CONFLICT", `Promotion code ${code} already exists and is not ended`);
      }

      const promotion: Promotion = {
        id: newId("pro"),
        code,
        type,
        value,
        scope,
        ...(scope === "GLOBAL" ? {} : { scope_ref: String(body.scope_ref) }),
        starts_at: startsAt,
        ends_at: endsAt,
        usage_limit: usageLimit,
        used_count: 0,
        status: "DRAFT",
        created_by_admin_id: admin.id,
        created_at: new Date().toISOString(),
      } as Promotion;
      store.promotions.push(promotion);
      audit({
        actor_admin_id: admin.id,
        action: "promotion.create",
        entity_type: "VENDOR", // enum predates promotions (see listings note)
        entity_id: promotion.id,
        reason,
        before: null,
        after: { code, type, value, scope, starts_at: startsAt, ends_at: endsAt, usage_limit: usageLimit },
        ip: ipFor(request),
      });
      return json(promotion, 201);
    });
  }),

  http.post("*/admin/v1/promotions/:promotion_id/schedule", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "promotions:schedule");
      const body = await readJson(request);
      const reason = requireReason(body);
      const promo = store.promotions.find((p) => p.id === params.promotion_id);
      if (!promo) throw notFound("Promotion", params.promotion_id);

      const legal = PROMO_TRANSITIONS[promo.status] ?? [];
      if (!legal.includes("SCHEDULED")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot schedule a ${promo.status} promotion`, {
          legal_targets: legal,
        });
      }
      if (promo.starts_at <= new Date().toISOString()) {
        throw new MockHttpError(422, "UNPROCESSABLE", "starts_at is already in the past; create a new window");
      }
      promo.status = "SCHEDULED";
      audit({
        actor_admin_id: admin.id,
        action: "promotion.schedule",
        entity_type: "VENDOR",
        entity_id: promo.id,
        reason,
        before: { status: "DRAFT" },
        after: { status: "SCHEDULED", starts_at: promo.starts_at, ends_at: promo.ends_at },
        ip: ipFor(request),
      });
      return json(promo);
    });
  }),

  http.post("*/admin/v1/promotions/:promotion_id/end", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "promotions:end");
      const body = await readJson(request);
      const reason = requireReason(body);
      const promo = store.promotions.find((p) => p.id === params.promotion_id);
      if (!promo) throw notFound("Promotion", params.promotion_id);

      const legal = PROMO_TRANSITIONS[promo.status] ?? [];
      if (!legal.includes("ENDED")) {
        throw new MockHttpError(409, "CONFLICT", `Cannot end a ${promo.status} promotion`, {
          legal_targets: legal,
        });
      }
      const before = promo.status;
      promo.status = "ENDED";
      audit({
        actor_admin_id: admin.id,
        action: "promotion.end",
        entity_type: "VENDOR",
        entity_id: promo.id,
        reason,
        before: { status: before },
        after: { status: "ENDED", used_count: promo.used_count },
        ip: ipFor(request),
      });
      return json(promo);
    });
  }),

  http.get("*/admin/v1/notifications", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "notifications:read");
      const url = new URL(request.url);
      const { limit, cursor } = parsePagination(url);
      const audience = url.searchParams.get("audience");
      let rows = [...store.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (audience) rows = rows.filter((n) => n.audience === audience);
      return json(paginated(rows, cursor, limit));
    });
  }),

  http.post("*/admin/v1/notifications", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "notifications:create");
      const body = await readJson(request);
      const reason = requireReason(body);
      const audience = String(body.audience ?? "");
      const title = String(body.title ?? "").trim();
      const text = String(body.body ?? "").trim();
      const scheduledAt = String(body.scheduled_at ?? "").trim();

      if (audience !== "BUYERS" && audience !== "VENDORS" && audience !== "SEGMENT") {
        throw new MockHttpError(400, "BAD_REQUEST", "audience must be BUYERS, VENDORS, or SEGMENT");
      }
      if (!title || title.length > 120) {
        throw new MockHttpError(400, "BAD_REQUEST", "title must be 1-120 characters");
      }
      if (!text || text.length > 2000) {
        throw new MockHttpError(400, "BAD_REQUEST", "body must be 1-2000 characters");
      }
      if (scheduledAt && scheduledAt <= new Date().toISOString()) {
        throw new MockHttpError(422, "UNPROCESSABLE", "scheduled_at must be in the future");
      }

      const notification: Notification = {
        id: newId("ntf"),
        audience,
        title,
        body: text,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
        created_by_admin_id: admin.id,
        created_at: new Date().toISOString(),
      } as Notification;
      store.notifications.push(notification);
      audit({
        actor_admin_id: admin.id,
        action: "notification.create",
        entity_type: "VENDOR", // enum predates notifications (see listings note)
        entity_id: notification.id,
        reason,
        before: null,
        after: { audience, title, status: notification.status },
        ip: ipFor(request),
      });
      return json(notification, 201);
    });
  }),

  http.post("*/admin/v1/notifications/:notification_id/send", async ({ request, params }) => {
    return handle(async () => {
      await simulate(request);
      const { admin } = requirePermission(request, "notifications:send");
      const body = await readJson(request);
      const reason = requireReason(body);
      const note = store.notifications.find((n) => n.id === params.notification_id);
      if (!note) throw notFound("Notification", params.notification_id);

      if (note.status === "SENT") {
        throw new MockHttpError(409, "CONFLICT", "Notification already sent", { legal_targets: [] });
      }
      const before = note.status;
      note.status = "SENT";
      note.sent_at = new Date().toISOString();
      audit({
        actor_admin_id: admin.id,
        action: "notification.send",
        entity_type: "VENDOR",
        entity_id: note.id,
        reason,
        before: { status: before },
        after: { status: "SENT", audience: note.audience },
        ip: ipFor(request),
      });
      return json(note);
    });
  }),
];

// ---------------------------------------------------------------- analytics

/**
 * Analytics (§6): derived on the fly from the order/vendor/dispute stores —
 * no separate analytics fixtures to drift out of sync with the ledger.
 * Windows are trailing and zero-filled so charts have a stable x-axis.
 */
export const analyticsHandlers = [
  http.get("*/admin/v1/analytics/gmv", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "analytics:read");
      const url = new URL(request.url);
      const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30) || 30));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayKeys: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86_400_000);
        dayKeys.push(d.toISOString().slice(0, 10));
      }
      const index = new Map(dayKeys.map((k, i) => [k, i]));

      const series = dayKeys.map((date) => ({ date, gmv_cents: 0, orders: 0, commission_cents: 0 }));
      let totalGmv = 0;
      let totalOrders = 0;
      for (const o of store.orders) {
        const key = index.get(o.created_at.slice(0, 10));
        if (key === undefined) continue;
        const bucket = series[key];
        if (!bucket) continue;
        // Cancelled/refunded sales never settle, so they never count as GMV.
        if (o.status === "CANCELLED" || o.status === "REFUNDED") continue;
        bucket.gmv_cents += o.totals.total_cents;
        bucket.commission_cents += o.totals.commission_amount_cents;
        bucket.orders += 1;
        totalGmv += o.totals.total_cents;
        totalOrders += 1;
      }
      return json({ days, series, total_gmv_cents: totalGmv, total_orders: totalOrders });
    });
  }),

  http.get("*/admin/v1/analytics/take-rate", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "analytics:read");
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      let gmv = 0;
      let commission = 0;
      let orders = 0;
      for (const o of store.orders) {
        if (o.created_at < cutoff) continue;
        if (o.status === "CANCELLED" || o.status === "REFUNDED") continue;
        gmv += o.totals.total_cents;
        commission += o.totals.commission_amount_cents;
        orders += 1;
      }
      return json({
        gmv_cents: gmv,
        commission_cents: commission,
        take_rate: gmv === 0 ? 0 : commission / gmv,
        orders_count: orders,
      });
    });
  }),

  http.get("*/admin/v1/analytics/vendor-leaderboard", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "analytics:read");
      const url = new URL(request.url);
      const { limit } = parsePagination(url);

      const totals = new Map<string, { gmv_cents: number; orders: number }>();
      for (const o of store.orders) {
        if (o.status === "CANCELLED" || o.status === "REFUNDED") continue;
        const agg = totals.get(o.vendor_id) ?? { gmv_cents: 0, orders: 0 };
        agg.gmv_cents += o.totals.total_cents;
        agg.orders += 1;
        totals.set(o.vendor_id, agg);
      }
      const rows = store.vendors
        .map((v) => {
          const agg = totals.get(v.id) ?? { gmv_cents: 0, orders: 0 };
          return {
            rank: 0,
            vendor_id: v.id,
            business_name: v.business_name,
            gmv_cents: agg.gmv_cents,
            orders: agg.orders,
            rating: v.performance.rating,
            cancellation_rate: v.performance.cancellation_rate,
          };
        })
        .sort((a, b) => b.gmv_cents - a.gmv_cents)
        .slice(0, limit)
        .map((row, i) => ({ ...row, rank: i + 1 }));
      return json(rows);
    });
  }),

  http.get("*/admin/v1/analytics/spoilage", async ({ request }) => {
    return handle(async () => {
      await simulate(request);
      requirePermission(request, "analytics:read");
      const eligible = store.orders;
      const cancelled = eligible.filter((o) => o.status === "CANCELLED").length;
      const late = eligible.filter((o) => o.sla.breached).length;
      const spoilage = store.vendors.reduce((sum, v) => sum + v.performance.spoilage_complaints, 0);
      const disputesOpen = store.disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length;
      return json({
        orders_count: eligible.length,
        cancellation_rate: eligible.length === 0 ? 0 : cancelled / eligible.length,
        late_shipment_rate: eligible.length === 0 ? 0 : late / eligible.length,
        spoilage_complaints: spoilage,
        disputes_open: disputesOpen,
      });
    });
  }),
];

export const handlers = [...authHandlers, ...orderHandlers, ...disputeHandlers, ...vendorHandlers, ...listingHandlers, ...payoutHandlers, ...marketingHandlers, ...analyticsHandlers, ...auditHandlers];

export type { Dispute };
