import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/book/BookCover'
import { useAuth } from '../lib/auth/useAuth'
import {
  dismissRecommendation,
  getRecommendations,
  hasCircleSignal,
  type Recommendation,
} from '../lib/recommender'
import { setShelfStatus } from '../lib/shelf/data'
import type { Book } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded'

type Tab = 'recs' | 'circles'

// Same 2-segment pill visual language as Shelves.tsx's "Want to read /
// Reading / Finished" switch (bg-tint track, bg-sage active pill), just
// two segments instead of three.
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'recs', label: 'Recs' },
  { tab: 'circles', label: 'From circles' },
]

const FALLBACK_CATEGORIES_SHOWN = 3

/**
 * The book's own Google Books synopsis/genres (same fields BookHero.tsx
 * shows on the Book Page, enriched onto every book once via
 * src/lib/books/data.ts's enrichBook), shown only on the true-cold-start
 * fallback recommendations, which have no real personalization "why" to
 * offer instead.
 */
function FallbackBookInfo({ book }: { book: Book }) {
  const description =
    typeof book.metadata.description === 'string' ? book.metadata.description : null
  const categories = Array.isArray(book.metadata.categories)
    ? book.metadata.categories.filter((c): c is string => typeof c === 'string')
    : []

  if (!description && categories.length === 0) return null

  return (
    <div className="mt-2 border-t border-line pt-2">
      {categories.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {categories.slice(0, FALLBACK_CATEGORIES_SHOWN).map((category) => (
            <span
              key={category}
              className="rounded-full bg-leaf px-2.5 py-0.5 font-sans text-[11px] font-bold text-on-leaf"
            >
              {category}
            </span>
          ))}
        </div>
      )}
      {description && (
        <p className="line-clamp-3 font-sans text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      )}
    </div>
  )
}

export function Recommendations() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [addedBookIds, setAddedBookIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<Tab>('recs')

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

  async function handleAddToWantToRead(bookId: string) {
    if (!user) return
    try {
      await setShelfStatus(user.id, bookId, 'want_to_read')
      setAddedBookIds((prev) => new Set(prev).add(bookId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that book. Try again.')
    }
  }

  // A real, persisted dismissal (see dismissRecommendation's doc comment)
  // — removed from view immediately, and excluded from every future
  // getRecommendations call for this user, not just this session.
  async function handleDismiss(bookId: string) {
    if (!user) return
    const previous = recommendations
    setRecommendations((prev) => prev.filter((rec) => rec.book.id !== bookId))
    try {
      await dismissRecommendation(user.id, bookId)
    } catch (err) {
      setRecommendations(previous)
      setError(err instanceof Error ? err.message : 'Could not dismiss that. Try again.')
    }
  }

  if (state === 'loading') {
    return <p className="font-sans text-muted">Finding books for you.</p>
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong.'}
      </div>
    )
  }

  // "From circles" filters the exact same scored pool down to books with
  // at least one real circle-mate signal (rated it) — see hasCircleSignal
  // in src/lib/recommender/recommend.ts. It never has its own separate
  // fetch or scoring pass, just a client-side filter of what's already
  // loaded, so there's one source of truth for what gets recommended.
  const circleRecommendations = recommendations.filter(hasCircleSignal)
  const visibleRecommendations = activeTab === 'recs' ? recommendations : circleRecommendations

  return (
    <div className="mx-auto max-w-2xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Recommended for you</h1>
      <p className="mb-5 font-sans text-sm text-muted">
        Every pick comes with a reason, never a black box.
      </p>

      {error && (
        <p className="mb-4 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <div className="mb-5 flex gap-1.5 rounded-full bg-tint p-1.5">
        {TABS.map(({ tab, label }) => {
          const active = tab === activeTab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-10 flex-1 rounded-full font-sans text-[12.5px] font-extrabold transition-all active:scale-95 ${
                active ? 'bg-sage text-surface shadow-soft' : 'text-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {visibleRecommendations.length === 0 ? (
        activeTab === 'recs' ? (
          <p className="font-sans text-sm text-muted">
            Nothing to recommend yet.{' '}
            <Link to="/search" className="font-bold text-sage underline">
              Search for a book
            </Link>{' '}
            and rate a few to get started.
          </p>
        ) : (
          <div className="rounded-3xl bg-tint px-5 py-8 text-center">
            <div className="font-display text-lg font-semibold text-ink">
              Nothing from your circles yet
            </div>
            <p className="mt-1 font-sans text-[13.5px] text-muted">
              Once a circle-mate rates or reviews a book, picks with their stamp of approval will
              show up here.
            </p>
            <Link
              to="/circles"
              className="mt-4 inline-block rounded-full bg-sage px-5 py-2.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95"
            >
              Join or start a circle
            </Link>
          </div>
        )
      ) : (
        <ul className="flex flex-col gap-3.5">
          {visibleRecommendations.map((rec) => {
            const added = addedBookIds.has(rec.book.id)
            return (
              <li key={rec.book.id} className="rounded-[22px] bg-surface p-3.5 shadow-soft">
                <div className="flex gap-3.5">
                  <Link to={`/book/${rec.book.id}`} className="flex-none">
                    <BookCover
                      coverUrl={rec.book.cover_url}
                      title={rec.book.title}
                      className="h-[118px] w-20"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/book/${rec.book.id}`}
                      className="block font-display text-base font-semibold text-ink"
                    >
                      {rec.book.title}
                    </Link>
                    {rec.book.author && (
                      <p className="mt-0.5 mb-2 font-sans text-xs text-muted">{rec.book.author}</p>
                    )}
                    {/* The first reason reads as the headline "why this
                        pick" line (bold, green), matching the round 4
                        mockup's own picks card — the rest are supporting
                        bullets. Same data, just the first one styled to
                        carry more weight. */}
                    {rec.why[0] && (
                      <p className="mb-1.5 font-sans text-[13px] font-bold text-sage-deep">
                        {rec.why[0]}
                      </p>
                    )}
                    {rec.why.length > 1 && (
                      <ul className="flex flex-col gap-1.5">
                        {rec.why.slice(1).map((reason) => (
                          <li key={reason} className="flex items-start gap-1.5">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-sage" />
                            <span className="font-sans text-[13px] text-ink">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* The fallback case has no real "why", so lean on the
                        book's own Google Books data instead, so a
                        low-confidence pick still gives something concrete
                        to judge it by rather than just a title. */}
                    {rec.isFallback && <FallbackBookInfo book={rec.book} />}
                  </div>
                </div>
                <div className="mt-3.5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleAddToWantToRead(rec.book.id)}
                    disabled={added}
                    className="btn-cta flex-1 rounded-full bg-sage py-2.5 font-sans text-sm font-extrabold text-surface disabled:opacity-60"
                  >
                    {added ? 'On your list' : 'Save for later'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDismiss(rec.book.id)}
                    className="flex-1 rounded-full border-2 border-line bg-surface py-2.5 font-sans text-sm font-extrabold text-ink transition-transform active:scale-95"
                  >
                    Not for me
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
