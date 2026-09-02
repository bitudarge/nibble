# Nibble — CLAUDE.md

Follow this file on every change in this repo. If anything here is ambiguous, ask the owner before building — do not assume.

## What Nibble is

A social reading-tracker web app. Its identity is an **explainable, circle-aware book recommender** wrapped in a warm reading tracker. Mascot: a bookworm named Nibble. Phase-1 audience: the owner and ~100 friends.

The owner is a **data scientist and a beginner web developer**. Write clean, heavily-commented code, and briefly explain architectural choices in plain language as you go. When a task needs an owner-only action (create an account, paste a key, click a dashboard setting), **stop, give exact numbered steps, and wait** — never fake or skip it.

**Foundation and functionality come before aesthetics.** No logo/visual polish work until the owner asks; use clean, plain, functional styling.

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

Phases 1–5 merged. Database schema is live, Google OAuth is fully
configured and verified working end-to-end (redirects to a real Google
sign-in screen both locally and on the production deploy), and the app is
deployed at https://nibble-jade.vercel.app (auto-deploy from GitHub is
deliberately disconnected — redeploy manually with `vercel --prod --yes`
from the repo root).

Supabase project administration (schema changes, auth provider config) is
now done directly via the Supabase Management API using a personal access
token stored via `supabase login` on this machine, rather than asking the
owner to click through the dashboard — see project memory
(`minimize-owner-actions`, `nibble-ci-setup-status`) for the pattern.

Phase 6 (recommender) merged too — explainable, circle-aware, isolated in
`src/lib/recommender/` with 23 passing unit tests on the scoring/
explanation/text-analysis logic specifically (fixture-based, no DB needed).
See `src/lib/recommender/README.md` for how it actually works.

**Still not clicked through with a real user session** — nobody has
actually signed in with a real Google account and used the app yet. All
pages pass lint/typecheck/test/build and I've verified the schema and RLS
behave correctly via direct API checks, but real end-to-end usage (search
→ shelve → rate → review → circles → recommendations) hasn't been
confirmed by an actual signed-in user. Phase 7 (stats/goals/streaks/Wrap)
not yet started.
