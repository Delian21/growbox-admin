/**
 * Route tree: /login is public; every other route lives under a pathless
 * authed layout whose beforeLoad gates on the session (UX gate only — the
 * mock still enforces RBAC per request).
 *
 * Navigations inside THIS file use untyped `redirect({ href })` because the
 * router type is being defined here (circularity); components elsewhere get
 * full typed Links via the Register augmentation below.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/shell/AppShell";
import { DashboardRoute } from "@/routes/DashboardRoute";
import { LoginRoute } from "@/routes/LoginRoute";
import { OrdersRoute } from "@/routes/OrdersRoute";
import { DisputesRoute } from "@/routes/DisputesRoute";
import { VendorsRoute } from "@/routes/VendorsRoute";
import { AuditRoute } from "@/routes/AuditRoute";
import { ListingsRoute } from "@/routes/ListingsRoute";
import { PayoutsRoute } from "@/routes/PayoutsRoute";
import { MarketingRoute } from "@/routes/MarketingRoute";
import { AnalyticsRoute } from "@/routes/AnalyticsRoute";
import { SettingsRoute } from "@/routes/SettingsRoute";
import { ProfileRoute } from "@/routes/ProfileRoute";
import { loadSession } from "@/auth/session";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/" className="text-sm text-primary underline">
        Back to dashboard
      </Link>
    </div>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: ({ location }) => {
    if (loadSession()) {
      // TanStack's location.href is relative ("/login?…"); new URL() needs
      // the origin as base or it throws "Invalid URL".
      const target = new URL(location.href, window.location.origin);
      const redirectParam = target.searchParams.get("redirect");
      // SPA navigation — see LoginRoute note about the in-memory mock store.
      throw redirect({ href: redirectParam && redirectParam.startsWith("/") ? redirectParam : "/" });
    }
  },
  component: () => <LoginRoute />,
});

/** Pathless layout: all authenticated screens render inside the shell. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: ({ location }) => {
    if (!loadSession()) {
      const redirectUri = `${location.pathname}${location.searchStr ?? ""}`;
      throw redirect({ href: `/login?redirect=${encodeURIComponent(redirectUri)}` });
    }
  },
  component: () => <AppShell />,
});

const indexRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  component: () => <DashboardRoute />,
});

/** Section with a `/:xxxId` detail route. The detail route renders the same
 * list component — sections use drawers, not separate detail pages (§4.3);
 * the detail path stays for deep links. */
function sectionWithDetail(path: string, component: () => ReactNode, detailParam: string) {
  const list = createRoute({
    getParentRoute: () => authedRoute,
    path,
    component,
  });
  const detail = createRoute({
    getParentRoute: () => authedRoute,
    path: `${path}/$${detailParam}`,
    component,
  });
  return { list, detail };
}

const orders = sectionWithDetail("/orders", () => <OrdersRoute />, "orderId");
const disputes = sectionWithDetail("/disputes", () => <DisputesRoute />, "disputeId");
const vendors = sectionWithDetail("/vendors", () => <VendorsRoute />, "vendorId");
const listings = sectionWithDetail("/listings", () => <ListingsRoute />, "listingId");
const payouts = createRoute({
  getParentRoute: () => authedRoute,
  path: "/payouts",
  component: () => <PayoutsRoute />,
});
const marketing = sectionWithDetail("/marketing", () => <MarketingRoute />, "promotionId");
const analytics = createRoute({
  getParentRoute: () => authedRoute,
  path: "/analytics",
  component: () => <AnalyticsRoute />,
});
const audit = createRoute({
  getParentRoute: () => authedRoute,
  path: "/audit",
  component: () => <AuditRoute />,
});
const settings = createRoute({
  getParentRoute: () => authedRoute,
  path: "/settings",
  component: () => <SettingsRoute />,
});
const profile = createRoute({
  getParentRoute: () => authedRoute,
  path: "/profile",
  component: () => <ProfileRoute />,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    indexRoute,
    orders.list,
    orders.detail,
    disputes.list,
    disputes.detail,
    vendors.list,
    vendors.detail,
    listings.list,
    listings.detail,
    payouts,
    marketing.list,
    marketing.detail,
    analytics,
    audit,
    settings,
    profile,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
