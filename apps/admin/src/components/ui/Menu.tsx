/**
 * Menu: a hand-rolled popover menu (no Radix in this project — see the note in
 * ui/README convention: Drawer and ReasonDialog are hand-rolled too).
 *
 * Provides the keyboard contract a menu needs: Arrow/Home/End move focus, Escape
 * closes, focus returns to the trigger on close, and a click outside dismisses.
 * Exit animation uses the shared `.menu-panel` keyframes with the same
 * `closing` gate as ReasonDialog, so the panel stays mounted for 160ms while it
 * plays out, then unmounts. `prefers-reduced-motion` is handled in CSS.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Must match `.closing .menu-panel` in index.css. */
const MENU_EXIT_MS = 160;

interface MenuContextValue {
  /** Dismiss with the exit animation, then notify the owner. */
  requestClose: () => void;
  /** id of the panel, for aria-controls. */
  panelId: string;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("Menu items must be rendered inside <Menu>");
  return ctx;
}

export interface MenuProps {
  /** Accessible name for the trigger button. */
  label: string;
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** MenuItems / MenuCheckboxItems. */
  children: ReactNode;
  /** Which edge the panel aligns to. Defaults to right (row action menus). */
  align?: "left" | "right";
}

export function Menu({ label, trigger, open, onOpenChange, children, align = "right" }: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const panelId = useId();

  const requestClose = useCallback(() => {
    if (!open || closing) return;
    // Reduced motion: skip the wait, but still route through one tick so the
    // state update is never batched against an in-flight open.
    setClosing(true);
  }, [open, closing]);

  // Finish the exit: hand control back, reset the gate, restore focus.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setClosing(false);
      onOpenChange(false);
      triggerRef.current?.focus();
    }, MENU_EXIT_MS);
    return () => clearTimeout(t);
  }, [closing, onOpenChange]);

  // Outside click (or click on the trigger itself) dismisses.
  useEffect(() => {
    if (!open || closing) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) requestClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closing, requestClose]);

  // Move focus to the first enabled item when the panel opens.
  useEffect(() => {
    if (!open || closing) return;
    const first = panelRef.current?.querySelector<HTMLElement>("[role^='menuitem']:not([disabled])");
    first?.focus();
  }, [open, closing]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    // Disabled items are skipped: browsers refuse focus() on them, which would
    // silently swallow Home/End when a greyed item sits at the edge.
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([disabled])") ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
    else next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => (open ? requestClose() : onOpenChange(true))}
        className="inline-flex items-center justify-center rounded-md border border-input bg-card px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {trigger}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            "menu-panel absolute z-40 mt-1 min-w-44 rounded-lg border border-border bg-card p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
            closing && "closing",
          )}
          aria-hidden={closing || undefined}
        >
          <MenuContext.Provider value={{ requestClose, panelId }}>{children}</MenuContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  /** Renders as menuitemcheckbox with aria-checked instead of menuitem. */
  checked?: boolean;
  /** Greyed + unfocusable. */
  disabled?: boolean;
  destructive?: boolean;
}

export function MenuItem({ onSelect, children, checked, disabled, destructive }: MenuItemProps) {
  const { requestClose } = useMenu();
  const isCheck = checked !== undefined;

  return (
    <button
      type="button"
      role={isCheck ? "menuitemcheckbox" : "menuitem"}
      aria-checked={isCheck ? checked : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect();
        requestClose();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
        destructive && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}
