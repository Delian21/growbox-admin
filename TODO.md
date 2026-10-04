# GrowBox Admin — Build TODO

> Working checklist derived from [ARCHITECTURE.md](ARCHITECTURE.md) and [BACKEND_GAP_ANALYSIS.md](BACKEND_GAP_ANALYSIS.md).
> Strategy (Gap Analysis §3/§5): build the full front-of-house now, mocked at the network edge (MSW) behind a hand-written OpenAPI contract. When the real backend lands (ADR-004, Supabase), the swap is config, not code.
> Order: scaffold → shell → contract → mock layer → Phase 1 screens → Phase 2 → Phase 3 → mock fidelity → swap readiness.
> **Status (2026-10-04):** §0 scaffold ✅ · §1 shell/routing/auth (bar notifications) ✅ · §2 contract + client + seed ✅ · §3 MSW handlers + simulation ✅ (env-driven base URL still open) · §4 Phase 1 screens ✅ (orders vendor/date filters + saved views still open) · §5 KYC, listing approval, SLA flags ✅ · §6 promotions, broadcasts, analytics ✅ · next: §5 remainder (payout export, commission rules), §6 impersonation + automation, §7 polish. Live ticket tracking in `.saipen/BOARD.md`.

---

## 0. Repo bootstrap

- [x] Init pnpm-workspace monorepo: `apps/admin` + `packages/api-client` (ARCHITECTURE.md §8 layout)
- [x] Vite + React + TypeScript app with strict TS; ESLint + Prettier
- [x] Tailwind + shadcn/ui init (tailwind-admin base); wire `design/tokens.css` (light + dark) into the theme pipeline
- [x] Light/dark theme toggle, persisted per admin (ARCHITECTURE.md §4.1)
- [x] Netlify SPA deploy config + security headers (CSP, frame-deny) — ADR-003
- [x] CI: typecheck + build on PR

## 1. App shell (frontend skeleton, no data)

- [ ] tailwind-admin-style shell: grouped sidebar (Overview · Orders · Disputes · Vendors · Listings · Payouts · Marketing · Analytics · Audit Log · Settings), topbar with global search / notifications / profile + role badge (§4.1) — built except notifications
- [x] TanStack Router route tree for all sections (placeholder pages OK)
- [x] Auth screens hitting mock endpoints: login → mandatory MFA verify (§9)
- [x] Role switcher for demo (SUPER_ADMIN / OPS / FINANCE / SUPPORT) + RBAC-gated nav — client gating is UX only, mock enforces per-role 403s
- [x] Persistent "demo data" banner + money-action labels (Gap Analysis §3: mock money ops are theater)

## 2. API contract (source of truth)

- [x] Hand-written OpenAPI spec for `/admin/v1/*` — Phase 1 scope shipped (`openapi/admin-v1.yaml`); Phase 2/3 groups still to add
- [x] Phase 1 spec first: auth, orders, disputes, vendors, audit
- [ ] Then Phase 2/3: listings, payouts, commission rules, promotions, notifications, reviews, analytics, impersonation
- [x] Cross-cutting spec rules: `reason` required on every mutation · idempotency keys on money ops · cursor pagination on all lists (§6)
- [x] Generate TS client into `packages/api-client` (openapi-typescript or equivalent) — never hand-write entity types elsewhere
  - [x] Seed fixtures for the mock layer: admins (one per role), vendors (all §5 statuses), orders (all statuses + SLA breach), disputes (every branch), audit log — `packages/api-client/src/seed`, with coverage README

## 3. Mock backend layer

- [x] MSW worker implementing the spec handlers, backed by deterministic seeded fixtures (all §5 entities: orders in every state, disputes, vendors across KYC statuses, flagged reviews, payouts, audit entries)
- [ ] Mock auth issues fake admin JWT with role claim; MFA accepts any code in demo
- [x] State machine enforcement in mocks: order/dispute/vendor/payout transitions only via legal paths (§5)
- [x] Every mock mutation appends an audit-log entry (actor, reason, before/after) — mirrors the backend invariant
- [x] Latency + occasional error simulation for loading/error states
- [ ] Env-driven base URL (`VITE_API_BASE_URL`); one fetch layer in `api-client` so MSW → real backend is config-only

