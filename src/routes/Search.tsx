import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getOrCreateBook } from '../lib/books/data'
import { searchOpenLibrary, type OpenLibrarySearchResult } from '../lib/books/openLibrary'

type LoadState = 'idle' | 'loading' | 'error' | 'loaded'

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [state, setState] = useState<LoadState>(initialQuery ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return

    setState('loading')
    setError(null)
    setSearchParams({ q: trimmed })

    try {
      const docs = await searchOpenLibrary(trimmed)
      setResults(docs)
      setState('loaded')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Open Library search failed. Check your connection and try again.',
      )
      setState('error')
    }
  }

  // Run the initial search from a deep link (e.g. the nav's search box).
  // Deliberately mount-only — re-running on every `query` keystroke would
  // search on every character typed instead of only on submit. Calls
  // searchOpenLibrary directly (not runSearch) since the initial `state`
  // above already accounts for the loading case — every setState here
  // happens inside a .then/.catch, not synchronously in the effect body.
  useEffect(() => {
    if (!initialQuery) return
    searchOpenLibrary(initialQuery)
      .then((docs) => {
        setResults(docs)
        setState('loaded')
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Open Library search failed. Check your connection and try again.',
        )
        setState('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold text-stone-900">Search books</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(query)
        }}
        className="mb-6 flex gap-2"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title or author…"
          className="flex-1 rounded-md border border-stone-300 px-3 py-2"
          aria-label="Search by title or author"
        />
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={!query.trim() || state === 'loading'}
        >
          Search
        </button>
      </form>

      {state === 'idle' && <p className="text-stone-500">Search for a book to get started.</p>}

      {state === 'loading' && <p className="text-stone-500">Searching…</p>}

      {state === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void runSearch(query)}
            className="text-sm font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {state === 'loaded' && results.length === 0 && (
        <p className="text-stone-500">No results for "{query}". Try a different search.</p>
      )}

      {state === 'loaded' && results.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {results.map((result) => (
            <li key={result.openLibraryId}>
              <button
                type="button"
                onClick={() => void handleSelect(result)}
                disabled={openingId !== null}
                className="flex w-full flex-col items-start gap-1 rounded-md border border-stone-200 p-2 text-left hover:border-stone-400 disabled:opacity-50"
              >
                {result.coverUrl ? (
                  <img src={result.coverUrl} alt="" className="h-40 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                    No cover
                  </div>
                )}
                <span className="text-sm font-medium text-stone-900">{result.title}</span>
                {result.author && <span className="text-xs text-stone-500">{result.author}</span>}
                {openingId === result.openLibraryId && (
                  <span className="text-xs text-stone-500">Opening…</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
