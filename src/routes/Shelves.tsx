import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { getShelfItemsWithBooks, setShelfStatus, type ShelfItemWithBook } from '../lib/shelf/data'
import type { ShelfStatus } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const SHELVES: { status: ShelfStatus; label: string }[] = [
  { status: 'want_to_read', label: 'Want to read' },
  { status: 'reading', label: 'Reading' },
  { status: 'finished', label: 'Finished' },
]

export function Shelves() {
  const { user } = useAuth()
  const [items, setItems] = useState<ShelfItemWithBook[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const shelfItems = await getShelfItemsWithBooks(user.id)
        if (!cancelled) {
          setItems(shelfItems)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your shelves.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function moveTo(item: ShelfItemWithBook, status: ShelfStatus) {
    if (!user) return
    try {
      const updated = await setShelfStatus(user.id, item.book_id, status)
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, ...updated, books: it.books } : it)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move that book.')
    }
  }

  if (state === 'loading') {
    return <p className="text-stone-500">Loading your shelves…</p>
  }

  if (state === 'error') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold text-stone-900">My shelves</h1>

      {items.length === 0 && (
        <p className="mb-6 text-stone-500">
          Nothing on your shelves yet.{' '}
          <Link to="/search" className="underline">
            Search for a book
          </Link>{' '}
          to add one.
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        {SHELVES.map(({ status, label }) => {
          const shelfItems = items.filter((item) => item.status === status)
          return (
            <div key={status}>
              <h2 className="mb-3 font-medium text-stone-900">
                {label} ({shelfItems.length})
              </h2>
              {shelfItems.length === 0 ? (
                <p className="text-sm text-stone-400">Nothing here yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3">
                  {shelfItems.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1">
                      <Link to={`/book/${item.book_id}`}>
                        {item.books.cover_url ? (
                          <img
                            src={item.books.cover_url}
                            alt=""
                            className="h-32 w-full rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                            No cover
                          </div>
                        )}
                        <span className="mt-1 block text-xs font-medium text-stone-900">
                          {item.books.title}
                        </span>
                      </Link>
                      <select
                        value={item.status}
                        onChange={(e) => void moveTo(item, e.target.value as ShelfStatus)}
                        className="rounded border border-stone-300 px-1 py-0.5 text-xs"
                        aria-label={`Move "${item.books.title}" to a different shelf`}
                      >
                        {SHELVES.map((s) => (
                          <option key={s.status} value={s.status}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
