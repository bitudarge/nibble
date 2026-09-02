import { useEffect, useState, type FormEvent } from 'react'
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
    return <p className="text-stone-500">Loading…</p>
  }

  if (state === 'not-found') {
    return (
      <p className="text-stone-500">
        That circle couldn't be found — you may not be a member, or the invite link is wrong.
      </p>
    )
  }

  if (state === 'error' || !circle) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        {error ?? 'Something went wrong loading this circle.'}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{circle.name}</h1>
        <p className="text-sm text-stone-500">
          Invite code: <span className="font-mono">{circle.join_code}</span> — share this with
          friends so they can join.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Members ({members.length})</h2>
        <ul className="flex flex-wrap gap-3">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 text-sm text-stone-700">
              {member.profiles.avatar_url ? (
                <img src={member.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs"
                >
                  {member.profiles.display_name.charAt(0).toUpperCase()}
                </span>
              )}
              {member.profiles.display_name}
              {member.role === 'owner' && <span className="text-xs text-stone-400">(owner)</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Reading together</h2>
        <div className="mb-3 flex flex-col gap-3">
          {reads.length === 0 ? (
            <p className="text-stone-500">Nothing started yet.</p>
          ) : (
            reads.map((read) => (
              <div key={read.id} className="rounded-md border border-stone-200 p-3">
                <Link to={`/book/${read.book_id}`} className="font-medium text-stone-900">
                  {read.books.title}
                </Link>
                {read.target_finish_date && (
                  <p className="text-xs text-stone-500">Target: {read.target_finish_date}</p>
                )}
                <ul className="mt-2 flex flex-col gap-1">
                  {(progressByBook[read.book_id] ?? []).map((progress) => (
                    <li
                      key={progress.id}
                      className="flex items-center gap-2 text-xs text-stone-600"
                    >
                      <span className="w-24 truncate">{progress.profiles.display_name}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-stone-100">
                        <div
                          className="h-1.5 rounded-full bg-stone-900"
                          style={{ width: `${Math.min(progress.percent_complete ?? 0, 100)}%` }}
                        />
                      </div>
                      <span>{Math.round(progress.percent_complete ?? 0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <StartCircleReadForm circleId={circle.id} onStarted={() => void refreshCircle(circle.id)} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Discussion</h2>
        <form onSubmit={(e) => void handlePostMessage(e)} className="mb-3 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something to the circle…"
            className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || posting}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </form>
        {messages.length === 0 ? (
          <p className="text-stone-500">No messages yet — say hello.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => (
              <li key={message.id} className="rounded-md border border-stone-200 p-2 text-sm">
                <span className="font-medium text-stone-900">{message.profiles.display_name}</span>{' '}
                <span className="text-stone-700">{message.body}</span>
                {message.books && (
                  <Link
                    to={`/book/${message.book_id}`}
                    className="ml-1 text-xs text-stone-500 underline"
                  >
                    ({message.books.title})
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Circle reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-stone-500">No circle-only reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-md border border-stone-200 p-3 text-sm">
                <Link to={`/book/${review.book_id}`} className="font-medium text-stone-900">
                  {review.books.title}
                </Link>
                <span className="ml-2 text-xs text-stone-500">
                  by {review.profiles.display_name}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-stone-700">{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Showcase</h2>
        {showcase.length === 0 ? (
          <p className="text-stone-500">No finished books to show yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {showcase.map((item) => (
              <li key={item.id}>
                <Link to={`/book/${item.book_id}`}>
                  {item.books.cover_url ? (
                    <img
                      src={item.books.cover_url}
                      alt=""
                      className="h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                      No cover
                    </div>
                  )}
                  <span className="mt-1 block text-xs font-medium text-stone-900">
                    {item.books.title}
                  </span>
                  <span className="block text-xs text-stone-500">{item.profiles.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
