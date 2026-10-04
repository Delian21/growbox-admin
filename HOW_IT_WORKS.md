# How the GrowBox Admin Panel Works

A plain-language tour of this project for someone who has never coded, or has just started. No jargon without a translation. (The deeper technical write-up lives in [ARCHITECTURE.md](ARCHITECTURE.md); this document is the friendly version.)

---

## 1. What is this thing?

GrowBox is a marketplace where people buy fresh produce from farmers. Two groups use it: buyers and vendors (the sellers). This project is the **third app**: the internal tool that the GrowBox staff use to watch over both sides. Think of it as the control room.

From this control room, staff can:

- See every order and rescue the ones that are stuck or late.
- Refund customers when something arrives spoiled.
- Approve or reject vendors and the products they want to sell.
- Approve and send payments (called **payouts**) to vendors.
- Keep a permanent, tamper-proof diary of every action staff take (the **audit log**).

## 2. The clever trick: a fake server inside the browser

The app is supposed to talk to a real server (a computer somewhere that holds all the data). That server does not exist yet. Instead, the app carries a **pretend server inside itself**, called the "mock layer". It is built with a library called MSW.

Here is the analogy: imagine mailing a letter, but a helpful postal worker intercepts it before it leaves your street, writes a reply themselves, and hands it straight back. The letter-writer never knows the letter never left. That is what MSW does: the app sends normal web requests, MSW catches them, and a small program fakes the answers using sample data.

Why do it this way?

1. Staff can demo the whole product today, with no server bills and no risk of breaking real money.
2. When the real server is finally built, the fake one is removed and **nothing on the screens needs to change**, because the screens only ever talk to "the request layer", never to the fake directly.

The sample data ("seed data") is a self-contained fictional cast: seven Nigerian farm vendors, a handful of admin users, orders, disputes, product listings, and payout batches. A quick detail: every timestamp in that data gets shifted at startup so that the most recent event always lands at "now". That way a demo never shows "zero sales today".

## 3. The journey of one click

Say a staff member clicks **Approve** on a product listing. Step by step:

1. **The screen (a "route")** opens a small popup called the reason dialog. It refuses to submit until the person types a reason of at least 3 characters. Every important action needs a written reason; it is the house rule.
2. **The hook layer** (`src/api/hooks.ts`) is a set of small helpers that know how to ask the server for things and how to remember the answers. It uses a library called TanStack Query, which works like a smart sticky-note memo: it caches answers, refetches them when they get stale, and shows loading or error states while it works.
3. **The request layer** (`packages/api-client/src/client.ts`) turns the request into an actual HTTP call: "POST /admin/v1/listings/lst_123/approve".
4. **The fake server** (MSW) intercepts it and runs a *handler*, which is just a function that answers that exact kind of request. Before answering, the handler checks a strict checklist:
   - Is the person logged in, with a valid session? If not, reject with 401.
   - Is their role allowed to do this? Roles are SUPER_ADMIN, OPS, FINANCE, SUPPORT, each with a different permission list. If not allowed, reject with 403.
   - Did they include a proper reason? If not, reject with 400.
   - Is this move legal for the thing they are changing? Every object (order, dispute, vendor, listing, payout) has a **state machine**: a map of allowed next stops, like a board-game board where you can only move along drawn paths. Approving an already-approved listing is an illegal move, rejected with 409.
5. If all checks pass, the handler **changes its working copy of the data** (never the original sample files, so a page reload resets the demo to a pristine state) and writes one new line into the audit log: who did it, what changed, before and after, when, and the reason.
6. The answer travels back. TanStack Query notices which memo-notes are now outdated and throws away the stale ones, so the table and the popup refresh themselves with the new reality.

That is the whole app in one paragraph: screens draw, hooks remember, the client sends, the fake server judges and records, and the cache refreshes.

## 4. The building blocks of every screen

Most screens are built from the same four Lego bricks, which is deliberate: a staff member learns a pattern once and recognizes it everywhere.

