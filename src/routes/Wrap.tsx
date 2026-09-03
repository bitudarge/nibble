import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { getWrapData, type WrapData } from '../lib/wrap/data'

// TODO(Section 6): this page still has its pre-refinement plain styling —
// only the "retake the quiz" link below uses the new design tokens, since
// it's new content added in Section 4. The rest gets restyled in Section 6.

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()

const TAG_TYPE_LABELS: Record<string, string> = {
  mood: 'Mood',
  pace: 'Pace',
  spice_level: 'Spice level',
  genre: 'Genre',
}

function formatTag(tag: string): string {
  const [type, name] = tag.split(':')
  return name ? `${TAG_TYPE_LABELS[type ?? ''] ?? type}: ${name}` : tag
}

export function Wrap() {
  const { user } = useAuth()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [wrap, setWrap] = useState<WrapData | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const data = await getWrapData(user.id, year)
        if (!cancelled) {
          setWrap(data)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your Wrap.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, year])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Your {year} Wrap</h1>
        <Link
          to="/quiz"
          className="rounded-full bg-tint px-3 py-1.5 font-sans text-xs font-bold text-ink"
        >
          Retake the taste quiz
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-end">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm"
          aria-label="Year"
        >
          {Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {state === 'loading' && <p className="text-stone-500">Building your Wrap…</p>}

      {state === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
          {error ?? 'Something went wrong.'}
        </div>
      )}

      {state === 'loaded' && wrap && (
        <div className="flex flex-col gap-6 rounded-lg border border-stone-200 bg-white p-6">
          {wrap.totalBooks === 0 ? (
            <p className="text-stone-500">
              No finished books in {year} yet.{' '}
              <Link to="/shelves" className="underline">
                Mark some as finished
              </Link>{' '}
              to build your Wrap.
            </p>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-3xl font-semibold text-stone-900">{wrap.totalBooks}</p>
                  <p className="text-sm text-stone-500">books finished</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-stone-900">
                    {wrap.totalPages.toLocaleString()}
                  </p>
                  <p className="text-sm text-stone-500">pages read</p>
                </div>
              </section>

              {wrap.favoriteBooks.length > 0 && (
                <section>
                  <h2 className="mb-2 font-medium text-stone-900">Favorites</h2>
                  <ul className="grid grid-cols-3 gap-3">
                    {wrap.favoriteBooks.map(({ book, stars }) => (
                      <li key={book.id}>
                        <Link to={`/book/${book.id}`}>
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt=""
                              className="h-32 w-full rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-32 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                              No cover
                            </div>
                          )}
                          <span className="mt-1 block text-xs font-medium text-stone-900">
                            {book.title}
                          </span>
                          <span className="block text-xs text-stone-500">★ {stars.toFixed(1)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {wrap.topTags.length > 0 && (
                <section>
                  <h2 className="mb-2 font-medium text-stone-900">Your top tags</h2>
                  <div className="flex flex-wrap gap-1">
                    {wrap.topTags.map(({ tag, count }) => (
                      <span
                        key={tag}
                        className="rounded-full border border-stone-300 px-2 py-0.5 text-xs text-stone-600"
                      >
                        {formatTag(tag)} ({count})
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-2 font-medium text-stone-900">Everything you finished</h2>
                <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {wrap.finishedBooks.map((item) => (
                    <li key={item.id}>
                      <Link to={`/book/${item.book_id}`}>
                        {item.books.cover_url ? (
                          <img
                            src={item.books.cover_url}
                            alt={item.books.title}
                            className="h-24 w-full rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                            No cover
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
