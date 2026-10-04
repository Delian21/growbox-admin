# GrowBox Admin Panel — Architecture

> Internal operations console for the **GrowBox agricultural marketplace**.
> Companion to the customer app (https://growbox-app.netlify.app) and vendor portal (https://growbox-vend.netlify.app).
> Status: **planning** · UI inspiration: [tailwind-admin](https://tailwind-admin.com) (React + shadcn/ui + Tailwind) · Brand: GrowBox palette ported from the Flutter clients.

---

## 1. What this is

A standalone web application that gives the GrowBox operations team authority over both sides of the marketplace:

- **Buyer side** — order oversight (with manual status override and 3PL assignment), refund & dispute mediation, review/rating moderation, global promotions and buyer notifications.
- **Vendor side** — onboarding & KYC verification, product/price approval before publishing, payout & commission management, performance monitoring (cancellation rate, late shipments, spoilage complaints) with warn/suspend/ban actions.

Non-goals: end-customer features, vendor self-service (those live in the two client apps). The admin panel never becomes a second vendor dashboard.

---

## 2. System context

```
                        ┌────────────────────────────────┐
                        │      Shared Backend / API      │
                        │  auth · orders · payments      │
                        │  wallets · payouts · push      │
                        └───┬───────────┬───────────┬────┘
             (customer JWT) │           │ (vendor JWT) │ (admin role claim + 2FA)
              ┌─────────────▼──┐   ┌────▼────────┐ ┌──▼─────────────────┐
              │  growbox-app   │   │ growbox-vend│ │  growbox-admin     │
              │  Flutter (M3)  │   │ Flutter (M3)│ │  React SPA         │
              │  buyer side    │   │  seller side│ │  this repo         │
              └────────────────┘   └─────────────┘ └────────────────────┘
```

**Ground rule:** the admin app is a consumer of the same backend API with an elevated, separately-issued credential. *All* authorization is enforced server-side. The client split (three deploys) is defense-in-depth and blast-radius control — not the security boundary.

| Concern | Owner |
|---|---|
| Order state machine | Backend · admin may override transitions |
| Money movement (refunds, payouts) | Backend only, idempotent, admin-initiated |
| Role & permission checks | Backend, on every endpoint |
| Audit trail | Backend, append-only, written on every admin mutation |
| Presentation, filters, workflows | Admin app |

---

## 3. Decision records

### ADR-001 — Standalone admin app (not embedded) — **Accepted** 2026-09-09

**Decision:** Build the admin panel as a third deployable app talking to the same backend.

**Rationale:** the admin surface moves money (refunds, payouts, commission rates) and holds regulated data (KYC documents, bank details). Shipping that surface inside consumer bundles is unacceptable exposure; a separate deploy also decouples daily ops-tool iteration from customer release trains, and enables per-site Netlify access controls, CSP, and optional IP allowlisting.

**Consequences:** one more deploy to monitor; UI/API client duplication mitigated via shared packages / generated clients (see §8).

### ADR-002 — React + shadcn/ui + Tailwind + TanStack (not Flutter web) — **Accepted** 2026-09-09

**Decision:** The admin app is a React SPA (Vite) with shadcn/ui components, Tailwind CSS, TanStack Router, TanStack Query, and TanStack Table.

**Rationale (summary — full comparison in the conversation log):**

| Dimension | React + shadcn + TanStack | Flutter web |
|---|---|---|
| Data-dense tables | TanStack Table: headless, virtualized, filterable | No mature equivalent; hand-rolled grids |
| Server state | TanStack Query: caching, invalidation, optimistic updates | Hand-rolled state + sync |
| Forms/validation | react-hook-form + zod schemas | Built-in forms; weaker schema ecosystem |
| Admin templates | tailwind-admin and a large ecosystem | Sparse, mostly mobile-first |
| Accessibility | Radix-based (shadcn): WAI-ARIA, keyboard nav | CanvasKit a11y & text selection historically weak |
| Web-native ergonomics | Multi-tab, find-in-page, copy/paste, deep links | Canvas-rendered: selection/find broken |
| Bundle | ~200–500 KB code-split | 1.5–3 MB CanvasKit/wasm initial load |
| Consistency w/ clients | Token port (§4) | Perfect Material 3 fidelity |
| Team | New stack (CRUD-level React only) | Existing skillset |

The decisive factors are the admin workload profile (dense tables, complex forms, optimistic money operations) and web-native ergonomics for staff using the tool all day. Flutter web wins on visual fidelity with the mobile clients, but an ops console trades brand spectacle for information density — the token port in §4 delivers the brand. **Recorded consequence:** data models are defined twice (Dart in clients, TypeScript here); the backend's OpenAPI schema is the single source of truth and the TS client is generated from it (§8). Flutter web would only be preferred by a Flutter-only team for whom React training cost exceeds table/form development savings — not the case here.

### ADR-003 — Hosting: Netlify site #3, SPA mode — **Accepted** 2026-09-09

**Decision:** Deploy as a third Netlify site alongside the existing two. SPA redirects, per-site security headers (CSP, frame-deny), optional edge IP allowlist, 2FA mandatory at login. No SSR needed — this is an authenticated internal tool.

---

## 4. Design system

### 4.1 Shell (emulating tailwind-admin)

One shell, many pages — tailwind-admin's demos are theme skins of the same layout, and that pattern carries:

- **Sidebar** — grouped nav: Overview · Orders · Disputes · Vendors · Listings · Payouts · Marketing · Analytics · Audit Log · Settings
- **Topbar** — global search (order ID, vendor, customer), notifications, admin profile/role badge
- **Content area** — widget-card grid on the dashboard; data tables + detail drawers on ops pages
- **Light/dark themes** — toggle persisted per admin; both palettes ported below

### 4.2 Color tokens — Flutter → CSS port

The two client apps are Flutter (Material 3); their palettes live in their `ColorScheme`s. The admin port maps them to shadcn-style CSS variables (Tailwind-Admin-compatible):

| Flutter source of truth | Admin CSS var | Used for |
|---|---|---|
| `colorScheme.primary` | `--primary` | Brand actions, active nav, primary buttons |
| `colorScheme.primaryContainer` | `--primary-soft` | Card accents, selected rows, badges |
| `colorScheme.secondary` | `--secondary` | Vendor-side highlights (KYC, payouts) |
| `colorScheme.tertiary` | `--accent` | Buyer-side highlights (orders, disputes) |
| `colorScheme.error` | `--destructive` | Bans, rejections, spoilage flags, refund actions |
| dark `colorScheme.*` | dark-mode token set | Dark theme |
| `colorScheme.surface` / `background` | `--card` / `--background` | Cards, page background |

> **Note:** exact hex values are extracted from the theme files of each client repo (`ColorScheme.fromSeed` seed colors or explicit schemes) when implementation starts. This section defines the mechanism and mapping; the palette values are an implementation-time input. Success criterion: put the admin panel and either client side by side and the brand should read as the same company.

### 4.3 Component inventory

- **Data table** — TanStack Table: column filters, sorting, saved views, row virtualization, bulk actions
- **Stat cards** — GMV today, open disputes, orders breaching SLA, pending approvals, payouts awaiting sign-off
- **Detail drawer/page** — order timeline, vendor profile with performance meters, dispute thread
- **Forms & dialogs** — shadcn forms + zod: refund issuance (amount, wallet credit, reason), KYC verdict, listing approval, promotion scheduler
- **State machines as UI** — order/dispute/payout lifecycle rendered as a timeline with the acting admin stamped on each hop
- **Charts** — GMV trend, take rate, cancellation/late-shipment/spoilage rates, vendor leaderboard

---

## 5. Data model

Backend-owned entities; the admin app renders and mutates them through the API. State machines shown inline.

```
AdminUser      { id, name, email, role, mfa_enrolled, status: ACTIVE|DISABLED }
Role           SUPER_ADMIN | OPS | FINANCE | SUPPORT

Order          { id, customer_id, vendor_id, items[], totals, commission_amount,
                 status: PLACED → ACCEPTED → PACKED → SHIPPED → DELIVERED
                              ↘ CANCELLED ↘ REFUNDED,
                 admin_overrides[] { admin_id, from, to, reason, at },
                 assigned_logistics { provider, tracking_ref, at }? }

Dispute        { id, order_id, opened_by, category: SPOILAGE|DAMAGE|WRONG_ITEM|NOT_DELIVERED|OTHER,
                 status: OPEN → UNDER_REVIEW → RESOLVED_{REFUND|CREDIT|PARTIAL_RECON} | REJECTED → CLOSED,
                 resolution { type: REFUND|WALLET_CREDIT|PARTIAL, amount, admin_id, notes } }

Vendor         { id, business_name, owner, status: PENDING_KYC → KYC_REVIEW → APPROVED
                                   → SUSPENDED | BANNED (reversible to APPROVED),
                 performance { cancellation_rate, late_shipment_rate, spoilage_complaints, rating },
                 warning_history[] }

KYCDocument    { vendor_id, type: FARM_REGISTRATION|LAND_DEED|ORGANIC_CERT|BANK_DETAILS,
                 file_url, status: PENDING → VERIFIED | REJECTED, reviewed_by, notes }

ProductListing { id, vendor_id, name, price_per_kg, images[], status:
                 PENDING_APPROVAL → APPROVED | REJECTED(reason), reviewed_by, published_at }

Payout         { id, vendor_id, period, gross, commission, net,
                 status: CALCULATED → PENDING_APPROVAL → APPROVED → PAID | FAILED,
                 approved_by, paid_at }
CommissionRule { name, rate, scope: GLOBAL|CATEGORY|VENDOR, effective_from }

Promotion      { id, code, type: PERCENT|FIXED|FREE_SHIPPING, value,
                 scope: GLOBAL|CATEGORY|VENDOR, starts_at, ends_at, usage_limit, status: DRAFT|SCHEDULED|LIVE|ENDED }

Review         { id, order_id, vendor_id, rating, body,
                 status: PUBLISHED → FLAGGED → REMOVED (restore → PUBLISHED), moderated_by, reason }

Notification   { audience: BUYERS|VENDORS|SEGMENT, title, body, scheduled_at, status }

AuditLog       { id, actor_admin_id, action, entity_type, entity_id,
                 before, after, reason, ip, at }   // append-only, immutable

SlaTimer       { order_id, type: UNSHIPPED|UNANSWERED_DISPUTE, threshold, breached_at, escalated }
```

**Invariants**
- Every state transition on money or status records `admin_id` + `reason` → AuditLog.
- Refunds and payouts are idempotent (client supplies idempotency keys).
- AuditLog has no delete/update path, in code or in the admin UI.

---

## 6. API surface (admin scope)

All endpoints under `/admin/v1/*`, requiring an admin JWT with a role claim; permissions checked server-side per role.

| Group | Representative endpoints |
|---|---|
| Auth | `POST /auth/login` (SSO) · `POST /auth/mfa/verify` · `POST /auth/mfa/enroll` |
| Orders | `GET /orders?status&sla=breached&vendor&date` · `GET /orders/:id` · `POST /orders/:id/status-override` · `POST /orders/:id/assign-logistics` |
| Disputes | `GET /disputes?status=open` · `GET /disputes/:id` · `POST /disputes/:id/resolve` (refund / credit / partial) · `POST /disputes/:id/comments` |
| Vendors | `GET /vendors?performance=poor` · `GET /vendors/:id` · `POST /vendors/:id/kyc-review` · `POST /vendors/:id/suspend` · `POST /vendors/:id/reinstate` · `POST /vendors/:id/ban` |
| Listings | `GET /listings?status=pending` · `POST /listings/:id/approve` · `POST /listings/:id/reject` |
| Payouts | `GET /payouts?period` · `POST /payouts/calculate` · `POST /payouts/:id/approve` · `GET /payouts/:id/export` |
| Commissions | `GET/POST /commission-rules` |
| Marketing | `GET/POST /promotions` · `POST /promotions/:id/schedule` · `POST /notifications` |
| Reviews | `GET /reviews?status=flagged` · `POST /reviews/:id/remove` · `POST /reviews/:id/restore` |
| Analytics | `GET /analytics/gmv` · `GET /analytics/take-rate` · `GET /analytics/vendor-leaderboard` · `GET /analytics/spoilage` |
| Audit | `GET /audit?actor&entity&date` (read-only) |
| Impersonation | `POST /impersonate/user` · `POST /impersonate/vendor` (SUPER_ADMIN only, auto-audited, time-boxed) |

**Cross-cutting rules:** every mutating call requires a `reason` and is audit-logged · idempotency keys on money operations · cursor pagination on all lists · server-side authorization on every route (client checks are UX only).

---

## 7. Phased roadmap

**Phase 1 — Fire-fighting (day-1 operations)**
Order oversight (list, detail, status override, 3PL assignment) · disputes & refunds/wallet credits · vendor list with performance flags · audit log · RBAC (4 roles) · auth with mandatory 2FA.
*Exit criteria: an ops agent can rescue a stuck order, refund a spoiled delivery, and suspend a bad vendor — all fully audit-trailed.*

**Phase 2 — Quality gates**
KYC review workflow · listing/price approval queue · payout batches with commission rules · SLA timers with escalation flags.
*Exit criteria: no vendor sells without passing KYC; no listing publishes without approval; payouts run as an approved batch.*

**Phase 3 — Growth & automation**
Promotions/discount codes & seasonal scheduling · buyer notifications · analytics dashboards (GMV, take rate, spoilage) · user/vendor impersonation for support · automation rules (auto-escalate disputes, auto-flag vendors breaching thresholds).

---

## 8. Repository layout

```
growbox-admin/            ← this repo
├─ ARCHITECTURE.md
├─ apps/
│  └─ admin/              React SPA: Vite + TanStack Router/Query/Table, shadcn/ui, Tailwind
├─ packages/
│  ├─ api-client/         TypeScript client GENERATED from the backend OpenAPI schema (source of truth)
│  └─ ui/                 GrowBox-branded primitives (tokens, themed shadcn wrappers) — extracted when a second consumer exists
```

Single source of truth for shapes = backend OpenAPI schema (ADR-002 consequence). The two Flutter clients are separate repos; consolidation into one monorepo is a future, optional migration — nothing here blocks it.

---

## 9. Security posture

- **Auth:** SSO login + mandatory 2FA for every admin; sessions short-lived; no shared accounts.
- **RBAC:** SUPER_ADMIN / OPS / FINANCE / SUPPORT — permission matrix enforced server-side; client hides what a role can't do (UX, never the boundary).
- **Audit:** append-only log for every mutation, with actor, reason, before/after, IP.
- **Edge:** per-site Netlify access controls; optional IP allowlist; strict CSP and frame-deny headers on the admin site only.
- **Secrets:** no admin credentials or secrets in the SPA bundle; all privileged operations via authenticated API calls.
- **Impersonation:** SUPER_ADMIN-only, time-boxed, banner-visible, auto-audited.

---

## 10. Open questions

1. **Palette extraction** — pull the exact `ColorScheme` definitions from both client repos to generate §4.2 token values.
2. **Backend surface discovery** — inventory what the two client apps actually call today (auth scheme, order endpoints, wallet/refund primitives) to size the admin API gap.
3. **SSO provider** — self-hosted (e.g., Keycloak) vs managed (e.g., WorkOS/Auth0) for the admin identity domain.
4. **3PL integration** — which providers and whether assignment is manual tracking-entry or API-driven.
