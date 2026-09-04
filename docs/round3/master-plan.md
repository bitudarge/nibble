# Nibbles round 3: interaction polish + recommender research

Coordinator's organized synthesis of a follow-up message from the owner on
2026-09-04, right after using round 2's changes for the first time. Same
pattern as `docs/round2/master-plan.md`: real quotes cleaned up for clarity,
coordinator's interpretation stated plainly where the request was genuinely
ambiguous.

## Already fixed directly by the coordinator, not delegated

Two real, reproducible bugs, found by exercising the live database as an
authenticated role, both already fixed and merged before this doc was
written:

- **"I can't really form a circle"** — `circles` had no way to see a
  circle you just created before the owner-membership trigger caught up,
  so `createCircle`'s `INSERT ... RETURNING` failed every time. Fixed:
  `supabase/migrations/20260904000004_circles_select_owner.sql`.
- **"For the set goal of the week and month I can't save the goals"** —
  the coordinator's own mistake in round 2 section 5: a partial unique
  index doesn't support Postgres's `ON CONFLICT` inference the way the
  app's upsert needs. Fixed:
  `supabase/migrations/20260904000005_fix_reading_goals_period_conflict_target.sql`.

Also already done directly (small, contained, PR open as of this writing):
dark mode removed entirely (including the OS-`prefers-color-scheme`
auto-activation, likely why it showed up unprompted), the avatar now links
to `/wrap`, the Shelves empty-state icon no longer wiggles.

## Section 1: Progress tracking + a less boring streak

The owner's words, cleaned up: "for the currently reading I want to track
progress whenever I want to do that, with like the lines... for the streak
you can't really record on the phone... I want to record the streak in a
better manner that's more interactive, the one that's there now is kind of
boring."

**Root cause of "can't record on the phone"**: both `Home.tsx`'s
"Currently reading" quick-update and `Shelves.tsx`'s inline progress
button use `window.prompt()`. Native browser prompts are known to behave
unreliably or not appear at all inside an installed PWA's standalone mode
on several mobile browsers (round 2 section 1 made this app installable),
which lines up with the complaint. Replace both with a real in-page
control, an interactive progress bar/slider ("with like the lines"), not a
native dialog. Reuse `logReadingProgress` (`src/lib/sessions/data.ts`)
exactly as both call sites already do, this is a UI change, not a data
layer change.

**Streak**: the current "I read today" button (`Home.tsx`) is a small
plain pill. Make it feel like a real moment, not just a functional
button, bigger, with its own satisfying tap animation (in the spirit of
the existing celebration/press-feedback patterns already in this app,
`src/components/celebrate/`, `active:scale-95` throughout), possibly
integrated with the streak-dots display itself (e.g. tapping today's dot).
Keep the underlying behavior (`recordStreakToday` in `Home.tsx`) as-is,
this is a presentation/interaction change.

## Section 2: Circle creation needs an invite moment

"For the circles page... I should be able to invite people when I create a
circle." Today, `Circles.tsx`'s `handleCreate` creates the circle and
immediately navigates to `/circles/:id`, where the invite code is shown as
plain text (`CircleHome.tsx`, "Invite code SOFA-24"). There's no prominent
"share this now" moment. Add one: right after creating a circle, make the
join code easy to copy/share immediately (a copy-to-clipboard button at
minimum; the Web Share API where available, falling back gracefully where
it isn't), either as a brief confirmation step before navigating to the
circle, or as a prominent first-arrival banner on the circle page itself.
Coordinator's call on exact mechanics.

## Section 3: A real first-time rating experience

The owner's words, cleaned up: "once I rate a book, the first time I want
it to be a whole different experience, immersive and interactive, rate a
book then an interactive way of putting the genre and stuff and writing
notes, then it saves, and I won't see the edit page, I'll just see the
information, with a little edit sign, whenever I go in I just want to see
my input without it being like the first time."

**Coordinator's interpretation**: right now (round 2 section 2),
`QuickNoteNudge` already does "rate then tag+note inline", but it's a
small, compact, always-inline widget, not the "immersive" moment being
asked for, and `BookPage.tsx`'s "My Notes" section always renders the full
`ReviewEditor` FORM (editable textarea + tags), whether or not a note
already exists, which is the "I just see the edit page" complaint.

Two changes:

1. **First-time rating**: replace (or significantly expand) the current
   compact `QuickNoteNudge` with a more immersive, dedicated interactive
   step, still triggered by rating a book for the first time, still saves
   into the same private review row, but should feel like a real moment
   (more space, clearer flow through genre/mood tagging then a note, a
   satisfying finish), not a cramped inline card. A full-screen step or a
   prominent modal/sheet are both reasonable, coordinator's call on exact
   presentation, but it must still be quick (a handful of taps plus
   optional text, not a long form) and skippable, matching this app's
   existing "quick and gentle" interaction philosophy.
2. **Read-only "My Notes" after that**: once a private note exists,
   `BookPage.tsx` should show it as read-only information (rating, tags,
   note text) with a small, clearly secondary "edit" affordance, not the
   full editable form by default. Tapping edit reveals the same editing
   capability that exists today. This mirrors the "Write a Review" pattern
   already established in round 2 section 2 (secondary reveal-on-click),
   apply the same shape here.

## Section 4: Recommender, research only, wait for approval

"I want the recommendation system to be better as well, please research
and get data from a public source on books to recommend until we get more
reviews, those can be added on information on top of what we have right
now."

This reopens the external-dataset question from round 1 section 7, which
the owner previously chose to skip. Per the owner's own original rule
(`docs/refinement/master-prompt.md` section 7, still the standing policy):
before using ANY external dataset, verify its license permits commercial
use and redistribution, report the dataset name and exact license, and
WAIT for explicit approval. Do NOT use the UCSD Book Graph / Goodreads
scrape (academic-only). Prefer clearly permissive licenses (CC0, CC-BY,
public domain).

**This section is research and reporting only.** No integration code gets
written until the owner has seen the specific dataset and its license and
said yes.
