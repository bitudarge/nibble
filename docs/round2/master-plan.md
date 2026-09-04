# Nibbles round 2: brand, PWA, and feature requests

This is the coordinator's (Claude's) organized synthesis of a large, informal
list of requests the owner sent in one message on 2026-09-03, after using the
deployed app for the first time since the section 1-8 refinement phase. Kept
here so every section has a durable spec to build from, same reason
`docs/refinement/master-prompt.md` exists for the first phase.

Real quotes are lightly cleaned up for clarity but the intent is preserved.
Where the request was genuinely ambiguous, this doc states the coordinator's
interpretation plainly, built on that interpretation, and flagged it in the
relevant PR for the owner to correct if wrong.

**Status: all 7 sections merged and deployed** (2026-09-03 to 2026-09-04).
See CLAUDE.md's "Round 2" section for the PR-by-PR summary, including two
real bugs found and fixed along the way and the still-open Supabase
redirect-config item for fully retiring `nibble-jade.vercel.app`. This doc
stays as the original plan/spec, not updated retroactively to describe what
shipped, check CLAUDE.md and `git log` for actual current state.

## Brand assets now in the repo

- `src/assets/brand/nibbles-mascot.png` - the caterpillar mascot alone,
  transparent background (generated from the owner's flat-white-background
  source by color-keying white pixels out, since the source PNG had no alpha
  channel).
- `src/assets/brand/nibbles-logo-lockup.png` - mascot + "Nibbles" wordmark
  together, same transparent treatment.
- `public/icons/icon-{16,32,180,192,512}.png` - transparent-background
  favicon/app-icon sizes, mascot centered and padded.
- `public/icons/icon-maskable-{192,512}.png` - same mascot, but on a solid
  `#FBF6EA` (the app's cream page background token) square, mascot scaled to
  roughly 62% to sit inside Android's maskable-icon safe zone. Use these
  specifically for the PWA manifest's `maskable` purpose icons; use the
  transparent ones for `any` purpose and the favicon/apple-touch-icon.

## Section 1: Brand refresh + PWA + new palette + custom icons + desktop nav

**Real logo everywhere.** Replace the plain-text `Logo` component
(`src/components/brand/Logo.tsx`, currently just styled "Nibbles" text) with
the actual mascot/wordmark art above. Use the full lockup
(`nibbles-logo-lockup.png`) where there's room (the login page, the desktop
sidebar's top), and the mascot alone (`nibbles-mascot.png`) where space is
tight (the phone header, possibly as a small icon next to the wordmark
elsewhere). Update `index.html`'s favicon links and `public/favicon.svg`
(currently a leftover default Vite purple abstract icon, replace it or point
elsewhere at the new PNGs) to use the new icon set. Keep the component
swappable, same principle as before, if the owner wants to swap art again
later it should be a contained change.

**New color palette.** The owner wants light mode to move away from the
current cream/honey palette toward "different greens and white." Dark mode:
"same like greens, blank not too black but black and whites", i.e. dark
greens on a near-black (not pure black) background, white-leaning text, no
honey/amber accent carried forward unless it still reads as a green-and-white
system. This replaces the `--nibbles-*` token values in `src/index.css` from
section 1 of the first refinement phase (the token NAMES and Tailwind
`@theme` wiring stay, since the whole app already consumes `bg-page`,
`text-ink`, `bg-surface`, etc., generically, only the hex values need to
change). Pick a fresh green scale (a primary, a deeper shade, a soft tint for
chips/sections) plus a near-white surface/page pair for light mode, and a
near-black (not `#000000`, something like a very dark warm or neutral gray)
plus the same green scale for dark mode. Keep it feeling calm and readable,
not neon. Since the owner said "get rid of" the honey accent implicitly by
asking for "greens and white" specifically (no mention of yellow/honey
surviving), fold streak/highlight moments into the green system instead (a
brighter or more saturated green for "happy moment" accents) rather than
keeping a separate honey hue, unless that reads badly, use judgment and note
the call made.

**Custom hand-drawn icon set**, replacing the current plain geometric line
icons in `src/components/layout/navIcons.tsx`, in a warm "freehand" sketchy
line style (loosely inspired by Streamline's CC-BY freehand icon family,
hand-drawn rather than scraped, no external asset dependency or attribution
needed since these are original SVGs matching a style direction, not copies
of their files):

- **Discover: a magnifying glass**, explicitly requested, replacing the
  current compass icon.
- **Shelves**: redesign, the owner didn't like specifics but called out
  wanting a change; something like a stack of books read as a shelf, drawn
  in the same sketchy line style as the rest of the new set.
- **Recs**: redesign, the owner said the current sparkle/star icon "gives
  very much AI", too generic/AI-assistant-coded. Something more concretely
  book-related (an open book with a small heart or star tucked in, a
  bookmark ribbon, anything that reads as "a pick for you" rather than a
  generic AI sparkle).
- Home, Circles, You: can stay conceptually the same (house, two-people,
  person) but should get the same hand-drawn line treatment for visual
  consistency with the three above, don't leave three icons sketchy and
  three geometric.

**Desktop nav**: the owner wants a hamburger menu on desktop rather than the
current always-visible sidebar (`AppShell.tsx`'s `<aside>`). Collapse the
sidebar's nav items behind a hamburger toggle (a slide-out panel or a
dropdown, whichever reads cleanest at desktop widths) containing the same six
destinations (Home, Discover, Shelves, Circles, Recs, You) plus the user
menu/sign-out that currently lives in the sidebar. Keep the phone bottom tab
bar as-is, this only changes the `md:` and up layout.

**PWA**: add a web app manifest (`public/manifest.webmanifest` or
`.json`, name "Nibbles", short_name "Nibbles", theme/background colors
matching the new palette, the icon set above with correct `purpose` values,
`display: standalone`), link it from `index.html`, and a minimal service
worker for installability (precache the app shell so it's installable and
has basic offline resilience for the static shell, this does not need to
mean full offline data sync for Supabase content, that's a much bigger
project, just enough that "Add to Home Screen" / desktop install works
properly on a phone and in Chrome/Edge on a laptop, and repeat visits load
instantly from the shell cache). Use Vite's own PWA plugin
(`vite-plugin-pwa`) rather than hand-rolling manifest generation and
service-worker registration, standard tooling beats a custom build.

## Section 2: Rating/review restructure

The owner's own words, cleaned up: "the rating system needs to be more
interactive, right now it's just a page, and have the review thing be on
another part instead, it's distracting, you know? It's my shelf so it's
weird for now... for the rating of books like mood, pace and stuff I want
that to be just once, not for both reviews and notes, note adding is once
and then have a button below, also write a review, and then after that when
they click it it's just their notes and the things they inputted."

**Coordinator's interpretation** (state this plainly in the PR, it's the
single most structurally significant change in this round, easiest place for
a misread): the tag picker (mood/pace/spice_level/genre chips in
`ReviewEditor.tsx`) currently renders independently inside every visibility
instance (private, public, circle), so tagging happens up to three times for
the same book if a user writes all three. Consolidate tagging to ONE step,
tied to rating + the private note (the existing anti-forgetting
`QuickNoteNudge` flow from the first refinement phase is the natural home for
this: rate -> tag once -> optional one-line note, all one compact inline
interaction, not a full page). Below that, a clearly separate "Write a
Review" button/action that leads to the public review compose flow (still
reusing `ReviewEditor`, just visually and flow-wise separated from the
rating/tagging/note moment, not sitting inline with it by default). The
circle-sharing and circle-review-compose pieces stay conceptually similar
(still on `BookPage`) but the overall page should read as "this is my shelf
entry for this book" first (rate, tag once, quick note, shelf status) with
reviewing as a secondary, clearly separate action underneath, not a wall of
three review editors all visible at once.

