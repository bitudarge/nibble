import { useState } from 'react'
import { getOrCreateBook } from '../../lib/books/data'
import { searchOpenLibrary, type OpenLibrarySearchResult } from '../../lib/books/openLibrary'
import { startCircleRead } from '../../lib/circles/data'

export function StartCircleReadForm({
  circleId,
  onStarted,
}: {
  circleId: string
  onStarted: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchOpenLibrary(query.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function handlePick(result: OpenLibrarySearchResult) {
    setStarting(result.openLibraryId)
    setError(null)
    try {
      const book = await getOrCreateBook(result)
      await startCircleRead(circleId, book.id, null)
      onStarted()
      setResults([])
      setQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start that read.')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="rounded-2xl bg-page p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a book to read together"
          aria-label="Search a book to read together"
          className="min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={!query.trim() || searching}
          className="flex-none rounded-full bg-sage px-4 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="mt-2 font-sans text-sm text-honey-text">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {results.slice(0, 5).map((result) => (
            <li key={result.openLibraryId}>
              <button
                type="button"
                onClick={() => void handlePick(result)}
                disabled={starting !== null}
                className="w-full rounded-2xl bg-surface px-3 py-2 text-left font-sans text-sm text-ink shadow-soft transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {result.title}
                {result.author && <span className="text-muted">, {result.author}</span>}
                {starting === result.openLibraryId && ' (starting…)'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
