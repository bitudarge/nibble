import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyCircles } from '../lib/circles/data'
import { getStreak } from '../lib/goals/data'
import { useAuth } from '../lib/auth/useAuth'
import { getWrapData, type WrapData } from '../lib/wrap/data'
import type { ReadingStreak } from '../types/database'

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
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  const [circleCount, setCircleCount] = useState(0)
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const [data, streakData, circles] = await Promise.all([
          getWrapData(user.id, year),
          getStreak(user.id),
          getMyCircles(user.id),
        ])
        if (!cancelled) {
          setWrap(data)
          setStreak(streakData)
          setCircleCount(circles.length)
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

  const rawName = user?.user_metadata?.full_name
  const displayName = typeof rawName === 'string' && rawName ? rawName : (user?.email ?? 'Reader')
  const rawAvatar = user?.user_metadata?.avatar_url
  const avatarUrl = typeof rawAvatar === 'string' ? rawAvatar : undefined

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <div className="mb-5 flex items-center gap-3.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <div
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf font-sans text-2xl font-extrabold text-on-leaf"
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-display text-xl font-semibold text-ink">{displayName}</div>
          <div className="font-sans text-sm text-muted">
            {circleCount} circle{circleCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          Wrap year
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-full border-2 border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink"
            aria-label="Year"
          >
            {Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <Link
          to="/quiz"
          className="rounded-full bg-tint px-3.5 py-1.5 font-sans text-xs font-bold text-ink"
        >
          Retake the taste quiz
        </Link>
      </div>

      <Link
        to="/my-books"
        className="mb-5 block w-fit rounded-full bg-tint px-3.5 py-1.5 font-sans text-xs font-bold text-ink"
      >
        My ratings and notes
      </Link>

      {state === 'loading' && <p className="font-sans text-muted">Building your wrap…</p>}

      {state === 'error' && (
        <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
          {error ?? 'Something went wrong.'}
        </div>
      )}

      {state === 'loaded' && wrap && (
        <div className="flex flex-col gap-6">
          {wrap.totalBooks === 0 ? (
            <p className="font-sans text-sm text-muted">
              No finished books in {year} yet.{' '}
              <Link to="/shelves" className="font-bold text-sage underline">
                Mark some as finished
              </Link>{' '}
              to build your wrap.
            </p>
          ) : (
            <>
              <section className="rounded-3xl bg-surface p-5 shadow-soft">
                <h2 className="mb-3 font-sans text-xs font-bold tracking-wide text-muted uppercase">
                  Your {year} wrap
                </h2>
                <div className="flex text-center">
                  <div className="flex-1">
                    <div className="font-sans text-3xl font-extrabold text-sage">
                      {wrap.totalBooks}
                    </div>
                    <div className="mt-1 font-sans text-xs font-bold text-muted">books</div>
                  </div>
                  <div className="w-px bg-line" />
                  <div className="flex-1">
                    <div className="font-sans text-3xl font-extrabold text-sage">
                      {wrap.totalPages.toLocaleString()}
                    </div>
                    <div className="mt-1 font-sans text-xs font-bold text-muted">pages</div>
                  </div>
                  <div className="w-px bg-line" />
                  <div className="flex-1">
                    <div className="font-sans text-3xl font-extrabold text-honey-text">
                      {streak?.current_streak ?? 0}
                    </div>
                    <div className="mt-1 font-sans text-xs font-bold text-muted">day streak</div>
                  </div>
                </div>
              </section>

              {wrap.topTags.length > 0 && (
                <section>
                  <h2 className="mb-2.5 font-sans text-base font-extrabold text-ink">
                    Your top tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {wrap.topTags.map(({ tag, count }) => (
                      <span
                        key={tag}
                        className="rounded-full bg-tint px-3.5 py-2 font-sans text-sm font-bold text-ink"
                      >
                        {formatTag(tag)} ({count})
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {wrap.favoriteBooks.length > 0 && (
                <section>
                  <h2 className="mb-2.5 font-sans text-base font-extrabold text-ink">
                    Favorites this year
                  </h2>
                  <ul className="grid grid-cols-3 gap-3">
                    {wrap.favoriteBooks.map(({ book, stars }) => (
                      <li key={book.id}>
                        <Link to={`/book/${book.id}`} className="block">
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt=""
                              className="h-32 w-full rounded-xl object-cover shadow-soft"
                            />
                          ) : (
                            <div
                              className="flex h-32 w-full items-center justify-center rounded-xl text-xs text-muted shadow-soft"
                              style={{
                                background:
                                  'repeating-linear-gradient(135deg, #DCE8D3 0 7px, #F6FAF3 7px 14px)',
                              }}
                            >
                              No cover yet
                            </div>
                          )}
                          <span className="mt-1.5 block font-display text-xs font-semibold text-ink">
                            {book.title}
                          </span>
                          <span className="block font-sans text-xs font-bold text-honey-text">
                            ★ {stars.toFixed(1)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="mb-2.5 font-sans text-base font-extrabold text-ink">
                  Everything you finished
                </h2>
                <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {wrap.finishedBooks.map((item) => (
                    <li key={item.id}>
                      <Link to={`/book/${item.book_id}`}>
                        {item.books.cover_url ? (
                          <img
                            src={item.books.cover_url}
                            alt={item.books.title}
                            className="h-24 w-full rounded-lg object-cover shadow-soft"
                          />
                        ) : (
                          <div
                            className="flex h-24 w-full items-center justify-center rounded-lg text-[10px] text-muted shadow-soft"
                            style={{
                              background:
                                'repeating-linear-gradient(135deg, #DCE8D3 0 7px, #F6FAF3 7px 14px)',
                            }}
                          >
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
