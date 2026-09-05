import { enrichBook, getRecentlyAddedBooks } from '../books/data'
import { getShelfItemsWithBooks } from '../shelf/data'
import type { Book } from '../../types/database'
import { getBookTagProfiles } from './bookTagProfile'
import { getCircleSignals } from './circleSignals'
import { getDismissedBookIds } from './dismissals'
import { discoverBooksByAuthors, discoverBooksForGenres, discoverPopularBooks } from './discovery'
import { NO_REASON_YET_MESSAGE, explainScore, scoreBook } from './scoring'
import { MIN_RATINGS_FOR_PERSONALIZATION, getOrComputeTasteProfile } from './tasteProfile'
import type { CircleSignal, TasteProfileData } from './types'

// How many recently-added books to consider scoring. A known MVP limit: as
// the catalog grows past this, older books stop being candidates at all.
// Fine while the catalog is small; see README.md for how to fix this later
// (paginate through the full catalog, or pre-filter by genre overlap).
const CANDIDATE_POOL_SIZE = 200

export interface Recommendation {
  book: Book
  score: number
  why: string[]
  /**
   * True for the true-cold-start fallback (recently-added books, no real
   * personalization reason yet). Recommendations.tsx uses this to show the
   * book's own Google Books synopsis/genres instead of a scored "why" list,
   * so a low-confidence pick still gives the reader something concrete to
   * judge it by rather than just a title and an apology.
   */
  isFallback?: boolean
  /**
   * Circle-mates' ratings of this book, the same signals already blended
   * into `score` (see scoreBook in scoring.ts) — exposed here, not just
   * internally, so the UI (Recommendations.tsx's "From circles" tab) can
   * offer a filtered view of "recommendations with real circle signal"
   * without recomputing or duplicating any scoring logic. Always empty
   * for the true-cold-start fallback (isFallback: true): those are
   * recently-added books that never went through real scoring at all, so
   * there is no real signal to show even if a circle-mate happens to have
   * rated one.
   */
  circleSignals: CircleSignal[]
}

/**
 * True when at least one circle-mate has a real signal (rated it) on this
 * recommendation. What the Recommendations page's "From circles" tab
 * filters on — pure and exported so the UI never has to guess at, or
 * duplicate, what counts as "real" circle signal.
 */
export function hasCircleSignal(rec: Pick<Recommendation, 'circleSignals'>): boolean {
  return rec.circleSignals.length > 0
}

/**
 * True when a scored recommendation's "why" is a real, specific reason
 * rather than just `explainScore`'s generic no-signal filler sentence.
 * Pure and exported so `getRecommendations`'s filtering is testable
 * without a database, same reasoning as `hasCircleSignal` above.
 */
export function hasRealReason(why: string[]): boolean {
  return why.length > 0 && !(why.length === 1 && why[0] === NO_REASON_YET_MESSAGE)
}

/**
 * True when there's not enough signal to personalize yet: too few ratings
 * AND no quiz-seeded tag affinity either. A user who's taken the taste
 * quiz gets scored recommendations right away even with zero ratings,
 * since tagAffinity already carries quiz-derived signal by then (see
 * mergeTagAffinity in tasteProfile.ts). Pure, so it's testable without a
 * database.
 */
export function needsFallback(tasteProfile: TasteProfileData): boolean {
  return (
    tasteProfile.ratedBookCount < MIN_RATINGS_FOR_PERSONALIZATION &&
    Object.keys(tasteProfile.tagAffinity).length === 0
  )
}

/**
 * The genres a taste profile likes best, most-affinity-first, as bare
 * genre names ("fantasy", not "genre:fantasy"). Feeds `discovery.ts`'s
 * external Open Library search — pure and testable without a database,
 * same reasoning as `needsFallback` above.
 */
export function topGenreAffinities(tagAffinity: Record<string, number>, limit = 3): string[] {
  return Object.entries(tagAffinity)
    .filter(([tag, value]) => tag.startsWith('genre:') && value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag.slice('genre:'.length))
}

