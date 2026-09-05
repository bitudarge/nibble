import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { Mascot } from '../components/brand/Mascot'
import { useCelebration } from '../components/celebrate/useCelebration'
import { PageLogSheet } from '../components/dashboard/PageLogSheet'
import { ProgressRing } from '../components/dashboard/ProgressRing'
import { CirclesIcon, RecsIcon, StreakIcon } from '../components/layout/navIcons'
import { Skeleton } from '../components/layout/Skeleton'
import { useAuth } from '../lib/auth/useAuth'
import { getRecentCircleActivity, type RecentCircleActivity } from '../lib/circles/data'
import {
  countBooksFinishedInPeriod,
  countBooksFinishedInYear,
  getGoalForPeriod,
  getGoalForYear,
  getIsoWeekPeriodKey,
  getMonthPeriodKey,
  getReadDaysThisWeek,
  getStreak,
  isStreakMilestone,
} from '../lib/goals/data'
import { resolveDisplayIdentity } from '../lib/profile/identity'
import { getRecommendations, type Recommendation } from '../lib/recommender'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemsWithBooks, type ShelfItemWithBook } from '../lib/shelf/data'
import type { ReadingGoal, ReadingStreak } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()
const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
// Computed once per module load, not per render — the "current" month/week
// genuinely only changes at a real calendar boundary, no need to
// recompute it on every re-render.
const MONTH_KEY = getMonthPeriodKey(new Date())
const WEEK_KEY = getIsoWeekPeriodKey(new Date())
// Monday-first index of today, matching daysReadFromSessionDates' own
// Monday-anchored bucketing (getDay() is Sunday-first, so shift it).
const TODAY_WEEK_INDEX = (new Date().getDay() + 6) % 7

function LeafIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M20 4C10 4 4 9.5 4 16.5c0 1.4.3 2.6.8 3.5C7 15 11.5 11.5 18 10c-4.5 2.2-8 5.6-9.6 10 1 .3 2 .5 3.1.5 6 0 8.5-6 8.5-16.5z"
      />
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

/** Rough "about N evenings" estimate for the hero card, matching the mockup's own math (45 pages/evening, at least one). */
function eveningsLeft(pagesLeft: number): number {
  return Math.max(1, Math.ceil(pagesLeft / 45))
}

/**
 * Shown the instant this page mounts, shaped like the real dashboard
 * below (hero card, goals card, a row of book-shaped cards) rather than a
 * blank screen or a plain "Loading…" line — the owner asked for exactly
 * this after finding the dashboard slow to open: a content-shaped
 * placeholder reads as "the page is working" instead of "did this break."
 */
function HomeSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="rounded-[30px] bg-surface p-4.5 shadow-soft">
        <div className="mb-4 flex gap-4">
          <Skeleton className="h-[130px] w-[86px] flex-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
        <Skeleton className="mb-4 h-3 w-full" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <div className="rounded-[30px] bg-surface p-4.5 shadow-soft">
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="mb-4 flex items-center gap-4">
          <Skeleton className="h-16 w-16 flex-none rounded-full" />
          <div className="min-w-0 flex-1 gap-1.5">
            <Skeleton className="mb-2 h-3 w-40" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-full" />
      </div>
      <div>
        <Skeleton className="mb-3 h-5 w-32" />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[178px] w-[132px] flex-none" />
          ))}
        </div>
      </div>
    </div>
  )
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
  const [weekDaysRead, setWeekDaysRead] = useState<boolean[]>(Array(7).fill(false) as boolean[])
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  // null (not []) specifically means "still loading" — recommendations
  // load independently of everything else below, see the second effect's
  // own comment for why, so this needs its own three-way state rather
  // than reusing the page's main `state`.
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null)
  const [circleActivity, setCircleActivity] = useState<RecentCircleActivity[]>([])
  const [recordingStreak, setRecordingStreak] = useState(false)
  // A brief bounce on tap (see index.css's nib-pop), fired immediately
  // alongside the optimistic leaf fill so the tap itself feels
  // acknowledged before the network round trip resolves.
  const [streakPop, setStreakPop] = useState(false)
  const popTimeoutRef = useRef<number | null>(null)
  const [logSheetOpen, setLogSheetOpen] = useState(false)
  const [logSheetItemId, setLogSheetItemId] = useState<string | null>(null)

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
          daysRead,
          readingStreak,
          activity,
        ] = await Promise.all([
          countBooksFinishedInYear(user.id, CURRENT_YEAR),
          countBooksFinishedInPeriod(user.id, 'month', MONTH_KEY),
          countBooksFinishedInPeriod(user.id, 'week', WEEK_KEY),
          getGoalForYear(user.id, CURRENT_YEAR),
          getGoalForPeriod(user.id, 'month', MONTH_KEY),
          getGoalForPeriod(user.id, 'week', WEEK_KEY),
          getReadDaysThisWeek(user.id, WEEK_KEY),
          getStreak(user.id),
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
        setWeekDaysRead(daysRead)
        setStreak(readingStreak)
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

  // Recommendations load on their own timeline, separate from everything
  // above — getRecommendations does real external Open Library lookups
  // (genre, bestseller, and same-author discovery, plus an enrichment
  // pass on the final picks) that can take meaningfully longer than the
  // rest of this page's plain Supabase reads. Blocking the whole
  // dashboard on the slowest single section made the entire page feel
  // slow to open even though most of it was ready almost instantly — the
  // owner's own words were "load the first one first." Everything else
  // above renders as soon as it's ready; this section shows its own
  // skeleton (see the render below) until this resolves independently.
  useEffect(() => {
    let cancelled = false
    if (!user) return
    getRecommendations(user.id, 5)
      .then((recs) => {
        if (!cancelled) setRecommendations(recs)
      })
      .catch(() => {
        // A failed recommendations fetch shouldn't block or error out the
        // rest of an otherwise-working dashboard — just show the section's
        // own empty state instead of a spinner that never resolves.
        if (!cancelled) setRecommendations([])
      })
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
      throw err // PageLogSheet needs this to know the save failed and keep the sheet open.
    }
  }

  // "Record your streak": a lighter alternative to logging a specific
  // page, for days you read but don't want to note exactly where you
  // stopped. Logs a zero-page session (fromPage === toPage) against
  // whichever book is currently being read, which is enough for the
  // server-side streak trigger to count today, without touching the
  // book's actual progress.
  async function recordStreakToday() {
    if (!user || currentlyReading.length === 0 || weekDaysRead[TODAY_WEEK_INDEX]) return
    const item = currentlyReading[0]
    if (!item) return
    const streakBefore = streak?.current_streak ?? 0
    setRecordingStreak(true)
    setError(null)
    if (popTimeoutRef.current !== null) window.clearTimeout(popTimeoutRef.current)
    setStreakPop(true)
    popTimeoutRef.current = window.setTimeout(() => setStreakPop(false), 420)
    // Fill today's leaf in immediately — waiting on two sequential
    // network round trips (log the session, then re-fetch the whole
    // week) before showing anything made a successful tap look like it
    // hadn't registered at all, which is what actually read as "broken"
    // rather than just slow. Rolled back below if the save fails.
    setWeekDaysRead((prev) => {
      const next = [...prev]
      next[TODAY_WEEK_INDEX] = true
      return next
    })
    try {
      const page = item.current_page ?? 0
      await logReadingProgress(user.id, item.book_id, page, page, item.books.page_count)
      const streakAfter = await getStreak(user.id)
      setStreak(streakAfter)
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(streakBefore, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
      const daysRead = await getReadDaysThisWeek(user.id, WEEK_KEY)
      setWeekDaysRead(daysRead)
    } catch (err) {
      setWeekDaysRead((prev) => {
        const next = [...prev]
        next[TODAY_WEEK_INDEX] = false
        return next
      })
      setError(err instanceof Error ? err.message : 'Could not record today. Try again.')
    } finally {
      setRecordingStreak(false)
    }
  }

  if (state === 'loading') {
    return <HomeSkeleton />
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  const { displayName } = resolveDisplayIdentity(user, profile)
  const firstName = displayName.split(' ')[0] || 'there'
  const weekPct = weekGoal
    ? Math.min(100, Math.round((finishedThisWeek / weekGoal.target_books) * 100))
    : 0
  const monthPct = monthGoal
    ? Math.min(100, Math.round((finishedThisMonth / monthGoal.target_books) * 100))
    : 0
  const yearPct = goal ? Math.min(100, Math.round((finishedThisYear / goal.target_books) * 100)) : 0
  const weekSubline =
    currentlyReading.length > 0
      ? `${currentlyReading.length} on the go` +
        (weekGoal
          ? weekGoal.target_books - finishedThisWeek > 0
            ? ` · ${weekGoal.target_books - finishedThisWeek} more this week`
            : ' · weekly goal met'
          : '')
      : 'Nothing on the go right now'

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-6"
      style={{ animation: 'nib-in 0.26s ease both' }}
    >
      {celebrationNode}
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-0.5 font-sans text-sm text-muted">{weekSubline}</p>
        {error && (
          <p className="mt-2 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
            {error}
          </p>
        )}
      </div>

      {currentlyReading.length === 0 ? (
        <div className="overflow-hidden rounded-[30px] bg-surface shadow-soft">
          <div className="flex justify-center bg-tint px-6 pt-6">
            <Mascot pose="idea" alt="" className="h-40" />
          </div>
          <div className="p-6 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">Nothing on the go</h2>
            <p className="mt-1.5 font-sans text-sm text-muted">
              Pick something short to start. Nibbles likes small books too.
            </p>
            <Link
              to="/search"
              className="btn-cta mt-4 inline-block rounded-full bg-sage px-7 py-3 font-sans text-base font-bold text-surface"
            >
              Find a book
            </Link>
          </div>
        </div>
      ) : (
        (() => {
          const hero = currentlyReading[0]
          if (!hero) return null
          const pageCount = hero.books.page_count
          const currentPage = hero.current_page ?? 0
          const pct = pageCount ? Math.min(100, Math.round((currentPage / pageCount) * 100)) : 0
          const pagesLeft = pageCount ? Math.max(0, pageCount - currentPage) : null
          return (
            <div className="rounded-[30px] bg-surface p-4.5 shadow-soft">
              <div className="mb-4 flex gap-4">
                <Link to={`/book/${hero.book_id}`} className="flex-none">
                  <BookCover
                    coverUrl={hero.books.cover_url}
                    title={hero.books.title}
                    className="h-[130px] w-[86px] shadow-lift"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="mb-1 font-sans text-[11px] font-bold tracking-wide text-sage uppercase">
                    Still nibbling
                  </span>
                  <Link
                    to={`/book/${hero.book_id}`}
                    className="block truncate font-display text-lg font-semibold text-ink"
                  >
                    {hero.books.title}
                  </Link>
                  <p className="mt-0.5 truncate font-sans text-sm text-muted">
                    {hero.books.author}
                  </p>
                  {pagesLeft !== null && (
                    <p className="mt-auto font-sans text-[13px] font-bold text-sage-deep">
                      {pagesLeft} pages left · about {eveningsLeft(pagesLeft)} evening
                      {eveningsLeft(pagesLeft) === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              </div>
              {pageCount && (
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      background:
                        'linear-gradient(90deg, var(--nibbles-sage-deep), var(--nibbles-sage))',
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLogSheetItemId(hero.id)
                    setLogSheetOpen(true)
                  }}
                  className="btn-cta flex-1 rounded-full bg-sage px-4 py-2.5 font-sans text-sm font-bold text-surface"
                >
                  Nibble a few pages
                </button>
                {currentlyReading.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogSheetItemId(null)
                      setLogSheetOpen(true)
                    }}
                    className="flex-none rounded-full bg-tint px-4 py-2.5 font-sans text-xs font-extrabold text-sage-deep transition-transform active:scale-95"
                  >
                    +{currentlyReading.length - 1} more
                  </button>
                )}
              </div>
            </div>
          )
        })()
      )}

      {logSheetOpen && (
        <PageLogSheet
          items={currentlyReading}
          initialItemId={logSheetItemId}
          onClose={() => setLogSheetOpen(false)}
          onSave={(item, page) => quickLogProgress(item, page)}
        />
      )}

      <div className="rounded-[30px] bg-surface p-4.5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Your goals</h2>
            {/* Tapping today's leaf below only felt worth doing if it's
                visibly connected to something — the streak count used to
                live in a card of its own that got removed, leaving the
                leaf row with no number to actually show for a tap. */}
            {streak && streak.current_streak > 0 && (
              <div className="mt-0.5 flex items-center gap-1 font-sans text-[12.5px] font-bold text-sage-deep">
                <StreakIcon />
                {streak.current_streak} day{streak.current_streak === 1 ? '' : 's'} in a row
              </div>
            )}
          </div>
          <Link
            to="/wrap"
            className="flex-none font-sans text-[12.5px] font-extrabold text-sage-deep transition-opacity active:opacity-60"
          >
            Adjust
          </Link>
        </div>
        <div className="mb-4 flex items-center gap-4">
          <ProgressRing percent={weekPct}>
            <span className="font-display text-2xl leading-none font-semibold text-ink">
              {finishedThisWeek}
            </span>
            <span className="mt-0.5 font-sans text-[10px] font-bold text-muted">
              of {weekGoal?.target_books ?? '–'}
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="mb-2 font-sans text-[11px] font-bold tracking-wide text-muted uppercase">
              {currentlyReading.length === 0
                ? 'Days this week · start a book to log a streak day'
                : "Days this week · tap today's leaf to log a streak day"}
            </div>
            <div className="flex gap-1.5">
              {WEEK_DAY_LABELS.map((label, i) => {
                const isToday = i === TODAY_WEEK_INDEX
                const read = weekDaysRead[i]
                const cellStyle = {
                  background: read ? 'var(--nibbles-sage)' : 'var(--nibbles-line)',
                }
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    {isToday ? (
                      <button
                        type="button"
                        onClick={() => void recordStreakToday()}
                        disabled={recordingStreak || read || currentlyReading.length === 0}
                        aria-label={read ? 'Today logged' : 'Log today as a reading day'}
                        className="flex h-8 w-full items-center justify-center rounded-[10px] transition-transform active:scale-90 disabled:active:scale-100"
                        style={{
                          ...cellStyle,
                          animation: streakPop ? 'nib-pop 0.42s ease' : undefined,
                        }}
                      >
                        {read && <LeafIcon className="text-surface" />}
                      </button>
                    ) : (
                      <div
                        className="flex h-8 w-full items-center justify-center rounded-[10px]"
                        style={cellStyle}
                      >
                        {read && <LeafIcon className="text-surface" />}
                      </div>
                    )}
                    <span className="font-sans text-[9.5px] font-bold text-muted">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="mb-3.5 h-px bg-line" />
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-sans text-[11px] font-bold tracking-wide text-muted uppercase">
                This month
              </span>
              <span className="font-sans text-[12.5px] font-extrabold text-sage-deep">
                {finishedThisMonth} of {monthGoal?.target_books ?? '–'}
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
                style={{ width: `${monthPct}%` }}
              />
            </div>
          </div>
          <div className="h-11 w-px flex-none bg-line" />
          <div className="w-24 flex-none">
            <div className="mb-1.5 font-sans text-[11px] font-bold tracking-wide text-muted uppercase">
              This year
            </div>
            <div className="font-display text-xl leading-none font-semibold text-ink">
              {finishedThisYear}/{goal?.target_books ?? '–'}
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-sage" style={{ width: `${yearPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {streak && streak.rest_days_banked > 0 && (
        <div className="flex items-center gap-3 rounded-[26px] bg-ink p-4">
          <Mascot pose="resting" alt="" className="h-14 flex-none" />
          <p className="font-sans text-[13px] leading-relaxed text-page">
            <span className="font-extrabold">
              {streak.rest_days_banked} rest day{streak.rest_days_banked === 1 ? '' : 's'} banked.
            </span>{' '}
            Miss a day and your streak survives it.
          </p>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RecsIcon />
            <h2 className="font-sans text-lg font-extrabold text-ink">Picked for you</h2>
          </div>
          <Link to="/recommendations" className="font-sans text-xs font-bold text-sage">
            See all
          </Link>
        </div>
        {recommendations === null ? (
          // Its own skeleton, independent of the rest of the page — see
          // the recommendations-loading effect's own comment for why this
          // section can still be loading well after everything else above
          // it has already rendered.
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[178px] w-[132px] flex-none" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
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
            {circleActivity.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-start gap-3 rounded-[20px] bg-surface p-3.5 shadow-soft"
              >
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-leaf font-sans text-xs font-extrabold text-on-leaf">
                  {item.displayName.charAt(0).toUpperCase()}
                </div>
                <p className="font-sans text-sm text-muted">
                  <span className="font-extrabold text-ink">{item.displayName}</span>{' '}
                  {item.kind === 'finished' ? (
                    <>
                      finished{' '}
                      <Link to={`/book/${item.bookId}`} className="font-bold text-sage-deep">
                        {item.bookTitle}
                      </Link>{' '}
                      in {item.circleName}.
                    </>
                  ) : (
                    <>
                      in {item.circleName}, on{' '}
                      <Link to={`/book/${item.bookId}`} className="font-bold text-sage-deep">
                        {item.bookTitle}
                      </Link>
                      : {item.body}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
