import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InviteCodeShare } from '../components/circles/InviteCodeShare'
import { StartCircleReadForm } from '../components/circles/StartCircleReadForm'
import { useAuth } from '../lib/auth/useAuth'
import {
  getCircleById,
  getCircleMembers,
  getCircleMessages,
  getCircleReads,
  getMemberProgressForBook,
  postCircleMessage,
  removeCircleMember,
  removeCircleRead,
  renameCircle,
  type CircleMemberWithProfile,
  type CircleMessageWithAuthor,
  type CircleReadWithBook,
  type MemberProgress,
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

export function CircleHome() {
  const { circleId } = useParams<{ circleId: string }>()
  const { user } = useAuth()

  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<CircleMemberWithProfile[]>([])
  const [messages, setMessages] = useState<CircleMessageWithAuthor[]>([])
  const [reads, setReads] = useState<CircleReadWithBook[]>([])
  const [progressByBook, setProgressByBook] = useState<Record<string, MemberProgress[]>>({})

  const [newMessage, setNewMessage] = useState('')
  const [posting, setPosting] = useState(false)

  // "Treat the whole circle like a normal groupchat" — a name edit and an
  // "add members" share panel, both reveal-on-click rather than sitting
  // permanently open, same shape as this app's other edit-in-place UI
  // (the private note editor, review composer).
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [removingReadId, setRemovingReadId] = useState<string | null>(null)

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

    const [membersData, messagesData, readsData] = await Promise.all([
      getCircleMembers(cid),
      getCircleMessages(cid),
      getCircleReads(cid),
    ])

    setCircle(found)
    setMembers(membersData)
    setMessages(messagesData)
    setReads(readsData)

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

  function startEditingName() {
    if (!circle) return
    setNameDraft(circle.name)
    setEditingName(true)
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault()
    if (!circle || !nameDraft.trim()) return
    setSavingName(true)
    try {
      const updated = await renameCircle(circle.id, nameDraft.trim())
      setCircle(updated)
      setEditingName(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename this circle.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleRemoveMember(memberRowId: string) {
    setRemovingMemberId(memberRowId)
    try {
      await removeCircleMember(memberRowId)
      setMembers((prev) => prev.filter((m) => m.id !== memberRowId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that member.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleRemoveRead(circleReadId: string) {
    setRemovingReadId(circleReadId)
    try {
      await removeCircleRead(circleReadId)
      setReads((prev) => prev.filter((r) => r.id !== circleReadId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that book.')
    } finally {
      setRemovingReadId(null)
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

  const isOwner = members.find((m) => m.user_id === user?.id)?.role === 'owner'

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-8 pb-28"
      style={{ animation: 'nib-in 0.26s ease both' }}
    >
      <div>
        {editingName ? (
          <form onSubmit={(e) => void handleSaveName(e)} className="flex items-center gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              disabled={savingName}
              aria-label="Circle name"
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 font-display text-xl font-semibold text-ink outline-none"
            />
            <button
              type="submit"
              disabled={savingName || !nameDraft.trim()}
              className="rounded-full bg-sage px-4 py-2 font-sans text-sm font-bold text-surface disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              disabled={savingName}
              className="rounded-full bg-tint px-4 py-2 font-sans text-sm font-bold text-ink"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{circle.name}</h1>
            {isOwner && (
              <button
                type="button"
                onClick={startEditingName}
                className="font-sans text-xs font-bold text-muted underline transition-opacity active:opacity-60"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-bold tracking-wide text-muted uppercase">
            Members ({members.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowInvite((prev) => !prev)}
            className="font-sans text-xs font-bold text-sage underline transition-opacity active:opacity-60"
          >
            {showInvite ? 'Hide invite code' : 'Add members'}
          </button>
        </div>
        {showInvite && (
          <div className="mb-3">
            <InviteCodeShare circleName={circle.name} joinCode={circle.join_code} />
          </div>
        )}
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
              {member.role === 'owner' ? (
                <span className="font-sans text-xs text-muted">owner</span>
              ) : (
                isOwner && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(member.id)}
                    disabled={removingMemberId === member.id}
                    aria-label={`Remove ${member.profiles.display_name}`}
                    className="font-sans text-xs font-bold text-muted underline transition-opacity active:opacity-60 disabled:opacity-50"
                  >
                    {removingMemberId === member.id ? 'Removing…' : 'Remove'}
                  </button>
                )
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
                  <div className="min-w-0 flex-1">
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
                  {/* Any member can drop a book the circle's done with —
                      same "treat it like a normal groupchat" reasoning as
                      member management below, not owner-restricted. */}
                  <button
                    type="button"
                    onClick={() => void handleRemoveRead(read.id)}
                    disabled={removingReadId === read.id}
                    aria-label={`Stop reading ${read.books.title} together`}
                    className="flex-none font-sans text-xs font-bold text-muted underline transition-opacity active:opacity-60 disabled:opacity-50"
                  >
                    {removingReadId === read.id ? 'Removing…' : 'Remove'}
                  </button>
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

      {/* A real groupchat's message box lives at the bottom of the
          screen, not inline in the scrolling feed — the owner's own
          words, "make the discussion type box be in the bottom like a
          normal text." Fixed to the viewport (not just this section) so
          it stays put while the rest of the page scrolls underneath it;
          the page's own pb-28 above keeps the last message from hiding
          behind it. Sits above the phone tab bar (which floats at
          bottom-3) on mobile; docks to the very bottom on desktop, where
          there's no tab bar to clear. */}
      <form
        onSubmit={(e) => void handlePostMessage(e)}
        className="fixed inset-x-0 bottom-[84px] z-30 md:bottom-0"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 md:px-8">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-4 shadow-lift">
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
          </div>
        </div>
      </form>
    </div>
  )
}