- **DataTable** (`src/components/DataTable.tsx`): the sortable table used for orders, disputes, vendors, listings, payouts, and the audit log. It has three moods: *loading* (grey shimmering placeholder rows), *empty* (a friendly icon with a title and a hint, shown when filters match nothing), and *error* (a red-bordered card explaining the failure, with a **Retry** button that asks the data source to try again).
- **Drawer** (`src/components/Drawer.tsx`): the side panel that slides in when you click a row, showing the full details of one thing. Escape or clicking the dark backdrop closes it.
- **ReasonDialog** (`src/components/ReasonDialog.tsx`): the popup that demands a written reason before any important action. If the action fails (for example, the server says "illegal move"), the popup stays open and keeps your typed text.
- **StatusBadge**: the little colored pills like "Awaiting approval". The colors are consistent everywhere: green is fine, amber needs attention, red is money-loss or bad, grey is inert, blue is in progress.
- **StateBlock** (`src/components/StateBlock.tsx`): the friendly loading / empty / error panel used inside dashboard panels, charts, and detail drawers — an icon badge, a plain-language headline, and (on errors) a **Retry** button. Raw technical messages never reach the screen: a single translator (`apiErrorMessage` in the hook layer) turns network and parsing failures — for example a stale mock worker handing back an HTML page instead of JSON — into a sentence a person can act on, and a compact inline variant carries the same treatment inside forms.

The drawer and the dialogs share the same animation choreography: they fade/slide in when opened, and, importantly, they also animate *out* when closed. The trick: when you close one, it is not immediately removed from the screen. A timer keeps it around for about 150 to 220 milliseconds while it plays its exit animation, and only then is it actually removed. People who set their operating system to "reduce motion" get no animations at all.

## 5. Money has special rules

Anything that moves money (refunds, marking a payout as paid) gets extra caution:

- Amounts are stored as whole numbers of **kobo** (100 kobo = 1 naira), never as decimals, because decimals cause rounding surprises.
- These requests carry an **idempotency key**, a random label that means "if this exact request somehow gets sent twice (a double-click, a flaky connection), only do it once". The fake server remembers the label and replays the original answer instead of paying twice.
- The app never *pretends* these actions succeeded instantly (it does not use "optimistic updates" for money). It waits for the server to confirm, even though that feels slower.
- A payout batch follows one road: CALCULATED → PENDING_APPROVAL → APPROVED → PAID. If the bank transfer fails, it becomes FAILED and can be retried back into the approval queue. One person's approval is recorded; the payment is recorded separately.

Batches are not typed in by hand. The **payout calculator** works them out: staff pick a vendor and a date range, and the fake server adds up that vendor's orders inside the range (skipping cancelled and refunded sales, which should never pay out), then fills in three figures: the **gross** total, the GrowBox **commission** (the marketplace's cut, taken straight from each order's own commission amount), and the **net** left over for the vendor. The server refuses to create a batch that fails its sanity checks: if there are no eligible orders in the range, if the commission would swallow the whole pot, if the numbers someone supplied disagree with what the orders actually add up to, or if a batch for that vendor and period already exists and is still waiting around. In every one of those cases the request is bounced with a specific error, and the app surfaces that message right inside the popup.

## 6. The people and their keys

There are four staff roles. The app hides menu items a role cannot use, but that hiding is only **decor**: the real lock is on the server side (in the fake server for now, in the real one later), which checks the permission on every single request. If you tricked the web page into showing the Payouts menu to a role without permission, the request would still bounce off the fake server with a 403. The page is the doorman's uniform; the server is the actual lock.

The audit log is the app's conscience: append-only, meaning things can be added but never edited or deleted, by anyone, including the super admin. The audit screen deliberately has no edit or delete buttons anywhere.

## 7. Where things live (a map for code explorers)

```
apps/admin/src/
  main.tsx            Entry point: starts the fake server, then the app
  router.tsx          Which web address shows which screen; login gate
  routes/             One file per screen (Dashboard, Orders, ... Payouts)
  api/hooks.ts        The "sticky-note memo" helpers for each data type
  components/         Reusable bricks: DataTable, Drawer, ReasonDialog, ...
  shell/              The frame around every page: sidebar, topbar, search
packages/api-client/src/
  client.ts           The single request sender (swap point to the real server)
  policy.ts           The rulebook: state machines + role permissions
  seed/               The fictional demo dataset
  mock/               The fake server: handlers, working store, error shapes
public/fonts/         Inter and DM Sans font files, stored locally
```

Typography note: body text and tables use **Inter** (crisp at small sizes), headings and big numbers use **DM Sans** (a bit warmer). Both are stored inside the project rather than fetched from a font website, which keeps the app's security policy simple and load times predictable. User-facing text also avoids long em dashes; separators are middots (·) or short dashes (–) instead.

## 8. Edge cases the app actively defends against

A short list of things that would otherwise go wrong, and what the code does about them:

