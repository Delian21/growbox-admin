import { useTheme } from "@/theme/ThemeProvider";
import { MoonIcon, SunIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Light/dark toggle — GrowBox tokens swap wholesale via the `.dark` class. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground",
        "bg-card transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Icon size={16} />
    </button>
  );
}
