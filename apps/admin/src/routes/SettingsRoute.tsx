/**
 * Settings screen (replaces the Phase 1 placeholder): profile card, appearance
 * (theme preference), language note, and demo-dataset info. Preferences other
 * than theme are display-only until a persistence API exists (§10 open q.).
 */

import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { useTheme } from "@/theme/ThemeProvider";
import { MoonIcon, SunIcon } from "@/components/icons";
import { GLOSSARY } from "@/components/Term";
import { ADMIN_BY_ID } from "@growbox/api-client";
import type { AdminOperation } from "@growbox/api-client";

/** Role → permitted operations, mirroring policy.ts for the permissions card. */
const ROLE_SUMMARY: Record<string, string> = {
  SUPER_ADMIN: "Full access to every section and action, by definition.",
  OPS: "Orders, disputes (incl. money resolutions), and vendor management.",
  FINANCE: "Read access to orders, disputes, vendors, plus the audit trail.",
  SUPPORT: "Read orders, read and comment on disputes, read vendors.",
};

export function SettingsRoute() {
  const { admin } = useAuth();
  const { theme, setTheme } = useTheme();

  const record = admin ? ADMIN_BY_ID.get(admin.id) : undefined;
  const permissions: readonly AdminOperation[] = [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, appearance, and workspace preferences."
      />

      {/* ------------------------------------------------------------ profile */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground ring-2 ring-primary-soft">
            {admin?.name
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">{admin?.name ?? "–"}</p>
            <p className="text-sm text-muted-foreground">
              {admin?.role} · {admin?.email}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Two-factor authentication</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <span
                className={`size-2 rounded-full ${record?.mfa_enrolled ? "bg-success" : "bg-warning"}`}
                aria-hidden="true"
              />
              {record?.mfa_enrolled ? "Enrolled (mandatory for all admins)" : "Not enrolled"}
            </dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Account status</dt>
            <dd className="mt-1 text-sm font-medium">{record?.status ?? "ACTIVE"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Admin ID</dt>
            <dd className="mt-1 font-mono text-xs">{admin?.id ?? "–"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">Role scope</dt>
            <dd className="mt-1 text-sm">{ROLE_SUMMARY[admin?.role ?? ""] ?? "–"}</dd>
          </div>
        </dl>
      </section>

      {/* --------------------------------------------------------- appearance */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme is saved per admin and applied before first paint (no flash on reload).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              { key: "light", label: "Light", desc: "Warm paper white, high ambient light", Icon: SunIcon },
              { key: "dark", label: "Dark", desc: "Neutral charcoal, low-light operations", Icon: MoonIcon },
            ] as const
          ).map(({ key, label, desc, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={theme === key}
              onClick={() => setTheme(key)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                theme === key
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                  theme === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon size={18} />
              </span>
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
              {theme === key && (
                <span className="ml-auto text-xs font-medium text-primary" aria-hidden="true">
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- language */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Language & region</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <dt>
              <p className="font-medium">Display language</p>
              <p className="text-xs text-muted-foreground">Interface copy and glossary</p>
            </dt>
            <dd className="text-muted-foreground">English (Nigeria)</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <dt>
              <p className="font-medium">Currency display</p>
              <p className="text-xs text-muted-foreground">
                Deployment setting: <code className="text-xs">VITE_CURRENCY_CODE</code> /{" "}
                <code className="text-xs">VITE_LOCALE</code>
              </p>
            </dt>
            <dd className="text-muted-foreground">
              {new Intl.NumberFormat(undefined, { style: "currency", currency: "NGN" })
                .resolvedOptions().locale === "en-NG"
                ? "₦ NGN"
                : "NGN"}{" "}
              · en-NG
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <dt>
              <p className="font-medium">Date & time format</p>
              <p className="text-xs text-muted-foreground">Follows the en-NG locale</p>
            </dt>
            <dd className="text-muted-foreground">
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}
            </dd>
          </div>
        </dl>
      </section>

      {/* -------------------------------------------------------- glossary */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Glossary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Plain-language definitions of the jargon used across the console. The same explanations appear
          inline wherever a dotted-underlined term appears.
        </p>
        <dl className="mt-4 space-y-3">
          {Object.entries(GLOSSARY).map(([key, entry]) => (
            <div key={key} className="rounded-lg border border-border p-3">
              <dt className="text-sm font-medium">{entry.term}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------ demo */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">About this workspace</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          This console runs against the in-browser mock API (MSW) with the Nigerian demo dataset: vendors
          such as Oyo Highlands Produce and Jos Plateau Greens, naira amounts stored as kobo integers, and
          seed dates re-based so the newest activity lands "today". A full reset happens on every page
          reload. See the README for the dataset and currency configuration.
        </p>
        {permissions.length > 0 && <p className="mt-2 text-xs">{permissions.length}</p>}
      </section>
    </div>
  );
}