- **The fake server randomly fails about 4 percent of data reads.** This is on purpose, to exercise the error states (write actions are exempt so demos stay usable). That is exactly why every table has a Retry button, and why retrying usually works. Each request also waits roughly 350 to 600 milliseconds on purpose, so the loading skeletons are real, not theoretical.
- **Your session expires.** The fake sessions are short-lived on purpose. Whenever any request comes back with 401, the app clears the stored session and bounces you to the login screen, remembering where you were so it can send you back.
- **Two people (or two tabs) act on the same thing.** The state machine checks happen at the moment of action, so if a listing was approved a second ago, your stale "Approve" click gets a 409 conflict instead of silently breaking the data.
- **The dialog loses your typed reason.** It does not. The draft only clears when the dialog fully closes, so a failed submission keeps your text for a second attempt.
- **Reviewer disagreement.** On any listing awaiting a decision, staff can leave notes for each other in a discussion thread inside the detail panel, before anyone approves or rejects. Posting a note is quick (no reason popup needed: the note itself is the record, the same convention the dispute screen uses) and it still lands in the audit log like every other action. Decisions, by contrast, always demand a written reason.
- **Money operations double-firing.** Covered by the idempotency key described above.
- **Demo drift.** A full page reload resets the entire dataset to the pristine sample, and all timestamps re-align to "now", so demos are repeatable forever.
- **Reading too much data at once.** Lists are paginated with a "cursor" (think: a bookmark saying "continue from here"). Summary counts ask the fake server for a **count report** alongside the rows: the server tallies every row *before* cutting the page, so the dashboard's "listings awaiting review" card and the status counts in the table toolbars stay correct even when a queue is far too big to fit on one screen. (If the count report is missing for any reason, the app falls back to counting just the visible rows, which is the honest-but-imperfect older behaviour.)

## 9. Fact-check appendix

This document was written after the code it describes, then re-read against the actual implementation line by line. Claims verified against the code: the MSW interception and its auth / RBAC / reason / state-machine checklist (`mock/handlers.ts`, `mock/http.ts`), the working-copy reset behaviour (`mock/store.ts`, `seed/index.ts`), the timestamp re-basing (`seed/relativeDates.ts`), the 4 percent simulated read-failure rate and 350ms plus jitter latency (`mock/http.ts`), the reason-dialog draft retention and 3 character minimum (`ReasonDialog.tsx`), the shared enter/exit animation timing of 220ms for drawers and 150ms for dialogs with a `prefers-reduced-motion` opt-out (`Drawer.tsx`, `ReasonDialog.tsx`, `index.css`), the retry wiring on every table (`DataTable.tsx` and all route files), the idempotency header plumbing (`client.ts`, dispute resolve and payout mark-paid handlers), the 401 global logout redirect (`main.tsx`), the role matrix and its client-side hiding plus server-side enforcement (`policy.ts`, `nav.ts`, `AppShell.tsx`), the dashboard listing card and merged activity feed (`DashboardRoute.tsx`), and the self-hosted Inter/DM Sans fonts (`public/fonts/`, `index.css`).

A second pass verified the newer features the same way: the payout calculator's order filtering, figure derivation, invariant checks, duplicate guard, and 422 / 409 errors (`mock/handlers.ts`, `POST /admin/v1/payouts/calculate`; `policy.ts` for the `payouts:calculate` permission), the `counts=status` facet computed before the status filter on both the listings and payouts list endpoints, with the page-scan fallback in the dashboard and toolbar components (`handlers.ts`, `DashboardRoute.tsx`, `ListingsRoute.tsx`, `PayoutsRoute.tsx`), and the reviewer comment thread with its 1 to 2000 character limit, `listing.comment` audit action, and no-reason deviation mirroring dispute comments (`handlers.ts`, `hooks.ts`, `ListingsRoute.tsx`).

A third pass covered the dashboard hierarchy rework: the variance chips and hero figures are derived from the same 14-day series as the cards (`DashboardRoute.tsx`, `countVariance`/`gmvSum`), the Sales trend and Dispute mix scope selectors are hand-rolled `Menu` dropdowns with 7/30/90-day windows (`Menu.tsx`), the donut's rounded arcs and hover tooltip are plain SVG with dash arithmetic (`DisputeMix`), and the friendly-error claim above is gated by `scripts/contrast-audit.mjs`, which now audits badge tones, variance chips, and panel stat deltas against WCAG AA in both themes and exits non-zero on any failure.

Two corrections came out of the first fact-check: the latency figure above was originally stated as a flat 350ms (it is 350ms plus 0 to 250ms of jitter), and a comment in `payout-types.ts` claimed the mock validates that a batch's net equals gross minus commission, which nothing enforced at the time (there was no create-payout endpoint). That gap no longer exists: the calculate endpoint added later does derive and enforce the invariant, and the `payout-types.ts` comment has been updated to say so.
