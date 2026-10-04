# BOARD

Goals:
- G0 -- Adopt Saipen tracking in this workspace (done 2026-09-09)
- G1 -- Stand up the project: pick what this repo builds, then scaffold it (wave 1)

Conventions: goals `G<n>`, tickets `T<n>`; move tickets DOING -> DONE and record every transition in LOG.md.

Wave 2 (2026-09-16): owner picked Phase 1 screens while ADR-004 stays parked — T4-T8 filed at top, T3 demoted below (MAINTENANCE §2.4 Entry).
Polish batch (2026-10-04): owner-driven design/polish — T-9 and T-10 filed DONE at this checkpoint (LOG E-2, E-3); ticket lines upgraded to the RFC §1.2 `T-###` shape.

## DOING

## TODO

- [ ] T-3 (G1) Decide and adopt the shared backend for all three apps (ADR-004: one Supabase project) -- pending owner sign-off

## DONE

- [x] T-0 (G0) Adopt Saipen tracking: board, state checkpoint, and session log are live | verify: recorded in LOG section 2026-09-09; BOARD.md, STATE.md, LOG.md present at the 2026-10-04 cold start
- [x] T-1 (G1) Define the first real goal: the GrowBox admin panel; contract captured in ARCHITECTURE.md | verify: ARCHITECTURE.md ADR-001..003 on disk; LOG section 2026-09-09 TICKET_DONE T-1
- [x] T-2 (G1) Scaffold the React admin shell (Vite + shadcn/ui + Tailwind + TanStack; mock API layer) | verify: typecheck + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-4 (G1) Orders screens: filtered table + detail drawer (timeline, admin-stamped overrides) + status-override dialog + 3PL assignment | verify: typecheck + lint + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-5 (G1) Disputes screens: list + detail thread + start-review/resolve dialogs + comments | verify: typecheck + lint + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-6 (G1) Vendors screens: performance list + profile meters + warn/suspend/reinstate/ban | verify: typecheck + lint + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-7 (G1) Audit log: read-only table with actor/entity/date filters; no edit path | verify: typecheck + lint + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-8 (G1) Dashboard stat cards: GMV, open disputes, SLA breaches, poor performers + recent audit activity | verify: typecheck + lint + build PASS 2026-09-16 (LOG section 2026-09-16)
- [x] T-9 (G1) Design pass: hierarchy (hero GMV, variance chips), typography, StateBlock error/empty states, UI Pro donut, 7/30/90 scope selectors, contrast gate | verify: typecheck 0 / lint 0 errors 10 warnings / build 0 / contrast-audit ALL PASS, live DOM verified both themes 2026-10-04 (LOG E-4)
- [x] T-10 (G1) Release polish: contrast audit covers chips + panel deltas, Sales trend scope, Analytics chart baseline/hover, docs sync, micro-interactions | verify: typecheck 0 / lint 0 errors 10 warnings / build 0 / contrast-audit exit 0, live DOM verified 2026-10-04 (LOG E-4)

## BLOCKED
