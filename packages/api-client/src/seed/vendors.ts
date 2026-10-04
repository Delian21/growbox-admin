/**
 * Vendors — every §5 status represented (PENDING_KYC, KYC_REVIEW, APPROVED,
 * SUSPENDED, BANNED) plus poor performers for the ?performance=poor filter.
 * Also: the fictional 3PL roster used by POST /orders/{id}/assign-logistics.
 *
 * KYC evidence ships with each vendor so the review workflow has something to
 * act on. Documents render as inline SVG data URIs (CSP img-src allows
 * 'self' data:), so the viewer needs no file backend in the mock.
 */
import type { components } from "@growbox/api-client";
import { shift } from "./relativeDates";

export type Vendor = components["schemas"]["Vendor"];
export type KycDocument = components["schemas"]["KycDocument"];
export type KycDocumentType = components["schemas"]["KycDocument"]["type"];

/** Fictional 3PL providers for assign-logistics fixtures. */
export const LOGISTICS_PROVIDERS = [ "Kwik Delivery", "GIGL Fresh", "FarmExpress NG", "ColdHubs Logistics"] as const;

export const KYC_DOC_TYPE_LABEL: Record<KycDocumentType, string> = {
  FARM_REGISTRATION: "Farm Registration Certificate",
  LAND_DEED: "Land Deed",
  ORGANIC_CERT: "Organic Certification",
  BANK_DETAILS: "Bank Account Details",
};

/** Escape text for embedding inside an XML/SVG node. */
function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Build a legible one-page document fixture. Fictional by design — the footer
 * says so — but structured like the real thing so the viewer is worth looking at.
 */
