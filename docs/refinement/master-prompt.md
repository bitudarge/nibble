# Nibbles refinement phase — master prompt

This is the owner's original spec for the current refinement phase (features
+ design, shipped together). It's copied here verbatim so it survives outside
chat history and the Downloads folder. The paired visual reference is
`Nibbles-design-mockup.html` in this same folder.

Decisions made while starting Section 1 (see CLAUDE.md's "Refinement phase"
section for the summary):

- The app is called **Nibbles** (not "Nibble") going forward, matching this
  document and the mockup.
- Dark mode (day/night reading toggle) is in scope from Section 1 onward —
  the mockup ships a complete dark palette as CSS variables, so it rides
  along with the token work rather than being deferred.
- The bottom tab bar / sidebar has six items: Home, Discover, Shelves,
  Circles, Recs, You. Recommendations keeps its own tab rather than folding
  into Home, unlike the mockup's five-tab bar. Discover maps to the existing
  Search page; You maps to the existing Wrap page.
- The logo is a plain text wordmark for now (`src/components/brand/Logo.tsx`),
  not the mockup's bookworm icon — the owner is designing their own logo.

---

## The design reference

I'm providing **`Nibbles-design-mockup.html`** — a self-contained prototype of
the whole app. **Open and study it.** It shows the intended look and feel for
every page (dashboard, search, shelves, circles, circle detail, book page,
recommendations, profile/"2026 wrap") and it already reflects the review model
below (private journal, public reviews, "from your circle," spoiler-tap). Match
its aesthetic, layout, spacing, and warmth in the real React app — reproduce the
*feel* in our real components, keeping all existing logic, routes, and Supabase
wiring intact. It's a visual reference, not code to copy wholesale.

> I'll swap the logo and tweak some elements myself later. Build the design system
> cleanly: logo isolated in one component, colors as tokens, so those are easy to
> change.

### Design system (use these exact values, pulled from the mockup)

**Colors — define as CSS variables / Tailwind theme tokens:**

- Creams / surfaces: `#FFFCF4` (primary surface), `#FBF6EA`, `#F3EBD9`,
  `#EFE9DC`, `#E9E0CC` (warm borders/dividers), `#E6DCC8`.
- Greens (brand): `#4F7B58` (primary), `#3C6144` (deep), `#E4EEE1` / `#EFF5EC`
  (soft green tints for chips/section backgrounds).
- Yellows (accent): `#F2C14E` (honey), `#E8B65C` (deeper honey) — streaks,
  highlights, happy moments.
- Text / neutrals: `#3A322A` (primary warm near-black), `#8A7C69` / `#7A6E60`
  (muted warm brown for secondary text).

**Type:**

