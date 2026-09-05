# Nibbles round 4: mockup-driven redesign

Coordinator's organized synthesis of an owner message on 2026-09-04 that
attached a full interactive HTML/CSS/JS mockup (`Nibbles App v4 (offline).html`,
a self-contained single-file export with embedded fonts/images and its own
tiny declarative-template runtime), a new mascot sprite sheet, and a new
"Nibbles" wordmark logo. Same pattern as the other round docs: real
requests cleaned up for clarity, coordinator's interpretation stated
plainly wherever the request was ambiguous or where the mockup's own
behavior was mockup-only scaffolding rather than real design intent.

The owner's instruction: implement the mockup's UI/UX "as is, like the
clicks and stuff", with an explicit list of deviations (below). A full
research pass extracted every screen, color, font, copy string, and click
handler from the mockup's embedded JS into a working spec before any of
this was written — see the coordinator's own notes for methodology if
this doc needs revisiting.

**Important finding from that research**: the mockup is a _visual/flow_
prototype with entirely fake data (a hardcoded name "Bitu", static fixture
book ratings that never actually average anything, circles that don't
really get created, an in-app "Preview app states" debug panel for the
design handoff itself). None of that fake-data machinery is being ported.
What's being adopted is the **visual design system and the navigation/
interaction patterns**, wired into this app's real Supabase-backed data
the same way every other page already is.

## Deviations the owner asked for, explicitly (override the mockup where these conflict)

1. Profile section needs a real sign-out control, reachable on the phone
   specifically (the mockup has no sign-out anywhere, and this app's own
   sign-out currently only exists in the desktop-only hamburger menu — a
   real, previously-unnoticed mobile gap).
2. Whole app: keep optimizing for phone use as the primary surface.
3. Discover: category rows personalized to what the owner picked on the
   taste quiz (e.g. picked "thriller" → a "Thriller" shelf of real books),
   not the mockup's fixed, unpersonalized 6-mood chip list.
4. Picks/Recs: two tabs, "Recs" and "From circles". Drop the mockup's
   third "Short reads" tab entirely.
5. Circles: no changes. The owner likes the current implementation as-is,
   explicitly excluded from this round.
6. Book detail page: split into tabs — About, Your circle, Your notes,
   Review — instead of one long scrolling page (the mockup doesn't tab
   this page at all, it's the owner's own ask).
7. Ratings: the mockup's own rating widget is a plain whole-star 1-5 tap
   (its "4.7"-style decimal numbers are static fixture data, not a real
   average). The owner wants the real aggregate average shown to a
   decimal (this app already computes and shows that, `.toFixed(1)`, see
   below) and wants people who rate without writing a review to still
   show up in the reviews list, not just get folded silently into the
   average.
8. Profile customization: real photo/name editing already exists (round 2
   section 4); add a preset "pick a mascot" avatar option using the new
   mascot art, alongside the existing photo-URL field.
9. New logo everywhere, and it must actually render on the phone header
   (today's phone header shows only the bare mascot mark, not the
   wordmark — the mockup's own phone-only design shows the full lockup at
   34px in exactly this spot, which is what "visible on the phone too"
   is asking for).
10. New mascot poses for specific empty/edge states: a "sick, wrapped in
    a blanket with tea" pose next to the rest-day-banked sign, and a
    cheerful pose for the empty-shelf "go discover more" state.

Everything else in the mockup (design tokens, the 3D pressable button
style, the floating bottom tab bar, per-screen layout/copy patterns) is
adopted as the new visual/interaction baseline, translated onto this
app's real routes and data rather than copied as static markup.

## Section 0: Foundation — design tokens, fonts, buttons, nav, brand assets

Blocking — every other section builds on this, so it lands and merges
first.

- New color palette in `src/index.css`, sourced directly from the
  mockup's own hex values (all-green, no pink/red/yellow anywhere,
  including error states — matches this app's existing light-only
  palette, just a different specific set of greens):
  `--nibbles-page:#F5FBF1`, `--nibbles-surface:#FFFFFF`,
  `--nibbles-ink:#2F4726`, `--nibbles-muted:#6E8562`,
  `--nibbles-line:#EAF5E2`, `--nibbles-tint:#F7FCF3`,
  `--nibbles-sage:#7CC05A`, `--nibbles-sage-deep:#4C8A33`,
  `--nibbles-leaf:#E9F5E0`, `--nibbles-on-leaf:#3A6B26`. The
  honey/celebration slot (already green-toned, not yellow, since round 2)
  moves to `#5FA23F` family to stay in the same green range as everything
  else.
- New display font: "Baloo 2" (Google Fonts, weights 500/600/700/800),
  replacing "Lora" as `--font-display`. Nunito stays the body font.