function docSvg(type: KycDocumentType, holder: string, refNo: string): string {
  const title = KYC_DOC_TYPE_LABEL[type];
  const authority: Record<KycDocumentType, string> = {
    FARM_REGISTRATION: "Oyo State Ministry of Agriculture",
    LAND_DEED: "Nigerian Land Registry",
    ORGANIC_CERT: "Organic Control Council of Nigeria",
    BANK_DETAILS: "Settlement account · GrowBox vendor payouts",
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420" role="img" aria-label="${xml(title)}">
  <rect width="600" height="420" fill="#fdfdfb"/>
  <rect width="600" height="6" fill="#2f6f3e"/>
  <text x="40" y="64" font-family="Verdana, sans-serif" font-size="11" letter-spacing="2" fill="#6b7280">GROWBOX · KYC SUBMISSION</text>
  <text x="40" y="112" font-family="Verdana, sans-serif" font-size="24" font-weight="bold" fill="#111827">${xml(title)}</text>
  <text x="40" y="146" font-family="Verdana, sans-serif" font-size="16" fill="#374151">${xml(holder)}</text>
  <line x1="40" y1="180" x2="560" y2="180" stroke="#e5e7eb"/>
  <text x="40" y="214" font-family="Verdana, sans-serif" font-size="11" fill="#6b7280">REFERENCE</text>
  <text x="40" y="238" font-family="Verdana, sans-serif" font-size="15" fill="#111827">${xml(refNo)}</text>
  <text x="40" y="282" font-family="Verdana, sans-serif" font-size="11" fill="#6b7280">ISSUED BY</text>
  <text x="40" y="306" font-family="Verdana, sans-serif" font-size="15" fill="#111827">${xml(authority[type])}</text>
  <rect x="40" y="336" width="520" height="44" rx="6" fill="#f3f4f6"/>
  <text x="56" y="364" font-family="Verdana, sans-serif" font-size="11" fill="#6b7280">Fictional demo fixture. Not a real document.</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface DocSeed {
  type: KycDocumentType;
  status: KycDocument["status"];
  uploaded_at: string;
  reviewed_by_admin_id?: string;
  reviewed_at?: string;
  notes?: string;
}

/** Turn a DocSeed into a full KycDocument bound to one vendor. */
function doc(vendorId: string, n: number, holder: string, seed: DocSeed): KycDocument {
  const id = `kyc_01J9Z8Q00000000000000${n.toString().padStart(2, "0")}D${vendorId.slice(-3)}`;
  return {
    id,
    vendor_id: vendorId,
    type: seed.type,
    file_url: docSvg(seed.type, holder, `GB-${vendorId.slice(-6)}-${n}`),
    status: seed.status,
    uploaded_at: seed.uploaded_at,
    ...(seed.reviewed_by_admin_id ? { reviewed_by_admin_id: seed.reviewed_by_admin_id } : {}),
    ...(seed.reviewed_at ? { reviewed_at: seed.reviewed_at } : {}),
    ...(seed.notes ? { notes: seed.notes } : {}),
  };
}

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_VENDORS: Vendor[] = [
  {
    id: "ven_01J9Z8Q00000000000000000A1",
    business_name: "Oyo Highlands Produce",
    owner: { name: "Adaeze Nwosu", email: "adaeze@oyohighlands.example", phone: "+2348031000001" },
    status: "APPROVED",
    performance: { cancellation_rate: 0.02, late_shipment_rate: 0.04, spoilage_complaints: 3, rating: 4.7 },
    warning_history: [],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A1", 1, "Oyo Highlands Produce", {
        type: "FARM_REGISTRATION",
        status: "VERIFIED",
        uploaded_at: "2026-03-10T09:15:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000001",
        reviewed_at: "2026-03-12T11:00:00Z",
        notes: "Registration active, matches owner ID.",
      }),
      doc("ven_01J9Z8Q00000000000000000A1", 2, "Adaeze Nwosu", {
        type: "BANK_DETAILS",
        status: "VERIFIED",
        uploaded_at: "2026-03-10T09:20:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000001",
        reviewed_at: "2026-03-12T11:04:00Z",
        notes: "Account name matches business owner.",
      }),
    ],
    created_at: "2026-03-14T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A2",
    business_name: "Jos Plateau Greens",
    owner: { name: "Ibrahim Musa", email: "ibrahim@josplateaugreens.example", phone: "+2348031000002" },
    status: "APPROVED",
    performance: { cancellation_rate: 0.06, late_shipment_rate: 0.09, spoilage_complaints: 11, rating: 4.1 },
    warning_history: [
      {
        id: "wrn_01J9Z8Q00000000000000000B1",
        reason: "Late shipments trending above 8% for two consecutive weeks.",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        at: "2026-08-21T10:30:00Z",
      },
    ],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A2", 1, "Jos Plateau Greens", {
        type: "FARM_REGISTRATION",
        status: "VERIFIED",
        uploaded_at: "2026-01-04T10:00:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2026-01-06T09:30:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A2", 2, "Jos Plateau Greens", {
        type: "LAND_DEED",
        status: "VERIFIED",
        uploaded_at: "2026-01-04T10:06:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2026-01-06T09:35:00Z",
        notes: "Plot size consistent with declared capacity.",
      }),
    ],
    created_at: "2026-01-09T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A3",
    business_name: "Benue Yam & Tubers Co.",
    owner: { name: "Eunice Adeyemi", email: "eunice@benueyam.example", phone: "+2348031000003" },
    status: "PENDING_KYC",
    performance: { cancellation_rate: 0, late_shipment_rate: 0, spoilage_complaints: 0, rating: 0 },
    warning_history: [],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A3", 1, "Benue Yam & Tubers Co.", {
        type: "FARM_REGISTRATION",
        status: "PENDING",
        uploaded_at: "2026-09-01T07:30:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A3", 2, "Benue Yam & Tubers Co.", {
        type: "LAND_DEED",
        status: "PENDING",
        uploaded_at: "2026-09-01T07:34:00Z",
      }),
    ],
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A4",
    business_name: "Epe Leafy Farms",
    owner: { name: "Tunde Bakare", email: "tunde@epeleafy.example", phone: "+2348031000004" },
    status: "KYC_REVIEW",
    performance: { cancellation_rate: 0, late_shipment_rate: 0, spoilage_complaints: 0, rating: 0 },
    warning_history: [],
    // Open for review with one document already bounced back: the vendor stays
    // in KYC_REVIEW after a rejection (see POST /vendors/{id}/kyc-review).
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A4", 1, "Epe Leafy Farms", {
        type: "FARM_REGISTRATION",
        status: "PENDING",
        uploaded_at: "2026-08-25T07:40:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A4", 2, "Epe Leafy Farms", {
        type: "LAND_DEED",
        status: "REJECTED",
        uploaded_at: "2026-08-25T07:45:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000001",
        reviewed_at: "2026-08-27T13:20:00Z",
        notes: "Scan is cropped and the plot number is unreadable. Resubmit the full page.",
      }),
      doc("ven_01J9Z8Q00000000000000000A4", 3, "Tunde Bakare", {
        type: "BANK_DETAILS",
        status: "PENDING",
        uploaded_at: "2026-08-25T07:50:00Z",
      }),
    ],
    created_at: "2026-08-25T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A5",
    business_name: "Zaria Onion Collective",
    owner: { name: "Hauwa Lawal", email: "hauwa@zariaonion.example", phone: "+2348031000005" },
    status: "SUSPENDED",
    performance: { cancellation_rate: 0.19, late_shipment_rate: 0.24, spoilage_complaints: 38, rating: 2.6 },
    warning_history: [
      {
        id: "wrn_01J9Z8Q00000000000000000B2",
        reason: "Cancellation rate breached 10% threshold.",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        at: "2026-08-02T09:00:00Z",
      },
      {
        id: "wrn_01J9Z8Q00000000000000000B3",
        reason: "Spoilage complaints above 25/month; final warning before suspension.",
        admin_id: "adm_01J9Z8Q0000000000000000001",
        at: "2026-08-18T14:00:00Z",
      },
    ],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A5", 1, "Zaria Onion Collective", {
        type: "FARM_REGISTRATION",
        status: "VERIFIED",
        uploaded_at: "2025-11-25T09:00:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2025-11-27T10:10:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A5", 2, "Hauwa Lawal", {
        type: "BANK_DETAILS",
        status: "VERIFIED",
        uploaded_at: "2025-11-25T09:05:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2025-11-27T10:14:00Z",
      }),
    ],
    created_at: "2025-11-30T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A6",
    business_name: "Niger Delta Fresh Exports",
    owner: { name: "Bisi Adebayo", email: "bisi@ndfresh.example", phone: "+2348031000006" },
    status: "BANNED",
    performance: { cancellation_rate: 0.31, late_shipment_rate: 0.4, spoilage_complaints: 72, rating: 1.8 },
    warning_history: [
      {
        id: "wrn_01J9Z8Q00000000000000000B4",
        reason: "Repeatedly listed produce not matching delivered goods.",
        admin_id: "adm_01J9Z8Q0000000000000000001",
        at: "2026-07-05T11:00:00Z",
      },
    ],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A6", 1, "Niger Delta Fresh Exports", {
        type: "FARM_REGISTRATION",
        status: "VERIFIED",
        uploaded_at: "2025-09-08T08:00:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000001",
        reviewed_at: "2025-09-10T12:00:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A6", 2, "Niger Delta Fresh Exports", {
        type: "ORGANIC_CERT",
        status: "VERIFIED",
        uploaded_at: "2025-09-08T08:08:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000001",
        reviewed_at: "2025-09-10T12:06:00Z",
      }),
    ],
    created_at: "2025-09-12T08:00:00Z",
  },
  {
    id: "ven_01J9Z8Q00000000000000000A7",
    business_name: "Ogbomosho Mango Hub",
    owner: { name: "Chiamaka Okeke", email: "chiamaka@ogbomoshomango.example", phone: "+2348031000007" },
    status: "APPROVED",
    performance: { cancellation_rate: 0.03, late_shipment_rate: 0.02, spoilage_complaints: 1, rating: 4.9 },
    warning_history: [],
    kyc_documents: [
      doc("ven_01J9Z8Q00000000000000000A7", 1, "Ogbomosho Mango Hub", {
        type: "FARM_REGISTRATION",
        status: "VERIFIED",
        uploaded_at: "2026-02-16T09:00:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2026-02-18T10:30:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A7", 2, "Ogbomosho Mango Hub", {
        type: "ORGANIC_CERT",
        status: "VERIFIED",
        uploaded_at: "2026-02-16T09:04:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2026-02-18T10:36:00Z",
      }),
      doc("ven_01J9Z8Q00000000000000000A7", 3, "Chiamaka Okeke", {
        type: "BANK_DETAILS",
        status: "VERIFIED",
        uploaded_at: "2026-02-16T09:09:00Z",
        reviewed_by_admin_id: "adm_01J9Z8Q0000000000000000002",
        reviewed_at: "2026-02-18T10:40:00Z",
      }),
    ],
    created_at: "2026-02-20T08:00:00Z",
  },
];

export const VENDORS: Vendor[] = RAW_VENDORS.map((v) => ({
  ...v,
  created_at: shift(v.created_at),
  warning_history: v.warning_history.map((w) => ({ ...w, at: shift(w.at) })),
  kyc_documents: v.kyc_documents.map((d) => ({
    ...d,
    uploaded_at: shift(d.uploaded_at),
    ...(d.reviewed_at ? { reviewed_at: shift(d.reviewed_at) } : {}),
  })),
}));

export const VENDOR_BY_ID = new Map(VENDORS.map((v) => [v.id, v]));
