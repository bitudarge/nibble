import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { useCelebration } from '../components/celebrate/useCelebration'
import { CirclesIcon, RecsIcon } from '../components/layout/navIcons'
import { useAuth } from '../lib/auth/useAuth'
import { getRecentCircleActivity, type RecentCircleActivity } from '../lib/circles/data'
import {
  countBooksFinishedInYear,
  getGoalForYear,
  getStreak,
  isStreakMilestone,
  setGoalForYear,
} from '../lib/goals/data'
import { getRecommendations, type Recommendation } from '../lib/recommender'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemsWithBooks, type ShelfItemWithBook } from '../lib/shelf/data'
import type { ReadingGoal, ReadingStreak } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()
const STREAK_DOTS = 7

function OpenBookIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinejoin="round"
      aria-hidden
      className="text-sage"
    >
      <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z" />
    </svg>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function Home() {
  const { user } = useAuth()
  const { celebrate, node: celebrationNode } = useCelebration()
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [currentlyReading, setCurrentlyReading] = useState<ShelfItemWithBook[]>([])
  const [finishedThisYear, setFinishedThisYear] = useState(0)
  const [goal, setGoal] = useState<ReadingGoal | null>(null)
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [circleActivity, setCircleActivity] = useState<RecentCircleActivity[]>([])
  const [goalInput, setGoalInput] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const shelfItems = await getShelfItemsWithBooks(user.id)
        const reading = shelfItems.filter((item) => item.status === 'reading')

        const [finishedCount, yearGoal, readingStreak, recs, activity] = await Promise.all([
          countBooksFinishedInYear(user.id, CURRENT_YEAR),
          getGoalForYear(user.id, CURRENT_YEAR),
          getStreak(user.id),
          getRecommendations(user.id, 5),
          getRecentCircleActivity(user.id),
        ])

        if (cancelled) return
        setCurrentlyReading(reading)
        setFinishedThisYear(finishedCount)
        setGoal(yearGoal)
        setStreak(readingStreak)
        setRecommendations(recs)
        setCircleActivity(activity)
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
    const streakBefore = streak?.current_streak ?? 0
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
      const streakAfter = await getStreak(user.id)
      setStreak(streakAfter)
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(streakBefore, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log progress.')
    }
  }

  async function handleSetGoal() {
    if (!user) return
    const target = Number(goalInput)
    if (!Number.isFinite(target) || target <= 0) {
      setError('Enter a positive number of books.')
      return
    }
    setSavingGoal(true)
    try {
      const updated = await setGoalForYear(user.id, CURRENT_YEAR, Math.round(target))
      setGoal(updated)
      setGoalInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your goal.')
    } finally {
      setSavingGoal(false)
    }
  }

  if (state === 'loading') {
    return <p className="font-sans text-muted">Loading your dashboard.</p>
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  const currentStreak = streak?.current_streak ?? 0
  const goalPct = goal ? Math.min(100, Math.round((finishedThisYear / goal.target_books) * 100)) : 0
  const rawName = user?.user_metadata?.full_name
  const firstName =
    typeof rawName === 'string' && rawName ? rawName.split(' ')[0] : (user?.email ?? 'there')

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-8"
      style={{ animation: 'nib-in 0.26s ease both' }}
    >
      {celebrationNode}
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          {greeting()}, {firstName}.
        </h1>
        {error && (
          <p className="mt-2 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
            {error}
          </p>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] bg-honey-soft p-4 shadow-soft">
          <div className="mb-1.5 font-sans text-[11.5px] font-bold tracking-wide text-honey-text uppercase">
            Streak
          </div>
          <div className="font-sans text-3xl font-extrabold text-honey-text">{currentStreak}</div>
          <div className="mt-0.5 font-sans text-[12.5px] font-semibold text-honey-text opacity-80">
            day{currentStreak === 1 ? '' : 's'} in a row
          </div>
          {streak && streak.longest_streak > currentStreak && (
            <div className="mt-1 font-sans text-[11px] text-honey-text opacity-70">
              Best: {streak.longest_streak} days
            </div>
          )}
          <div className="mt-2.5 flex gap-1">
            {Array.from({ length: STREAK_DOTS }, (_, i) => (
              <div
                key={i}
                className="h-[7px] flex-1 rounded-full"
                style={{
                  background:
                    i < Math.min(STREAK_DOTS, currentStreak)
                      ? 'var(--nibbles-honey)'
                      : 'rgba(138,94,27,.22)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[22px] bg-leaf p-4 shadow-soft">
          <div className="mb-1.5 font-sans text-[11.5px] font-bold tracking-wide text-on-leaf uppercase">
            {CURRENT_YEAR} goal
          </div>
          {goal ? (
            <>
              <div className="font-sans text-3xl font-extrabold text-on-leaf">
                {finishedThisYear}/{goal.target_books}
              </div>
              <div className="mt-0.5 font-sans text-[12.5px] font-semibold text-on-leaf opacity-80">
                books finished
              </div>
              <div className="mt-2.5 h-[9px] overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="e.g. 20"
                className="w-20 rounded-full border border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink"
                aria-label="Books to read this year"
              />
              <button
                type="button"
                onClick={() => void handleSetGoal()}
                disabled={!goalInput.trim() || savingGoal}
                className="rounded-full bg-sage px-3.5 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
              >
                {savingGoal ? 'Saving…' : 'Set goal'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <OpenBookIcon />
          <h2 className="font-sans text-lg font-extrabold text-ink">Currently reading</h2>
        </div>
        {currentlyReading.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            Nothing in progress.{' '}
            <Link to="/search" className="font-bold text-sage underline">
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
                  className="flex items-center gap-3.5 rounded-[22px] bg-surface p-3.5 shadow-soft"
                >
                  <Link to={`/book/${item.book_id}`} className="flex-none">
                    <BookCover
                      coverUrl={item.books.cover_url}
                      title={item.books.title}
                      className="h-[84px] w-14"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/book/${item.book_id}`}
                      className="block truncate font-display text-base font-semibold text-ink"
                    >
                      {item.books.title}
                    </Link>
                    <p className="mt-0.5 mb-2 truncate font-sans text-xs text-muted">
                      {item.books.author}
                    </p>
                    <div className="h-3 overflow-hidden rounded-full bg-tint">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(percent, 100)}%`,
                          background:
                            'linear-gradient(90deg, var(--nibbles-sage-deep), var(--nibbles-sage))',
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-sans text-xs font-bold text-muted">
                        {item.books.page_count
                          ? `page ${item.current_page ?? 0} of ${item.books.page_count} · ${Math.round(percent)}%`
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
                        className="rounded-full bg-leaf px-3.5 py-1.5 font-sans text-xs font-bold text-on-leaf transition-transform active:scale-95"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RecsIcon />
            <h2 className="font-sans text-lg font-extrabold text-ink">Recommended next</h2>
          </div>
          <Link to="/recommendations" className="font-sans text-xs font-bold text-sage">
            See all
          </Link>
        </div>
        {recommendations.length === 0 ? (
          <p className="font-sans text-sm text-muted">Nothing to show yet.</p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {recommendations.map((rec) => (
              <Link
                key={rec.book.id}
                to={`/book/${rec.book.id}`}
                className="w-[132px] flex-none rounded-[20px] bg-surface p-2.5 shadow-soft transition-transform active:scale-95"
              >
                <BookCover
                  coverUrl={rec.book.cover_url}
                  title={rec.book.title}
                  className="h-32 w-full"
                />
                <span className="mt-2 block truncate font-display text-sm font-semibold text-ink">
                  {rec.book.title}
                </span>
                <p className="mt-0.5 line-clamp-2 font-sans text-[11px] text-muted">{rec.why[0]}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CirclesIcon className="text-sage" />
          <h2 className="font-sans text-lg font-extrabold text-ink">Circle activity</h2>
        </div>
        {circleActivity.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            <Link to="/circles" className="font-bold text-sage underline">
              Join or create a circle
            </Link>{' '}
            to see friend activity here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {circleActivity.map((message) => (
              <li
                key={message.id}
                className="flex items-start gap-3 rounded-[20px] bg-surface p-3.5 shadow-soft"
              >
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-leaf font-sans text-xs font-extrabold text-on-leaf">
                  {message.profiles.display_name.charAt(0).toUpperCase()}
                </div>
                <p className="font-sans text-sm text-muted">
                  <span className="font-extrabold text-ink">{message.profiles.display_name}</span>{' '}
                  in {message.circle_name}: {message.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
