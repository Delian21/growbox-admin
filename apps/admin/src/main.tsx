import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import App from "./App";
import { router } from "./router";
import { clearSession } from "./auth/session";
import { ApiError } from "@growbox/api-client";
import "./index.css";

/**
 * Session expiry: mock sessions are short-lived (§9) and the mock store
 * resets on a full reload, so any 401 means the token is dead. Clear and
 * re-authenticate instead of letting every query fail forever.
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
      }
    },
  }),
});

async function enableMocking(): Promise<void> {
  // Dynamic import keeps MSW out of the main bundle; when the real backend
  // lands this whole function becomes a no-op gated on VITE_API_BASE_URL.
  const { worker } = await import("@growbox/api-client/mock");
  await worker.start({
    onUnhandledRequest: "bypass", // let static assets through
  });
}

void enableMocking().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {/* App provides AuthProvider + ThemeProvider around the shell */}
        <App>
          <RouterProvider router={router} />
        </App>
      </QueryClientProvider>
    </StrictMode>,
  );
});
