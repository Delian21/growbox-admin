import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { can } from "@growbox/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { CommandMenu } from "@/shell/CommandMenu";
import { NAV_GROUPS } from "@/shell/nav";
import { LogOutIcon, MenuIcon, SearchIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  /** Reactive route path — window.location is outer-scope and not re-rendered. */
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Exit-animation gate: true while the drawer plays its slide-out. */
  const [drawerClosing, setDrawerClosing] = useState(false);

  /** Close through the exit animation; unmount happens in onExited below. */
  const closeMobileNav = () => {
    if (!mobileNavOpen || drawerClosing) return;
    setDrawerClosing(true);
  };
  const DRAWER_EXIT_MS = 220;

  // Unmount after the exit animation completes (matches drawer-slide-out).
  useEffect(() => {
    if (!drawerClosing) return;
    const t = setTimeout(() => {
      setDrawerClosing(false);
      setMobileNavOpen(false);
    }, DRAWER_EXIT_MS);
    return () => clearTimeout(t);
  }, [drawerClosing]);

  // Two-letter initials for the avatar chip.
  const initials = (admin?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    return () => setMobileNavOpen(false);
  }, [pathname]);

  /** Fixed shell: only <main> scrolls, so SPA navigations must reset it
   * (the browser's default scroll-to-top applies to the window, not here). */
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // Drawer parity with the command menu: Escape closes, body scroll locks
  // while open (prevents background scroll-through on touch and wheel).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  const handleSignOut = () => {
    signOut();
    void navigate({ to: "/login" });
  };

  /** Sidebar body shared by the desktop rail and the mobile drawer: nav +
   * account card footer (identity lives here, not in the top bar). */
  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <nav className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // Client-side RBAC is UX only (§2); the API enforces for real.
                if (item.op && admin && !can(admin.role, item.op)) return null;
                const Icon = item.Icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === "/" }}
                      onClick={onNavigate}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeProps={{
                        className:
                          "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_2px_0_0_0_var(--sidebar-primary)]",
                      }}
                    >
                      <Icon size={15} className="shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="min-h-0 shrink-0 border-t border-sidebar-border p-3">
        {admin ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Link
              to="/profile"
              onClick={onNavigate}
              aria-label={`Profile · ${admin.name}`}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-sidebar-accent"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-primary-soft"
                title={`${admin.name} · ${admin.role}`}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">{admin.name}</p>
                <p className="truncate text-xs leading-tight text-muted-foreground">{admin.role}</p>
              </div>
            </Link>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                onNavigate?.();
                handleSignOut();
              }}
            >
              <LogOutIcon size={15} />
            </button>
          </div>
        ) : (
          <p className="px-2 text-[11px] leading-4 text-muted-foreground">
            GrowBox operations console · demo data
          </p>
        )}
      </div>
    </>
  );


  return (
    // Fixed viewport shell: chrome (rail + header) is pinned; only <main>
    // scrolls. h-dvh keeps mobile browser chrome from eating the layout.
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm">
            G
          </span>
          <span className="text-sm font-semibold tracking-tight">GrowBox Admin</span>
        </div>
        {sidebarContent()}
      </aside>

      {/* Mobile drawer (below md) — stays mounted through the exit animation */}
      {!mobileNavOpen ? null : (
        <div
          className={cn("fixed inset-0 z-40 md:hidden", drawerClosing && "closing")}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          aria-hidden={drawerClosing || undefined}
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="overlay-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={closeMobileNav}
          />
          <aside className="drawer-panel relative flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground">
                  G
                </span>
                <span className="text-sm font-semibold tracking-tight">GrowBox Admin</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={closeMobileNav}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <XIcon size={16} />
              </button>
            </div>
            {sidebarContent(closeMobileNav)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation menu"
              className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Open command menu"
            >
              <SearchIcon size={14} />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Light text on 15% amber over dark surfaces; dark text in light mode —
                theme-conditional because the tint always comes from the warning token. */}
            <span className="hidden rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium ring-1 ring-warning/30 text-warning-foreground dark:text-amber-200 sm:inline">
              demo data
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <CommandMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
