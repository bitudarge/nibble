import { useState } from 'react'
import type { Review } from '../../types/database'

/**
 * One review in a list (public or circle). `byline` is optional since
 * public reviews don't currently carry author info (see getPublicReviews),
 * while circle reviews do (who, and which circle) — see BookPage.tsx.
 */
export function ReviewCard({ review, byline }: { review: Review; byline?: string }) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers)

  return (
    <li className="rounded-2xl border border-line bg-page p-3">
      {byline && <div className="mb-1 font-sans text-xs font-bold text-muted">{byline}</div>}
      {revealed ? (
        <p
          className="font-sans whitespace-pre-wrap text-ink"
          style={{ animation: 'nib-in 0.2s ease both' }}
        >
          {review.body}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-full bg-tint px-3 py-1.5 font-sans text-sm font-bold text-muted transition-transform active:scale-95"
        >
          Spoilers. Tap to peek.
        </button>
      )}
    </li>
  )
}