## 4. Phase 1 screens — fire-fighting (§7)

- [ ] Dashboard stat cards: GMV today, open disputes, orders breaching SLA, pending approvals, payouts awaiting sign-off (§4.3) — built as GMV / disputes / SLA / pending listings / poor performers; the payouts-awaiting-sign-off card is still open
- [ ] Orders: TanStack Table list with column filters (status, SLA breached, vendor, date) + saved views
- [x] Order detail drawer: timeline with state machine, admin stamp on each hop
- [x] Order status override dialog (reason required) + 3PL assignment (provider + tracking ref)
- [x] Disputes: list + detail thread; resolve dialog (refund / wallet credit / partial) with reason; comments
- [x] Vendors: list with performance flags (cancellation, late shipments, spoilage, rating); profile with performance meters
- [x] Vendor actions: warn / suspend / reinstate / ban (reason required, role-gated)
- [x] Audit log: read-only table, filter by actor / entity / date; no edit or delete path anywhere
- [x] RBAC permission matrix enforced in mock 403s + hidden UI per role

**Exit criteria (§7): an ops agent can rescue a stuck order, refund a spoiled delivery, and suspend a bad vendor — all audit-trailed in the mock.**

## 5. Phase 2 screens — quality gates (§7)

- [x] KYC review workflow: document viewer, verdict (verify/reject) with notes, vendor status transitions (PENDING_KYC → KYC_REVIEW → APPROVED)
- [x] Listing/price approval queue: approve / reject(reason); nothing "publishes" without it
- [ ] Payout batches: CALCULATED → PENDING_APPROVAL → APPROVED → PAID; approve + export; FAILED handling
- [ ] Commission rules CRUD (GLOBAL / CATEGORY / VENDOR scope, effective dates)
- [x] SLA timers with escalation flags surfaced on orders/disputes

**Exit criteria: no vendor sells without KYC; no listing publishes without approval; payouts run as an approved batch.**

## 6. Phase 3 screens — growth & automation (§7)

- [x] Promotions: codes, PERCENT / FIXED / FREE_SHIPPING, scopes, scheduler (DRAFT → SCHEDULED → LIVE → ENDED)
- [x] Buyer/vendor notification composer with audience + scheduling
- [x] Analytics: GMV trend, take rate, cancellation/late-shipment/spoilage rates, vendor leaderboard (charts on --chart-1..5 tokens)
- [ ] Impersonation (SUPER_ADMIN only): time-boxed, banner-visible, auto-audited
- [ ] Automation rules: auto-escalate disputes, auto-flag vendors breaching thresholds

## 7. Mock fidelity & polish

- [ ] Cursor pagination, sorting, and filter edge cases behave like a real API
- [ ] Empty / error / loading states for every table and drawer
- [ ] Optimistic updates on status changes with rollback on mock failure (money ops stay non-optimistic)
- [ ] Keyboard nav + a11y pass (Radix/shadcn baseline)
- [ ] Storybook or route-level fixtures for odd states (empty queues, breached SLAs, banned vendors)

## 8. Swap-readiness (real backend, later)

- [ ] Verify checklist from Gap Analysis §2 once client repos are reachable (inventory any real API surface)
- [ ] On ADR-004 sign-off: stand up Supabase, port §5 model to Postgres, replace MSW with real `/admin/v1` (Edge Functions/RPC)
- [ ] Confirm success criterion §4.2: admin panel beside either client reads as the same company; swap provisional `design/tokens.css` hexes for exact client palette values

---

## Open questions carried from the docs

- [ ] ADR-004 owner sign-off (Supabase as shared backend)
- [ ] SSO provider (Open Question 3) — Supabase Auth TOTP likely settles it
- [ ] 3PL integration shape: manual tracking entry vs API-driven (Open Question 4)
