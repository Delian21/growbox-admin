/** Local persistence for the mock admin session (token + admin profile). */

import type { components } from "@growbox/api-client";

export type AdminUser = components["schemas"]["AdminUser"];

export interface AdminSession {
  token: string;
  admin: AdminUser;
}

const STORAGE_KEY = "growbox-admin-session";

export function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    return parsed.token && parsed.admin?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
