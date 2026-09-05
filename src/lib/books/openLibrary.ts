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
 *
 * `sort` matters a lot here: the endpoint's own default ordering (omit
 * the param, or equivalently 'editions') is by edition count, which
 * skews heavily toward old public-domain classics — confirmed directly,
 * the unsorted "fantasy" subject's top results are Alice in Wonderland
 * (1865), The Wonderful Wizard of Oz (1899), Gulliver's Travels (1726).
 * 'new' sorts by first-publish-date descending instead, which is what
 * discovery.ts uses by default now rather than only when a user
 * explicitly asks for newer books.
 */
export async function searchOpenLibraryBySubject(
  subjectSlug: string,
  limit = 10,
  sort?: 'new' | 'old',
): Promise<OpenLibrarySearchResult[]> {
  const url = new URL(`${SUBJECT_URL}/${subjectSlug}.json`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('details', 'false')
  if (sort) url.searchParams.set('sort', sort)

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
  if (typeof description === 'string') return description
  if (description && typeof description === 'object') return description.value ?? null
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
