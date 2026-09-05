import { cleanDescription } from './textCleanup'

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

/**
 * Open Library has real, observed reliability gaps — confirmed directly
 * while building this feature (a stretch of outright connection failures
 * mid-session, unrelated to anything this app did). Retries once, after a
 * short pause, before giving up on a network failure or a 5xx — enough to
 * ride out a brief hiccup without making a real outage take twice as long
 * to report. A 4xx isn't retried (a bad request won't fix itself), and a
 * deliberate cancellation (an aborted signal, e.g. a fast typist's stale
 * search) is never treated as a failure to retry.
 */
async function fetchWithRetry(url: string | URL, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    if (init?.signal?.aborted) throw err
    await new Promise((resolve) => setTimeout(resolve, 500))
    return fetch(url, init)
  }
  // A 4xx is a bad request, not a transient failure, retrying would just
  // fail the same way again — only retry a network error (above) or a 5xx.
  // Either way, the retried response (or its own failure) is returned/
  // thrown as-is so the caller's own status-code-specific error message
  // still applies rather than a generic one from in here.
  if (response.status < 500) return response
  await new Promise((resolve) => setTimeout(resolve, 500))
  return fetch(url, init)
}

export async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal,
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i')
  url.searchParams.set('limit', '20')

  const response = await fetchWithRetry(url, { signal })
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

// A title containing script outside the Latin range (CJK, Hangul,
// Cyrillic, Arabic, Hebrew, Thai) is excluded from genre-browse results —
// see looksLikeEnglishTitle just below for why this exists alongside the
// query's own `language=eng` filter, not instead of it.
const NON_LATIN_SCRIPT = new RegExp(
  '[' +
    'Ѐ-ӿ' + // Cyrillic
    '֐-׿' + // Hebrew
    '؀-ۿ' + // Arabic
    '฀-๿' + // Thai
    '぀-ヿ' + // Hiragana + Katakana
    '一-鿿' + // CJK unified ideographs
    '가-힯' + // Hangul syllables
    ']',
)

function looksLikeEnglishTitle(title: string): boolean {
  return !NON_LATIN_SCRIPT.test(title)
}

/**
 * Open Library's genre-browsing query, used by the recommender
 * (`src/lib/recommender/discovery.ts`) to pull in books nobody's added to
 * Nibble yet for a genre the user's taste profile favors, and by
 * Discover's own genre chips — rather than only ever recommending from
 * whatever's already in the catalog. `subjectSlug` is lowercase and
 * underscore-separated ("science_fiction", "fantasy") — see
 * `genreTagToSubjectSlug` in the recommender's tagVocabulary.ts for how a
 * genre tag becomes one. An unrecognized slug isn't an error, Open
 * Library just returns no matches for it.
 *
 * Goes through the search endpoint (`q=subject:X`) rather than the
 * purpose-built `/subjects/X.json` browsing endpoint, for two reasons:
 * `/subjects` has no per-work language field at all, and its own default
 * ordering skews heavily toward old public-domain classics — confirmed
 * directly, the unsorted "fantasy" subject's top results there were Alice
 * in Wonderland (1865), The Wonderful Wizard of Oz (1899), Gulliver's
 * Travels (1726). `language=eng` on the search endpoint filters most
 * non-English editions out server-side (the owner asked for Discover/
 * recommendation picks to be English-only), though it isn't fully
 * trustworthy on its own — confirmed directly, a real query still
 * returned several all-Japanese-titled light-novel entries tagged "eng".
 * `looksLikeEnglishTitle` catches exactly that script-based case as a
 * backstop; a Latin-script foreign title with no distinguishing script
 * (French, Spanish, German) can still slip through occasionally, a real
 * but much rarer gap than doing no filtering at all.
 *
 * `sort` matters a lot for freshness: omitting it uses relevance, which
 * in practice already favors well-known modern books over the `/subjects`
 * endpoint's classics-skew, `new` sorts by first-publish-date descending
 * (what discovery.ts uses by default, rather than only when a user
 * explicitly asks for newer books), `old` the reverse. Over-fetches from
 * Open Library first (some subjects have a lot of foreign-language
 * editions to filter back out) so the language filter still leaves close
 * to `limit` results rather than starving the caller.
 */
export async function searchOpenLibraryBySubject(
  subjectSlug: string,
  limit = 10,
  sort?: 'new' | 'old',
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', `subject:${subjectSlug}`)
  url.searchParams.set('language', 'eng')
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i')
  url.searchParams.set('limit', String(limit * 3))
  if (sort) url.searchParams.set('sort', sort)

  const response = await fetchWithRetry(url)
  if (!response.ok) {
    throw new Error(`Open Library subject lookup failed (${response.status}).`)
  }

  const data = (await response.json()) as OpenLibrarySearchResponse

  return data.docs
    .filter((doc) => doc.key && doc.title && looksLikeEnglishTitle(doc.title))
    .slice(0, limit)
    .map((doc) => ({
      openLibraryId: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] ?? null,
      publishedYear: doc.first_publish_year ?? null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    }))
}

