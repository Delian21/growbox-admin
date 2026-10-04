# GrowBox Admin

Internal operations console for the [GrowBox](https://growbox-app.netlify.app) agricultural marketplace. See [ARCHITECTURE.md](ARCHITECTURE.md) for decisions and [TODO.md](TODO.md) for the build plan.

## Stack

- **Apps:** React 19 + Vite + TypeScript (strict) — [apps/admin](apps/admin)
- **API contract:** hand-written OpenAPI for `/admin/v1` → generated TS client — [packages/api-client](packages/api-client)
- **UI:** Tailwind CSS v4 + shadcn/ui conventions, GrowBox tokens from [design/tokens.css](design/tokens.css)
- **State:** TanStack Router + TanStack Query

## Develop

Requires Node 22+. pnpm is provisioned via corepack (no global install):

```bash
corepack pnpm install
corepack pnpm dev            # apps/admin on http://localhost:5173
```

Other useful commands (run through `corepack pnpm` until shims are enabled):

```bash
corepack pnpm typecheck      # tsc across all workspaces
corepack pnpm lint           # eslint
corepack pnpm build          # all workspaces
corepack pnpm contrast       # WCAG AA gate: badge tones + variance chips (exit 1 on failure)
corepack pnpm --filter @growbox/api-client generate   # regenerate client from openapi/admin-v1.yaml
```

> When the real backend lands (ADR-004), point `VITE_API_BASE_URL` at it and drop the mock layer — no screen rewrites (BACKEND_GAP_ANALYSIS.md §3).

## Demo dataset

The mock API (`packages/api-client/src/mock`, MSW in the browser) ships a self-contained **Nigerian demo dataset** (`packages/api-client/src/seed`):

- **Vendors** — Oyo Highlands Produce, Jos Plateau Greens, Zaria Onion Collective, Benue Yam & Tubers Co., Epe Leafy Farms, Ogbomosho Mango Hub, Niger Delta Fresh Exports (one per vendor lifecycle state).
- **Admins** — Ngozi Okafor (SUPER_ADMIN), Chinedu Eze (OPS), Aisha Bello (FINANCE), Emeka Obi (SUPPORT). Demo login: any listed email, any password, any 6-digit MFA code.
- **Produce** — ugwu, green amaranth, scent leaf, Jos carrots, red onions, avocado (pear).
- **Logistics (3PL)** — Kwik Delivery, GIGL Fresh, FarmExpress NG, ColdHubs Logistics.
- **Currency** — all amounts are integer **kobo** (₦1 = 100 kobo) per the OpenAPI contract; display formatting converts to naira.

The dataset deliberately uses fictional businesses; nothing here represents a real company.

### Seed date re-basing

Seed fixtures carry literal timestamps. At load time, `seed/relativeDates.ts` shifts **every** timestamp by a single offset so the newest event lands at "now" — meaning "Sales today" is never ₦0, the 7-day trend always shows a real week, and breached SLA timers stay urgent. Because the offset is uniform, before/after ordering in the audit trail is preserved. The mock store resets on full page reload, returning everything to the pristine dataset.

### Currency configuration

Currency display is deployment config, not code — see `apps/admin/src/lib/currency.ts` and `.env.example`:

```bash
VITE_CURRENCY_CODE=NGN   # ISO 4217 code (NGN default; KES, GHS, …)
VITE_LOCALE=en-NG        # BCP 47 locale for symbol/grouping (en-NG default)
```

Amounts are stored as integer minor units end-to-end, so swapping market only changes rendering. `apps/admin/src/lib/format.ts` re-exports `money()`; date/time formatting uses `en-NG` throughout.

## Glossary

Domain jargon (GMV, SLA, KYC, wallet credit, idempotency key, …) is defined once in `apps/admin/src/components/Term.tsx` and rendered inline as hover/focus tooltips via the `<Term k="…" />` component, with the full list on the Settings screen.
