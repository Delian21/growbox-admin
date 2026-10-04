# LOG (append-only event authority)

## 2026-09-09

- 13:28Z SESSION_START -- agent=codebuff (Freebuff). Workspace empty apart from .freebuff/project-id.
- 13:28Z SAIPEN_ADOPT -- user asked to set up .saipen for our work; found fresh INIT bootstrap (phase PLAN, task none, counters 0).
- 13:29Z GOAL_CREATED -- G0 "Adopt Saipen tracking" (closed immediately) and G1 "Stand up the project" (wave 1; tickets T1, T2).
- 13:29Z TICKET_DONE -- T0: board, state checkpoint, and session log are live; Saipen tracking operational.
- 13:29Z NEXT -- T1 moved to DOING: define the first real goal for this repo; awaiting user input.
- 14:05Z TICKET_DONE -- T1: first goal defined — the GrowBox admin panel. Contract captured in ARCHITECTURE.md (ADRs 001-003), provisional palette in design/tokens.css (Open Question 1), backend discovery + gap analysis in BACKEND_GAP_ANALYSIS.md (Open Question 2).
- 14:05Z TICKETS_ADDED -- T2 (scaffold the React admin shell against a mocked /admin/v1 layer) and T3 (adopt shared backend — ADR-004 proposes one Supabase project for all three apps; needs owner sign-off).
- 14:05Z NEXT -- T2 queued; awaiting owner decision on ADR-004.

## 2026-09-16

- SESSION_START -- agent=codebuff (Freebuff). Cold restart; found T2 fully built on disk by prior session with NO checkpoint (STATE still said PLAN/T2-todo). Files outrank memory: verified instead of redoing.
- RUN: SCOUT -- T2 scope: shell/router/auth+MFA/MSW handlers/seed all present; repo state matches TODO.md (§0 done, §2 contract+client+seed done, next §3+§1 remainder).
- RUN: VERIFY -- pnpm typecheck -> PASS (both workspace projects); pnpm build -> PASS (admin 301.63 kB main + 352.12 kB mock chunk, gzip 98/112 kB).
- TICKET_DONE -- T2: React admin shell scaffolded (Vite + Tailwind v4 + shadcn-style primitives + TanStack Router/Query; light/dark persisted; login -> mandatory MFA; RBAC-gated nav; MSW /admin/v1 with state machines, idempotency, audit).
- STATE -- style_contract stale marker ded-4ae736e4 -> ded-a6711c95 refreshed against STYLE.md at this checkpoint.
- NEXT -- T3 (ADR-004 Supabase sign-off) is the only TODO and needs the owner. Asked; alternative is Phase 1 screens (TODO.md §4) against the mock.
- DECISION -- owner picked Phase 1 screens; ADR-004 stays parked. Goal pivot per MAINTENANCE §2.4.
- PLAN -- wave 2 filed: T4 orders, T5 disputes, T6 vendors, T7 audit, T8 dashboard; T3 demoted below them. Adding @tanstack/react-table per ADR-002/TODO §4.
- DEC: goal_waves 1->2
- DEC: goal_tickets 3->4 (T2 verify pass counted at checkpoint)
- RUN: BUILD -- shared infra: api/hooks.ts (typed query/mutation hooks, idempotency key on resolve), DataTable (TanStack Table v8 — v9 beta auto-installed first, downgraded), StatusBadge, Drawer, ReasonDialog, PageHeader, lib/format.ts.
- RUN: BUILD -- T4 OrdersRoute (filters, drawer, override + 3PL dialogs), T5 DisputesRoute (thread, start-review, resolve money dialog, comments), T6 VendorsRoute (meters, warn/suspend/reinstate/ban), T7 AuditRoute (read-only, filtered), T8 DashboardRoute rewrite (stat cards + recent activity); router wired.
- RUN: VERIFY -- typecheck PASS; lint 0 errors (7 pre-existing-style warnings); build PASS (453 kB mock chunk incl. table). 
- DEC: goal_tickets 4->9 (T4-T8 each passed VERIFY)
- NEXT -- smoke-test dev server in browser, then wave 2 done pending owner review; T3 (ADR-004) still parked on owner.
- 04.10.26 15:38 [E-1] [agent: codebuff] DEC: legacy journal (sections 2026-09-09/16) predates the E-id skeleton and keeps verbatim text -- restamping needs invented times, so the upgrade stays an owner decision
- 04.10.26 15:38 [E-2] [parent: E-1] [T-9] [agent: codebuff] DEC: T-9 filed DONE -- dashboard hierarchy (hero GMV, variance chips), typography pass, StateBlock friendly error/empty states, UI Pro donut, 7/30/90 scope selector
- 04.10.26 15:38 [E-3] [parent: E-2] [T-10] [agent: codebuff] DEC: T-10 filed DONE -- contrast audit extended to variance chips + panel stat deltas, Sales trend scope selector, Analytics chart baseline/hover, docs sync, micro-interactions
- 04.10.26 15:38 [E-4] [parent: E-3] [agent: codebuff] RUN: corepack pnpm typecheck + lint + build + contrast -> PASS -- 0 errors, 10 warnings (baseline), ALL PROPOSED PAIRS PASS, worst new chip 4.92:1
- 04.10.26 15:38 [E-5] [parent: E-4] [agent: codebuff] DEC: goal_waves 2->3; goal_tickets 9->11 -- owner-driven polish wave closed at this checkpoint
- 04.10.26 15:38 [E-6] [parent: E-5] [agent: codebuff] DEC: accidental --help probe line from this session removed before this upgrade; no other legacy bytes touched
- 04.10.26 15:45 [E-7] [parent: E-6] [agent: codebuff] DEC: goal_waves correction 3->2 -- the polish batches ran with no saipen PLAN entry, so they are not a goal wave; E-5's count was wrong and the valve stays at 2/3 waves, 11/20 tickets
- 04.10.26 15:48 [E-8] [parent: E-7] [agent: codebuff] RUN: validate.py -> FAIL -- 23 legacy pre-skeleton LOG lines (sections 2026-09-09/16) remain; STATE and BOARD checks clean at this checkpoint
- 04.10.26 16:09 [E-9] [parent: E-8] [agent: codebuff] RUN: git init -> commit 75e4dd8 -- 101 files, .freebuff/ gitignored, no secrets staged; push waits on owner-supplied remote URL
- 04.10.26 16:17 [E-10] [parent: E-9] [agent: codebuff] DEC: amend -> 3e6b9f7; E-9 named pre-amend 75e4dd8
- 04.10.26 16:23 [E-11] [parent: E-10] [agent: codebuff] RUN: git push origin master -> b4f0819; remote ref matches; GitHub Actions CI run completed success
