/**
 * Friendly loading/empty/error block for panel and drawer bodies, replacing
 * bare red paragraphs. Error variant keeps role="alert" and an optional retry.
 */
import { AlertTriangleIcon, PackageIcon, TimerIcon, type IconType } from "@/components/icons";
import { Button } from "@/components/ui/Button";

export interface StateBlockProps {
  variant: "loading" | "empty" | "error";
  /** Headline; defaults suit each variant. */
  title?: string;
  /** Supporting detail line under the headline. */
  message?: string;
  /** Retry handler — renders the retry button in the error variant. */
  onRetry?: () => void;
  retrying?: boolean;
  /** Icon in the badge; defaults per variant. */
  icon?: IconType;
  className?: string;
}

const VARIANT = {
  loading: { icon: TimerIcon, badge: "bg-muted text-muted-foreground", title: "Loading…" },
  empty: { icon: PackageIcon, badge: "bg-muted text-muted-foreground", title: "Nothing here yet" },
  error: {
    icon: AlertTriangleIcon,
    badge: "bg-destructive/10 text-destructive dark:text-red-300",
    title: "Something went wrong",
  },
} as const;

export function StateBlock({
  variant,
  title,
  message,
  onRetry,
  retrying,
  icon,
  className,
}: StateBlockProps) {
  const cfg = VARIANT[variant];
  const Icon = icon ?? cfg.icon;
  const isError = variant === "error";

  return (
    <div
      {...(isError ? { role: "alert" } : {})}
      className={`flex flex-col items-center gap-2 px-6 py-10 text-center ${className ?? ""}`}
    >
      <span className={`flex size-10 items-center justify-center rounded-full ${cfg.badge}`}>
        <Icon size={18} className={variant === "loading" ? "animate-pulse" : undefined} />
      </span>
      <div>
        <p className={`text-sm font-medium ${isError ? "text-destructive dark:text-red-300" : ""}`}>
          {title ?? cfg.title}
        </p>
        {message && (
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{message}</p>
        )}
      </div>
      {isError && onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}

/** Compact one-line alert for form/drawer-level failures. */
export function InlineError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive dark:text-red-300"
    >
      <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
