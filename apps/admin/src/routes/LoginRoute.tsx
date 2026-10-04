/**
 * Login (step 1: email + password) → MFA verify (step 2: any 6-digit code in
 * the mock, see seed README). On success, continues to ?redirect or "/".
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, errorMessage } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineError } from "@/components/StateBlock";

const DEMO_ACCOUNTS = [
  { email: "ngozi@growbox.example", role: "SUPER_ADMIN" },
  { email: "chinedu@growbox.example", role: "OPS" },
  { email: "aisha@growbox.example", role: "FINANCE" },
  { email: "emeka@growbox.example", role: "SUPPORT" },
] as const;

export function LoginRoute() {
  const { requestChallenge, verifyMfa, admin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (admin) {
    return (
      <CenteredCard>
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-semibold">
          {admin.name} <span className="text-muted-foreground">({admin.role})</span>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Continue to the <a className="text-primary underline" href="/">dashboard</a>.
        </p>
      </CenteredCard>
    );
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestChallenge(email, password);
      setStep("mfa");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyMfa(code);
      // SPA navigation, NOT window.location.assign: the mock store is
      // in-memory, so a full reload would wipe the session we just created
      // and bounce the admin straight back to /login (401 loop).
      const redirect = new URLSearchParams(window.location.search).get("redirect");
      await navigate({ to: redirect && redirect.startsWith("/") ? redirect : "/" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            G
          </span>
          <span className="font-semibold">GrowBox Admin</span>
        </div>
        <ThemeToggle />
      </div>

      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@growbox.example"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="any value works in demo"
            />
          </Field>
          {error && <InlineError message={error} />}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitMfa} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is mandatory for admins. Enter any 6-digit code (demo mode).
          </p>
          <Field label="Authenticator code" htmlFor="code">
            <input
              id="code"
              inputMode="numeric"
              pattern="\d{6}"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputCls} tracking-[0.4em]`}
              placeholder="000000"
            />
          </Field>
          {error && <InlineError message={error} />}
          <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
            {busy ? "Verifying…" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline"
            onClick={() => {
              setStep("credentials");
              setError(null);
            }}
          >
            Back to sign-in
          </button>
        </form>
      )}

      <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo accounts (any password, any 6-digit code):</p>
        <ul className="mt-1 space-y-0.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("demo");
                  setStep("credentials");
                }}
              >
                {a.email}
              </button>{" "}
              · {a.role}
            </li>
          ))}
        </ul>
      </div>
    </CenteredCard>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