- **Lora** (serif) for headings, book titles, warm display text.
- **Nunito** (rounded sans) for UI, body, buttons, labels.
- Comfortable phone-reading sizes, clear hierarchy. (Ignore the JetBrains Mono in
  the file, it is not part of this app's style.)

**Shape & feel:**

- Rounded and bubbly: generous soft corners on cards, buttons, inputs, covers.
  Nothing sharp.
- Soft, subtle shadows and gentle depth so cards lift off the cream background.
- Cozy, calm, friendly, like a warm reading nook. Roomy padding, not cramped.

---

## Build order

Each section pairs the FUNCTION (what it does) with the LOOK (how it should feel
per the mockup). Do them in order; STOP after each.

### 1. Design system + app shell (foundation for everything below)

- Implement the color tokens, fonts (Lora + Nunito), rounded components, and soft
  shadows as a shared theme. Isolate the logo in one swappable component.
- Restyle the global shell to match the mockup: phone **bottom tab bar**, a warm
  cream background, soft header, and a sensible wider **desktop** layout (sidebar
  nav / grid) rather than a stretched mobile view.
- Everything **responsive, mobile-first**; verify common phone and desktop widths,
  nothing overflows or breaks between breakpoints.
- **STOP** for review.

### 2. Dynamic (type-ahead) book search, function + look

- Replace search-on-submit with **live results as the user types.**
- **Debounce** input (~300ms after typing stops) before calling the book API;
  cancel in-flight requests that are superseded. Don't fire per keystroke.
- Style it as the mockup's "What are we nibbling on?" search: cozy input,
  tappable results, mood-suggestion chips ("cosy", "quiet", "slow burn"), and the
  warm "Nibbles found nothing" empty state.
- Subtle loading indicator; handle empty results and API errors gracefully (never
  a blank screen). Thumb-friendly on phone.
- **STOP** for review.

### 3. Richer book data, Google Books primary, Open Library fallback

- Use **Google Books API as the primary source** for each book's rich detail:
  description/synopsis, categories/genre, page count, published date, good cover.
  **Fall back to Open Library** when a field or cover is missing.
- Store enriched fields on the existing `books` table (extras in the `metadata`
  jsonb). Keep dedupe so everyone converges on one canonical page per book.
- Restyle the **Book Page** per the mockup: cover as hero, synopsis, genre/tags as
  rounded chips, page count, publish year, star rating, shelf + "Log progress."
- If a Google Books API key is needed for reliability, tell me exactly how to
  create one and where to put it (`.env`, never committed).
- **STOP** for review.

### 4. Onboarding taste quiz (cold-start for the recommender), function + look

- After signup, run a short, friendly **taste quiz** that seeds recommendations
  before the user has rated anything.
- **5-7 questions, tap-based, skippable.** Examples: favorite genres
  (multi-select), preferred pace (fast/slow), light vs. heavy themes, fiction vs.
  non-fiction lean, a few favorite books (optional search-to-add), how much they
  read.
- Save answers into the existing **`taste_profiles`** table as the starting
  profile the recommender reads from. Let users **re-take / edit** later in
  settings.
- Style it warm and cozy, on-brand with the mockup: rounded chip choices, gentle
  progress, Nibbles-worm warmth. The recommender must use this profile immediately
  so day-one recs are personalized with zero ratings.
- **STOP** for review.

### 5. Rework the review system, model + make it interactive (function + look)

Keep the model from the mockup and our earlier decision, and make it feel great.

**The model (reuse the existing `reviews` table + its `visibility` field):**

- **"My Notes", private reading journal (memory aid).** On every book page, a
  private space visible ONLY to the author (never public; only to a circle if they
  explicitly share). Always private by nature, **no visibility choice to make.**
  Freeform, low-pressure, easy to add/edit. → `visibility = private`.
- **"Write a Review", opt-in public review (social layer).** A separate action
  for sharing a take publicly. Public by nature, no visibility toggle at write
  time. Optional. → `visibility = public`.
- **Anti-forgetting nudge.** When a user **rates** a book (taps stars), offer an
  **optional one-line quick note** that saves to their private "My Notes." One tap
  to skip. Builds the habit of capturing a thought before it's forgotten.
- **Circle sharing.** A **"share to circle"** button on an existing note or review,
  not a third compose flow. → `visibility = circle` with `circle_id` set.
- A user may have BOTH a private note and a public review for the same book, no
  constraint blocking that.

**Make it interactive and dynamic (the part I want to feel really nice):**

- Style "My Notes", "Public reviews", and "From your circle" as distinct, softly
  separated sections per the mockup.
- **Spoiler reviews:** the "Spoilers, tap to peek" interaction, blurred/hidden
  until tapped, smooth reveal.
- **Rating interaction:** tapping stars feels satisfying (soft animation) and
  prompts the optional one-line note inline, no heavy modal.
- **Dynamic touches:** optimistic UI (show the note/review immediately, confirm in
  the background), smooth transitions on add/save, tasteful quick micro-animations
  on save / finish / streak. Motion stays quick and gentle.
- **STOP** for review.

### 6. Restyle the remaining pages to match the mockup

Apply the look to everything not covered above, preserving behavior:

- **Dashboard:** warm greeting, streak (honey accent), yearly goal, "Currently
  reading" cards with progress + Update, "Recommended next" strip, "Circle
  activity."
- **Shelves:** three shelves with cover grids and the "Nothing on this shelf yet"
  empty state.
- **Recommendations:** each pick shown with its plain-language reason (never a
  black box).
- **Circles + circle detail:** the "small rooms, not a public feed" styling,
  members, reading-together progress, discussion, showcase, invite code.
- **Profile / 2026 wrap:** stats, top tags, favourites, the shareable wrap look.
- **STOP** for review.

### 7. Seed the recommender responsibly (cold-start data), RESEARCH FIRST

We have no users yet, so recommendations need help on day one WITHOUT faking
reviews or breaking any license.

1. **Primary cold-start = the onboarding taste quiz (section 4) + Google Books
   genre/category metadata.** Fully ours, license-free. Make the recommender
   produce good results from these alone.
2. **Optional bonus, an external ratings dataset:** before using ANY dataset,
   **verify its license permits commercial use and redistribution in an app**,
   report the dataset name and exact license to me, and **WAIT for approval.**
   **Do NOT use the UCSD Book Graph / Goodreads scrape** (academic/non-commercial
   only). Prefer clearly permissive licenses (CC0 / CC-BY / public domain); check
   each individually.
3. **Never display external/seeded data as a real user review.** Seeded data is
   background signal for the recommender only. All **visible** reviews/notes come
   from real Nibbles users.
4. Books with no reviews get **warm empty states** (Nibbles-worm "Be the first to
   share a thought!"), not fake content.

- **STOP** before integrating any external dataset.

### 8. Interaction & motion polish pass (whole app)

- Buttons gently press; cards respond to tap; page transitions are smooth.
- Warm, on-brand loading and empty states everywhere (no blank screens).
- Honey-accented delight on finishing a book / hitting a streak (tasteful, brief;
  a soft flutter, not confetti overload).
- Verify thumb-friendly targets on phone and a good desktop experience.
- **STOP** for review.

---

## Content & copy law (applies to ALL text in the app)

- **Never use em dashes (—) anywhere** in UI text, copy, labels, empty states,
  or placeholders. Use a period, a comma, or a short connecting word.
- **No "AI slop" phrasing.** Keep copy warm, plain, human, specific. Avoid generic
  filler and stock AI-assistant phrasing ("unlock your reading journey," "dive
  into," "elevate," "seamless," "delve," "curated just for you," "in today's
  fast-paced world"). Write like a real person who loves books: short, warm,
  concrete, in the mockup's voice ("Nibbles is hungry. Find something to nibble
  on.").
- Avoid emoji unless it clearly fits a cozy moment and the owner approves it.

## Performance & logistics (apply throughout)

- Debounced/cancelable API calls (search especially); don't hammer Open Library or
  Google Books.
- Paginate long lists (shelves, reviews, circle feeds); lean on the existing
  indexes; fetch only what a screen needs.
- Optimistic UI where it helps responsiveness, with background confirmation and
  graceful rollback on failure.
- Keep the app fast and smooth on a mid-range phone. Keep animations quick and
  gentle (respect reduced-motion).

## Cross-cutting

- Follow `CLAUDE.md`: PRs only, keep RLS and data wiring intact, no hardcoded
  secrets, friendly loading/empty/error states, validate all input.
- Do NOT break existing functionality, this is refinement, not a rebuild.
- Keep the logo and color tokens easy for the owner to change later.
- Explain significant choices briefly (the owner is learning). If anything is
  ambiguous, ASK before building. Don't assume.
