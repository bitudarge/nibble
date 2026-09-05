import type { Book } from '../../types/database'
import { getOrCreateBook } from '../books/data'
import {
  searchOpenLibraryByAuthor,
  searchOpenLibraryBySubject,
  type OpenLibrarySearchResult,
} from '../books/openLibrary'
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

/** Given a batch of raw search results, creates/fetches each as a real
 * `books` row (same `getOrCreateBook` path Search.tsx uses) and dedupes
 * against both each other and the caller's own exclusion set. Shared by
 * every discovery function below so "turn search results into usable
 * candidates" is written, and best-effort-guarded, in exactly one place.
 */
async function materializeDiscoveredBooks(
  results: OpenLibrarySearchResult[],
  excludeBookIds: Set<string>,
  maxCount: number,
): Promise<Book[]> {
  const seenOpenLibraryIds = new Set<string>()
  const deduped = results.filter((result) => {
    if (seenOpenLibraryIds.has(result.openLibraryId)) return false
    seenOpenLibraryIds.add(result.openLibraryId)
    return true
  })

  const created = await Promise.all(
    deduped.map(async (result) => {
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
    if (discovered.length >= maxCount) break
  }
  return discovered
}

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

  return materializeDiscoveredBooks(resultsByGenre.flat(), excludeBookIds, MAX_DISCOVERED_BOOKS)
}

// Open Library's tag for books that have appeared on the New York Times
// bestseller list — a real, recognizable "popular right now" signal, not
// a vague popularity score. Confirmed directly that this subject slug
// returns genuine, well-known current bestsellers (Atomic Habits, Dark
// Matter, and so on), not junk.
const BESTSELLER_SUBJECT = 'new_york_times_bestseller'
const POPULAR_RESULTS = 8

/**
 * Pulls in currently-popular books regardless of the user's own genre
 * affinities, so the candidate pool isn't only ever narrow personal-taste
 * matches — the owner asked to "include popular books best seller book in
 * the mix of recommendation and discover to create more diversity."
 * Same best-effort/bounded contract as discoverBooksForGenres: a failed
 * search or a book that fails to save is skipped, never worth breaking
 * the page over a flaky external API.
 */
export async function discoverPopularBooks(excludeBookIds: Set<string>): Promise<Book[]> {
  let results: OpenLibrarySearchResult[]
  try {
    results = await searchOpenLibraryBySubject(BESTSELLER_SUBJECT, POPULAR_RESULTS, 'new')
  } catch {
    return []
  }
  return materializeDiscoveredBooks(results, excludeBookIds, POPULAR_RESULTS)
}

const AUTHORS_TO_SEARCH = 2
const RESULTS_PER_AUTHOR = 4

/**
 * More books by an author already on the reader's shelf (any status —
 * want-to-read counts, not just finished/rated) — the owner asked that
 * adding a book to a library/list should surface "some other books by
 * the author." `authors` should be the most-recently-added distinct
 * authors on the shelf, most recent first; only the first
 * `AUTHORS_TO_SEARCH` are actually queried, same bounded/best-effort
 * contract as the other discovery functions here. Returns each found
 * book paired with the author that surfaced it (not just a bare `Book[]`
 * like the other discovery functions) — recommend.ts needs that pairing
 * to give an honest "more by {author}" reason to a match that has no
 * other real personalization signal, the same way discoverPopularBooks'
 * caller does for bestsellers.
 */
export async function discoverBooksByAuthors(
  authors: string[],
  excludeBookIds: Set<string>,
): Promise<{ book: Book; author: string }[]> {
  const topAuthors = authors.slice(0, AUTHORS_TO_SEARCH)
  if (topAuthors.length === 0) return []

  const resultsByAuthor = await Promise.all(
    topAuthors.map(async (author) => {
      try {
        const results = await searchOpenLibraryByAuthor(author, RESULTS_PER_AUTHOR)
        return results.map((result) => ({ result, author }))
      } catch {
        return []
      }
    }),
  )

  const seenOpenLibraryIds = new Set<string>()
  const flattened = resultsByAuthor.flat().filter(({ result }) => {
    if (seenOpenLibraryIds.has(result.openLibraryId)) return false
    seenOpenLibraryIds.add(result.openLibraryId)
    return true
  })

  const created = await Promise.all(
    flattened.map(async ({ result, author }) => {
      try {
        return { book: await getOrCreateBook(result), author }
      } catch {
        return null
      }
    }),
  )

  const discovered: { book: Book; author: string }[] = []
  const usedIds = new Set(excludeBookIds)
  for (const entry of created) {
    if (!entry || usedIds.has(entry.book.id)) continue
    usedIds.add(entry.book.id)
    discovered.push(entry)
  }
  return discovered
}
