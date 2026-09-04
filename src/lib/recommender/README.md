# The recommender

Nibble's headline feature: explainable, circle-aware book recommendations.
"Explainable" is the load-bearing word — every recommendation ships with a
plain-language reason, and every piece of that reason traces back to
something you can point at (a word in a lexicon, a tag on a review, a
rating a specific person left). No black-box model anywhere in here.

## How it works

**1. Text analysis** (`textAnalysis.ts`, `lexicon.ts`) — when a review is
saved, its body gets a sentiment score (−1 to +1) and a handful of keyword
"themes", both from simple word-list matching and frequency counting. Not
sentiment analysis in the ML sense — literally (positive words − negative
words) / total, using the hand-picked lists in `lexicon.ts`. Stored on the
review row (`reviews.sentiment_score`, `reviews.extracted_themes`).

**2. Book tag profiles** (`bookTagProfile.ts`) — a book's "identity" for
scoring is how often each tag (mood/pace/spice_level/genre) has been used
across its reviews, PLUS a `genre:*` signal inferred from its Google Books
categories (`addCategoryTagCounts`, reusing the same category-to-tag
matcher as the taste quiz's favorite-book picks, `matchCategoryToGenreTag`
in `quizProfile.ts`). The category half matters a lot early on: most books
have zero reviews for a long while, so `review_tags` alone would leave the
scorer with nothing to match against — Google Books categories are the
only genre signal most candidate books have until real reviews accumulate.
RLS on `review_tags` mirrors each review's own visibility, so the
review-derived half naturally only counts tags from reviews the requesting
user can actually see — no extra privacy logic needed there; the
category-derived half comes straight off the book row, which every
signed-in user can already read.

**3. Taste profiles** (`tasteProfile.ts`) — two layers, added together
rather than one replacing the other (`mergeTagAffinity`):

- _Rating-based_: for each book a user rated, weight its tags by how far
  that rating sits from the user's own average (a 5★ from someone
  averaging 3★ says more than a 5★ from someone averaging 4.5★),
  accumulate per tag, normalize to roughly [−1, 1].
- _Quiz-based_: answers from the onboarding taste quiz (`quizProfile.ts`,
  `TasteQuiz.tsx`), each a direct or inferred `genre:*`/`pace:*`/`mood:*`
  affinity. This is what makes day-one recommendations possible before a
  user has rated anything — see `computeTasteProfile`'s doc comment.

Stored in `taste_profiles.profile` so it doesn't need recomputing on every
page load. Recomputed whenever a rating or review is saved (see
`reviews/data.ts` and `ratings/data.ts`), or the quiz is retaken (see
`saveQuizAnswers`) — call `recomputeTasteProfile(userId)` any other time it
needs refreshing on demand.

**4. Circle signals** (`circleSignals.ts`) — for each candidate book,
check whether the user's circle-mates rated it, weighted by "taste
overlap": how similarly the two of you have rated books you've **both**
read (`scoring.ts`'s `computeTasteOverlap`). Deliberately built only from
the `ratings` table, which is globally readable by design — never by
comparing another user's private `taste_profiles` row, which RLS wouldn't
allow anyway. No shared ratings yet → overlap is 0, an honest "we don't
know" rather than a guess.

**5. Scoring + explanation** (`scoring.ts`) — pure functions, no I/O,
fully unit-tested with fixtures (`scoring.test.ts`). `scoreBook` combines
the tag-match signal with the circle signal into one number.
`explainScore` turns that into the actual sentences a user reads —
this is the function that enforces "never a black box": if there's no real
signal, it says so ("we don't have a specific reason yet") instead of
inventing one.

**6. Orchestration** (`recommend.ts`) — the one function everything else
calls: `getRecommendations(userId)`. Degrades gracefully (`needsFallback`):
falls back to recently-added books, clearly labeled as not personalized,
only when there's truly no signal at all, fewer than
`MIN_RATINGS_FOR_PERSONALIZATION` (currently 3) ratings AND no quiz-seeded
tag affinity either. A user who took the taste quiz gets scored, explained
recommendations from their very first visit, zero ratings needed — never a
fake tag-match explanation for a taste profile that doesn't exist yet.

**7. Discovery** (`discovery.ts`) — once there's a real taste profile,
`recommend.ts` doesn't only score whatever's already in the local catalog.
`topGenreAffinities` picks the taste profile's best-liked genres (quiz
answers and/or ratings), and `discoverBooksForGenres` searches Open
Library's genre-browsing API for each one, pulling in books nobody's
searched for or added yet via the same `getOrCreateBook` path Search.tsx
uses (full Google Books enrichment included, so they carry real genre
categories and score/explain exactly like any other candidate). This is
what makes "recommend books based on the quiz" actually mean something
before the catalog has much in it: a fantasy-loving day-one quiz taker
gets real fantasy books, not just whatever three books happen to already
be in the database. Bounded and best-effort (see the constants at the top
of `discovery.ts`) — a flaky external API skips that genre rather than
breaking the page.

## Public interface

Import from `index.ts`, not the individual files:

```ts
import { getRecommendations, recomputeTasteProfile, analyzeReviewText } from '../lib/recommender'
```

- `getRecommendations(userId, limit?)` → `Recommendation[]`, each with
  `{ book, score, why }`. Powers the Dashboard strip and the Recommendations
  page.
- `recomputeTasteProfile(userId)` / `getOrComputeTasteProfile(userId)` —
  call the former after any rating/review change if you're not already
  going through `reviews/data.ts` or `ratings/data.ts` (which already do).
- `analyzeReviewText(body)` → `{ sentimentScore, extractedThemes }`, used
  by `reviews/data.ts` when saving a review.

## Known limitations / how to improve this later

- **Candidate pool from the local catalog is capped** at the 200 most
  recently added books (`recommend.ts`'s `CANDIDATE_POOL_SIZE`). Fine
  while the catalog is small; once it isn't, either paginate through the
  full catalog or pre-filter candidates by genre overlap with the user's
  taste profile before scoring. Discovery (section 7 above) only widens
  this with a handful of externally-found books per top genre, it doesn't
  remove this cap.
- **Discovery only runs off genre affinity**, not mood/pace, since Open
  Library's subject API is genre-shaped, not mood-shaped. A user whose
  strongest signal is "cozy" or "slow-burn" rather than a specific genre
  won't get much from it, they'll still get scored recommendations from
  the local catalog as before, just without the external boost.
- **Sentiment/themes aren't fed into scoring yet** — they're computed and
  stored on every review, but `scoreBook` only uses tag data so far. A
  natural next step: blend `sentiment_score` into the tag-affinity
  computation (a highly-tagged-but-negative review should pull that tag's
  affinity down harder), or surface `extracted_themes` keywords directly in
  the "why" text.
- **No decay over time** — a rating from a year ago counts exactly as much
  as one from yesterday. Reasonable for now; add a recency weight in
  `computeTasteProfile` if tastes visibly drift.
- **Circle overlap needs co-rated books** — two circle-mates who haven't
  rated any of the same books get overlap 0, so their ratings still count
  (at zero weight) but never explain a recommendation. This self-corrects
  as more people rate more books.
