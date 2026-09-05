import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { InviteCodeShare } from '../components/circles/InviteCodeShare'
import { useAuth } from '../lib/auth/useAuth'
import {
  createCircle,
  getCircleMembers,
  getCircleReads,
  getMemberProgressForBook,
  getMyCircles,
  joinCircleByCode,
  type CircleMemberWithProfile,
  type CircleReadWithBook,
  type MemberProgress,
} from '../lib/circles/data'
import type { Circle } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

interface CircleSummary {
  circle: Circle
  members: CircleMemberWithProfile[]
  sharedBook: CircleReadWithBook | null
  memberProgress: MemberProgress[]
}

async function loadCircleSummary(circle: Circle): Promise<CircleSummary> {
  const [members, reads] = await Promise.all([
    getCircleMembers(circle.id),
    getCircleReads(circle.id),
  ])
  const sharedBook = reads.find((read) => read.status === 'active') ?? null
  const memberProgress = sharedBook ? await getMemberProgressForBook(sharedBook.book_id) : []
  return { circle, members, sharedBook, memberProgress }
}

// A single initial-bubble avatar, colored by a small fixed palette hashed
// from the name — enough visual variety to tell members apart at a
// glance without needing real uploaded photos.
const AVATAR_COLORS = [
  'var(--nibbles-sage)',
  'var(--nibbles-sage-deep)',
  'var(--nibbles-ink)',
  'var(--nibbles-honey)',
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash]!
}

export function Circles() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [summaries, setSummaries] = useState<CircleSummary[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [newCircleName, setNewCircleName] = useState('')
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  // Set right after a successful create, instead of navigating straight
  // to the circle page — the owner asked to be able to invite people at
  // creation time, not have to go find the code somewhere else after.
  const [justCreated, setJustCreated] = useState<Circle | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const mine = await getMyCircles(user.id)
        const withSummaries = await Promise.all(mine.map(loadCircleSummary))
        if (!cancelled) {
          setSummaries(withSummaries)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your circles.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !newCircleName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const circle = await createCircle(user.id, newCircleName.trim())
      setNewCircleName('')
      setJustCreated(circle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that circle.')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setError(null)
    try {
      const circle = await joinCircleByCode(joinCode.trim())
      navigate(`/circles/${circle.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join with that code.')
      setJoining(false)
    }
  }

  if (justCreated) {
    return (
      <div className="mx-auto max-w-lg text-center" style={{ animation: 'nib-in 0.26s ease both' }}>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          {justCreated.name} is ready
        </h1>
        <p className="mb-5 font-sans text-sm text-muted">
          Invite your first readers before you head in.
        </p>
        <InviteCodeShare circleName={justCreated.name} joinCode={justCreated.join_code} />
        <button
          type="button"
          onClick={() => navigate(`/circles/${justCreated.id}`)}
          className="mt-5 h-11 w-full rounded-full bg-sage font-sans text-sm font-extrabold text-surface transition-transform active:scale-95"
        >
          Continue to your circle
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Your circles</h1>
      <p className="mb-5 font-sans text-sm text-muted">
        Small rooms with friends, never a public feed.
      </p>

      {error && (
        <p className="mb-4 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      {state === 'loading' && <p className="font-sans text-muted">Finding your circles…</p>}

      {state === 'error' && !error && (
        <p className="font-sans text-muted">Something went wrong loading your circles.</p>
      )}

      {state === 'loaded' && (
        <section className="mb-6">
          {summaries.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              You're not in any circles yet. Start one below, or join with a friend's code.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {summaries.map(({ circle, members, sharedBook, memberProgress }) => {
                const avgPct =
                  memberProgress.length > 0
                    ? Math.round(
                        memberProgress.reduce((sum, m) => sum + (m.percent_complete ?? 0), 0) /
                          memberProgress.length,
                      )
                    : 0
                const filledDots = Math.round(avgPct / 10)
                const furthestAhead = memberProgress.reduce(
                  (best, m) =>
                    !best || (m.percent_complete ?? 0) > (best.percent_complete ?? 0) ? m : best,
                  null as MemberProgress | null,
                )
                const furthestAheadName =
                  furthestAhead?.profiles.id === user?.id
                    ? 'You'
                    : furthestAhead?.profiles.display_name

                return (
                  <li key={circle.id}>
                    <Link
                      to={`/circles/${circle.id}`}
                      className="block rounded-3xl bg-surface p-4 shadow-soft transition-transform active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-lg font-bold text-ink">
                          {circle.name}
                        </span>
                        <div className="flex -space-x-2">
                          {members.slice(0, 4).map((member) => (
                            <span
                              key={member.user_id}
                              aria-hidden
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface font-sans text-xs font-bold text-surface"
                              style={{ background: avatarColor(member.profiles.display_name) }}
                            >
                              {member.profiles.display_name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-1 font-sans text-xs text-muted">
                        {members.map((m) => m.profiles.display_name).join(', ')}
                      </p>

                      {sharedBook && (
                        <div className="mt-3 rounded-2xl bg-tint p-3">
                          <p className="mb-2 truncate font-sans text-sm font-bold text-ink">
                            {sharedBook.books.title}
                          </p>
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex gap-1">
                              {Array.from({ length: 10 }, (_, i) => (
                                <span
                                  key={i}
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background:
                                      i < filledDots
                                        ? 'var(--nibbles-sage)'
                                        : 'var(--nibbles-line)',
                                  }}
                                />
                              ))}
                            </div>
                            <span className="font-sans text-xs font-bold text-sage-deep">
                              {avgPct}% together
                            </span>
                          </div>
                          {furthestAheadName && (
                            <p className="font-sans text-[11px] text-muted">
                              {furthestAheadName} {furthestAheadName === 'You' ? 'are' : 'is'}{' '}
                              furthest ahead, so be kind about spoilers.
                            </p>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <div className="rounded-3xl bg-surface p-4 shadow-soft">
        <h2 className="mb-1 font-sans text-base font-extrabold text-ink">Start or join one</h2>
        <p className="mb-3 font-sans text-xs text-muted">
          Three or four friends is the sweet spot.
        </p>
        <form onSubmit={(e) => void handleCreate(e)} className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={newCircleName}
            onChange={(e) => setNewCircleName(e.target.value)}
            placeholder="Name your circle"
            aria-label="Circle name"
            className="h-11 min-w-0 flex-1 rounded-full border-2 border-line bg-page px-4 font-sans text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!newCircleName.trim() || creating}
            className="h-11 flex-none rounded-full bg-sage px-5 font-sans text-sm font-extrabold text-surface transition-transform active:scale-95 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create circle'}
          </button>
        </form>
        <form onSubmit={(e) => void handleJoin(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="SOFA-24"
            aria-label="Invite code"
            className="h-11 min-w-0 flex-1 rounded-full border-2 border-line bg-page px-4 font-sans text-sm text-ink uppercase outline-none placeholder:text-muted placeholder:normal-case"
          />
          <button
            type="submit"
            disabled={!joinCode.trim() || joining}
            className="h-11 flex-none rounded-full border-2 border-line bg-page px-5 font-sans text-sm font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