/**
 * Distinct authors from the reader's own shelf, most-recently-added
 * first — any shelf status counts (want-to-read included, not just
 * finished/rated), since the owner asked specifically for "if the user
 * adds [a book] in their library or list" to drive more-like-this picks,
 * not only a book they've already rated. Feeds `discovery.ts`'s
 * `discoverBooksByAuthors` — pure and testable without a database, same
 * reasoning as `topGenreAffinities` below.
 */
export function recentShelfAuthors(
  shelfItems: { updated_at: string; books: { author: string | null } }[],
): string[] {
  const seen = new Set<string>()
  const authors: string[] = []
  // Already ordered most-recently-updated first by getShelfItemsWithBooks,
  // but sort defensively here too so this stays correct for any caller.
  const sorted = [...shelfItems].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  for (const item of sorted) {
    const author = item.books.author
    if (!author || seen.has(author)) continue
    seen.add(author)
    authors.push(author)
  }
  return authors
}

/**
 * The recommender's one public entry point for "what should I read next".
 * Degrades gracefully: with no ratings and no quiz signal, falls back to
 * recently-added books with an honest label rather than a fake "why".
 */
export async function getRecommendations(userId: string, limit = 10): Promise<Recommendation[]> {
  const [shelfItems, dismissedBookIds] = await Promise.all([
    getShelfItemsWithBooks(userId),
    getDismissedBookIds(userId),
  ])
  // "Not for me" excludes a book from every future call the same way a
  // shelved one already is — one combined exclusion list rather than two
  // separate ones threaded through the rest of this function.
  const excludedBookIds = [...shelfItems.map((item) => item.book_id), ...dismissedBookIds]

  const tasteProfile = await getOrComputeTasteProfile(userId)

  if (needsFallback(tasteProfile)) {
    const remaining = MIN_RATINGS_FOR_PERSONALIZATION - tasteProfile.ratedBookCount
    const fallback = await getRecentlyAddedBooks(excludedBookIds, limit)
    return fallback.map((book) => ({
      book,
      score: 0,
      why: [
        `Rate ${remaining} more book${remaining === 1 ? '' : 's'} to personalize this, or take the taste quiz for a head start. Showing recently added books for now.`,
      ],
      isFallback: true,
      // No real scoring ran for these, so there's no real circle signal to
      // report either, even if a circle-mate happens to have rated one.
      circleSignals: [],
    }))
  }

  const candidates = await getRecentlyAddedBooks(excludedBookIds, CANDIDATE_POOL_SIZE)

  // Widen the pool past whatever's already in the catalog: search Open
  // Library for the genres this taste profile likes best (quiz-seeded or
  // rating-derived, topGenreAffinities doesn't care which) and pull in
  // books nobody's added yet. See discovery.ts for why this is bounded and
  // best-effort — a flaky external API should never take down the whole
  // recommendations page.
  const topGenres = topGenreAffinities(tasteProfile.tagAffinity)
  if (topGenres.length > 0) {
    try {
      const excludeIds = new Set([...excludedBookIds, ...candidates.map((book) => book.id)])
      const discovered = await discoverBooksForGenres(
        topGenres,
        excludeIds,
        tasteProfile.quiz?.answers.recencyPreference,
      )
      candidates.push(...discovered)
    } catch {
      // Discovery is a bonus signal on top of the existing catalog, not a
      // hard dependency, fall through with whatever candidates exist.
    }
  }

  // A few current bestsellers, regardless of the taste profile's own
  // genre affinities — the owner asked for popular picks "in the mix...
  // to create more diversity" rather than recommendations narrowing to
  // only ever the same handful of favored genres. Tracked separately so
  // one can still be shown even with no personal tag-match reason (see
  // popularBookIds below) — being a current bestseller is itself an
  // honest reason, not a black-box one.
  const popularBookIds = new Set<string>()
  try {
    const excludeIds = new Set([...excludedBookIds, ...candidates.map((book) => book.id)])
    const popular = await discoverPopularBooks(excludeIds)
    for (const book of popular) popularBookIds.add(book.id)
    candidates.push(...popular)
  } catch {
    // Same reasoning as genre discovery above: a bonus signal, not a hard
    // dependency.
  }

  // "If the user adds in their library or list, recommend some other
  // books by the author" — any shelf status counts, not just rated
  // books, since adding a book to a list is itself a real signal even
  // before it's read. Tracked with the specific author that earned each
  // match (see authorMatchReasons below), same honest-fallback shape as
  // the bestseller reason above.
  const authorMatchReasons = new Map<string, string>()
  try {
    const excludeIds = new Set([...excludedBookIds, ...candidates.map((book) => book.id)])
    const byAuthor = await discoverBooksByAuthors(recentShelfAuthors(shelfItems), excludeIds)
    for (const { book, author } of byAuthor) {
      authorMatchReasons.set(book.id, `You added a book by ${author} — here's another.`)
      candidates.push(book)
    }
  } catch {
    // Same reasoning as the other discovery calls above: a bonus signal,
    // not a hard dependency.
  }

  if (candidates.length === 0) return []

  const candidateIds = candidates.map((book) => book.id)
  const [tagProfiles, circleSignals] = await Promise.all([
    getBookTagProfiles(candidateIds),
    getCircleSignals(userId, candidateIds),
  ])

  const scored = candidates.map((book) => {
    const tagProfile = tagProfiles.get(book.id) ?? { bookId: book.id, tagCounts: {} }
    const signals = circleSignals.get(book.id) ?? []
    const result = scoreBook(tasteProfile, tagProfile, signals)
    let why = explainScore(result)
    // A personal tag match (quiz answers or past ratings) is the
    // recommender's strongest, most specific signal — the owner asked
    // for onboarding-quiz-based picks "to be first," so this is tracked
    // separately from score alone (a discovered bestseller/author match
    // can still out-score a weak tag match numerically) and used to sort
    // ahead of everything else below, regardless of relative score.
    const hasPersonalMatch = result.tagMatches.some((m) => m.contribution > 0)
    // A bestseller or same-author pick that happens to also match the
    // taste profile keeps its real, specific reason from explainScore
    // above; one that doesn't gets one of these instead of being dropped
    // by hasRealReason below — both are honest, non-fabricated signals,
    // not the generic "we don't have a reason yet" filler that IS worth
    // excluding. Author match checked first: it's the more specific of
    // the two when a book somehow qualifies as both.
    if (!hasRealReason(why)) {
      const authorReason = authorMatchReasons.get(book.id)
      if (authorReason) why = [authorReason]
      else if (popularBookIds.has(book.id)) {
        why = ['A current bestseller, worth a look even without a personal match yet.']
      }
    }
    return { book, score: result.score, why, circleSignals: signals, hasPersonalMatch }
  })

  // The owner asked to never show the generic "we don't have a specific
  // reason yet" filler for now, and to lean entirely on quiz-derived (or
  // rating-derived) affinity instead — a candidate that only ever produced
  // that fallback sentence didn't actually match anything the taste
  // profile knows about, so it's excluded here rather than shown with an
  // empty-feeling explanation. This can return fewer than `limit`.
  const withRealReasons = scored.filter((rec) => hasRealReason(rec.why))

  const ranked = withRealReasons
    .sort((a, b) => {
      // Personal-taste matches (quiz/ratings) always rank above bestseller-
      // or author-only picks, regardless of score — see hasPersonalMatch's
      // own comment above for why this isn't just left to score ordering.
      if (a.hasPersonalMatch !== b.hasPersonalMatch) return a.hasPersonalMatch ? -1 : 1
      return b.score - a.score
    })
    .slice(0, limit)

  // Every book actually shown gets one more chance at a real description
  // and page count before going out — the owner asked to "find all of the
  // books you recommend [data] for their about and pages." Only runs on
  // the final, already-small `limit`-sized slice (not the whole candidate
  // pool), so this stays cheap; enrichBook itself is a no-op for a book
  // that's already fully enriched, safe to call unconditionally here.
  const enrichedBooks = await Promise.all(
    ranked.map(async (rec) => {
      try {
        return await enrichBook(rec.book)
      } catch {
        return rec.book
      }
    }),
  )

  return ranked.map((rec, i) => ({
    book: enrichedBooks[i] ?? rec.book,
    score: rec.score,
    why: rec.why,
    circleSignals: rec.circleSignals,
  }))
}
