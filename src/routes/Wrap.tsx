import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Skeleton } from '../components/layout/Skeleton'
import { getMyCircles } from '../lib/circles/data'
import {
  countBooksFinishedInPeriod,
  countBooksFinishedInYear,
  getGoalForPeriod,
  getGoalForYear,
  getIsoWeekPeriodKey,
  getMonthPeriodKey,
  getStreak,
  setGoalForPeriod,
  setGoalForYear,
} from '../lib/goals/data'
import { useAuth } from '../lib/auth/useAuth'
import { resolveDisplayIdentity } from '../lib/profile/identity'
import { getWrapData, type WrapData } from '../lib/wrap/data'
import type { ReadingGoal, ReadingStreak } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

const CURRENT_YEAR = new Date().getFullYear()
const MONTH_KEY = getMonthPeriodKey(new Date())
const WEEK_KEY = getIsoWeekPeriodKey(new Date())

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

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * One editable goal target as a live-updating slider — matches the round
 * 4 mockup's "Goals" card on the You page exactly: label + current
 * progress top-right, a big target number, a caption, then a native
 * range input. Saves on every change, no separate confirm step, same as
 * the mockup's own behavior (and Home's old inline GoalCard editing,
 * which this replaces — goal *editing* now lives here, Home just shows a
 * read-only summary that links here).
 */
