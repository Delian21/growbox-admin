/**
 * Listings — vendor-submitted produce listings flowing through the approval
 * queue (DRAFT → PENDING_REVIEW → APPROVED / REJECTED → ARCHIVED). Fictional
 * Nigerian produce consistent with the vendor roster; vendor_id references
 * VENDORS in vendors.ts. Extends the Phase 1 contract (see listing-types.ts).
 */
import type { Listing } from "../listing-types";
import { shift } from "./relativeDates";

/** Written with literal dates, re-based to "now" at load (see relativeDates). */
const RAW_LISTINGS: Listing[] = [
  {
    id: "lst_01K5M2F00000000000000000L1",
    vendor_id: "ven_01J9Z8Q00000000000000000A1", // Oyo Highlands Produce
    title: "Fresh Ugwu (Fluted Pumpkin) Leaves",
    category: "Leafy greens",
    description: "Morning-harvested ugwu bundles, washed and crated. 500g bunches.",
    unit: "500g bunch",
    price_cents: 45000, // ₦450
    stock_kg: 120,
    status: "PENDING_REVIEW",
    submitted_at: "2026-09-07T09:15:00Z",
    comments: [
      {
        id: "cmt_01K5M2F00000000000000000C1",
        author_admin_id: "adm_01J9Z8Q0000000000000000004",
        body: "Photos look consistent with last month's batch. Checking the crate weight against the declared stock before deciding.",
        at: "2026-09-08T10:05:00Z",
      },
      {
        id: "cmt_01K5M2F00000000000000000C2",
        author_admin_id: "adm_01J9Z8Q0000000000000000002",
        body: "Price is above the ugwu market average this week; check with the vendor before approving.",
        at: "2026-09-08T11:20:00Z",
      },
    ],
    review_history: [],
  },
  {
    id: "lst_01K5M2F00000000000000000L2",
    vendor_id: "ven_01J9Z8Q00000000000000000A2", // Jos Plateau Greens
    title: "Plateau Green Amaranth",
    category: "Leafy greens",
    description: "Crisp green amaranth from cool-climate plateau farms.",
    unit: "1kg crate",
    price_cents: 80000, // ₦800
    stock_kg: 300,
    status: "PENDING_REVIEW",
    submitted_at: "2026-09-08T14:40:00Z",
    comments: [],
    review_history: [],
  },
  {
    id: "lst_01K5M2F00000000000000000L3",
    vendor_id: "ven_01J9Z8Q00000000000000000A7", // Ogbomosho Mango Hub
    title: "Ogbomosho Mangoes (Grade A)",
    category: "Fruit",
    description: "Tree-ripened mangoes, sorted and single-layer packed.",
    unit: "20kg basket",
    price_cents: 1800000, // ₦18,000
    stock_kg: 800,
    status: "PENDING_REVIEW",
    submitted_at: "2026-09-06T11:05:00Z",
    comments: [
      {
        id: "cmt_01K5M2F00000000000000000C3",
        author_admin_id: "adm_01J9Z8Q0000000000000000004",
        body: "The Grade A claim needs a photo of the sorting table; requested from the vendor.",
        at: "2026-09-07T16:30:00Z",
      },
    ],
    review_history: [],
  },
  {
    id: "lst_01K5M2F00000000000000000L4",
    vendor_id: "ven_01J9Z8Q00000000000000000A4", // Epe Leafy Farms
    title: "Scent Leaf (Efirin), Bulk Pack",
    category: "Herbs",
    description: "Aromatic scent leaf, cut fresh and chilled.",
    unit: "250g pack",
    price_cents: 30000, // ₦300
    stock_kg: 60,
    status: "DRAFT",
    submitted_at: null,
    comments: [],
    review_history: [],
  },
  {
    id: "lst_01K5M2F00000000000000000L5",
    vendor_id: "ven_01J9Z8Q00000000000000000A2",
    title: "Jos Irish Potatoes",
    category: "Tubers",
    description: "Firm table-grade potatoes, brushed clean.",
    unit: "50kg bag",
    price_cents: 5200000, // ₦52,000
    stock_kg: 2000,
    status: "APPROVED",
    submitted_at: "2026-09-01T08:20:00Z",
    comments: [],
    reviewed_at: "2026-09-01T16:00:00Z",
    review_history: [
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Photos, pricing and stock all consistent; approved for sale.",
        at: "2026-09-01T16:00:00Z",
      },
    ],
  },
  {
    id: "lst_01K5M2F00000000000000000L6",
    vendor_id: "ven_01J9Z8Q00000000000000000A1",
    title: "Premium Garden Egg",
    category: "Vegetables",
    description: "Small sweet variety favoured for sauces.",
    unit: "1kg basket",
    price_cents: 95000, // ₦950
    stock_kg: 250,
    status: "APPROVED",
    submitted_at: "2026-09-02T10:00:00Z",
    comments: [],
    reviewed_at: "2026-09-02T15:30:00Z",
    review_history: [
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000004",
        reason: "Standard produce listing; nothing unusual.",
        at: "2026-09-02T15:30:00Z",
      },
    ],
  },
  {
    id: "lst_01K5M2F00000000000000000L7",
    vendor_id: "ven_01J9Z8Q00000000000000000A5", // Zaria Onion Collective (suspended)
    title: "Dried Onion Flakes 10kg",
    category: "Pantry",
    description: "Dehydrated onion flakes, food-grade packaging.",
    unit: "10kg sack",
    price_cents: 1200000, // ₦12,000
    stock_kg: 400,
    status: "REJECTED",
    submitted_at: "2026-09-03T12:45:00Z",
    comments: [],
    reviewed_at: "2026-09-03T18:10:00Z",
    review_history: [
      {
        action: "REJECTED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Vendor is suspended; product photos are stock images reused from another seller.",
        at: "2026-09-03T18:10:00Z",
      },
    ],
  },
  {
    id: "lst_01K5M2F00000000000000000L8",
    vendor_id: "ven_01J9Z8Q00000000000000000A5",
    title: "Onion Paste Tub 5kg",
    category: "Pantry",
    description: "Chilled onion paste for restaurants.",
    unit: "5kg tub",
    price_cents: 700000, // ₦7,000
    stock_kg: 150,
    status: "REJECTED",
    submitted_at: "2026-09-04T09:30:00Z",
    comments: [],
    reviewed_at: "2026-09-04T13:00:00Z",
    review_history: [
      {
        action: "REJECTED",
        admin_id: "adm_01J9Z8Q0000000000000000001",
        reason: "No cold-chain capability on file for chilled goods. Resubmit with a logistics plan.",
        at: "2026-09-04T13:00:00Z",
      },
    ],
  },
  {
    id: "lst_01K5M2F00000000000000000L9",
    vendor_id: "ven_01J9Z8Q00000000000000000A6", // Niger Delta Fresh Exports (banned)
    title: "Smoked Catfish (Export Grade)",
    category: "Protein",
    description: "Traditionally smoked, vacuum sealed.",
    unit: "2kg pack",
    price_cents: 2600000, // ₦26,000
    stock_kg: 90,
    status: "ARCHIVED",
    submitted_at: "2026-08-20T10:00:00Z",
    comments: [],
    reviewed_at: "2026-08-22T09:00:00Z",
    review_history: [
      {
        action: "APPROVED",
        admin_id: "adm_01J9Z8Q0000000000000000004",
        reason: "Verified packaging photos and processing facility.",
        at: "2026-08-22T09:00:00Z",
      },
      {
        action: "ARCHIVED",
        admin_id: "adm_01J9Z8Q0000000000000000002",
        reason: "Vendor banned; all listings delisted automatically.",
        at: "2026-08-30T17:00:00Z",
      },
    ],
  },
];

export const LISTINGS: Listing[] = RAW_LISTINGS.map((l) => ({
  ...l,
  submitted_at: l.submitted_at ? shift(l.submitted_at) : null,
  ...(l.reviewed_at ? { reviewed_at: shift(l.reviewed_at) } : {}),
  review_history: l.review_history.map((r) => ({ ...r, at: shift(r.at) })),
  comments: l.comments.map((c) => ({ ...c, at: shift(c.at) })),
}));

export const LISTING_BY_ID = new Map(LISTINGS.map((l) => [l.id, l]));
