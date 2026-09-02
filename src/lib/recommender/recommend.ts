import { getRecentlyAddedBooks } from '../books/data'
import { getShelfItems } from '../shelf/data'
import type { Book } from '../../types/database'
import { getBookTagProfiles } from './bookTagProfile'
import { getCircleSignals } from './circleSignals'
import { explainScore, scoreBook } from './scoring'
import { MIN_RATINGS_FOR_PERSONALIZATION, getOrComputeTasteProfile } from './tasteProfile'

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
 * The recommender's one public entry point for "what should I read next".
 * Degrades gracefully: with too few ratings to personalize, falls back to
 * recently-added books with an honest label rather than a fake "why".
 */
export async function getRecommendations(userId: string, limit = 10): Promise<Recommendation[]> {
  const shelfItems = await getShelfItems(userId)
  const shelvedBookIds = shelfItems.map((item) => item.book_id)

  const tasteProfile = await getOrComputeTasteProfile(userId)

  if (tasteProfile.ratedBookCount < MIN_RATINGS_FOR_PERSONALIZATION) {
    const remaining = MIN_RATINGS_FOR_PERSONALIZATION - tasteProfile.ratedBookCount
    const fallback = await getRecentlyAddedBooks(shelvedBookIds, limit)
    return fallback.map((book) => ({
      book,
      score: 0,
      why: [
        `Rate ${remaining} more book${remaining === 1 ? '' : 's'} to personalize this — showing recently added books for now.`,
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
