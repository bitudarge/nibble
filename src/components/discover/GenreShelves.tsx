import { useCallback, useEffect, useState } from 'react'
import {
  searchOpenLibraryBySubject,
  type OpenLibrarySearchResult,
} from '../../lib/books/openLibrary'
import { genreLabelFor } from '../../lib/discover/genreLabel'
// Reading only, not editing — genreTagToSubjectSlug is the exact same
// tag-to-subject mapping the recommender's own external genre discovery
// (src/lib/recommender/discovery.ts) already uses, reused here rather than
// duplicated.
import { genreTagToSubjectSlug } from '../../lib/recommender/tagVocabulary'
import { BookCover } from '../book/BookCover'

type ShelfState = 'loading' | 'loaded' | 'error'

// How many of the user's picked genres get their own shelf, and how many
// books show up per shelf. Each shelf is its own network call to Open
// Library, done in parallel, so this is capped in both directions to keep
// a single Discover page load to a reasonable, bounded number of requests
// (5 shelves x 1 request each, 10 books each) rather than growing with
// however many genres someone happened to pick on the quiz.
const MAX_GENRE_SHELVES = 5
const BOOKS_PER_SHELF = 10

/**
 * One genre's horizontal shelf of real books, pulled live from Open
 * Library's subject-browsing API. Deliberately renders straight from the
 * raw search results instead of calling `getOrCreateBook` for every book
 * shown, that would create a `books` row for every cover someone merely
 * scrolls past. A `books` row only gets created for a book the user
 * actually taps, via the shared `onSelect` (see Search.tsx's handleSelect).
 *
 * Loading/error state is scoped to this one shelf and fetched independently
 * of every other shelf, so a slow or failing genre never blocks the rest of
 * the page (including the search box above it) from working.
 */
function GenreShelf({
  genre,
  openingId,
  onSelect,
}: {
  genre: string
  openingId: string | null
  onSelect: (result: OpenLibrarySearchResult) => void
}) {
  const [state, setState] = useState<ShelfState>('loading')
  const [books, setBooks] = useState<OpenLibrarySearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // Takes an explicit `cancelled` getter rather than closing over a ref, so
  // both the mount effect and the manual "Try again" retry can share this
  // one implementation without either accidentally writing state after
  // this shelf has unmounted (e.g. the user navigated away from Discover
  // while a slow request was still in flight).
  const load = useCallback(
    async (isCancelled: () => boolean) => {
      setState('loading')
      setError(null)
      try {
        const results = await searchOpenLibraryBySubject(
          genreTagToSubjectSlug(genre),
          BOOKS_PER_SHELF,
        )
        if (isCancelled()) return
        setBooks(results)
        setState('loaded')
      } catch (err) {
        if (isCancelled()) return
        setError(
          err instanceof Error ? err.message : 'Could not load these books. Check your connection.',
        )
        setState('error')
      }
    },
    [genre],
  )

  useEffect(() => {
    let cancelled = false
    // Kicked off from a microtask, not the effect body directly, so the
    // resulting setState calls (load sets "loading" synchronously before
    // its first await) are treated as coming from a callback rather than
    // synchronously from the effect itself — same trick Search.tsx's own
    // initial-query effect uses, for the same reason.
    void Promise.resolve().then(() => load(() => cancelled))
    return () => {
      cancelled = true
    }
  }, [load])

  const label = genreLabelFor(genre)

  return (
    <section className="mb-5">
      <h2 className="mb-2.5 font-sans text-lg font-extrabold text-ink">{label}</h2>

      {state === 'loading' && (
        <p className="font-sans text-sm text-muted">Finding {label.toLowerCase()} books…</p>
      )}

      {state === 'error' && (
        <div className="rounded-2xl border border-line bg-surface p-3.5 text-ink shadow-soft">
          <p className="mb-1.5 font-sans text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void load(() => false)}
            className="font-sans text-sm font-bold text-sage underline transition-opacity active:opacity-60"
          >
            Try again
          </button>
        </div>
      )}

      {state === 'loaded' && books.length === 0 && (
        <p className="font-sans text-sm text-muted">
          Nothing found for {label.toLowerCase()} right now.
        </p>
      )}

      {state === 'loaded' && books.length > 0 && (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {books.map((book) => (
            <button
              key={book.openLibraryId}
              type="button"
              onClick={() => onSelect(book)}
              disabled={openingId !== null}
              className="w-[132px] flex-none rounded-[20px] bg-surface p-2.5 text-left shadow-soft transition-transform active:scale-95 disabled:opacity-50"
            >
              <BookCover coverUrl={book.coverUrl} title={book.title} className="h-32 w-full" />
              <span className="mt-2 block truncate font-display text-sm font-semibold text-ink">
                {book.title}
              </span>
              {book.author && (
                <span className="mt-0.5 block truncate font-sans text-xs text-muted">
                  {book.author}
                </span>
              )}
              {openingId === book.openLibraryId && (
                <span className="mt-0.5 block font-sans text-xs text-muted">Opening…</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Discover's personalized "Section 1" shelves: one horizontal shelf of
 * real books per genre the signed-in user picked on the onboarding taste
 * quiz, in the order they picked them. Renders nothing at all (not even an
 * empty section) when there's nothing to show, either because the user
 * hasn't taken the quiz yet or picked no genres — this is a bonus on top
 * of the existing search box, not a page of its own, so it should never
 * look broken or empty.
 */
export function GenreShelves({
  genres,
  openingId,
  onSelect,
}: {
  genres: string[]
  openingId: string | null
  onSelect: (result: OpenLibrarySearchResult) => void
}) {
  // Defensive de-dup, in case the same genre ever ends up twice in quiz
  // answers, then cap to a reasonable number of shelves.
  const seen = new Set<string>()
  const shelfGenres = genres
    .filter((genre) => {
      if (seen.has(genre)) return false
      seen.add(genre)
      return true
    })
    .slice(0, MAX_GENRE_SHELVES)

  if (shelfGenres.length === 0) return null

  return (
    <div className="mb-1">
      {shelfGenres.map((genre) => (
        <GenreShelf key={genre} genre={genre} openingId={openingId} onSelect={onSelect} />
      ))}
    </div>
  )
}
