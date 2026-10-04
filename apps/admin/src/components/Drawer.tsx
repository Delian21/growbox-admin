/**
 * Detail drawer: slide-over panel for order/dispute/vendor/payout detail
 * views (ARCHITECTURE.md §4.3). Escape + backdrop click close it.
 *
 * Enter/exit animation mirrors the mobile nav drawer and reason dialogs
 * (see index.css): the panel stays mounted through the 220ms slide-out,
 * then unmounts and calls onClose, so all overlays feel consistent.
 */

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Matches the drawer-slide-out duration in index.css. */
const DRAWER_EXIT_MS = 220;

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  /** Exit-animation gate: true while the slide-out plays. */
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (!open || closing) return;
    setClosing(true);
  };

  // Unmount after the exit animation completes, then hand control back.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setClosing(false);
      onClose();
    }, DRAWER_EXIT_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex justify-end", closing && "closing")}
      role="dialog"
      aria-modal="true"
      aria-hidden={closing || undefined}
    >
      <button
        type="button"
        aria-label="Close panel"
        className="overlay-backdrop absolute inset-0 bg-foreground/30"
        onClick={requestClose}
      />
      <div className="drawer-panel relative flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
