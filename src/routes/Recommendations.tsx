import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { getRecommendations, type Recommendation } from '../lib/recommender'

type LoadState = 'loading' | 'error' | 'loaded'

export function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setState('loading')
      try {
        const recs = await getRecommendations(user.id, 20)
        if (!cancelled) {
          setRecommendations(recs)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load recommendations.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (state === 'loading') {
    return <p className="text-stone-500">Finding books for you…</p>
  }

  if (state === 'error') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold text-stone-900">Recommended for you</h1>
      <p className="mb-6 text-sm text-stone-500">
        Every recommendation here comes with a reason — never a black box.
      </p>

      {recommendations.length === 0 ? (
        <p className="text-stone-500">
          Nothing to recommend yet.{' '}
          <Link to="/search" className="underline">
            Search for a book
          </Link>{' '}
          and rate a few to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {recommendations.map((rec) => (
            <li key={rec.book.id} className="flex gap-4 rounded-md border border-stone-200 p-3">
              <Link to={`/book/${rec.book.id}`} className="shrink-0">
                {rec.book.cover_url ? (
                  <img src={rec.book.cover_url} alt="" className="h-32 w-20 rounded object-cover" />
                ) : (
                  <div className="flex h-32 w-20 items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                    No cover
                  </div>
                )}
              </Link>
              <div>
                <Link to={`/book/${rec.book.id}`} className="font-medium text-stone-900">
                  {rec.book.title}
                </Link>
                {rec.book.author && <p className="text-sm text-stone-600">{rec.book.author}</p>}
                <ul className="mt-2 flex flex-col gap-0.5">
                  {rec.why.map((reason) => (
                    <li key={reason} className="text-sm text-stone-600">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
