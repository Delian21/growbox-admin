/**
 * Profile screen (reached from the header avatar / mobile-drawer account card):
 * admin identity, MFA status, and the exact RBAC permission matrix for the
 * acting role — straight from policy.ts, which is the same source the API
 * enforces (client view is UX only, §2/§9).
 */

import { Link } from "@tanstack/react-router";
import { ADMIN_BY_ID, RBAC_MATRIX, type AdminOperation, type Role } from "@growbox/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Term } from "@/components/Term";
import { ShieldCheckIcon } from "@/components/icons";

/** Human labels for every operation in the RBAC matrix. */
const OP_LABEL: Record<AdminOperation, string> = {
  "orders:read": "View orders",
  "orders:override-status": "Override order status",
  "orders:assign-logistics": "Assign courier to orders",
  "disputes:read": "View disputes",
  "disputes:comment": "Comment on disputes",
  "disputes:start-review": "Move disputes into review",
  "disputes:resolve": "Resolve disputes (refund / credit / partial)",
  "vendors:read": "View vendors",
  "vendors:kyc-review": "Run identity (KYC) review",
  "vendors:warn": "Issue vendor warnings",
  "vendors:suspend": "Suspend vendors",
  "vendors:reinstate": "Reinstate vendors",
  "vendors:ban": "Ban vendors",
  "listings:read": "View listings",
  "listings:approve": "Approve listings",
  "listings:reject": "Reject listings",
  "payouts:read": "View payout batches",
  "payouts:calculate": "Calculate payout batches",
  "payouts:submit": "Submit payout batches for approval",
  "payouts:approve": "Approve payout batches",
  "payouts:mark-paid": "Mark payout batches paid",
  "payouts:retry": "Retry failed payout batches",
  "promotions:read": "View discount campaigns",
  "promotions:create": "Create discount codes",
  "promotions:schedule": "Schedule discount campaigns",
  "promotions:end": "End discount campaigns early",
  "notifications:read": "View broadcasts",
  "notifications:create": "Compose broadcasts",
  "notifications:send": "Send broadcasts",
  "analytics:read": "View analytics",
  "audit:read": "Read the audit trail",
};

/** Ordering used for the permissions list. */
const ALL_OPS = Object.keys(OP_LABEL) as AdminOperation[];

export function ProfileRoute() {
  const { admin } = useAuth();
  const record = admin ? ADMIN_BY_ID.get(admin.id) : undefined;
  const role: Role | null = admin?.role ?? null;

  const allowed: AdminOperation[] =
    role === "SUPER_ADMIN" ? ALL_OPS : role ? (RBAC_MATRIX[role] ?? []) : [];

  const initials = (admin?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Profile" description="Your account, security status, and what your role can do." />

      {/* Identity */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground ring-2 ring-primary-soft">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">{admin?.name ?? "–"}</p>
            <p className="text-sm text-muted-foreground">
              {admin?.role} · {admin?.email}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Two-factor authentication</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <span
                className={`size-2 rounded-full ${record?.mfa_enrolled ? "bg-success" : "bg-destructive"}`}
                aria-hidden="true"
              />
              {record?.mfa_enrolled ? "Enrolled" : "Not enrolled"}
            </dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Account status</dt>
            <dd className="mt-1 text-sm font-medium">{record?.status ?? "–"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Admin ID</dt>
            <dd className="mt-1 truncate font-mono text-xs" title={admin?.id}>
              {admin?.id ?? "–"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheckIcon size={14} className="mt-0.5 shrink-0" />
          <span>
            Two-factor authentication is mandatory for every admin (§9). Sessions are short-lived; any 401
            returns you to sign-in. All authorisation is enforced server-side: this page describes your
            role, it does not grant it.
          </span>
        </p>
      </section>

      {/* Permission matrix */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Role permissions</h2>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-foreground">
            {role ?? "–"} · {allowed.length} of {ALL_OPS.length} operations
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          What your role may do. Sections outside your scope are hidden from the sidebar and rejected by the
          API with 403.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_OPS.map((op) => {
            const ok = allowed.includes(op);
            return (
              <li
                key={op}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-sm ${
                  ok ? "border-border bg-card" : "border-border/50 bg-muted/30 text-muted-foreground"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground/60"
                  }`}
                  aria-hidden="true"
                >
                  {ok ? "✓" : "–"}
                </span>
                <span className={ok ? "font-medium" : ""}>{OP_LABEL[op]}</span>
                <span className="sr-only">{ok ? "allowed" : "not allowed"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Audit visibility note */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Accountability</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Every mutation you perform is written to the <Term k="audit">audit trail</Term> with your admin ID,
          the before/after state, and a mandatory reason. The trail is append-only: even{" "}
          {role === "SUPER_ADMIN" ? "SUPER_ADMINs" : "administrators"} cannot edit or delete it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link to="/audit" className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-muted">
            View audit log →
          </Link>
          <Link to="/settings" className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-muted">
            Preferences & glossary →
          </Link>
        </div>
      </section>
    </div>
  );
}
