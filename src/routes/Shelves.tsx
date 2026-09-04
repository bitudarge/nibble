import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { Logo } from '../components/brand/Logo'
import { useCelebration } from '../components/celebrate/useCelebration'
import { useAuth } from '../lib/auth/useAuth'
import { getStreak, isStreakMilestone } from '../lib/goals/data'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemsWithBooks, setShelfStatus, type ShelfItemWithBook } from '../lib/shelf/data'
import type { ReadingStreak, ShelfStatus } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const SHELVES: { status: ShelfStatus; label: string }[] = [
  { status: 'want_to_read', label: 'Want to read' },
  { status: 'reading', label: 'Reading' },
  { status: 'finished', label: 'Finished' },
]

const NEXT_STATUS: Record<ShelfStatus, ShelfStatus> = {
  want_to_read: 'reading',
  reading: 'finished',
  finished: 'want_to_read',
}

const MOVE_LABEL: Record<ShelfStatus, string> = {
  want_to_read: 'Start reading',
  reading: 'Mark finished',
  finished: 'Back to want to read',
}

export function Shelves() {
  const { user } = useAuth()
  const { celebrate, node: celebrationNode } = useCelebration()
  const [items, setItems] = useState<ShelfItemWithBook[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [activeShelf, setActiveShelf] = useState<ShelfStatus>('reading')
  // Kept just for before/after streak-milestone comparison when logging
  // progress inline, same shape as Home.tsx's quickLogProgress.
  const [streak, setStreak] = useState<ReadingStreak | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const [shelfItems, readingStreak] = await Promise.all([
          getShelfItemsWithBooks(user.id),
          getStreak(user.id),
        ])
        if (!cancelled) {
          setItems(shelfItems)
          setStreak(readingStreak)
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
      if (status === 'finished' && item.status !== 'finished') {
        celebrate(`Finished ${item.books.title}! Nibbles is proud.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move that book.')
    }
  }

  // Same interaction Home.tsx's "Currently reading" strip already uses for
  // this exact need (a quick page-number prompt rather than a persistent
  // inline field, which would crowd this grid's already-compact cards).
  async function quickLogProgress(item: ShelfItemWithBook, toPage: number) {
    if (!user) return
    const streakBefore = streak?.current_streak ?? 0
    try {
      await logReadingProgress(
        user.id,
        item.book_id,
        item.current_page,
        toPage,
        item.books.page_count,
      )
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                current_page: toPage,
                percent_complete: it.books.page_count
                  ? Math.min((toPage / it.books.page_count) * 100, 100)
                  : null,
              }
            : it,
        ),
      )
      const streakAfter = await getStreak(user.id)
      setStreak(streakAfter)
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(streakBefore, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log your progress.')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div style={{ animation: 'nib-wig 2.6s ease-in-out infinite', transformOrigin: '50% 80%' }}>
          <Logo variant="mark" className="h-16" />
        </div>
        <p className="font-sans text-sm text-muted">Finding your shelves.</p>
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

  const shelfItems = items.filter((item) => item.status === activeShelf)

  return (
    <div className="mx-auto max-w-3xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      {celebrationNode}
      <h1 className="mb-4 font-display text-2xl font-semibold text-ink">Your shelves</h1>

      {error && (
        <p className="mb-4 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <div className="mb-5 flex gap-1.5 rounded-full bg-tint p-1.5">
        {SHELVES.map(({ status, label }) => {
          const active = status === activeShelf
          const count = items.filter((item) => item.status === status).length
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveShelf(status)}
              className={`h-10 flex-1 rounded-full font-sans text-[12.5px] font-extrabold transition-all active:scale-95 ${
                active ? 'bg-sage text-surface shadow-soft' : 'text-muted'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {shelfItems.length === 0 ? (
        <div className="rounded-3xl bg-tint px-5 py-8 text-center">
          {/* Static now (was an animated wiggle) — the owner found the
              constant motion on an empty shelf distracting rather than
              charming. */}
          <svg width="60" height="60" viewBox="0 0 96 96" aria-hidden className="mx-auto">
            <path
              d="M30 78 C24 48 44 30 62 38"
              fill="none"
              stroke="var(--nibbles-sage)"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-2 font-display text-lg font-semibold text-ink">
            Nothing on this shelf yet
          </div>
          <div className="mt-1 font-sans text-[13.5px] text-muted">
            Nibbles is hungry. Find something to nibble on.
          </div>
          <Link
            to="/search"
            className="mt-4 inline-block rounded-full bg-sage px-5 py-2.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95"
          >
            Discover books
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          {shelfItems.map((item) => (
            <li key={item.id}>
              <Link to={`/book/${item.book_id}`}>
                <BookCover
                  coverUrl={item.books.cover_url}
                  title={item.books.title}
                  className="h-[172px] w-full"
                />
              </Link>
              <div className="mb-1.5 h-[7px] rounded-b-md bg-line shadow-soft" />
              <Link
                to={`/book/${item.book_id}`}
                className="block truncate font-display text-sm font-semibold text-ink"
              >
                {item.books.title}
              </Link>
              <p className="mb-2 truncate font-sans text-[11.5px] text-muted">
                {item.books.author}
              </p>
              {item.status === 'reading' && (
                <div className="mb-2 flex items-center justify-between gap-1.5">
                  <span className="truncate font-sans text-[11px] font-bold text-muted">
                    {item.books.page_count
                      ? `page ${item.current_page ?? 0} of ${item.books.page_count}`
                      : `page ${item.current_page ?? 0}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const input = window.prompt(
                        'What page are you on?',
                        String(item.current_page ?? ''),
                      )
                      const page = Number(input)
                      if (input && Number.isFinite(page) && page >= 0) {
                        void quickLogProgress(item, page)
                      }
                    }}
                    className="flex-none rounded-full bg-leaf px-2.5 py-1 font-sans text-[11px] font-bold text-on-leaf transition-transform active:scale-95"
                  >
                    Update
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => void moveTo(item, NEXT_STATUS[item.status])}
                className="w-full rounded-full border-2 border-line bg-surface py-2 font-sans text-xs font-extrabold text-ink transition-transform active:scale-95"
              >
                {MOVE_LABEL[item.status]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
