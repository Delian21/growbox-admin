/**
 * Sidebar navigation config (ARCHITECTURE.md §4.1), shared by AppShell and
 * the ⌘K command menu. Each item carries its glyph + required permission;
 * client-side RBAC filtering is UX only (§2 — the API enforces for real).
 */
import {
  BarChartIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  WalletIcon,
  type IconType,
} from "@/components/icons";
import type { AdminOperation } from "@growbox/api-client";

export interface NavItem {
  label: string;
  to: string;
  Icon: IconType;
  /** Admin permission required to see the item (omitted = everyone). */
  op?: AdminOperation;
  /** Keywords the command menu matches beyond the label. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", to: "/", Icon: LayoutDashboardIcon, keywords: "home overview stats" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Orders", to: "/orders", Icon: ShoppingCartIcon, keywords: "fulfilment delivery 3pl sla" },
      { label: "Disputes", to: "/disputes", Icon: MessageSquareIcon, keywords: "refunds mediation chargeback" },
    ],
  },
  {
    label: "Supply",
    items: [
      { label: "Vendors", to: "/vendors", Icon: StoreIcon, keywords: "sellers kyc performance suspend" },
      { label: "Listings", to: "/listings", Icon: PackageIcon, keywords: "products approval catalog" },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Payouts",
        to: "/payouts",
        Icon: WalletIcon,
        op: "payouts:read",
        keywords: "commissions settlements money batches",
      },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        label: "Marketing",
        to: "/marketing",
        Icon: MegaphoneIcon,
        op: "promotions:read",
        keywords: "promotions coupons broadcasts notifications",
      },
      {
        label: "Analytics",
        to: "/analytics",
        Icon: BarChartIcon,
        op: "analytics:read",
        keywords: "reports gmv trends take rate leaderboard",
      },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Audit Log", to: "/audit", Icon: ScrollTextIcon, op: "audit:read", keywords: "history trail compliance" },
      { label: "Settings", to: "/settings", Icon: SettingsIcon, keywords: "configuration preferences" },
    ],
  },
];
