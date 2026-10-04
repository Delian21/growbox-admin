import type { ReactNode } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "@/auth/AuthProvider";

/** Providers only — routing (and the shell layout) lives in router.tsx. */
export default function App({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
