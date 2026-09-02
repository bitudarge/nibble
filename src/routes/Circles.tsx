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
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-stone-900">Circles</h1>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {state === 'loading' && <p className="text-stone-500">Loading…</p>}

      {state === 'error' && !error && (
        <p className="text-stone-500">Something went wrong loading your circles.</p>
      )}

      {state === 'loaded' && (
        <section className="mb-8">
          {circles.length === 0 ? (
            <p className="text-stone-500">You're not in any circles yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {circles.map((circle) => (
                <li key={circle.id}>
                  <Link
                    to={`/circles/${circle.id}`}
                    className="block rounded-md border border-stone-200 p-3 font-medium text-stone-900 hover:border-stone-400"
                  >
                    {circle.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-md border border-stone-200 p-4"
        >
          <h2 className="mb-2 font-medium text-stone-900">Create a circle</h2>
          <input
            type="text"
            value={newCircleName}
            onChange={(e) => setNewCircleName(e.target.value)}
            placeholder="Circle name"
            className="mb-2 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!newCircleName.trim() || creating}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        <form
          onSubmit={(e) => void handleJoin(e)}
          className="rounded-md border border-stone-200 p-4"
        >
          <h2 className="mb-2 font-medium text-stone-900">Join a circle</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Invite code"
            className="mb-2 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!joinCode.trim() || joining}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
