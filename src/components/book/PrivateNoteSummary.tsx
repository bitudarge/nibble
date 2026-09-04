import { useState } from 'react'
import type { BookTag, Circle, Review } from '../../types/database'

/**
 * Read-only view of an already-saved private note (the rating itself is
 * shown separately via BookHero/StarRating): tags, note text, a small
 * Edit affordance, and the same share-to-circle capability the editable
 * form has, so sharing something you already wrote doesn't require
 * tapping Edit first. This is what BookPage.tsx shows instead of the full
 * ReviewEditor form once a private review exists, tapping Edit reveals
 * that same form for changes, see round 2 section 2's "Write a Review"
 * for the same reveal-on-click shape this mirrors.
 */
export function PrivateNoteSummary({
  review,
  tags,
  onEdit,
  shareTargets,
  onShare,
}: {
  review: Review
  tags: BookTag[]
  onEdit: () => void
  shareTargets: Circle[]
  onShare: (circleId: string, body: string) => Promise<void>
}) {
  const [shareCircleId, setShareCircleId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [justShared, setJustShared] = useState(false)

  async function handleShare() {
    if (!shareCircleId) return
    setSharing(true)
    setShareError(null)
    try {
      await onShare(shareCircleId, review.body)
      setJustShared(true)
      window.setTimeout(() => setJustShared(false), 2000)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share that. Try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-leaf px-2.5 py-1 font-sans text-xs font-bold text-on-leaf"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {review.body ? (
        <p className="font-sans text-sm whitespace-pre-wrap text-ink">{review.body}</p>
      ) : (
        <p className="font-sans text-sm text-muted">Tagged, no note written this time.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full bg-tint px-3.5 py-1.5 font-sans text-xs font-bold text-ink transition-transform active:scale-95"
        >
          Edit
        </button>

        {shareTargets.length > 0 && (
          <>
            <select
              value={shareCircleId}
              onChange={(e) => setShareCircleId(e.target.value)}
              aria-label="Circle to share this with"
              className="rounded-full border border-line bg-page px-3 py-1.5 font-sans text-xs text-ink"
            >
              <option value="" disabled>
                Share to circle
              </option>
              {shareTargets.map((circle) => (
                <option key={circle.id} value={circle.id}>
                  {circle.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={!shareCircleId || sharing}
              className="rounded-full bg-tint px-3 py-1.5 font-sans text-xs font-bold text-ink transition-transform active:scale-95 disabled:opacity-50"
            >
              {sharing ? 'Sharing…' : justShared ? 'Shared' : 'Share'}
            </button>
          </>
        )}
      </div>
      {shareError && <p className="font-sans text-xs text-honey-text">{shareError}</p>}
    </div>
  )
}
