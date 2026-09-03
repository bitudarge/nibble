# Nibbles — CLAUDE.md

Follow this file on every change in this repo. If anything here is ambiguous, ask the owner before building — do not assume.

## What Nibbles is

A social reading-tracker web app. Its identity is an **explainable, circle-aware book recommender** wrapped in a warm reading tracker. Mascot: a bookworm named Nibble (the app itself is called Nibbles). Phase-1 audience: the owner and ~100 friends.

The owner is a **data scientist and a beginner web developer**. Write clean, heavily-commented code, and briefly explain architectural choices in plain language as you go. When a task needs an owner-only action (create an account, paste a key, click a dashboard setting), **stop, give exact numbered steps, and wait** — never fake or skip it.

The app's original build (phases 1-7 below) deliberately used plain, functional styling with no visual polish. That's no longer the case: the app is now in a **refinement phase** (design + features together) driven by a visual mockup. See "Refinement phase" further down for its own build order and design system, and don't undo that work by reverting to plain styling on new pages.

## Tech stack

- Frontend: React + Vite + TypeScript (strict) + Tailwind CSS
- Routing: React Router
- Database + Auth: Supabase (Postgres), via `@supabase/supabase-js`
- Book data: Open Library API (no key needed) — search, covers, metadata
- Testing: Vitest + React Testing Library
- Hosting target: Vercel (stay deploy-ready; never auto-deploy)
- Version control: private GitHub repo, all changes via pull requests

## Non-negotiable rules

1. Never commit directly to `main`. Every change is a pull request.
2. Nothing deploys automatically. The owner is the only one who merges.
3. **Row Level Security on every table**, with policies that stop data leaking between users and between circles. Double-check circle isolation specifically.
4. Never hardcode secrets — all keys live in the git-ignored `.env`. The Supabase `service_role` key and DB password must never appear in app code or be requested from the owner.
5. Never trust the client. Enforce access at the database (RLS) level, not just in the UI.
6. Every network/DB call is wrapped in error handling with friendly messages.
7. Every data screen has explicit **loading / empty / error** states.
8. Validate all user input in the UI and again before it hits the database.

## How work happens

- One pull request per phase (see build order below), each with a clear description of what changed, why, and anything risky (especially auth or data access).
- Stop at each phase boundary, and at any point that needs an owner-only action. Give numbered click-by-click steps and wait for confirmation.
- Prefer boring, well-documented, widely-used solutions over clever ones.
- Structure code so new features slot in: feature-based folders, a typed data-access layer separate from UI, the recommender kept isolated in `src/lib/recommender/`.

## Build order (phases; one PR each, stop after every phase)

1. **Scaffold + safety rails + review automation** — Vite/React/TS/Tailwind, ESLint+Prettier, Vitest smoke test, `.env` wiring, Supabase client wrapper with local-storage fallback, GitHub repo + Actions CI (lint/typecheck/test + Claude Code review), branch protection.
2. **Full database schema + RLS** — all tables up front (profiles, books, shelf_items, reading_sessions, ratings, book_tags, review_tags, reviews, reading_goals, reading_streaks, circles, circle_members, circle_messages, circle_reads, taste_profiles) delivered as SQL migrations + copy-paste SQL, with RLS policies enforcing circle isolation.
3. **Auth (Google login) + app shell + navigation.**
4. **Core pages** — Dashboard, Search/Discovery, Book Page, My Shelves.
5. **Circles** — create/join, discussion feed, circle reviews, reading-together.
6. **The recommender** — explainable, circle-aware, isolated in `src/lib/recommender/`, every recommendation ships a plain-language "why."
7. **Reading stats, goals, streaks, shareable Reading Wrap.**

Full detail for each phase (schema fields, page contents, RLS specifics, recommender design) lives in the phase's own PR description and in project memory — check there before re-deriving from scratch.

## Cross-cutting requirements (every phase)

