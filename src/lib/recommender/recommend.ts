import { getRecentlyAddedBooks } from '../books/data'
import { getShelfItems } from '../shelf/data'
import type { Book } from '../../types/database'
import { getBookTagProfiles } from './bookTagProfile'
import { getCircleSignals } from './circleSignals'
import { explainScore, scoreBook } from './scoring'
import { MIN_RATINGS_FOR_PERSONALIZATION, getOrComputeTasteProfile } from './tasteProfile'
import type { TasteProfileData } from './types'

// How many recently-added books to consider scoring. A known MVP limit: as
// the catalog grows past this, older books stop being candidates at all.
// Fine while the catalog is small; see README.md for how to fix this later
// (paginate through the full catalog, or pre-filter by genre overlap).
const CANDIDATE_POOL_SIZE = 200

export interface Recommendation {
  book: Book
  score: number
  why: string[]
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
    }))
  }

  const candidates = await getRecentlyAddedBooks(shelvedBookIds, CANDIDATE_POOL_SIZE)
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
    return { book, score: result.score, why: explainScore(result) }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}
