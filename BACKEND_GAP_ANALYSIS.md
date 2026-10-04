# GrowBox — Backend Surface Discovery & Gap Analysis

> Resolves Open Question 2 in ARCHITECTURE.md · Dated 2026-09-09
> Scope: what API surface the two client apps call today, what the admin panel needs, how to close the gap — and whether the admin panel can be built **without** a backend for now.

---

## 1. Discovery constraint

The client repos are **not in this workspace**, and the deployed sites are Flutter web canvases, so network calls are not inspectable from page source. What we know:

| Signal | growbox-app (buyer) | growbox-vend (vendor) |
|---|---|---|
| Framework | Flutter (Material 3) web build | Flutter (Material 3) web build |
| Stated purpose | "grocery delivery app for consumers" | "manage your store, products, orders and sales" |
| Backend visible from metadata | None detected | None detected |
| Owner statement | **No backend exists for either app** | ← same |

**Per the owner: neither app has a backend today.** The practical conclusion is stronger than any scan: there is no meaningful API surface to inventory. If either app secretly calls something (Firebase, a REST service), the verification pass below will find it — but planning assumes zero.

## 2. Verification checklist (run when client repos are reachable)

1. Search for HTTP/DIO clients, base URLs, `.env`/`--dart-define` endpoints.
2. Look for `firebase_options.dart`, `supabase_initialize`, or similar SDK bootstrapping.
3. Check how orders/products/auth state are stored — local only, or synced?
4. If anything is found, diff it against §4 and update this doc.

## 3. Answer: can we build the admin panel without a backend?

**Yes — build the admin app now against a mock API layer, but understand what you're building.**

The admin panel is *inherently* a backend product: order overrides, refunds, payout approvals, and the audit log are server-side actions. With no backend there is nothing real to administer. What you *can* legitimately build today is the entire **front-of-house**: the tailwind-admin-style shell, order/dispute/vendor/payout screens, workflows, RBAC-gated navigation, light/dark theming — all driven by seeded demo data.

The trick that makes this investment survive contact with reality:

- **Contract-first:** the admin app codes against the API surface already defined in ARCHITECTURE.md §6 (`/admin/v1/*`), typed by a hand-written OpenAPI spec.
- **Mock at the network edge:** MSW (Mock Service Worker) or json-server implements that spec with fixtures. The app cannot tell the difference — same requests, same shapes.
- **Swap is config, not code:** when the real backend exists, point the same client at it and delete the mock worker. No screen rewrites.

This is the standard "design-first" path and it de-risks the UI before a single backend decision is locked.

**What you cannot get without the backend:** real auth/2FA, real money movement, real audit trails, multi-user concurrency. Anything money-adjacent in the mock is theater and must be labeled as demo.

## 4. Gap analysis — admin needs vs. what exists

| Admin capability (ARCHITECTURE.md §6) | Backend primitive required | Exists today |
|---|---|---|
| Admin auth, 2FA, RBAC roles | Identity service + role claims | ❌ None |
| Order oversight & status override | Order store + state machine + override endpoint | ❌ None |
| Refunds & wallet credits | Ledger/wallet + idempotent mutation API | ❌ None |
| Vendor KYC review | Doc storage + review workflow + status | ❌ None |
| Listing/price approval | Listing store + publish gate | ❌ None |
| Payouts & commissions | Earnings ledger + batch payouts | ❌ None |
| Review moderation | Review store + moderation states | ❌ None |
| Promotions & notifications | Promo engine + push/FCM sender | ❌ None |
| Analytics (GMV, take rate…) | Aggregation queries over real data | ❌ None |
| Audit log | Append-only event store | ❌ None |
| SLA timers | Scheduled jobs / cron | ❌ None |

**Gap: ~100%.** And note the second-order fact: the buyer and vendor apps *also* need most of this core (orders, products, auth, payments) to become real products. The missing backend is not an admin-panel dependency — it is **the platform's wave-1 dependency**.

## 5. Recommendation: one shared backend for all three apps

A single backend is the right architecture — three apps, one source of truth. The admin panel *must* mutate the same orders, listings, and payouts the two clients read; anything else guarantees divergence.

**Recommended: Supabase (managed Postgres + Auth + Storage + Edge Functions + Realtime).**

- The relational model in ARCHITECTURE.md §5 maps almost 1:1 to Postgres tables.
- Auth issues JWTs with custom role claims → RLS policies express the RBAC matrix server-side (the "authorization is server-side" rule from §2 of the architecture doc).
- Storage handles KYC documents; Edge Functions handle money-adjacent mutations (refund/payout) with idempotency and audit inserts; `pg_cron` covers SLA timers.
- Free tier is sufficient for development; managed = no ops burden while the platform is pre-revenue.
- The ADR-002 "OpenAPI is the source of truth" consequence adjusts naturally: with Supabase, the **Postgres schema + generated types** (`supabase gen types`) become the contract shared by all three apps (Dart + TS).

Alternatives, for the record: **Firebase/Firestore** (fine for the client apps, but the admin's aggregation/reporting queries fight NoSQL) and **self-hosted NestJS + Postgres** (max control, max work — the right move only if outgrowing managed services later; the schema ports cleanly).

### Proposed path (for the board)

1. **Now:** admin app against mocked `/admin/v1` (MSW) → ship the shell + phase-1 screens with demo data.
2. **Next:** stand up the shared Supabase project; implement the §5 data model; move buyer + vendor apps onto it.
3. **Then:** replace the mock layer with real `/admin/v1` endpoints (Edge Functions/RPC) — admin goes live.

### ADR-004 — Shared backend: one Supabase project serving all three apps — **Proposed** (needs owner sign-off)

Single Postgres/Supabase project is the system of record for buyers, vendors, and admins. Consequence: all three clients migrate onto it (client apps currently have no backend, so this is greenfield, not migration); admin-specific authorization via role claims + RLS; mock-first admin development proceeds in parallel.

---

## 6. Open items carried forward

- Owner sign-off on ADR-004 (Supabase as the shared backend).
- Client-repo verification pass (§2) whenever the repos are reachable.
- Open Question 1 resolved provisionally: `design/tokens.css` carries the proposed palette; swap exact client hexes when repos are available.
- Open Questions 3 (SSO provider) and 4 (3PL integration) remain open — Supabase Auth with TOTP likely settles #3 cheaply.
