import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { Skeleton } from '../components/layout/Skeleton'
import { useAuth } from '../lib/auth/useAuth'
import { getMyRatedBooks, type MyRatedBook } from '../lib/ratings/myBooks'

type LoadState = 'loading' | 'error' | 'loaded'

/**
 * "When they go to the things they already rated it should only show them
 * their inputs, like notes and what they entered" — a personal list, never
 * other people's public/circle reviews, see getMyRatedBooks.
 */
export function MyBooks() {
  const { user } = useAuth()
  const [items, setItems] = useState<MyRatedBook[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const rated = await getMyRatedBooks(user.id)
        if (!cancelled) {
          setItems(rated)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your ratings.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-1 h-7 w-64" />
        <Skeleton className="mb-5 h-4 w-56" />
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-2xl bg-surface p-3.5 shadow-soft">
              <div className="flex gap-3.5">
                <Skeleton className="h-24 w-16 flex-none" />
                <div className="min-w-0 flex-1 gap-1.5 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-1.5 h-3 w-1/3" />
                  <Skeleton className="mt-2 h-3.5 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My ratings and notes</h1>
      <p className="mb-5 font-sans text-sm text-muted">
        Just what you put in, not anyone else's reviews.
      </p>

      {items.length === 0 ? (
        <p className="font-sans text-sm text-muted">
          You haven't rated anything yet.{' '}
          <Link to="/search" className="font-bold text-sage underline">
            Find a book
          </Link>{' '}
          to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(({ book, rating, note, tags }) => (
            <li key={book.id} className="rounded-2xl bg-surface p-3.5 shadow-soft">
              <div className="flex gap-3.5">
                <Link to={`/book/${book.id}`} className="flex-none">
                  <BookCover coverUrl={book.cover_url} title={book.title} className="h-24 w-16" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/book/${book.id}`}
                    className="block font-display text-base font-semibold text-ink"
                  >
                    {book.title}
                  </Link>
                  {book.author && <p className="font-sans text-xs text-muted">{book.author}</p>}
                  <p className="mt-1 font-sans text-sm font-bold text-honey-text">
                    ★ {rating.stars.toFixed(1)}
                  </p>
                  {tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-leaf px-2 py-0.5 font-sans text-[11px] font-bold text-on-leaf"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {note?.body && (
                    <p className="mt-1.5 font-sans text-sm whitespace-pre-wrap text-ink">
                      {note.body}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
