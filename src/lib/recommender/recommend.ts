import { getRecentlyAddedBooks } from '../books/data'
import { getShelfItems } from '../shelf/data'
import type { Book } from '../../types/database'
import { getBookTagProfiles } from './bookTagProfile'
import { getCircleSignals } from './circleSignals'
import { discoverBooksForGenres } from './discovery'
import { explainScore, scoreBook } from './scoring'
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
 * The recommender's one public entry point for "what should I read next".
 * Degrades gracefully: with no ratings and no quiz signal, falls back to
 * recently-added books with an honest label rather than a fake "why".
 */
export async function getRecommendations(userId: string, limit = 10): Promise<Recommendation[]> {
  const shelfItems = await getShelfItems(userId)
  const shelvedBookIds = shelfItems.map((item) => item.book_id)

  const tasteProfile = await getOrComputeTasteProfile(userId)

  if (needsFallback(tasteProfile)) {
    const remaining = MIN_RATINGS_FOR_PERSONALIZATION - tasteProfile.ratedBookCount
    const fallback = await getRecentlyAddedBooks(shelvedBookIds, limit)
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

  const candidates = await getRecentlyAddedBooks(shelvedBookIds, CANDIDATE_POOL_SIZE)

  // Widen the pool past whatever's already in the catalog: search Open
  // Library for the genres this taste profile likes best (quiz-seeded or
  // rating-derived, topGenreAffinities doesn't care which) and pull in
  // books nobody's added yet. See discovery.ts for why this is bounded and
  // best-effort — a flaky external API should never take down the whole
  // recommendations page.
  const topGenres = topGenreAffinities(tasteProfile.tagAffinity)
  if (topGenres.length > 0) {
    try {
      const excludeIds = new Set([...shelvedBookIds, ...candidates.map((book) => book.id)])
      const discovered = await discoverBooksForGenres(topGenres, excludeIds)
      candidates.push(...discovered)
    } catch {
      // Discovery is a bonus signal on top of the existing catalog, not a
      // hard dependency, fall through with whatever candidates exist.
    }
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
    return { book, score: result.score, why: explainScore(result), circleSignals: signals }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}
