import type { Book } from '../../types/database'
import { getOrCreateBook } from '../books/data'
import { searchOpenLibraryBySubject } from '../books/openLibrary'
import { genreTagToSubjectSlug } from './tagVocabulary'
import type { TasteQuizAnswers } from './types'

/**
 * Which way to sort Open Library's subject results — see
 * searchOpenLibraryBySubject's own comment for why 'new' is the default
 * rather than the endpoint's own classic-skewed ordering. Only an
 * explicit 'classics' answer switches to 'old'; everything else
 * (including never having taken the quiz) leans newer, since that's a
 * better default for virtually everyone.
 */
function sortForRecencyPreference(
  preference: TasteQuizAnswers['recencyPreference'] | undefined,
): 'new' | 'old' {
  return preference === 'classics' ? 'old' : 'new'
}

// How many of the user's top genre affinities to search externally, and
// how many Open Library results to pull per genre. Kept bounded: this
// turns into real network calls and, for books nobody's added yet, real
// writes (getOrCreateBook + a one-time enrichment lookup) on every call,
// not just reads, so it stays capped rather than growing with the user's
// whole taste profile. Raised from the original 2 genres / 6 results / 8
// total once recommend.ts started filtering out candidates with no real
// tag-match reason (see hasRealReason) — that filter is honest but means
// a thin candidate pool can leave a well-onboarded user with very few
// picks, so there's more raw material here for it to work with.
const GENRES_TO_SEARCH = 3
const RESULTS_PER_GENRE = 8
const MAX_DISCOVERED_BOOKS = 16

/**
 * Pulls in books nobody's added to Nibble yet, from Open Library's
 * genre-browsing API, for the user's top genre affinities (quiz answers
 * and/or ratings, whatever `recommend.ts`'s `topGenreAffinities` found).
 * Without this, `getRecommendations` could only ever recommend from
 * whatever books someone already happened to search for and add (see
 * `recommend.ts`'s `CANDIDATE_POOL_SIZE`), so a brand new user who just
 * took the taste quiz would see the same handful of catalog books as
 * everyone else, even for a genre nobody's touched yet. Every book this
 * creates goes through the exact same `getOrCreateBook` path Search.tsx
 * uses (including the one-time Google Books enrichment), so it's a normal,
 * fully-enriched `books` row afterward, indistinguishable from one a user
 * found by hand, real genre categories included, so it scores and explains
 * exactly like any other candidate.
 *
 * Deliberately best-effort and bounded, not a hard dependency: a failed
 * search or a book that fails to save just gets skipped, this is a bonus
 * signal layered on top of the existing catalog, never worth breaking the
 * whole recommendations page over a flaky external API.
 */
export async function discoverBooksForGenres(
  genres: string[],
  excludeBookIds: Set<string>,
  recencyPreference?: TasteQuizAnswers['recencyPreference'],
): Promise<Book[]> {
  const topGenres = genres.slice(0, GENRES_TO_SEARCH)
  if (topGenres.length === 0) return []

  const sort = sortForRecencyPreference(recencyPreference)
  const resultsByGenre = await Promise.all(
    topGenres.map(async (genre) => {
      try {
        return await searchOpenLibraryBySubject(
          genreTagToSubjectSlug(genre),
          RESULTS_PER_GENRE,
          sort,
        )
      } catch {
        return []
      }
    }),
  )

  const seenOpenLibraryIds = new Set<string>()
  const candidates = resultsByGenre.flat().filter((result) => {
    if (seenOpenLibraryIds.has(result.openLibraryId)) return false
    seenOpenLibraryIds.add(result.openLibraryId)
    return true
  })

  const created = await Promise.all(
    candidates.map(async (result) => {
      try {
        return await getOrCreateBook(result)
      } catch {
        return null
      }
    }),
  )

  const discovered: Book[] = []
  const usedIds = new Set(excludeBookIds)
  for (const book of created) {
    if (!book || usedIds.has(book.id)) continue
    usedIds.add(book.id)
    discovered.push(book)
    if (discovered.length >= MAX_DISCOVERED_BOOKS) break
  }
  return discovered
}
