/**
 * Admin API hooks: typed wrappers over ApiClient + TanStack Query.
 * One query/mutation per contract operation; mutations invalidate their
 * entity's queries so lists and drawers refresh after an audited action.
 * Session token comes from AuthProvider (single source, §9).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { ApiClient, ApiError } from "@growbox/api-client";
import type { components } from "@growbox/api-client";
import type { Listing, ListingPage, ListingStatus } from "@growbox/api-client";
import type { Payout, PayoutPage, PayoutStatus } from "@growbox/api-client";

export type Order = components["schemas"]["Order"];
export type Dispute = components["schemas"]["Dispute"];
export type DisputeComment = components["schemas"]["DisputeComment"];
export type Vendor = components["schemas"]["Vendor"];
export type AuditEntry = components["schemas"]["AuditLog"];
export type OrderStatus = components["schemas"]["OrderStatus"];
export type DisputeStatus = components["schemas"]["DisputeStatus"];
export type VendorStatus = components["schemas"]["VendorStatus"];
export type DisputeCategory = components["schemas"]["DisputeCategory"];
export type AuditEntityType = components["schemas"]["AuditEntityType"];
export type OrderPage = components["schemas"]["OrderPage"];
export type DisputePage = components["schemas"]["DisputePage"];
export type VendorPage = components["schemas"]["VendorPage"];
export type AuditLogPage = components["schemas"]["AuditLogPage"];
/** Single transport instance; MSW intercepts it (see main.tsx). */
export const api = new ApiClient({ baseUrl: "" });

/**
 * Human message from the mock's uniform error shape; raw transport/parse
 * failures are translated to friendly copy so JSON SyntaxError text (e.g. an
 * HTML body from a stale worker) never leaks into the UI.
 */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.bodyText) as { error?: { message?: string } };
      if (body.error?.message) return body.error.message;
    } catch {
      /* Non-JSON body (e.g. stale worker served HTML) — fall through. */
    }
    return `The server returned an unexpected response (HTTP ${err.status}).`;
  }
  if (err instanceof SyntaxError) {
    return "Couldn't reach the server — it responded with something unexpected.";
  }
  if (err instanceof TypeError) {
    return "Couldn't reach the server — check your connection and try again.";
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong";
}

/**
 * Session token lookup, evaluated at request time (inside queryFn), not at
 * render time — the login write happens after first render, and TanStack
 * Query would otherwise cache requests made with a stale empty token.
 * Reads the same localStorage key AuthProvider persists (single source, §9).
 */
export function currentToken(): string {
  try {
    const raw = localStorage.getItem("growbox-admin-session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed.token === "string" ? parsed.token : "";
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------- orders

export interface OrderFilters {
  status?: OrderStatus;
  sla?: "breached";
  date_from?: string;
  date_to?: string;
}

export function ordersQueryString(filters: OrderFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.sla) params.set("sla", filters.sla);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ["orders", "list", filters],
    queryFn: () =>
      api.request<OrderPage>("GET", `/admin/v1/orders${ordersQueryString(filters)}`, undefined, {
        token: currentToken(),
      }),
  });
}

export function useOrder(orderId: string | null) {
  
  return useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => api.request<Order>("GET", `/admin/v1/orders/${orderId}`, undefined, { token: currentToken() }),
    enabled: orderId != null,
  });
}

