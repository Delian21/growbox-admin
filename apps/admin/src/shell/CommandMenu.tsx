/**
 * ⌘K command menu (shadcn/admin pattern): fuzzy-filter over the nav config,
 * Enter/click navigates, Escape closes. Zero dependencies — dialog element +
 * plain state. RBAC filtering mirrors the sidebar (UX only, §2).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { can, type Role } from "@growbox/api-client";
import { NAV_GROUPS, type NavItem } from "@/shell/nav";
import { useAuth } from "@/auth/AuthProvider";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Normalize for matching: lowercase, collapse whitespace. */
function hay(item: NavItem): string {
  return `${item.label} ${item.keywords ?? ""}`.toLowerCase();
}

function matches(item: NavItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return item.label.toLowerCase().includes(q) || hay(item).includes(q);
}

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const role: Role | null = admin?.role ?? null;

  /** Close through the exit animation (menu-pop-out), then unmount. */
  const close = () => {
    if (closing) return;
    setClosing(true);
  };

  // Unmount + notify parent after the exit animation (160ms).
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setClosing(false);
      onOpenChange(false);
    }, 160);
    return () => clearTimeout(t);
  }, [closing, onOpenChange]);

  const items = useMemo<NavItem[]>(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).filter(
        (item) => (!item.op || !role || can(role, item.op)) && matches(item, query),
      ),
    [query, role],
  );

  // Reset state each time the palette opens; focus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Defer until the dialog is painted so focus sticks.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const go = (item: NavItem) => {
    close();
    void navigate({ to: item.to });
  };

  // Global hotkey: Cmd/Ctrl+K toggles. Closing routes through the animation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open && !closing) close();
        else onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, onOpenChange]);

  // Lock body scroll while open (parity with the mobile drawer).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]", closing && "closing")}
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
      aria-hidden={closing || undefined}
    >
      <button
        type="button"
        aria-label="Close command menu"
        className="overlay-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={close}
      />
      <div className="menu-panel relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <SearchIcon size={15} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && items[active]) {
                e.preventDefault();
                go(items[active]);
              } else if (e.key === "Escape") {
                close();
              }
            }}
            placeholder="Search sections: orders, disputes, vendors…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching sections.</li>
          ) : (
            items.map((item, i) => {
              const Icon = item.Icon;
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      i === active ? "bg-primary-soft text-primary-foreground" : "hover:bg-muted"
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                  >
                    <Icon size={15} className="shrink-0 text-muted-foreground" />
                    {item.label}
                    {i === active && (
                      <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        ↵
                      </kbd>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
