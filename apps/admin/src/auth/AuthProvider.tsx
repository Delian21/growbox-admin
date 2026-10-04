/**
 * Auth state: runs the two-step login (password → mandatory MFA, §9) against
 * /admin/v1/auth and exposes the acting admin. Client-side gating is UX only —
 * the mock handlers enforce RBAC on every request too.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiClient, ApiError, type AdminUser } from "@growbox/api-client";
import { clearSession, loadSession, saveSession, type AdminSession } from "./session";

interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
}

interface VerifyResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  admin: AdminUser;
}

interface AuthContextValue {
  admin: AdminUser | null;
  /** Step 1 of 2. Resolves when the MFA challenge is issued. */
  requestChallenge: (email: string, password: string) => Promise<void>;
  /** Step 2 of 2. Resolves signed-in on success. */
  verifyMfa: (code: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const client = new ApiClient({ baseUrl: "" });

/** Pull the human-readable message out of the mock's uniform error shape. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.bodyText) as { error?: { message?: string } };
      return body.error?.message ?? err.message;
    } catch {
      return err.message;
    }
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => loadSession());
  const [challenge, setChallenge] = useState<string | null>(null);

  const requestChallenge = useCallback(async (email: string, password: string) => {
    const res = await client.request<MfaChallenge>("POST", "/admin/v1/auth/login", { email, password });
    setChallenge(res.mfa_token);
  }, []);

  const verifyMfa = useCallback(
    async (code: string) => {
      if (!challenge) throw new Error("No MFA challenge in progress");
      const res = await client.request<VerifyResponse>("POST", "/admin/v1/auth/mfa/verify", {
        mfa_token: challenge,
        code,
      });
      const next: AdminSession = { token: res.access_token, admin: res.admin };
      saveSession(next);
      setSession(next);
      setChallenge(null);
    },
    [challenge],
  );

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
    setChallenge(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ admin: session?.admin ?? null, requestChallenge, verifyMfa, signOut }),
    [session, requestChallenge, verifyMfa, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
