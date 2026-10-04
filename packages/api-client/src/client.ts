import type { paths } from "./generated/schema";

/**
 * Thin, transport-only client over the /admin/v1 OpenAPI contract.
 * Single fetch layer = the MSW → real-backend swap is config, not code
 * (BACKEND_GAP_ANALYSIS.md §3). Framework caching (TanStack Query) wraps this.
 * Platform-agnostic on purpose: the app injects the base URL (e.g. from
 * VITE_API_BASE_URL); this package never reads build-tool env.
 */

export type Paths = paths;

export interface RequestOptions {
  /** Bearer token for the admin JWT (role claim enforced server-side). */
  token?: string;
  /** Injected in tests / by the mock layer; defaults to fetch. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: { baseUrl?: string; token?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = (opts.baseUrl ?? "").replace(/\/$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async request<Ok>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<Ok> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ?? options.token ? { Authorization: `Bearer ${options.token ?? this.token}` } : {}),
        // Money mutations are idempotent server-side (ARCHITECTURE.md §6).
        ...(body != null && "idempotency_key" in (body as object)
          ? { "Idempotency-Key": String((body as Record<string, unknown>).idempotency_key) }
          : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, text);
    }
    if (res.status === 204) return undefined as Ok;
    return (await res.json()) as Ok;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(`API ${status}: ${bodyText || "(no body)"}`);
    this.name = "ApiError";
  }
}