export function useOverrideOrderStatus(orderId: string): UseMutationResult<Order, unknown, { to: OrderStatus; reason: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Order>("POST", `/admin/v1/orders/${orderId}/status-override`, input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useAssignLogistics(orderId: string): UseMutationResult<Order, unknown, { provider: string; tracking_ref: string; reason: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Order>("POST", `/admin/v1/orders/${orderId}/assign-logistics`, input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ----------------------------------------------------------------- disputes

export interface DisputeFilters {
  status?: DisputeStatus;
  category?: DisputeCategory;
}

export function useDisputes(filters: DisputeFilters) {
  
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  const qs = params.toString();
  return useQuery({
    queryKey: ["disputes", "list", filters],
    queryFn: () =>
      api.request<DisputePage>("GET", `/admin/v1/disputes${qs ? `?${qs}` : ""}`, undefined, { token: currentToken() }),
  });
}

export function useDispute(disputeId: string | null) {
  
  return useQuery({
    queryKey: ["disputes", "detail", disputeId],
    queryFn: () => api.request<Dispute>("GET", `/admin/v1/disputes/${disputeId}`, undefined, { token: currentToken() }),
    enabled: disputeId != null,
  });
}

export function useStartDisputeReview(disputeId: string): UseMutationResult<Dispute, unknown, { reason: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Dispute>("POST", `/admin/v1/disputes/${disputeId}/start-review`, input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["disputes"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useResolveDispute(
  disputeId: string,
): UseMutationResult<Dispute, unknown, { type: "REFUND" | "WALLET_CREDIT" | "PARTIAL"; amount_cents: number; reason: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    // Money op: ApiClient turns idempotency_key in the body into the header (§5).
    mutationFn: (input) =>
      api.request<Dispute>(
        "POST",
        `/admin/v1/disputes/${disputeId}/resolve`,
        { ...input, idempotency_key: crypto.randomUUID() },
        { token: currentToken() },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["disputes"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useAddDisputeComment(disputeId: string): UseMutationResult<DisputeComment, unknown, { body: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<DisputeComment>("POST", `/admin/v1/disputes/${disputeId}/comments`, input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["disputes"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ------------------------------------------------------------------ vendors

export interface VendorFilters {
  status?: VendorStatus;
  performance?: "poor";
}

export function useVendors(filters: VendorFilters) {
  
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.performance) params.set("performance", filters.performance);
  const qs = params.toString();
  return useQuery({
    queryKey: ["vendors", "list", filters],
    queryFn: () =>
      api.request<VendorPage>("GET", `/admin/v1/vendors${qs ? `?${qs}` : ""}`, undefined, { token: currentToken() }),
  });
}

export function useVendor(vendorId: string | null) {
  
  return useQuery({
    queryKey: ["vendors", "detail", vendorId],
    queryFn: () => api.request<Vendor>("GET", `/admin/v1/vendors/${vendorId}`, undefined, { token: currentToken() }),
    enabled: vendorId != null,
  });
}

type VendorAction = "warn" | "suspend" | "reinstate" | "ban";

export type KycAction = "open" | "verify" | "reject";

/**
 * KYC review (§5): open PENDING_KYC → KYC_REVIEW, then verify → APPROVED or
 * reject (documents bounced, vendor deliberately stays in KYC_REVIEW).
 * Illegal action-for-status combos come back as a 409 from the mock.
 */
export function useVendorKycReview(
  vendorId: string,
): UseMutationResult<Vendor, unknown, { action: KycAction; reason: string; notes?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Vendor>("POST", `/admin/v1/vendors/${vendorId}/kyc-review`, input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendors"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useVendorAction(vendorId: string): UseMutationResult<Vendor, unknown, { action: VendorAction; reason: string }> {
  
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }) =>
      api.request<Vendor>("POST", `/admin/v1/vendors/${vendorId}/${action}`, { reason }, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendors"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ----------------------------------------------------------------- listings

export type { Listing, ListingPage, ListingStatus };

export interface ListingFilters {
  status?: ListingStatus;
}

export function useListings(filters: ListingFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  // Per-status totals independent of the status filter (dashboard + toolbar).
  params.set("counts", "status");
  const qs = params.toString();
  return useQuery({
    queryKey: ["listings", "list", filters],
    queryFn: () =>
      api.request<ListingPage>("GET", `/admin/v1/listings${qs ? `?${qs}` : ""}`, undefined, {
        token: currentToken(),
      }),
  });
}

export function useListing(listingId: string | null) {
  return useQuery({
    queryKey: ["listings", "detail", listingId],
    queryFn: () => api.request<Listing>("GET", `/admin/v1/listings/${listingId}`, undefined, { token: currentToken() }),
    enabled: listingId != null,
  });
}

/** Reviewer discussion: comment body is the record (same deviation as disputes). */
export function useAddListingComment(
  listingId: string,
): UseMutationResult<{ id: string }, unknown, { body: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<{ id: string }>("POST", `/admin/v1/listings/${listingId}/comments`, input, {
        token: currentToken(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

type ListingAction = "approve" | "reject" | "archive";

export function useListingAction(
  listingId: string,
): UseMutationResult<Listing, unknown, { action: ListingAction; reason: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }) =>
      api.request<Listing>("POST", `/admin/v1/listings/${listingId}/${action}`, { reason }, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listings"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ------------------------------------------------------------------ payouts

export type { Payout, PayoutPage, PayoutStatus };

export interface PayoutFilters {
  status?: PayoutStatus;
  vendor_id?: string;
}

export function usePayouts(filters: PayoutFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.vendor_id) params.set("vendor_id", filters.vendor_id);
  // Per-status totals independent of the status filter (toolbar counts).
  params.set("counts", "status");
  const qs = params.toString();
  return useQuery({
    queryKey: ["payouts", "list", filters],
    queryFn: () =>
      api.request<PayoutPage>("GET", `/admin/v1/payouts${qs ? `?${qs}` : ""}`, undefined, {
        token: currentToken(),
      }),
  });
}

export function usePayout(payoutId: string | null) {
  return useQuery({
    queryKey: ["payouts", "detail", payoutId],
    queryFn: () => api.request<Payout>("GET", `/admin/v1/payouts/${payoutId}`, undefined, { token: currentToken() }),
    enabled: payoutId != null,
  });
}

/**
 * Runs the settlement calculator for a vendor + period: the mock derives
 * gross / commission from the vendor's eligible orders in the window and
 * refuses inconsistent or duplicate batches (422 / 409).
 */
export function useCalculatePayout(): UseMutationResult<
  Payout,
  unknown,
  { vendor_id: string; period_start: string; period_end: string; reason: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Payout>("POST", "/admin/v1/payouts/calculate", input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payouts"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

type PayoutAction = "submit" | "approve" | "retry";

/** Reason-audited batch decisions (submit / approve / retry a failed run). */
export function usePayoutAction(
  payoutId: string,
): UseMutationResult<Payout, unknown, { action: PayoutAction; reason: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }) =>
      api.request<Payout>("POST", `/admin/v1/payouts/${payoutId}/${action}`, { reason }, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payouts"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

/**
 * Money op: marks an APPROVED batch PAID. Non-optimistic by design (TODO §7)
 * and replay-safe via the Idempotency-Key header (§5 invariant).
 */
export function useMarkPayoutPaid(payoutId: string): UseMutationResult<Payout, unknown, { reason: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Payout>(
        "POST",
        `/admin/v1/payouts/${payoutId}/mark-paid`,
        { ...input, idempotency_key: crypto.randomUUID() },
        { token: currentToken() },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payouts"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ---------------------------------------------------------------- marketing

export type Promotion = components["schemas"]["Promotion"];
export type PromotionPage = components["schemas"]["PromotionPage"];
export type PromotionStatus = components["schemas"]["PromotionStatus"];
export type Notification = components["schemas"]["Notification"];
export type NotificationPage = components["schemas"]["NotificationPage"];
export type NotificationAudience = components["schemas"]["NotificationAudience"];

export interface PromotionFilters {
  status?: PromotionStatus;
}

export function usePromotions(filters: PromotionFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  params.set("counts", "status");
  const qs = params.toString();
  return useQuery({
    queryKey: ["promotions", "list", filters],
    queryFn: () =>
      api.request<PromotionPage>("GET", `/admin/v1/promotions${qs ? `?${qs}` : ""}`, undefined, {
        token: currentToken(),
      }),
  });
}

export interface PromotionInput {
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  scope: "GLOBAL" | "CATEGORY" | "VENDOR";
  scope_ref?: string;
  starts_at: string;
  ends_at: string;
  usage_limit: number;
  reason: string;
}

export function useCreatePromotion(): UseMutationResult<
  Promotion,
  unknown,
  PromotionInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Promotion>("POST", "/admin/v1/promotions", input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["promotions"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export type PromoAction = "schedule" | "end";

export function usePromotionAction(
  promotionId: string,
): UseMutationResult<Promotion, unknown, { action: PromoAction; reason: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }) =>
      api.request<Promotion>("POST", `/admin/v1/promotions/${promotionId}/${action}`, { reason }, {
        token: currentToken(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["promotions"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useNotifications(filters: { audience?: NotificationAudience }) {
  const params = new URLSearchParams();
  if (filters.audience) params.set("audience", filters.audience);
  const qs = params.toString();
  return useQuery({
    queryKey: ["notifications", "list", filters],
    queryFn: () =>
      api.request<NotificationPage>("GET", `/admin/v1/notifications${qs ? `?${qs}` : ""}`, undefined, {
        token: currentToken(),
      }),
  });
}

export interface NotificationInput {
  audience: NotificationAudience;
  title: string;
  body: string;
  scheduled_at?: string;
  reason: string;
}

export function useCreateNotification(): UseMutationResult<
  Notification,
  unknown,
  NotificationInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Notification>("POST", "/admin/v1/notifications", input, { token: currentToken() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useSendNotification(notificationId: string): UseMutationResult<
  Notification,
  unknown,
  { reason: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.request<Notification>("POST", `/admin/v1/notifications/${notificationId}/send`, input, {
        token: currentToken(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// --------------------------------------------------------------- analytics

export type GmvDay = components["schemas"]["GmvDay"];
export type AnalyticsGmv = components["schemas"]["AnalyticsGmv"];
export type AnalyticsTakeRate = components["schemas"]["AnalyticsTakeRate"];
export type LeaderboardRow = components["schemas"]["LeaderboardRow"];
export type AnalyticsQuality = components["schemas"]["AnalyticsQuality"];

export function useGmvSeries(days: number) {
  return useQuery({
    queryKey: ["analytics", "gmv", days],
    queryFn: () =>
      api.request<AnalyticsGmv>("GET", `/admin/v1/analytics/gmv?days=${days}`, undefined, {
        token: currentToken(),
      }),
  });
}

export function useTakeRate() {
  return useQuery({
    queryKey: ["analytics", "take-rate"],
    queryFn: () =>
      api.request<AnalyticsTakeRate>("GET", "/admin/v1/analytics/take-rate", undefined, {
        token: currentToken(),
      }),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["analytics", "leaderboard"],
    queryFn: () =>
      api.request<LeaderboardRow[]>("GET", "/admin/v1/analytics/vendor-leaderboard?limit=10", undefined, {
        token: currentToken(),
      }),
  });
}

export function useQualitySignals() {
  return useQuery({
    queryKey: ["analytics", "quality"],
    queryFn: () =>
      api.request<AnalyticsQuality>("GET", "/admin/v1/analytics/spoilage", undefined, {
        token: currentToken(),
      }),
  });
}

// -------------------------------------------------------------------- audit

export interface AuditFilters {
  actor?: string;
  entity_type?: AuditEntityType;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
}

export function useAuditLog(filters: AuditFilters) {
  
  const params = new URLSearchParams();
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.entity_id) params.set("entity_id", filters.entity_id);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const qs = params.toString();
  return useQuery({
    queryKey: ["audit", "list", filters],
    queryFn: () =>
      api.request<AuditLogPage>("GET", `/admin/v1/audit${qs ? `?${qs}` : ""}`, undefined, { token: currentToken() }),
  });
}
