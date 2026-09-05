import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StartCircleReadForm } from '../components/circles/StartCircleReadForm'
import { useAuth } from '../lib/auth/useAuth'
import {
  getCircleById,
  getCircleMembers,
  getCircleMessages,
  getCircleReads,
  getCircleReviews,
  getCircleShowcase,
  getMemberProgressForBook,
  postCircleMessage,
  type CircleMemberWithProfile,
  type CircleMessageWithAuthor,
  type CircleReadWithBook,
  type CircleReviewWithDetails,
  type MemberProgress,
  type ShowcaseItem,
} from '../lib/circles/data'
import type { Circle } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded' | 'not-found'

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="font-sans text-lg font-extrabold text-ink">{children}</h2>
    </div>
  )
}

const iconProps = {
  width: 19,
  height: 19,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  strokeWidth: 2.1,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function ReadingTogetherIcon() {
  return (
    <svg {...iconProps} stroke="var(--nibbles-sage)">
      <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z" />
    </svg>
  )
}

function DiscussionIcon() {
  return (
    <svg {...iconProps} stroke="var(--nibbles-sage)">
      <path d="M4.5 5.5h15v10h-9l-6 4z" />
    </svg>
  )
}

function ShowcaseIcon() {
  return (
    <svg {...iconProps} stroke="var(--nibbles-honey)">
      <path d="M7 4h10v16l-5-3.4L7 20z" />
    </svg>
  )
}

export function CircleHome() {
  const { circleId } = useParams<{ circleId: string }>()
  const { user } = useAuth()

  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<CircleMemberWithProfile[]>([])
  const [messages, setMessages] = useState<CircleMessageWithAuthor[]>([])
  const [reviews, setReviews] = useState<CircleReviewWithDetails[]>([])
  const [reads, setReads] = useState<CircleReadWithBook[]>([])
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([])
  const [progressByBook, setProgressByBook] = useState<Record<string, MemberProgress[]>>({})

  const [newMessage, setNewMessage] = useState('')
  const [posting, setPosting] = useState(false)

  // Fetches everything for a circle and updates state — no synchronous
  // setState at the top (every setState here happens after an await), so
  // it's safe to call from the mount effect below AND from a plain event
  // handler (StartCircleReadForm's onStarted) without re-triggering the
  // full-page "Loading…" state on that second call.
  async function refreshCircle(cid: string) {
    const found = await getCircleById(cid)
    if (!found) {
      setState('not-found')
      return
    }

    const [membersData, messagesData, reviewsData, readsData, showcaseData] = await Promise.all([
      getCircleMembers(cid),
      getCircleMessages(cid),
      getCircleReviews(cid),
      getCircleReads(cid),
      getCircleShowcase(cid),
    ])

    setCircle(found)
    setMembers(membersData)
    setMessages(messagesData)
    setReviews(reviewsData)
    setReads(readsData)
    setShowcase(showcaseData)

    const progressEntries = await Promise.all(
      readsData.map(
        async (read) => [read.book_id, await getMemberProgressForBook(read.book_id)] as const,
      ),
    )
    setProgressByBook(Object.fromEntries(progressEntries))
  }

  useEffect(() => {
    async function load() {
      if (!circleId || !user) return
      setState('loading')
      setError(null)
      try {
        await refreshCircle(circleId)
        setState('loaded')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this circle.')
        setState('error')
      }
    }
    void load()
  }, [circleId, user])

  async function handlePostMessage(e: FormEvent) {
    e.preventDefault()
    if (!user || !circleId || !newMessage.trim()) return
    setPosting(true)
    try {
      await postCircleMessage(circleId, user.id, newMessage.trim(), null)
      setNewMessage('')
      setMessages(await getCircleMessages(circleId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post that message.')
    } finally {
      setPosting(false)
    }
  }

  if (state === 'loading') {
    return <p className="font-sans text-muted">Finding your circle…</p>
  }

  if (state === 'not-found') {
    return (
      <p className="font-sans text-muted">
        That circle couldn't be found. You may not be a member, or the invite link is wrong.
      </p>
    )
  }

  if (state === 'error' || !circle) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong loading this circle.'}
      </div>
    )
  }

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-8"
      style={{ animation: 'nib-in 0.26s ease both' }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{circle.name}</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          Invite code <span className="font-bold text-ink">{circle.join_code}</span>
        </p>
      </div>

      {error && (
        <p className="rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-sans text-sm font-bold tracking-wide text-muted uppercase">
          Members ({members.length})
        </h2>
        <ul className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-3.5 pl-1.5 shadow-soft"
            >
              {member.profiles.avatar_url ? (
                <img src={member.profiles.avatar_url} alt="" className="h-7 w-7 rounded-full" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf font-sans text-xs font-bold text-on-leaf"
                >
                  {member.profiles.display_name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-sans text-sm font-bold text-ink">
                {member.profiles.display_name}
              </span>
              {member.role === 'owner' && (
                <span className="font-sans text-xs text-muted">owner</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading icon={<ReadingTogetherIcon />}>Reading together</SectionHeading>
        <div className="mb-3 flex flex-col gap-3">
          {reads.length === 0 ? (
            <p className="font-sans text-sm text-muted">Nothing started yet.</p>
          ) : (
            reads.map((read) => (
              <div key={read.id} className="rounded-3xl bg-surface p-4 shadow-soft">
                <div className="mb-3 flex items-center gap-3">
                  {/* A small gradient "cover" swatch, matching the
                      mockup's reading-together card even when the real
                      book has no cover image of its own yet. */}
                  <div
                    className="h-12 w-9 flex-none rounded-lg"
                    style={{
                      background: read.books.cover_url
                        ? `url(${read.books.cover_url}) center/cover`
                        : 'linear-gradient(160deg, var(--nibbles-sage), var(--nibbles-sage-deep))',
                    }}
                  />
                  <div className="min-w-0">
                    <span className="block font-sans text-[11px] font-bold tracking-wide text-sage uppercase">
                      Reading together
                    </span>
                    <Link
                      to={`/book/${read.book_id}`}
                      className="block truncate font-display text-lg font-semibold text-ink"
                    >
                      {read.books.title}
                    </Link>
                  </div>
                </div>
                {read.target_finish_date && (
                  <p className="mt-0.5 mb-3 font-sans text-xs text-muted">
                    Target finish {read.target_finish_date}
                  </p>
                )}
                <ul className="mb-3 flex flex-col gap-2.5">
                  {(progressByBook[read.book_id] ?? []).map((progress) => {
                    const isYou = progress.profiles.id === user?.id
                    return (
                      <li key={progress.id} className="flex items-center gap-2.5">
                        <span className="w-16 flex-none truncate font-sans text-xs font-bold text-muted">
                          {isYou ? 'You' : progress.profiles.display_name}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-tint">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(progress.percent_complete ?? 0, 100)}%`,
                              background: isYou ? 'var(--nibbles-ink)' : 'var(--nibbles-sage)',
                            }}
                          />
                        </div>
                        <span className="w-9 flex-none text-right font-sans text-xs font-bold text-muted">
                          {Math.round(progress.percent_complete ?? 0)}%
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="font-sans text-[11px] text-muted">
                  Nobody sees your exact page unless you share it.
                </p>
              </div>
            ))
          )}
        </div>
        <StartCircleReadForm circleId={circle.id} onStarted={() => void refreshCircle(circle.id)} />
      </section>

      <section>
        <SectionHeading icon={<DiscussionIcon />}>Chatter</SectionHeading>
        <form
          onSubmit={(e) => void handlePostMessage(e)}
          className="mb-4 flex items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-4 shadow-soft"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something kind"
            aria-label="Message"
            className="h-10 min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || posting}
            aria-label="Post"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-sage text-surface transition-transform active:scale-90 disabled:opacity-50"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 20l16-8L4 4v6l10 2-10 2z" fill="currentColor" />
            </svg>
          </button>
        </form>
        {messages.length === 0 ? (
          <p className="font-sans text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {/* getCircleMessages orders newest-first (so a "most recent
                50" limit keeps the right window), but a chat reads top to
                bottom in the order it happened, like every normal
                messaging app — reversed here for display only. */}
            {[...messages].reverse().map((message) => {
              const isOwn = message.user_id === user?.id
              return (
                <li
                  key={message.id}
                  className={`flex items-end gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-leaf font-sans text-xs font-bold text-on-leaf"
                  >
                    {message.profiles.display_name.charAt(0).toUpperCase()}
                  </span>
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 font-sans text-sm shadow-soft ${
                      isOwn
                        ? 'rounded-[20px_20px_6px_20px] bg-ink text-surface'
                        : 'rounded-[20px_20px_20px_6px] bg-surface text-ink'
                    }`}
                  >
                    {message.body}
                    {message.books && (
                      <Link
                        to={`/book/${message.book_id}`}
                        className={`mt-1 block text-xs font-bold underline ${isOwn ? 'text-surface/80' : 'text-muted'}`}
                      >
                        {message.books.title}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-sans text-sm font-bold tracking-wide text-muted uppercase">
          Circle reviews
        </h2>
        {reviews.length === 0 ? (
          <p className="font-sans text-sm text-muted">No circle-only reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl bg-surface p-3.5 shadow-soft">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    to={`/book/${review.book_id}`}
                    className="font-display text-sm font-semibold text-ink"
                  >
                    {review.books.title}
                  </Link>
                  <span className="font-sans text-xs text-muted">
                    by {review.profiles.display_name}
                  </span>
                </div>
                <p className="mt-1.5 font-sans text-sm whitespace-pre-wrap text-ink">
                  {review.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading icon={<ShowcaseIcon />}>Showcase</SectionHeading>
        {showcase.length === 0 ? (
          <p className="font-sans text-sm text-muted">No finished books to show yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {showcase.map((item) => (
              <li key={item.id}>
                <Link to={`/book/${item.book_id}`} className="block">
                  {item.books.cover_url ? (
                    <img
                      src={item.books.cover_url}
                      alt=""
                      className="h-28 w-full rounded-xl object-cover shadow-soft"
                    />
                  ) : (
                    <div
                      className="flex h-28 w-full items-center justify-center rounded-xl text-xs text-muted shadow-soft"
                      style={{
                        background:
                          'repeating-linear-gradient(135deg, #E3F2D9 0 7px, #F6FAF3 7px 14px)',
                      }}
                    >
                      No cover yet
                    </div>
                  )}
                  <span className="mt-1.5 block font-display text-xs font-semibold text-ink">
                    {item.books.title}
                  </span>
                  <span className="block font-sans text-xs text-muted">
                    {item.profiles.display_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
