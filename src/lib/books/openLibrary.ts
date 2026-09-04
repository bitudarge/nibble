/**
 * Thin wrapper around Open Library's search API — no API key needed. Kept
 * separate from src/lib/books/data.ts (which talks to our own `books`
 * table) so "search the internet" and "read/write our database" stay two
 * distinct, individually testable concerns.
 */

export interface OpenLibrarySearchResult {
  openLibraryId: string
  title: string
  author: string | null
  publishedYear: number | null
  coverUrl: string | null
}

interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[]
}

const SEARCH_URL = 'https://openlibrary.org/search.json'

export async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal,
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i')
  url.searchParams.set('limit', '20')

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Open Library search failed (${response.status}). Try again in a moment.`)
  }

  const data = (await response.json()) as OpenLibrarySearchResponse

  return data.docs
    .filter((doc) => doc.key && doc.title)
    .map((doc) => ({
      openLibraryId: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] ?? null,
      publishedYear: doc.first_publish_year ?? null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    }))
}

interface OpenLibrarySubjectAuthor {
  name?: string
}

interface OpenLibrarySubjectWork {
  key: string
  title: string
  authors?: OpenLibrarySubjectAuthor[]
  cover_id?: number
  first_publish_year?: number
}

interface OpenLibrarySubjectResponse {
  works: OpenLibrarySubjectWork[]
}

const SUBJECT_URL = 'https://openlibrary.org/subjects'

/**
 * Open Library's purpose-built genre-browsing API, used by the recommender
 * (`src/lib/recommender/discovery.ts`) to pull in books nobody's added to
 * Nibble yet for a genre the user's taste profile favors, rather than only
 * ever recommending from whatever's already in the catalog. `subjectSlug`
 * is lowercase and underscore-separated ("science_fiction", "fantasy") —
 * see `genreTagToSubjectSlug` in the recommender's tagVocabulary.ts for how
 * a genre tag becomes one. An unrecognized slug isn't an error, Open
 * Library just returns an empty `works` list for it.
 */
export async function searchOpenLibraryBySubject(
  subjectSlug: string,
  limit = 10,
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(`${SUBJECT_URL}/${subjectSlug}.json`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('details', 'false')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open Library subject lookup failed (${response.status}).`)
  }

  const data = (await response.json()) as OpenLibrarySubjectResponse

  return (data.works ?? [])
    .filter((work) => work.key && work.title)
    .map((work) => ({
      openLibraryId: work.key,
      title: work.title,
      author: work.authors?.[0]?.name ?? null,
      publishedYear: work.first_publish_year ?? null,
      coverUrl: work.cover_id ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg` : null,
    }))
}
