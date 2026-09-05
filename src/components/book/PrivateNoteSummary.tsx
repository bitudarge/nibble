import { useState } from 'react'
import type { BookTag, Circle, Review } from '../../types/database'

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
 * Read-only view of an already-saved private note (the rating itself is
 * shown separately via BookHero/StarRating): tags, note text, a small
 * Edit affordance, and the same share-to-circle capability the editable
 * form has, so sharing something you already wrote doesn't require
 * tapping Edit first. This is what BookPage.tsx shows instead of the full
 * ReviewEditor form once a private review exists, tapping Edit reveals
 * that same form for changes, see round 2 section 2's "Write a Review"
 * for the same reveal-on-click shape this mirrors.
 *
 * Restyled from a bare stack of plain form controls into a real card —
 * the owner found the old version dull next to the rest of the app's
 * polish. One-tap circle chips replace the old select+button two-step
 * for sharing, and `justSharedId` tracks which specific circle just got
 * a share (rather than one shared boolean for all of them, which would
 * have shown a stale "Shared" confirmation on the wrong chip once there
 * was more than one circle to share to).
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
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [justSharedId, setJustSharedId] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  async function handleShare(circleId: string) {
    setSharingId(circleId)
    setShareError(null)
    try {
      await onShare(circleId, review.body)
      setJustSharedId(circleId)
      window.setTimeout(() => setJustSharedId(null), 2000)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share that. Try again.')
    } finally {
      setSharingId(null)
    }
  }

  return (
    <div className="rounded-[22px] bg-tint p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
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
            <p className="font-display text-[15px] leading-relaxed text-ink italic">
              “{review.body}”
            </p>
          ) : (
            <p className="font-sans text-sm text-muted">Tagged, no note written this time.</p>
          )}
          <p className="mt-2 font-sans text-[11px] font-bold tracking-wide text-muted uppercase">
            Saved to this phone
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit this note"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-sage-deep shadow-soft transition-transform active:scale-90"
        >
          <PencilIcon />
        </button>
      </div>

      {shareTargets.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3.5">
          <span className="font-sans text-xs font-bold text-muted">Share to</span>
          {shareTargets.map((circle) => (
            <button
              key={circle.id}
              type="button"
              onClick={() => void handleShare(circle.id)}
              disabled={sharingId === circle.id}
              className="rounded-full bg-surface px-3 py-1.5 font-sans text-xs font-bold text-ink shadow-soft transition-transform active:scale-95 disabled:opacity-50"
            >
              {sharingId === circle.id
                ? 'Sharing…'
                : justSharedId === circle.id
                  ? 'Shared ✓'
                  : circle.name}
            </button>
          ))}
        </div>
      )}
      {shareError && <p className="mt-2 font-sans text-xs text-honey-text">{shareError}</p>}
    </div>
  )
}