/**
 * More books by an author whose work is already on someone's shelf — the
 * owner asked that adding a book to a library/list should surface "some
 * other books by the author or similar genres." `author` is matched
 * loosely (Open Library's own `author:` search field, not an exact-key
 * lookup), which is intentional: this app only ever stores an author's
 * plain display name string (see `books.author`), never their Open
 * Library author key, so an exact-id match isn't available here. Same
 * English-only filtering and retry behavior as searchOpenLibraryBySubject.
 */
export async function searchOpenLibraryByAuthor(
  author: string,
  limit = 6,
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', `author:"${author}"`)
  url.searchParams.set('language', 'eng')
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i')
  url.searchParams.set('limit', String(limit * 3))
  url.searchParams.set('sort', 'new')

  const response = await fetchWithRetry(url)
  if (!response.ok) {
    throw new Error(`Open Library author lookup failed (${response.status}).`)
  }

  const data = (await response.json()) as OpenLibrarySearchResponse

  return data.docs
    .filter((doc) => doc.key && doc.title && looksLikeEnglishTitle(doc.title))
    .slice(0, limit)
    .map((doc) => ({
      openLibraryId: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] ?? null,
      publishedYear: doc.first_publish_year ?? null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    }))
}

export interface OpenLibraryWorkDetails {
  description: string | null
  subjects: string[]
}

// Open Library's own `description` field is documented as a plain string,
// but a real fraction of work records still carry it in the older
// `{type, value}` wrapper shape instead — handle both rather than silently
// dropping every book that happens to use the older shape.
type OpenLibraryDescription = string | { value?: string } | undefined

interface OpenLibraryWorkResponse {
  description?: OpenLibraryDescription
  subjects?: string[]
}

function normalizeDescription(description: OpenLibraryDescription): string | null {
  if (typeof description === 'string') return cleanDescription(description)
  if (description && typeof description === 'object') return cleanDescription(description.value)
  return null
}

/**
 * Open Library's per-work detail (synopsis + subject tags), keyed by the
 * exact same work id already stored as `books.open_library_id`
 * ("/works/OL...W"). This is the fallback source for `enrichBook` when
 * Google Books has nothing to offer — unauthenticated Google Books quota
 * is shared globally and can run out entirely for a stretch (0 requests/
 * day happens in practice), and Nibble has no key configured yet, so
 * without this fallback every book's "About this book" card and every
 * genre-affinity match would silently go empty. Never throws, same
 * "missing data isn't an error" contract as fetchGoogleBooksDetails.
 */
export async function fetchOpenLibraryWorkDetails(
  openLibraryId: string,
): Promise<OpenLibraryWorkDetails | null> {
  try {
    const response = await fetch(`https://openlibrary.org${openLibraryId}.json`)
    if (!response.ok) return null
    const data = (await response.json()) as OpenLibraryWorkResponse
    const description = normalizeDescription(data.description)
    const subjects = Array.isArray(data.subjects)
      ? data.subjects.filter((s): s is string => typeof s === 'string')
      : []
    if (!description && subjects.length === 0) return null
    return { description, subjects }
  } catch {
    return null
  }
}

interface OpenLibraryEditionEntry {
  number_of_pages?: number
  languages?: { key: string }[]
}

interface OpenLibraryEditionsResponse {
  entries?: OpenLibraryEditionEntry[]
}

/** The value appearing most often in a list, ties broken by first occurrence. */
function mode(values: number[]): number | null {
  if (values.length === 0) return null
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0]!
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Best-effort page count from Open Library's editions of a work, for
 * books Google Books had nothing on. Editions of the very same book
 * genuinely disagree on page count — different translations, print runs,
 * and formats (audiobook duration masquerading as "pages," large-print
 * runs, etc.) all get their own edition record with their own number —
 * confirmed directly against a real work (The Hobbit's editions span
 * 590-896 pages depending on translation). English-language editions are
 * preferred, since this app is English-first and that's the count a
 * reader here is most likely to actually be holding; the most common
 * count among them wins over just taking the first one, so one unusual
 * edition (a single translation, an odd large-print run) doesn't set the
 * number. Falls back to the mode across every edition, regardless of
 * language, only if no English edition reports a count at all. Never
 * throws, same "missing data isn't an error" contract as the other
 * enrichment fetchers.
 */
export async function fetchOpenLibraryPageCount(openLibraryId: string): Promise<number | null> {
  try {
    const response = await fetch(`https://openlibrary.org${openLibraryId}/editions.json?limit=20`)
    if (!response.ok) return null
    const data = (await response.json()) as OpenLibraryEditionsResponse
    const entries = data.entries ?? []

    const isEnglish = (entry: OpenLibraryEditionEntry) =>
      !entry.languages || entry.languages.some((l) => l.key === '/languages/eng')
    const pageCounts = (list: OpenLibraryEditionEntry[]) =>
      list.map((e) => e.number_of_pages).filter((n): n is number => typeof n === 'number' && n > 0)

    const englishCounts = pageCounts(entries.filter(isEnglish))
    return mode(englishCounts.length > 0 ? englishCounts : pageCounts(entries))
  } catch {
    return null
  }
}
