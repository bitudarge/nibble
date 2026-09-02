import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { getRecentlyAddedBooks } from '../lib/books/data'
import { countBooksFinishedInYear, getGoalForYear, getStreak } from '../lib/goals/data'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemsWithBooks, type ShelfItemWithBook } from '../lib/shelf/data'
import type { Book, ReadingGoal, ReadingStreak } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()

export function Home() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [currentlyReading, setCurrentlyReading] = useState<ShelfItemWithBook[]>([])
  const [finishedThisYear, setFinishedThisYear] = useState(0)
  const [goal, setGoal] = useState<ReadingGoal | null>(null)
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  const [discoverBooks, setDiscoverBooks] = useState<Book[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const shelfItems = await getShelfItemsWithBooks(user.id)
        const reading = shelfItems.filter((item) => item.status === 'reading')

        const [finishedCount, yearGoal, readingStreak, discover] = await Promise.all([
          countBooksFinishedInYear(user.id, CURRENT_YEAR),
          getGoalForYear(user.id, CURRENT_YEAR),
          getStreak(user.id),
          getRecentlyAddedBooks(shelfItems.map((item) => item.book_id)),
        ])

        if (cancelled) return
        setCurrentlyReading(reading)
        setFinishedThisYear(finishedCount)
        setGoal(yearGoal)
        setStreak(readingStreak)
        setDiscoverBooks(discover)
        setState('loaded')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your dashboard.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function quickLogProgress(item: ShelfItemWithBook, toPage: number) {
    if (!user) return
    try {
      await logReadingProgress(
        user.id,
        item.book_id,
        item.current_page,
        toPage,
        item.books.page_count,
      )
      setCurrentlyReading((prev) =>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log progress.')
    }
  }

  if (state === 'loading') {
    return <p className="text-stone-500">Loading your dashboard…</p>
  }

  if (state === 'error') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section>
        <h1 className="mb-4 text-2xl font-semibold text-stone-900">Currently reading</h1>
        {currentlyReading.length === 0 ? (
          <p className="text-stone-500">
            Nothing in progress.{' '}
            <Link to="/search" className="underline">
              Find something to read
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {currentlyReading.map((item) => {
              const percent = item.percent_complete ?? 0
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border border-stone-200 p-3"
                >
                  <Link to={`/book/${item.book_id}`} className="font-medium text-stone-900">
                    {item.books.title}
                  </Link>
                  <div className="h-2 flex-1 rounded-full bg-stone-100">
                    <div
                      className="h-2 rounded-full bg-stone-900"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-500">{Math.round(percent)}%</span>
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
                    className="text-xs text-stone-500 underline"
                  >
                    Update
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-stone-200 p-4">
          <h2 className="mb-1 text-sm font-medium text-stone-500">{CURRENT_YEAR} reading goal</h2>
          {goal ? (
            <p className="text-lg text-stone-900">
              {finishedThisYear} / {goal.target_books} books
            </p>
          ) : (
            <p className="text-sm text-stone-500">No goal set yet.</p>
          )}
        </div>
        <div className="rounded-md border border-stone-200 p-4">
          <h2 className="mb-1 text-sm font-medium text-stone-500">Streak</h2>
          <p className="text-lg text-stone-900">
            {streak?.current_streak ?? 0} day{streak?.current_streak === 1 ? '' : 's'}
          </p>
          {streak && streak.longest_streak > streak.current_streak && (
            <p className="text-xs text-stone-500">Best: {streak.longest_streak} days</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Recently added to Nibble</h2>
        <p className="mb-3 text-xs text-stone-500">
          Not personalized yet — real recommendations with a "why" arrive in Phase 6.
        </p>
        {discoverBooks.length === 0 ? (
          <p className="text-stone-500">Nothing to show yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {discoverBooks.map((book) => (
              <li key={book.id}>
                <Link to={`/book/${book.id}`}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="h-32 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                      No cover
                    </div>
                  )}
                  <span className="mt-1 block text-xs font-medium text-stone-900">
                    {book.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Circle activity</h2>
        <p className="text-stone-500">
          Join or create a circle to see friend activity here — circles land in Phase 5.
        </p>
      </section>
    </div>
  )
}
