import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "destructive";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium",
        "transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "motion-safe:active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        {
          primary: "bg-primary text-primary-foreground hover:bg-primary/90",
          outline: "border border-border bg-card text-foreground hover:bg-muted",
          ghost: "text-foreground hover:bg-muted",
          destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        }[variant],
        className,
      )}
      {...props}
    />
  );
});
