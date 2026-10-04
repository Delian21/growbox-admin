/**
 * Reason dialog: every audited mutation requires a reason (§6 cross-cutting
 * rule), so every action dialog is this component with extra fields injected.
 * Blocks submit until the reason has the minimum length the mock enforces.
 *
 * Enter/exit animation matches the detail drawer (see index.css): the dialog
 * stays mounted through the 150ms fade/scale-out, then unmounts and calls
 * onClose, so all overlays feel consistent.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineError } from "@/components/StateBlock";

/** Matches the dialog-pop-out duration in index.css. */
const DIALOG_EXIT_MS = 150;

const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra form fields rendered above the reason box. */
  children?: ReactNode;
  /** Disable submit while the mutation is in flight. */
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  destructive?: boolean;
  /** Extra validation on the assembled values; return an error message to block. */
  validate?: (values: { reason: string }) => string | null;
  onSubmit: (values: { reason: string }) => void;
}

export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  children,
  busy,
  error,
  submitLabel = "Confirm",
  destructive,
  validate,
  onSubmit,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  /** Exit-animation gate: true while the fade/scale-out plays. */
  const [closing, setClosing] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

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
    }, DIALOG_EXIT_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  // Clear the draft only when the dialog closes (success or cancel) — never on
  // submit itself, so a failed mutation (e.g. 409) doesn't wipe the typed reason.
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  // Focus the reason box on open and hand focus back to the opener on close,
  // so keyboard users are never dropped on <body> behind a modal.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    reasonRef.current?.focus();
    return () => {
      if (prev?.isConnected && document.activeElement !== prev) prev.focus();
    };
  }, [open]);

  // Escape closes through the exit animation; the backdrop click does too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const tooShort = reason.trim().length < 3;
  const blocked = tooShort || busy || (validate?.({ reason }) != null);

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", closing && "closing")}
      role="dialog"
      aria-modal="true"
      aria-hidden={closing || undefined}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="overlay-backdrop absolute inset-0 bg-foreground/30"
        onClick={requestClose}
      />
      <form
        className="dialog-panel relative w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked) return;
          onSubmit({ reason: reason.trim() });
        }}
      >
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
        <Field label="Reason (required · written to the audit log)" htmlFor="reason">
          <textarea
            id="reason"
            ref={reasonRef}
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="Why is this action being taken?"
          />
        </Field>
        {error && <InlineError message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={blocked} variant={destructive ? "destructive" : "primary"}>
            {busy ? "Working…" : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
