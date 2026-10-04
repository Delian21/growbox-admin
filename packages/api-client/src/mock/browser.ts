/**
 * MSW browser worker. Started from main.tsx BEFORE React renders whenever no
 * real backend URL is configured — the app cannot tell the difference
 * (BACKEND_GAP_ANALYSIS.md §3: swap is config, not code).
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
