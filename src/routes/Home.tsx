import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { ProgressControl } from '../components/book/ProgressControl'
import { useCelebration } from '../components/celebrate/useCelebration'
import { CirclesIcon, RecsIcon } from '../components/layout/navIcons'
import { useAuth } from '../lib/auth/useAuth'
import { getRecentCircleActivity, type RecentCircleActivity } from '../lib/circles/data'
import {
  countBooksFinishedInPeriod,
  countBooksFinishedInYear,
  getGoalForPeriod,
  getGoalForYear,
  getIsoWeekPeriodKey,
  getMonthPeriodKey,
  getStreak,
  isStreakMilestone,
  setGoalForPeriod,
  setGoalForYear,
} from '../lib/goals/data'
import { resolveDisplayIdentity } from '../lib/profile/identity'
import { getRecommendations, type Recommendation } from '../lib/recommender'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemsWithBooks, type ShelfItemWithBook } from '../lib/shelf/data'
import type { ReadingGoal, ReadingStreak } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()
const STREAK_DOTS = 7
// Computed once per module load, not per render — the "current" month/week
// genuinely only changes at a real calendar boundary, no need to
// recompute it on every re-render.
const MONTH_KEY = getMonthPeriodKey(new Date())
const WEEK_KEY = getIsoWeekPeriodKey(new Date())

/**
 * One goal card: streak-style display when a target's set, an inline
 * "set/edit" form otherwise. Shared by the yearly/monthly/weekly goals so
 * "editable, always, not just on first set" (a real gap in the old
 * yearly-only version, which only ever showed the input before a goal
 * existed) only needs to be right in one place.
 */
function GoalCard({
  label,
  bgClass,
  textClass,
  current,
  goal,
  onSave,
}: {
  label: string
  bgClass: string
  textClass: string
  current: number
  goal: ReadingGoal | null
  onSave: (target: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const target = Number(input)
    if (!Number.isFinite(target) || target <= 0) {
      setError('Enter a positive number of books.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(Math.round(target))
      setEditing(false)
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that goal.')
    } finally {
      setSaving(false)
    }
  }

  const showForm = editing || !goal
  const pct = goal ? Math.min(100, Math.round((current / goal.target_books) * 100)) : 0

  return (
    <div className={`rounded-[22px] ${bgClass} p-4 shadow-soft`}>
      <div
        className={`mb-1.5 flex items-center justify-between font-sans text-[11.5px] font-bold tracking-wide ${textClass} uppercase`}
      >
        <span>{label}</span>
        {goal && !editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setInput(String(goal.target_books))
            }}
            className={`normal-case ${textClass} opacity-70 transition-opacity active:opacity-40`}
          >
            Edit
          </button>
        )}
      </div>

      {showForm ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 4"
            className="w-16 rounded-full border border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink"
            aria-label={`${label} target`}
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!input.trim() || saving}
            className="rounded-full bg-sage px-3.5 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving…' : goal ? 'Update' : 'Set goal'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              className={`font-sans text-xs font-bold ${textClass} opacity-70`}
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={`font-sans text-3xl font-extrabold ${textClass}`}>
            {current}/{goal.target_books}
          </div>
          <div className={`mt-0.5 font-sans text-[12.5px] font-semibold ${textClass} opacity-80`}>
            books finished
          </div>
          <div className="mt-2.5 h-[9px] overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
      {error && <p className={`mt-1.5 font-sans text-xs ${textClass}`}>{error}</p>}
    </div>
  )
}

function FlameIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5c3.2 3 5.5 5.6 5.5 9.1A5.5 5.5 0 016.5 11.6c0-1.6.7-2.9 1.8-4.2.3 1.5 1 2.3 2 2.6-.6-2.8.2-5.4 1.7-7.5z" />
    </svg>
  )
}

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
  const { user, profile } = useAuth()
  const { celebrate, node: celebrationNode } = useCelebration()
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [currentlyReading, setCurrentlyReading] = useState<ShelfItemWithBook[]>([])
  const [finishedThisYear, setFinishedThisYear] = useState(0)
  const [finishedThisMonth, setFinishedThisMonth] = useState(0)
  const [finishedThisWeek, setFinishedThisWeek] = useState(0)
  const [goal, setGoal] = useState<ReadingGoal | null>(null)
  const [monthGoal, setMonthGoal] = useState<ReadingGoal | null>(null)
  const [weekGoal, setWeekGoal] = useState<ReadingGoal | null>(null)
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [circleActivity, setCircleActivity] = useState<RecentCircleActivity[]>([])
  const [recordingStreak, setRecordingStreak] = useState(false)
  // Toggled briefly on tap to trigger the nib-pop bounce (see index.css) —
  // a class flip rather than a CSS transition, since the same value needs
  // to be re-triggerable on every tap, not just the first.
  const [streakPop, setStreakPop] = useState(false)
  const popTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const shelfItems = await getShelfItemsWithBooks(user.id)
        const reading = shelfItems.filter((item) => item.status === 'reading')

        const [
          finishedCount,
          finishedMonthCount,
          finishedWeekCount,
          yearGoal,
          monthGoalRow,
          weekGoalRow,
          readingStreak,
          recs,
          activity,
        ] = await Promise.all([
          countBooksFinishedInYear(user.id, CURRENT_YEAR),
          countBooksFinishedInPeriod(user.id, 'month', MONTH_KEY),
          countBooksFinishedInPeriod(user.id, 'week', WEEK_KEY),
          getGoalForYear(user.id, CURRENT_YEAR),
          getGoalForPeriod(user.id, 'month', MONTH_KEY),
          getGoalForPeriod(user.id, 'week', WEEK_KEY),
          getStreak(user.id),
          getRecommendations(user.id, 5),
          getRecentCircleActivity(user.id),
        ])

        if (cancelled) return
        setCurrentlyReading(reading)
        setFinishedThisYear(finishedCount)
        setFinishedThisMonth(finishedMonthCount)
        setFinishedThisWeek(finishedWeekCount)
        setGoal(yearGoal)
        setMonthGoal(monthGoalRow)
        setWeekGoal(weekGoalRow)
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

  useEffect(() => {
    return () => {
      if (popTimeoutRef.current !== null) window.clearTimeout(popTimeoutRef.current)
    }
  }, [])

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
      throw err // ProgressControl needs this to know the save failed and roll back its own display.
    }
  }

  // "Record your streak": a lighter alternative to logging a specific
  // page, for days you read but don't want to note exactly where you
  // stopped. Logs a zero-page session (fromPage === toPage) against
  // whichever book is currently being read, which is enough for the
  // server-side streak trigger to count today, without touching the
  // book's actual progress.
  async function recordStreakToday() {
    if (!user || currentlyReading.length === 0) return
    const item = currentlyReading[0]
    if (!item) return
    const streakBefore = streak?.current_streak ?? 0
    setRecordingStreak(true)
    setError(null)
    // The bounce fires immediately on tap, before the network round-trip,
    // it's acknowledging the tap itself, not the save succeeding.
    if (popTimeoutRef.current !== null) window.clearTimeout(popTimeoutRef.current)
    setStreakPop(true)
    popTimeoutRef.current = window.setTimeout(() => setStreakPop(false), 420)
    try {
      const page = item.current_page ?? 0
      await logReadingProgress(user.id, item.book_id, page, page, item.books.page_count)
      const streakAfter = await getStreak(user.id)
      setStreak(streakAfter)
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(streakBefore, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record today. Try again.')
    } finally {
      setRecordingStreak(false)
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
  const { displayName } = resolveDisplayIdentity(user, profile)
  const firstName = displayName.split(' ')[0] || 'there'

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
            {Array.from({ length: STREAK_DOTS }, (_, i) => {
              const filled = i < Math.min(STREAK_DOTS, currentStreak)
              // The very next dot (today's, once recorded) pulses gently
              // to invite the tap below, so the button and the dots read
              // as one connected gesture rather than two separate things.
              const isNext = !filled && i === Math.min(STREAK_DOTS, currentStreak)
              return (
                <div
                  key={i}
                  className="h-[7px] flex-1 rounded-full"
                  style={{
                    background: filled ? 'var(--nibbles-honey)' : 'rgba(138,94,27,.22)',
                    animation: isNext ? 'nib-in 1.6s ease-in-out infinite alternate' : undefined,
                  }}
                />
              )
            })}
          </div>
          {currentlyReading.length > 0 ? (
            <button
              type="button"
              onClick={() => void recordStreakToday()}
              disabled={recordingStreak}
              style={{ animation: streakPop ? 'nib-pop 0.42s ease' : undefined }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-honey px-4 py-3 font-sans text-sm font-extrabold text-surface shadow-soft transition-transform active:scale-95 disabled:opacity-50"
            >
              <FlameIcon />
              {recordingStreak ? 'Recording…' : 'I read today'}
            </button>
          ) : (
            <p className="mt-3 font-sans text-[11px] text-honey-text opacity-70">
              Start a book to record a streak day.
            </p>
          )}
        </div>

        <GoalCard
          label={`${CURRENT_YEAR} goal`}
          bgClass="bg-leaf"
          textClass="text-on-leaf"
          current={finishedThisYear}
          goal={goal}
          onSave={async (target) => {
            if (!user) return
            const updated = await setGoalForYear(user.id, CURRENT_YEAR, target)
            setGoal(updated)
          }}
        />

        <GoalCard
          label="This month"
          bgClass="bg-tint"
          textClass="text-ink"
          current={finishedThisMonth}
          goal={monthGoal}
          onSave={async (target) => {
            if (!user) return
            const updated = await setGoalForPeriod(user.id, 'month', MONTH_KEY, target)
            setMonthGoal(updated)
          }}
        />

        <GoalCard
          label="This week"
          bgClass="bg-surface"
          textClass="text-ink"
          current={finishedThisWeek}
          goal={weekGoal}
          onSave={async (target) => {
            if (!user) return
            const updated = await setGoalForPeriod(user.id, 'week', WEEK_KEY, target)
            setWeekGoal(updated)
          }}
        />
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
            {currentlyReading.map((item) => (
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
                  <ProgressControl
                    currentPage={item.current_page ?? 0}
                    pageCount={item.books.page_count}
                    onSave={(page) => quickLogProgress(item, page)}
                  />
                </div>
              </li>
            ))}
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
