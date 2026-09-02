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
