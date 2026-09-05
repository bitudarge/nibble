import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { Logo } from '../components/brand/Logo'
import { Mascot } from '../components/brand/Mascot'
import { useCelebration } from '../components/celebrate/useCelebration'
import { PageLogSheet } from '../components/dashboard/PageLogSheet'
import { useAuth } from '../lib/auth/useAuth'
import { enrichBook } from '../lib/books/data'
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
  const [logSheetItem, setLogSheetItem] = useState<ShelfItemWithBook | null>(null)

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
        // Progress bars on this page need a page count, but enrichment has
        // only ever run lazily from the book's own detail page — a shelf
        // full of books nobody's individually opened since PR #61 added
        // page counts would show no bars at all. Top up any that are
        // still missing one in the background, same as BookPage's own
        // lazy call: enrichBook decides per book whether there's anything
        // worth asking for, this just gives it a chance to run here too.
        for (const item of shelfItems) {
          if (item.books.page_count) continue
          void enrichBook(item.books).then((richer) => {
            if (cancelled || richer.page_count === item.books.page_count) return
            setItems((prev) =>
              prev.map((it) => (it.book_id === richer.id ? { ...it, books: richer } : it)),
            )
          })
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

  // Same PageLogSheet Home and the Book detail page already use for this
  // exact need, reused here instead of a third copy of the same
  // slider/save logic.
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
      throw err // PageLogSheet needs this to know the save failed and keep the sheet open.
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
                    {item.status === 'reading' &&
                      (pageCount ? (
                        <>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint">
                            <div
                              className="h-full rounded-full transition-[width] duration-500 ease-out"
                              style={{
                                width: `${pct}%`,
                                background:
                                  'linear-gradient(90deg, var(--nibbles-sage-deep), var(--nibbles-sage))',
                              }}
                            />
                          </div>
                          <p className="mt-1 font-sans text-xs text-muted">
                            page {currentPage} of {pageCount}
                          </p>
                        </>
                      ) : (
                        // No known page count for this book — still say
                        // where they are rather than showing nothing at
                        // all, even without a bar to put a percent on.
                        <p className="mt-1 font-sans text-xs text-muted">page {currentPage}</p>
                      ))}
                    {item.status !== 'reading' && pageCount && (
                      <p className="mt-1 font-sans text-xs text-muted">{pageCount} pages</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void moveTo(item, NEXT_STATUS[item.status])}
                        className="btn-cta self-start rounded-full bg-sage px-4 py-1.5 font-sans text-xs font-extrabold text-surface"
                      >
                        {MOVE_LABEL[item.status]}
                      </button>
                      {item.status === 'reading' && (
                        <button
                          type="button"
                          onClick={() => setLogSheetItem(item)}
                          className="self-start rounded-full border-2 border-line px-4 py-1.5 font-sans text-xs font-extrabold text-ink transition-transform active:scale-95"
                        >
                          Nibble
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {logSheetItem && (
        <PageLogSheet
          items={[logSheetItem]}
          initialItemId={logSheetItem.id}
          onClose={() => setLogSheetItem(null)}
          onSave={(item, toPage) => quickLogProgress(item, toPage)}
        />
      )}
    </div>
  )
}
