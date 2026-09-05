import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { getOrCreateBook } from '../lib/books/data'
import {
  searchOpenLibrary,
  searchOpenLibraryBySubject,
  type OpenLibrarySearchResult,
} from '../lib/books/openLibrary'
import { genreLabelFor } from '../lib/discover/genreLabel'
import { getOrComputeTasteProfile } from '../lib/recommender'
import { genreTagToSubjectSlug } from '../lib/recommender/tagVocabulary'
import { setShelfStatus } from '../lib/shelf/data'

type LoadState = 'idle' | 'loading' | 'error' | 'loaded'

// How long to wait after the user stops typing before actually searching.
// Short enough to feel live, long enough that a fast typist doesn't fire
// a request per keystroke.
const DEBOUNCE_MS = 300

// Always the first chip, alongside whatever quiz-genre chips the user
// has — a broad "show me anything" option for browsing outside your own
// picked genres, not just a fallback for someone with no quiz answers.
const ALL_CHIP = 'all'

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
}

function SearchGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

export function Search() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [state, setState] = useState<LoadState>(initialQuery.trim() ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  // Keyed by Open Library id rather than our own book id, since a raw
  // search result has no book row (and no known shelf status) until
  // someone actually acts on it — see handleQuickAdd.
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  // The bare genre tags ("fantasy", "sci-fi") from the user's taste quiz
  // answers, in the order they picked them — drives the filter chips below
  // the search box, alongside the always-present "All" chip (see
  // genreChips below). Stays an empty array for anyone who hasn't taken
  // the quiz yet, or if the profile fails to load for any reason: this is
  // a nice-to-have on top of a working search page, not something worth
  // showing a scary error for.
  const [quizGenres, setQuizGenres] = useState<string[]>([])
  // Which genre chip (if any) produced the results currently on screen —
  // distinct from `query`, which chip clicks also set (to the chip's
  // display label) so the results header reads naturally. Lets typing in
  // the search box cleanly fall back to text search, and lets the "Try
  // again" button retry whichever kind of search actually failed.
  const [activeGenre, setActiveGenre] = useState<string | null>(null)

  // A timer for the debounce, and the controller for whichever request is
  // currently in flight, so a fast-typing user's earlier keystrokes never
  // race a later one to the results.
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Genre-chip searches have no AbortController (Open Library's subjects
  // endpoint call takes no signal), so a request id guards against a
  // slower earlier click's response landing after a faster later one's.
  const genreRequestIdRef = useRef(0)

  function runSearch(trimmed: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState('loading')
    setError(null)
    setSearchParams({ q: trimmed }, { replace: true })

    searchOpenLibrary(trimmed, controller.signal)
      .then((docs) => {
        setResults(docs)
        setState('loaded')
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setError(
          err instanceof Error
            ? err.message
            : 'Open Library search failed. Check your connection and try again.',
        )
        setState('error')
      })
  }

  function scheduleSearch(value: string, { immediate = false } = {}) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (!trimmed) {
      abortRef.current?.abort()
      setResults([])
      setState('idle')
      setSearchParams({}, { replace: true })
      return
    }

    if (immediate) runSearch(trimmed)
    else debounceRef.current = window.setTimeout(() => runSearch(trimmed), DEBOUNCE_MS)
  }

  // Genre chips search real books in that genre (Open Library's
  // subject-browsing endpoint), not a title/author text match — clicking
  // "Fantasy" should show fantasy books, not books with "fantasy" in the
  // title. `genre` is one of the bare quiz tags, or ALL_CHIP.
  function runGenreSearch(genre: string) {
    abortRef.current?.abort()
    const requestId = ++genreRequestIdRef.current

    setActiveGenre(genre)
    setState('loading')
    setError(null)
    setSearchParams({}, { replace: true })

    const slug = genreTagToSubjectSlug(genre === ALL_CHIP ? 'fiction' : genre)
    searchOpenLibraryBySubject(slug, 24, 'new')
      .then((docs) => {
        if (genreRequestIdRef.current !== requestId) return
        setResults(docs)
        setState('loaded')
      })
      .catch((err: unknown) => {
        if (genreRequestIdRef.current !== requestId) return
        setError(
          err instanceof Error
            ? err.message
            : 'Open Library search failed. Check your connection and try again.',
        )
        setState('error')
      })
  }

  // Run once on mount, for a deep link like /search?q=circe — or, with no
  // query, land on the "All" genre shelf instead of an empty "type
  // something" placeholder. The owner said Discover "isn't working" when
  // it opens to nothing and asked for it to default to All, and an empty
  // landing state reads as broken even though nothing's actually wrong.
  // Not part of scheduleSearch's dependency chain since it should only
  // ever fire once. The search itself is kicked off from a microtask (not
  // the effect body directly) so the resulting setState calls are treated
  // as coming from a callback, not synchronously from the effect.
  useEffect(() => {
    const trimmed = initialQuery.trim()
    if (trimmed) void Promise.resolve().then(() => runSearch(trimmed))
    else void Promise.resolve().then(() => handleChipClick(ALL_CHIP))
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Loads the signed-in user's taste quiz genres once, to drive the
  // personalized shelves below. Independent of the search box's own
  // loading/error state above, a failed or slow profile fetch here should
  // never block search from working.
  useEffect(() => {
    let cancelled = false

    async function loadQuizGenres() {
      if (!user) return
      try {
        const profile = await getOrComputeTasteProfile(user.id)
        if (!cancelled) setQuizGenres(profile.quiz?.answers.genres ?? [])
      } catch {
        if (!cancelled) setQuizGenres([])
      }
    }

    void loadQuizGenres()
    return () => {
      cancelled = true
    }
  }, [user])

  function handleQueryChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)
    setActiveGenre(null)
    scheduleSearch(value)
  }

  function handleChipClick(genre: string) {
    setQuery(genre === ALL_CHIP ? 'All' : genreLabelFor(genre))
    runGenreSearch(genre)
  }

  async function handleSelect(result: OpenLibrarySearchResult) {
    setOpeningId(result.openLibraryId)
    try {
      const book = await getOrCreateBook(result)
      navigate(`/book/${book.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that book. Try again.')
      setOpeningId(null)
    }
  }

  // "Save for later" straight from a search/genre-shelf result, without
  // leaving the page — matches the mockup's own status pill on each
  // result card. Creates the book row the same way opening one does
  // (getOrCreateBook is idempotent, so this is cheap even if the book
  // already exists), then sets it want-to-read.
  async function handleQuickAdd(result: OpenLibrarySearchResult) {
    if (!user) return
    setAddingId(result.openLibraryId)
    try {
      const book = await getOrCreateBook(result)
      await setShelfStatus(user.id, book.id, 'want_to_read')
      setAddedIds((prev) => new Set(prev).add(result.openLibraryId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that book. Try again.')
    } finally {
      setAddingId(null)
    }
  }

  const trimmedQuery = query.trim()
  const showResultsArea = trimmedQuery.length > 0
  // The user's own onboarding genre picks drive the filter chips, always
  // led by "All" so there's a way to browse outside your own picked
  // genres — not just a fallback for someone with no quiz answers.
  const genreChips = [ALL_CHIP, ...quizGenres]

  return (
    <div className="mx-auto max-w-3xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-3 font-display text-2xl font-semibold text-ink">
        What are we nibbling on?
      </h1>

      <form onSubmit={(e) => e.preventDefault()} className="mb-3.5">
        <div className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-4 shadow-soft">
          <SearchGlyph className="flex-none text-muted" />
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder="Title, author, or mood"
            aria-label="Search books"
            className="min-w-0 flex-1 border-none bg-transparent font-sans text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sage text-surface"
          >
            <SearchGlyph />
          </span>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {genreChips.map((genre) => (
          <button
            key={genre}
            type="button"
            onClick={() => handleChipClick(genre)}
            className="rounded-full px-3.5 py-2 font-sans text-[13px] font-bold shadow-soft transition-transform active:scale-95"
            style={
              activeGenre === genre
                ? { background: 'var(--nibbles-sage)', color: 'var(--nibbles-surface)' }
                : { background: 'var(--nibbles-surface)', color: 'var(--nibbles-ink)' }
            }
          >
            {genre === ALL_CHIP ? 'All' : genreLabelFor(genre)}
          </button>
        ))}
      </div>

      {!showResultsArea && (
        <p className="font-sans text-sm text-muted">
          Search by title or author, or try one of the genres above.
        </p>
      )}

      {showResultsArea && (
        <div className="mb-2.5 font-sans text-xs font-bold tracking-wide text-muted uppercase">
          {state === 'loading' && results.length === 0
            ? 'Searching…'
            : `${results.length} book${results.length === 1 ? '' : 's'} for "${trimmedQuery}"${
                state === 'loading' ? ' · updating…' : ''
              }`}
        </div>
      )}

      {state === 'error' && (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-ink shadow-soft">
          <p className="mb-2 font-sans text-sm">{error}</p>
          <button
            type="button"
            onClick={() => (activeGenre ? runGenreSearch(activeGenre) : runSearch(trimmedQuery))}
            className="font-sans text-sm font-bold text-sage underline transition-opacity active:opacity-60"
          >
            Try again
          </button>
        </div>
      )}

      {showResultsArea && results.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3.5 transition-opacity sm:grid-cols-3 md:grid-cols-4"
          style={{ opacity: state === 'loading' ? 0.6 : 1 }}
        >
          {results.map((result) => {
            const added = addedIds.has(result.openLibraryId)
            return (
              <li
                key={result.openLibraryId}
                className="rounded-[22px] bg-surface p-2.5 shadow-soft"
              >
                <button
                  type="button"
                  onClick={() => void handleSelect(result)}
                  disabled={openingId !== null}
                  className="flex w-full flex-col items-start gap-1 text-left transition-transform active:scale-95 disabled:opacity-50"
                >
                  {result.coverUrl ? (
                    <img
                      src={result.coverUrl}
                      alt=""
                      className="h-40 w-full rounded-[14px] object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-40 w-full items-center justify-center rounded-[14px] text-center font-sans text-xs text-muted"
                      style={{
                        background:
                          'repeating-linear-gradient(135deg, #DCE8D3 0 7px, #F6FAF3 7px 14px)',
                      }}
                    >
                      No cover yet
                    </div>
                  )}
                  <span className="font-display text-sm font-semibold text-ink">
                    {result.title}
                  </span>
                  {result.author && (
                    <span className="font-sans text-xs text-muted">{result.author}</span>
                  )}
                  {openingId === result.openLibraryId && (
                    <span className="font-sans text-xs text-muted">Opening…</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickAdd(result)}
                  disabled={added || addingId === result.openLibraryId}
                  className="mt-2 w-full rounded-full border-2 border-line bg-surface py-1.5 font-sans text-xs font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-60"
                >
                  {added
                    ? 'On your list ✓'
                    : addingId === result.openLibraryId
                      ? 'Saving…'
                      : 'Save for later'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {state === 'loaded' && showResultsArea && results.length === 0 && (
        <div className="mt-1.5 rounded-3xl bg-tint px-5 py-6.5 text-center">
          <svg
            width="52"
            height="52"
            viewBox="0 0 96 96"
            aria-hidden
            className="mx-auto"
            style={{ animation: 'nib-wig 2.6s ease-in-out infinite', transformOrigin: '50% 80%' }}
          >
            <path
              d="M30 78 C24 48 44 30 62 38"
              fill="none"
              stroke="var(--nibbles-sage)"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-2 font-display text-lg font-semibold text-ink">
            Nibbles found nothing
          </div>
          <div className="mt-1 font-sans text-[13.5px] text-muted">
            Try one of the genre chips above instead.
          </div>
        </div>
      )}
    </div>
  )
}
