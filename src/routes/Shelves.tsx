import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { ProgressControl } from '../components/book/ProgressControl'
import { Logo } from '../components/brand/Logo'
import { Mascot } from '../components/brand/Mascot'
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
  finished: 'reading',
}

const MOVE_LABEL: Record<ShelfStatus, string> = {
  want_to_read: 'Start it',
  reading: 'Mark finished',
  finished: 'Read again',
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
      throw err // ProgressControl needs this to know the save failed and roll back its own display.
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
          {/* A cheerful mascot pose inviting the reader to go discover
              something, replacing the plain line-drawing swoosh — static,
              not animated, the owner found constant motion on an empty
              shelf distracting rather than charming (round 3). */}
          <Mascot pose="idea" alt="" className="mx-auto h-20" />
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
        <ul className="flex flex-col gap-3">
          {shelfItems.map((item) => {
            const pageCount = item.books.page_count
            const currentPage = item.current_page ?? 0
            const pct = pageCount ? Math.min(100, Math.round((currentPage / pageCount) * 100)) : 0
            return (
              <li key={item.id} className="rounded-[26px] bg-surface p-3.5 shadow-soft">
                <div className="flex gap-3.5">
                  <Link to={`/book/${item.book_id}`} className="flex-none">
                    <BookCover
                      coverUrl={item.books.cover_url}
                      title={item.books.title}
                      className="h-[104px] w-[70px]"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      to={`/book/${item.book_id}`}
                      className="block truncate font-display text-base font-semibold text-ink"
                    >
                      {item.books.title}
                    </Link>
                    <p className="mt-0.5 truncate font-sans text-xs text-muted">
                      {item.books.author}
                    </p>
                    {item.status === 'reading' && pageCount && (
                      <>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint">
                          <div
                            className="h-full rounded-full bg-sage"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 font-sans text-xs text-muted">
                          page {currentPage} of {pageCount}
                        </p>
                      </>
                    )}
                    {item.status !== 'reading' && pageCount && (
                      <p className="mt-1 font-sans text-xs text-muted">{pageCount} pages</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void moveTo(item, NEXT_STATUS[item.status])}
                      className="btn-cta mt-2 self-start rounded-full bg-sage px-4 py-1.5 font-sans text-xs font-extrabold text-surface"
                    >
                      {MOVE_LABEL[item.status]}
                    </button>
                  </div>
                </div>
                {item.status === 'reading' && (
                  <div className="mt-3 border-t border-line pt-3">
                    <ProgressControl
                      currentPage={currentPage}
                      pageCount={pageCount}
                      onSave={(page) => quickLogProgress(item, page)}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