- Accessible and responsive: keyboard-navigable, sensible alt text, works on mobile and desktop widths.
- Performant for ~100 users: paginate lists, use indexes, don't over-fetch.
- Kind and non-toxic by design: validate inputs; no AI feature that could generate harmful text about users.
- Extensible: note in each phase's PR what future features the structure is ready for.

## Current status

**All 7 phases merged.** Database schema is live, Google OAuth is fully
configured and verified working end-to-end (redirects to a real Google
sign-in screen both locally and on the production deploy), and the app is
deployed at https://nibble-jade.vercel.app (auto-deploy from GitHub is
deliberately disconnected — redeploy manually with `vercel --prod --yes`
from the repo root).

Supabase project administration (schema changes, auth provider config) is
done directly via the Supabase Management API using a personal access
token stored via `supabase login` on this machine, rather than asking the
owner to click through the dashboard — see project memory
(`minimize-owner-actions`, `nibble-ci-setup-status`) for the pattern.

Phase 6 (recommender) — explainable, circle-aware, isolated in
`src/lib/recommender/` with 23 passing unit tests on the scoring/
explanation/text-analysis logic specifically (fixture-based, no DB needed).
See `src/lib/recommender/README.md` for how it actually works.

Phase 7 — reading goals (settable on the Dashboard now), streaks (computed
server-side by a DB trigger on `reading_sessions` insert — the table is
read-only for clients now, see migration `20260902000005`), and a
shareable yearly Wrap page (`/wrap`: books finished, pages read, favorites,
top tags).

**2026-09-02: found and fixed two real production bugs** once the owner
actually tried the dashboard with a real account — the exact gap flagged
above (nothing had exercised authenticated queries against live circle
data before this). Both fixed directly on the live database via the
Management API, migrations `20260902000006`–`20260902000008`:

1. Every RLS policy that checked circle membership queried
   `circle_members` from inside `circle_members`'s own policy — Postgres
   detects this as infinite recursion (error 42P17) once real membership
   rows exist. Fixed by moving the check into `SECURITY DEFINER` helper
   functions (`is_circle_member`, `shares_circle_with`,
   `can_view_reading_progress`) that bypass RLS internally, breaking the
   cycle. This is the standard fix for this exact class of Postgres bug.
2. `shelf_items`/`circle_members`/`circle_messages`/`reviews`/`ratings`
   all had `user_id` pointing at `auth.users`, so PostgREST's
   `profiles(*)` embedded-select syntax couldn't find a join path (it
   needs a _direct_ FK, not one two hops away through `auth.users`).
   Retargeted every user-identity FK to `public.profiles(id)` instead
   (safe: one profile per user, auto-created by the signup trigger).

Verified the fix with two throwaway test accounts and a real circle
(members, messages, circle reviews, reading-together progress, showcase,
circle-aware recommendations) — all previously-broken queries now return 200. Debug data cleaned up afterward.

**Still not fully clicked through by the owner in a browser** — the fixes
above were verified via direct API calls, not the actual UI. That's the
next thing that should happen.

## Refinement phase (all 8 sections merged, 2026-09-02 to 2026-09-03)

The full spec lives in `docs/refinement/master-prompt.md` (copied into the
repo so it survives outside chat history), and the visual reference is
`docs/refinement/Nibbles-design-mockup.html` — read both before touching
refinement-phase code rather than re-deriving from scratch.

One PR per numbered section, merged and deployed in order:

1. Design system + app shell (tokens, fonts, logo component, bottom tab bar /
   sidebar). PR #12.
2. Dynamic type-ahead book search, debounced, cancels stale requests. PR #13.
3. Richer book data (Google Books primary, Open Library fallback) + restyled
   Book Page. PR #14. Fixed a real bug found only by testing against live
   RLS: `books` had no UPDATE policy, so enrichment writes were silently
   dropped, added `books_update_authenticated` (migration
   `20260902000009`).
4. Onboarding taste quiz (cold-start for the recommender), seeds
   `taste_profiles`. PR #15.
5. Reworked review system: private "My Notes" vs public "Write a Review" vs
   "share to circle", tappable half-star rating, the anti-forgetting quick
   note, spoiler-tap, optimistic UI with rollback. PR #16.
