# Seed fixtures

Deterministic demo dataset backing the mock `/admin/v1` layer. All shapes are
typed against the generated OpenAPI schema (`components["schemas"][...]`) from
`openapi/admin-v1.yaml` — if the contract changes, `pnpm --filter
@growbox/api-client generate` + `tsc` will flag drift here.

## Coverage

| Area | File | Covers |
|---|---|---|
| Admins | `admins.ts` | One per role: SUPER_ADMIN, OPS, FINANCE, SUPPORT |
| Vendors | `vendors.ts` | Every §5 status: PENDING_KYC, KYC_REVIEW, APPROVED ×3, SUSPENDED, BANNED · poor performers for `?performance=poor` · warning history · 3PL roster |
| Orders | `orders.ts` | Every §5 status: PLACED, ACCEPTED (SLA **breached** + escalated), PACKED, SHIPPED (3PL assigned), DELIVERED (3PL assigned), CANCELLED (override in history), REFUNDED (override in history) · healthy + problem vendors |
| Disputes | `disputes.ts` | Every category: SPOILAGE ×2, DAMAGE ×2, WRONG_ITEM, NOT_DELIVERED ×2, OTHER · every status branch: OPEN ×2 (one **SLA-breached**), UNDER_REVIEW, RESOLVED_REFUND, RESOLVED_CREDIT, RESOLVED_PARTIAL_RECON, REJECTED, CLOSED · vendor-vs-customer side · resolutions with amounts ≤ disputed |
| Audit | `audit.ts` | Append-only trail matching the story: overrides, resolutions, warnings, suspend/ban, comments · actor + reason + before/after + IP |

## Story coherence

Fixtures reference each other deliberately — follow along when testing:

- `ord_...002` (Naivasha Greens) is **stuck ACCEPTED with a breached,
  escalated UNSHIPPED SLA** and an open NOT_DELIVERED dispute (`dsp_...D1`) —
  the day-1 fire.
- `ven_...A2` (Naivasha Greens) has a prior late-shipment warning that explains
  the breach; `ven_...A5` (Molo Potato) is suspended with two warnings, an
  overridden CANCELLED order and a wallet-credit resolution — the suspension
  story.
- `ord_...007` / `dsp_...D4` show the full REFUNDED end-to-end path with
  matching audit entries.

## Demo logins (mock only)

| Email | Role | Try it for |
|---|---|---|
| wanjiru@growbox.example | SUPER_ADMIN | everything |
| daniel@growbox.example | OPS | orders, disputes, vendor actions |
| amina@growbox.example | FINANCE | payouts (phase 2), read elsewhere |
| peter@growbox.example | SUPPORT | read + dispute comments only |

MFA accepts any 6-digit code in the mock. Passwords are not checked in demo
mode — any value works.

## Reset

Handlers must deep-copy (`resetSeed()`) rather than mutate these arrays, so a
page reload restores the pristine dataset.
