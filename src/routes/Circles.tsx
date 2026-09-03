import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { createCircle, getMyCircles, joinCircleByCode } from '../lib/circles/data'
import type { Circle } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

export function Circles() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [circles, setCircles] = useState<Circle[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [newCircleName, setNewCircleName] = useState('')
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const mine = await getMyCircles(user.id)
        if (!cancelled) {
          setCircles(mine)
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
      navigate(`/circles/${circle.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that circle.')
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

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Your circles</h1>
      <p className="mb-5 font-sans text-sm text-muted">Small rooms, not a public feed.</p>

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
          {circles.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              You're not in any circles yet. Start one below, or join with a friend's code.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {circles.map((circle) => (
                <li key={circle.id}>
                  <Link
                    to={`/circles/${circle.id}`}
                    className="flex items-center justify-between rounded-3xl bg-surface p-4 font-sans shadow-soft transition-transform active:scale-[0.98]"
                  >
                    <span className="font-display text-lg font-bold text-ink">{circle.name}</span>
                    <span className="text-sm font-bold text-muted">View →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-4">
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-3xl bg-surface p-4 shadow-soft"
        >
          <h2 className="mb-3 font-sans text-base font-extrabold text-ink">Start a circle</h2>
          <input
            type="text"
            value={newCircleName}
            onChange={(e) => setNewCircleName(e.target.value)}
            placeholder="Circle name"
            aria-label="Circle name"
            className="mb-3 h-11 w-full rounded-full border-2 border-line bg-page px-4 font-sans text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!newCircleName.trim() || creating}
            className="h-11 w-full rounded-full bg-sage font-sans text-sm font-extrabold text-surface transition-transform active:scale-95 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        <form
          onSubmit={(e) => void handleJoin(e)}
          className="rounded-3xl bg-surface p-4 shadow-soft"
        >
          <h2 className="mb-3 font-sans text-base font-extrabold text-ink">Join with a code</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Invite code"
            aria-label="Invite code"
            className="mb-3 h-11 w-full rounded-full border-2 border-line bg-page px-4 font-sans text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!joinCode.trim() || joining}
            className="h-11 w-full rounded-full border-2 border-line bg-page font-sans text-sm font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