- A reusable 3D "pressable" button treatment for primary CTAs (flat
  `box-shadow: 0 4px 0 <darker-green>`, no blur, that collapses to
  `translateY(4px); box-shadow: 0 0 0` on press) — the mockup's most
  distinctive interaction signature. Applied to the app's existing
  primary-action buttons (not every button — secondary/outline buttons
  keep the existing `active:scale-95` press feedback, matching the
  mockup's own split between primary CTA vs. secondary buttons).
- Bottom tab bar restyled as a floating rounded pill (matching the
  mockup's floating bar with margin on all sides), not a full-width bar
  flush against the screen edges.
- New brand assets replacing `src/assets/brand/nibbles-mascot.png` and
  `nibbles-logo-lockup.png` with the owner's new artwork. Mobile header
  switches from the bare mark to the full lockup (matches the mockup's
  own phone-only header, which always shows the full "Nibbles" wordmark,
  never just the bug icon alone).
- New bundled mascot pose images (cropped and background-verified
  transparent by the coordinator from the owner's sprite sheet) added to
  `src/assets/brand/`: an "eating a leaf, happy" pose, a "wrapped in a
  blanket with tea" pose, and a cheerful "idea" pose — used in sections 5
  and 6 below.

## Section 1: Discover — personalized genre shelves

Below the existing search bar and mood chips (both stay, they're a
distinct, still-useful feature), add one horizontal shelf of real books
per genre the owner picked on the taste quiz (`taste_profiles.profile`,
via the taste-quiz answers already stored, same `QUIZ_GENRE_OPTIONS`
vocabulary the recommender already uses). Populate each shelf with
`searchOpenLibraryBySubject` (already built for the recommender's
discovery feature this session) — reuses existing infrastructure rather
than inventing a new external-data path. Tapping a book opens it via the
same `getOrCreateBook` flow the manual search results already use.
Someone who hasn't taken the quiz just sees the existing search + mood
chips, no empty/broken shelf section.

## Section 2: Recs/Picks — two tabs

Add a 2-segment pill control to `Recommendations.tsx`: **Recs** (today's
existing scored list, unchanged) and **From circles** (the same pool,
filtered to books where at least one circle-mate has a real signal —
`getCircleSignals` already computes this for scoring, this just surfaces
it as its own filtered view instead of only folding it into one blended
score). No "Short reads" tab, per the owner's explicit ask.

## Section 3: Book detail page — tabs

Restructure `BookPage.tsx` from one long scroll into 4 tabs:

- **About**: cover, title/author, aggregate rating chip, the primary
  shelf-status action, the "About this book" blurb/tags/facts.
- **Your circle**: the existing circle-reading-together section.
- **Your notes**: the existing private-notes section (round 3's
  first-rating flow / read-only summary), unchanged behavior, just moved
  under its own tab.
- **Review**: the existing "Write a Review" reveal-on-click, the public
  reviews list, and comments — plus a new lightweight entry type in that
  list for someone who rated the book but never wrote/published a review
  (a one-line "so-and-so rated it ★4" row, no text, visually distinct
  from a full review card), so a bare rating is visible somewhere besides
  just moving the invisible average number. Ratings are already globally
  readable (the recommender's circle-signal code already relies on this),
  so this is a display-layer addition, not an RLS change.

The aggregate rating chip itself needs no change — `getAggregateRating` /
`aggregateLabel` already compute and show a real decimal average
(`toFixed(1)`, e.g. "4.7 average") from every actual rating, review or
not; the mockup's own decimals were static fixture numbers, this app's
were already real.

## Section 4: Profile — sign out + mascot avatar picker

- Add a real, visible **Sign out** button directly on `Wrap.tsx` (the
  "You" page), not only inside the desktop-only hamburger menu — this is
  the fix for deviation #1 above, a genuine mobile gap since there is
  currently no way to sign out at all from a phone.
- `EditProfile.tsx`: add a small grid of preset mascot avatar images
  (the new pose art from section 0, plus the app's existing mascot marks)
  as one-tap avatar choices, alongside the existing photo-URL field —
  picking one just sets `avatar_url` to that bundled asset's resolved
  URL, no Storage bucket needed (matches the existing plain-URL
  architecture note in CLAUDE.md).

## Section 5: Home — rest-day banking + empty-shelf mascot

New mechanic, not previously in this app (found in the mockup, not
separately requested in words, but implementing the mockup "as is"
includes it): a **banked rest day** that protects your streak across a
single missed day.

**Real semantics** (the mockup's own rest-day logic is fake — a single
pre-seeded flag with no earning rule and a "Use it" button that doesn't
actually touch the streak; a real backend needs real rules):

- `reading_streaks` gets a `rest_days_banked int not null default 0`
  column.
- The streak trigger (`update_reading_streak`, migration `20260902000005`)
  grants one banked rest day every 7-day streak milestone, capped at 2
  banked at once.
- When a session lands exactly one day after the last one AND a rest day
  is banked, the trigger now continues the streak (consuming one banked
  day) instead of resetting it to 1. A gap of 2+ missed days still resets
  the streak regardless — a rest day only ever covers one missed day.
- This app's banner is **informational, not a manual "consume" button**:
  since the trigger already auto-applies a banked day the moment it's
  actually needed, a fake "Use it" click that doesn't do anything real
  (the mockup's own doesn't either) would be the opposite of this app's
  "never a black box" ethos. The banner instead reads something like "N
  rest day(s) banked — miss a day and your streak survives," next to the
  new "wrapped in a blanket with tea" mascot pose (read as a cozy day off,
  not literal illness).
- This is a live-database trigger change — gets the same rigorous direct-
  RLS/trigger testing discipline as every other schema change this
  project has made (reproduce, verify, clean up test data).

Also: `Shelves.tsx`'s empty-state (currently a static line-drawing swoosh,
wiggle already removed in round 3) gets the new cheerful "idea" mascot
pose with copy inviting the reader to Discover, replacing the plain
swoosh icon.

## What's explicitly not being ported from the mockup

- The hardcoded "Bitu" name, fake fixture ratings/reviews, non-functional
  create/join-circle toasts, and the in-app "Preview app states" debug
  panel — all mockup/handoff scaffolding, not real app behavior.
- Circles screens — explicit owner exception (deviation #5).
- The mockup's persistent header streak-pill/"You" button and its shallow
  single-stack navigation model — this app is a real multi-route React
  Router app with its own working back-navigation and an already-solid
  streak UI (round 3), that architecture isn't being replaced to match a
  single-page mockup's own nav shortcuts.
