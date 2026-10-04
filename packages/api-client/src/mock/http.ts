/**
 * HTTP plumbing for the mock handlers: uniform error shape, bearer-token
 * verification, RBAC + reason enforcement, latency/error simulation, and
 * cursor pagination. The §6 cross-cutting rules live here so no handler can
 * forget them.
 */

import { HttpResponse, delay } from "msw";
import type { components } from "../generated/schema";
import { can, type AdminOperation, type Role } from "../policy";
import { SESSION_TTL_MS, store } from "./store";

type AdminUser = components["schemas"]["AdminUser"];
type ErrorSchema = components["schemas"]["Error"];

const LATENCY_BASE_MS = 350;
const LATENCY_JITTER_MS = 250;
const ERROR_RATE = 0.04; // ~4% of GETs fail with 500 to exercise error states

export class MockHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: NonNullable<ErrorSchema["error"]>["code"],
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorResponse(err: MockHttpError) {
  const body: ErrorSchema = {
    error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
  };
  return HttpResponse.json(body, { status: err.status });
}

/** Latency + simulated transient failures. Mutations skip the 500s (demo stays usable). */
export async function simulate(request: Request): Promise<void> {
  await delay(LATENCY_BASE_MS + Math.random() * LATENCY_JITTER_MS);
  const isRead = request.method === "GET";
  if (isRead && Math.random() < ERROR_RATE) {
    throw new MockHttpError(500, "INTERNAL", "Simulated transient failure (demo error state)");
  }
}

interface AuthContext {
  admin: AdminUser;
  token: string;
}

/** Verifies the mock bearer token and returns the acting admin. */
export function requireAuth(request: Request): AuthContext {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = store.sessions.get(token);
  if (!session) {
    throw new MockHttpError(401, "UNAUTHORIZED", "Missing or invalid bearer token");
  }
  if (Date.now() > session.expiresAt) {
    store.sessions.delete(token);      throw new MockHttpError(401, "UNAUTHORIZED", "Session expired. Sign in again");
  }
  return { admin: session.admin, token };
}

/** Auth + RBAC in one guard (server-side is the real boundary; this mirrors it). */
export function requirePermission(request: Request, op: AdminOperation): AuthContext {
  const ctx = requireAuth(request);
  if (!can(ctx.admin.role as Role, op)) {
    throw new MockHttpError(
      403,
      "FORBIDDEN",
      `Role ${ctx.admin.role} lacks permission for ${op}`,
    );
  }
  return ctx;
}

/** Every mutation must carry a reason (§6); returns it for the audit entry. */
export function requireReason(body: unknown): string {
  const reason = (body as { reason?: unknown } | null)?.reason;
  if (typeof reason !== "string" || reason.trim().length < 3) {
    throw new MockHttpError(400, "BAD_REQUEST", "A reason of at least 3 characters is required");
  }
  return reason.trim();
}

export function parsePagination(url: URL, DEFAULT_LIMIT = 25): { limit: number; cursor: number } {
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? "25", 10) || DEFAULT_LIMIT, 1), 100);
  const cursorRaw = url.searchParams.get("cursor");
  let cursor = 0;
  if (cursorRaw) {
    try {
      const decoded = JSON.parse(atob(cursorRaw)) as { o?: number };
      if (typeof decoded.o === "number") cursor = decoded.o;
    } catch {
      throw new MockHttpError(400, "BAD_REQUEST", "Malformed cursor");
    }
  }
  return { limit, cursor };
}

/** Opaque cursor encoding just an offset — enough for the demo. */
export function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ o: offset }));
}

export function paginated<T>(data: T[], cursor: number, limit: number, extra?: Record<string, unknown>) {
  const page = data.slice(cursor, cursor + limit);
  const next = cursor + limit;
  return {
    data: page,
    next_cursor: next < data.length ? encodeCursor(next) : null,
    prev_cursor: cursor > 0 ? encodeCursor(Math.max(cursor - limit, 0)) : null,
    total: data.length,
    ...extra,
  };
}

/** Append-only audit write (§5 invariant) — used by every mutating handler. */
export function audit(entry: {
  actor_admin_id: string;
  action: string;
  entity_type: "ORDER" | "DISPUTE" | "VENDOR";
  entity_id: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string;
}): void {
  store.audit.unshift({
    id: `aud_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
    ...entry,
    at: new Date().toISOString(),
  });
}

export { SESSION_TTL_MS };