function GoalSlider({
  label,
  caption,
  current,
  target,
  min,
  max,
  onChange,
}: {
  label: string
  caption: string
  current: number
  target: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(value: number) {
    setSaving(true)
    setError(null)
    try {
      await onChange(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-tint p-3.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-sans text-sm font-bold text-ink">{label}</span>
        <span className="font-sans text-xs font-bold text-sage-deep">
          {current} of {target}
        </span>
      </div>
      <div className="font-display text-2xl font-semibold text-ink">
        {target} <span className="font-sans text-xs font-bold text-muted">{caption}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={target}
        disabled={saving}
        onChange={(e) => void handleChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2 w-full accent-sage"
      />
      {error && <p className="mt-1 font-sans text-xs text-honey-text">{error}</p>}
    </div>
  )
}

export function Wrap() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const year = CURRENT_YEAR
  const [wrap, setWrap] = useState<WrapData | null>(null)
  const [editingGoals, setEditingGoals] = useState(false)
  const [streak, setStreak] = useState<ReadingStreak | null>(null)
  const [circleCount, setCircleCount] = useState(0)

  const [weekGoal, setWeekGoal] = useState<ReadingGoal | null>(null)
  const [monthGoal, setMonthGoal] = useState<ReadingGoal | null>(null)
  const [yearGoal, setYearGoal] = useState<ReadingGoal | null>(null)
  const [finishedThisWeek, setFinishedThisWeek] = useState(0)
  const [finishedThisMonth, setFinishedThisMonth] = useState(0)
  const [finishedThisYear, setFinishedThisYear] = useState(0)

  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const [data, streakData, circles, week, month, yr, weekCount, monthCount, yearCount] =
          await Promise.all([
            getWrapData(user.id, year),
            getStreak(user.id),
            getMyCircles(user.id),
            getGoalForPeriod(user.id, 'week', WEEK_KEY),
            getGoalForPeriod(user.id, 'month', MONTH_KEY),
            getGoalForYear(user.id, CURRENT_YEAR),
            countBooksFinishedInPeriod(user.id, 'week', WEEK_KEY),
            countBooksFinishedInPeriod(user.id, 'month', MONTH_KEY),
            countBooksFinishedInYear(user.id, CURRENT_YEAR),
          ])
        if (!cancelled) {
          setWrap(data)
          setStreak(streakData)
          setCircleCount(circles.length)
          setWeekGoal(week)
          setMonthGoal(month)
          setYearGoal(yr)
          setFinishedThisWeek(weekCount)
          setFinishedThisMonth(monthCount)
          setFinishedThisYear(yearCount)
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

  const { displayName, avatarUrl } = resolveDisplayIdentity(user, profile)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <div className="mb-5 flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
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
        {/* A real, reachable sign-out on the profile page itself — before
            this, signing out only existed in the desktop-only hamburger
            menu, so there was no way to sign out at all on a phone, this
            app's primary surface. */}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex-none rounded-full bg-tint px-3.5 py-2 font-sans text-xs font-bold text-muted transition-colors active:text-ink"
        >
          Sign out
        </button>
      </div>

      {/* The account-management links used to sit buried below the goals
          card and the (now-removed) wrap-year picker, easy to miss. They're
          real settings someone reaches for often (checking their own
          ratings, fixing a typo'd name, retaking the quiz after their taste
          shifts), so they get a proper, visible row right under the
          identity header instead. */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          to="/my-books"
          className="rounded-full bg-surface px-3.5 py-2 font-sans text-xs font-bold text-ink shadow-soft"
        >
          My ratings and notes
        </Link>
        <Link
          to="/profile/edit"
          className="rounded-full bg-surface px-3.5 py-2 font-sans text-xs font-bold text-ink shadow-soft"
        >
          Edit profile
        </Link>
        <Link
          to="/quiz"
          className="rounded-full bg-surface px-3.5 py-2 font-sans text-xs font-bold text-ink shadow-soft"
        >
          Retake the taste quiz
        </Link>
      </div>

      {wrap && (
        <div className="mb-5 rounded-[26px] bg-ink p-5">
          <h2 className="mb-3 font-sans text-[11px] font-bold tracking-wide text-page uppercase opacity-70">
            Your {year} wrap
          </h2>
          <div className="flex text-center">
            <div className="flex-1">
              <div className="font-display text-2xl font-semibold text-page">{wrap.totalBooks}</div>
              <div className="mt-1 font-sans text-xs font-bold text-page opacity-70">books</div>
            </div>
            <div className="w-px bg-page/20" />
            <div className="flex-1">
              <div className="font-display text-2xl font-semibold text-page">
                {wrap.totalPages.toLocaleString()}
              </div>
              <div className="mt-1 font-sans text-xs font-bold text-page opacity-70">pages</div>
            </div>
            <div className="w-px bg-page/20" />
            <div className="flex-1">
              <div className="font-display text-2xl font-semibold text-page">
                {streak?.current_streak ?? 0}
              </div>
              <div className="mt-1 font-sans text-xs font-bold text-page opacity-70">
                day streak
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="mb-5 rounded-[26px] bg-surface p-4.5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Goals</h2>
          <button
            type="button"
            onClick={() => setEditingGoals((v) => !v)}
            aria-label={editingGoals ? 'Done editing goals' : 'Edit goals'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tint text-sage-deep transition-transform active:scale-90"
          >
            {editingGoals ? (
              <span className="font-sans text-xs font-extrabold">Done</span>
            ) : (
              <PencilIcon />
            )}
          </button>
        </div>
        {editingGoals ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <GoalSlider
              label="Weekly"
              caption="days a week"
              current={finishedThisWeek}
              target={weekGoal?.target_books ?? 3}
              min={1}
              max={7}
              onChange={async (value) => {
                if (!user) return
                setWeekGoal(await setGoalForPeriod(user.id, 'week', WEEK_KEY, value))
              }}
            />
            <GoalSlider
              label="Monthly"
              caption="books a month"
              current={finishedThisMonth}
              target={monthGoal?.target_books ?? 2}
              min={1}
              max={8}
              onChange={async (value) => {
                if (!user) return
                setMonthGoal(await setGoalForPeriod(user.id, 'month', MONTH_KEY, value))
              }}
            />
            <GoalSlider
              label="Yearly"
              caption="books a year"
              current={finishedThisYear}
              target={yearGoal?.target_books ?? 12}
              min={6}
              max={60}
              onChange={async (value) => {
                if (!user) return
                setYearGoal(await setGoalForYear(user.id, CURRENT_YEAR, value))
              }}
            />
          </div>
        ) : (
          // Compact read-only summary, matching the same three targets
          // without the sliders' vertical space, tapping the pencil above
          // reveals the editable form instead of it always sitting open.
          <div className="mt-3 flex flex-col gap-1.5 font-sans text-sm text-ink">
            <div className="flex items-center justify-between">
              <span className="text-muted">Weekly</span>
              <span className="font-bold">
                {finishedThisWeek} of {weekGoal?.target_books ?? 3} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Monthly</span>
              <span className="font-bold">
                {finishedThisMonth} of {monthGoal?.target_books ?? 2} books
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Yearly</span>
              <span className="font-bold">
                {finishedThisYear} of {yearGoal?.target_books ?? 12} books
              </span>
            </div>
          </div>
        )}
      </section>

      {state === 'loading' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-[22px] bg-surface p-4 shadow-soft">
            <Skeleton className="mb-2.5 h-4 w-28" />
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-[22px]" />
            ))}
          </div>
        </div>
      )}

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
              {wrap.topTags.length > 0 && (
                <section>
                  <h2 className="mb-2.5 font-sans text-base font-extrabold text-ink">
                    Your top tags
                  </h2>
                  <div className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4 shadow-soft">
                    {wrap.topTags.slice(0, 4).map(({ tag, count }, i) => {
                      const max = wrap.topTags[0]?.count ?? count
                      const widthPct = Math.max(8, Math.round((count / max) * 100))
                      return (
                        <div key={tag} className="flex items-center gap-3">
                          <span className="w-24 flex-none truncate font-sans text-xs font-bold text-ink">
                            {formatTag(tag)}
                          </span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-tint">
                            <div
                              className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
                              style={{
                                width: `${widthPct}%`,
                                // A slightly deeper shade for the top bar
                                // reads as "your strongest pull," matching
                                // the mockup's flat-green bars closely
                                // enough without a whole new palette.
                                opacity: i === 0 ? 1 : 0.85,
                              }}
                            />
                          </div>
                          <span className="w-5 flex-none text-right font-sans text-xs font-bold text-muted">
                            {count}
                          </span>
                        </div>
                      )
                    })}
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
