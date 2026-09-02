import { useState } from 'react'
import type { Review } from '../../types/database'

export function ReviewCard({ review }: { review: Review }) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers)

  return (
    <li className="rounded-md border border-stone-200 p-3">
      {revealed ? (
        <p className="whitespace-pre-wrap text-stone-800">{review.body}</p>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="text-sm text-stone-500 underline"
        >
          Contains spoilers — tap to reveal
        </button>
      )}
    </li>
  )
}