**New personal "My Ratings & Notes" view**: a page (or a section on the
existing Wrap/profile page, coordinator's call, lean toward a dedicated
`/my-books` or similar route since the list could get long) listing every
book the user has rated, each showing their own rating, their own tags, and
their own private note, i.e. exactly what they put in, not other people's
public/circle reviews. This is what "when they go to the things they already
ranked it should only show them their inputs" means.

## Section 3: Comments on reviews

New feature: let users comment on other people's public and circle reviews.
Needs a new table (e.g. `review_comments`: id, review_id, user_id, body,
created_at) with RLS mirroring the parent review's visibility (a comment on
a public review is visible to everyone signed in, a comment on a circle
review only to that circle's members, same pattern
`reviews_select_visible` already uses). Keep v1 simple: plain text comments,
authors can delete their own, no nested replies, no likes, matching this
app's "kind and non-toxic by design" cross-cutting rule (CLAUDE.md), validate
input, don't build anything that could amplify harassment (no anonymous
posting, always tied to a real profile).

## Section 4: Profile editing

Let users edit their own `profiles` row (`display_name`, and let them
replace `avatar_url`, either a URL field or, if feasible without adding new
infra, an image upload to Supabase Storage, coordinator's call based on what
already exists in this project, Supabase Storage isn't set up yet as of this
writing, so a simple URL field or keeping the Google avatar with just the
display name editable is the pragmatic v1 unless storage setup turns out to
be cheap). This is what makes comments/reviews feel like they come from "a
specific account" rather than always whatever Google handed over at signup.

## Section 5: Goals (monthly/weekly/yearly) + a streak button

Currently only a yearly goal exists (`reading_goals` table, one row per
`(user_id, year)`). Add monthly and weekly goal support, likely a schema
change (either a `period` column, `'year' | 'month' | 'week'`, plus whatever
key identifies which month/week, or a small new table if that reads
cleaner), all three editable, not just settable once. Also: "have a button
where they can record their streaks", a simple explicit "I read today" /
"log today" action separate from the full page-progress form, so keeping a
streak alive doesn't require knowing your current page number every day.

## Section 6: Shelves polish

"For your shelves get rid of the loading thing, maybe have my little mascot
on there instead": replace the plain "Loading your shelves." text with a
warm mascot-based loading state (small mascot art, gentle animation,
matching the loading-state warmth theme already established). Also let users
input reading progress directly from the Shelves grid (a quick page-count
field or similar per "Reading" shelf item), not only from the Book Page or
Dashboard.

## Section 7: Recommender improvements

Lean harder on the taste quiz answers, make the "why" more specific, and
when the recommender genuinely has nothing good to say (the true cold-start
fallback case), lead with the book's own background info (synopsis, genre,
page count, already available since section 3 of the first refinement phase
enriched every book via Google Books) rather than just a bare "recently
added" label, so a low-confidence pick still gives the user something useful
to judge it by. "Get data from the internet" is already partially true via
Google Books, lean further into that existing integration (its categories,
description) rather than adding a new third-party API mid-build, a new
external data source is its own decision the owner should weigh in on
explicitly, same as the Google Books key was.

## Domain

Resolved directly by the coordinator with the owner before this doc was
written: nibble-jade.vercel.app and nibbles-app.vercel.app were both removed
as project domains (they now 404). **https://readnibbles.vercel.app** is the
sole live domain going forward.