6. Restyled the remaining pages (Dashboard, Shelves, Recommendations,
   Circles, circle detail, Profile/Wrap) to match the mockup. PRs #17
   (Circles/circle detail/Wrap) and #18 (Dashboard/Shelves/Recommendations).
7. Made the recommender's book-side scoring actually use Google Books
   categories, not just `review_tags`, so quiz-seeded genre affinity has
   something to match against on the many books nobody's reviewed yet. PR
   #19. The optional external-ratings-dataset bonus was proposed and the
   owner chose to skip it for now (not integrated, no license was ever
   evaluated against real code).
8. Interaction/motion polish pass: a honey/sage "finished a book" and
   "streak milestone" celebration (new, nothing like it existed before),
   plus a tap-target/press-feedback/page-transition consistency sweep. PR
   #20.

Live at https://nibbles-app.vercel.app (new primary domain, registered as a
proper Vercel project domain, not just an alias, so it survives every
deploy) and https://nibble-jade.vercel.app (original domain, kept working).
Redeploy after merging with `npx vercel --prod --yes` from the repo root,
same manual-deploy discipline as before, auto-deploy from GitHub is still
deliberately disconnected. That command has intermittently failed once with
`"Not authorized"` on the first attempt and succeeded immediately on retry,
twice so far, cause unconfirmed (looked transient, not investigated
further since a retry always worked).

**Not yet clicked through by the owner with a real signed-in account.**
Every PR in this phase hit the same wall: `RequireAuth` needs a real Google
OAuth session, which isn't obtainable in an unattended environment, so
every section's testing was lint/typecheck/test/build plus targeted unit
tests, never a real browser session logged in as a real user. The one
exception was Section 3's RLS bug, which was caught by directly exercising
the database as an authenticated role, not through the UI. Given Phase 7's
history (`nibble-ci-setup-status` in memory: two real bugs surfaced only
once the owner actually used the dashboard signed in), treat this whole
phase as unverified-in-the-browser until that happens, especially: the
taste quiz's one-time post-signup redirect, the review system's "share to
circle" flow, and the new finish/streak celebration's actual trigger
timing.

Decisions already made when starting Section 1:

- App name is **Nibbles** (not "Nibble") in all user-facing text; the mascot
  is still named Nibble. The npm package name and GitHub repo stay `nibble`,
  those are infra identifiers, not user-facing.
- Dark mode (day/night toggle) is in scope from Section 1, not deferred.
- Bottom tab bar / sidebar has six items: Home, Discover (= Search),
  Shelves, Circles, Recs (= Recommendations), You (= Wrap). Recommendations
  keeps its own tab rather than living only inside Home, unlike the mockup's
  five-tab bar.
- Logo is a plain text wordmark (`src/components/brand/Logo.tsx`) for now,
  not the mockup's bookworm icon, since the owner is designing their own
  logo separately.

### Getting a Google Books API key (optional, Section 3+)

Book pages work with zero key, Google allows a modest number of
unauthenticated requests. A key just makes lookups reliable at real usage.
To create one:

1. Go to https://console.cloud.google.com/ and create a project (or reuse
   one you already have), name doesn't matter, e.g. "Nibbles".
2. In that project, go to **APIs & Services > Library**, search "Books
   API", and click **Enable**.
3. Go to **APIs & Services > Credentials > Create Credentials > API key**.
4. Optionally click into the new key and restrict it: under "API
   restrictions" limit it to the Books API only, so it's useless for
   anything else if it ever leaks.
5. Copy the key into `.env` as `VITE_GOOGLE_BOOKS_API_KEY=...`, and add the
   same variable/value in Vercel (Project Settings > Environment Variables)
   for the production deploy. Never commit it.

Content law that applies to every section: no em dashes anywhere in UI copy,
no AI-slop phrasing, emoji only where it clearly fits and the owner approves.
Design tokens live in `src/index.css` (`@theme` block + `--nibbles-*` CSS
variables, light and dark) — change colors there, not by hand-picking hex
values in components.
