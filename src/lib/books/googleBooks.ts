/**
 * Thin wrapper around the Google Books API, the primary source for a
 * book's rich detail (synopsis, genre, page count, publish date, cover).
 * Mirrors the shape of src/lib/books/openLibrary.ts: typed response
 * interfaces, one fetch function, no framework dependencies, so "search
 * the internet" stays separate from "read/write our database"
 * (src/lib/books/data.ts does the merging of the two).
 *
 * Works with zero API key (Google allows a modest number of unauthenticated
 * requests), just less reliably at real usage volume. See .env.example for
 * where to add a key.
 */

export interface GoogleBooksDetails {
  description: string | null
  categories: string[]
  pageCount: number | null
  publishedYear: number | null
  coverUrl: string | null
}

interface GoogleBooksImageLinks {
  thumbnail?: string
  smallThumbnail?: string
}

interface GoogleBooksVolumeInfo {
  title?: string
  authors?: string[]
  description?: string
  categories?: string[]
  pageCount?: number
  publishedDate?: string
  imageLinks?: GoogleBooksImageLinks
}

interface GoogleBooksVolume {
  volumeInfo?: GoogleBooksVolumeInfo
}

interface GoogleBooksSearchResponse {
  items?: GoogleBooksVolume[]
}

const VOLUMES_URL = 'https://www.googleapis.com/books/v1/volumes'

function extractYear(publishedDate: string | undefined): number | null {
  if (!publishedDate) return null
  const year = Number.parseInt(publishedDate.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

// Prefer a bigger cover than the default thumbnail when Google Books offers
// one, and upgrade the URL to https (Google serves http:// by default,
// which browsers block as mixed content on our https:// site).
function bestCoverUrl(imageLinks: GoogleBooksImageLinks | undefined): string | null {
  const url = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail
  return url ? url.replace(/^http:/, 'https:') : null
}

// Google Books' relevance ranking is usually good enough that we don't need
// fuzzy matching, but occasionally the top hit is an unrelated volume that
// merely shares words with the query. A loose substring check on the title
// is enough to filter that out without being so strict it rejects
// legitimate subtitle/edition differences.
function titleLooksLikeAMatch(candidateTitle: string | undefined, wantedTitle: string): boolean {
  if (!candidateTitle) return false
  const candidate = candidateTitle.toLowerCase()
  const wanted = wantedTitle.toLowerCase()
  return candidate.includes(wanted) || wanted.includes(candidate)
}

/**
 * Looks up one book by title + optional author and returns whatever
 * details Google Books has for it, or null if nothing usable was found.
 * Never throws: a lookup failure just means "no Google Books data," which
 * the caller treats as normal (Open Library-only) rather than an error.
 */
export async function fetchGoogleBooksDetails(
  title: string,
  author: string | null,
): Promise<GoogleBooksDetails | null> {
  try {
    const url = new URL(VOLUMES_URL)
    const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', '5')

    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
    if (apiKey) url.searchParams.set('key', apiKey)

    const response = await fetch(url)
    if (!response.ok) return null

    const data = (await response.json()) as GoogleBooksSearchResponse
    const match = data.items?.find((item) => titleLooksLikeAMatch(item.volumeInfo?.title, title))
    const info = match?.volumeInfo
    if (!info) return null

    return {
      description: info.description ?? null,
      categories: info.categories ?? [],
      pageCount: info.pageCount ?? null,
      publishedYear: extractYear(info.publishedDate),
      coverUrl: bestCoverUrl(info.imageLinks),
    }
  } catch {
    // Network error, malformed response, etc. — treat exactly like "no
    // data found" rather than surfacing it to the caller.
    return null
  }
}
