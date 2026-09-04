import { useState, type FormEvent } from 'react'
import {
  deleteComment,
  getCommentsForReview,
  postComment,
  type CommentWithAuthor,
} from '../../lib/comments/data'
import type { Review } from '../../types/database'

const COMMENTS_SHOWN_COLLAPSED = 3

function CommentAvatar({ profile }: { profile: CommentWithAuthor['profiles'] }) {
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="h-6 w-6 flex-none rounded-full" />
  }
  return (
    <div
      aria-hidden
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-leaf text-[11px] font-bold text-on-leaf"
    >
      {profile.display_name.charAt(0).toUpperCase()}
    </div>
  )
}

/**
 * One comment on a review, plus a delete button when it's the current
 * user's own (RLS already enforces this server-side, this is just the
 * matching UI affordance, see deleteComment's doc comment).
 */
function CommentRow({
  comment,
  isOwn,
  onDelete,
}: {
  comment: CommentWithAuthor
  isOwn: boolean
  onDelete: () => void
}) {
  return (
    <li className="flex items-start gap-2">
      <CommentAvatar profile={comment.profiles} />
      <div className="min-w-0 flex-1">
        <span className="mr-1.5 font-sans text-xs font-bold text-ink">
          {comment.profiles.display_name}
        </span>
        <span className="font-sans text-xs whitespace-pre-wrap text-muted">{comment.body}</span>
      </div>
      {isOwn && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete comment"
          className="flex-none font-sans text-xs text-muted transition-opacity active:opacity-60"
        >
          Remove
        </button>
      )}
    </li>
  )
}

/**
 * The comment thread on one review: a toggle so comments aren't fetched
 * for every review on the page at once (only when someone actually opens
 * one), a short inline compose box, and optimistic posting (the new
 * comment appears immediately with a temporary id, gets swapped for the
 * real row once the save resolves, and is rolled back with a friendly
 * error if the save fails) — same shape as BookPage.tsx's optimistic
 * rating.
 */
function CommentThread({
  reviewId,
  currentUserId,
  currentUserDisplayName,
}: {
  reviewId: string
  currentUserId?: string
  currentUserDisplayName?: string
}) {
  const [open, setOpen] = useState(false)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setOpen(true)
    if (loadState !== 'idle') return
    setLoadState('loading')
    try {
      const rows = await getCommentsForReview(reviewId)
      setComments(rows)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || !currentUserId || posting) return

    const tempId = `temp-${Date.now()}`
    const optimistic: CommentWithAuthor = {
      id: tempId,
      review_id: reviewId,
      user_id: currentUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
      profiles: {
        id: currentUserId,
        display_name: currentUserDisplayName ?? 'You',
        avatar_url: null,
        created_at: '',
      },
    }
    setComments((prev) => [...prev, optimistic])
    setDraft('')
    setPosting(true)
    setError(null)
    try {
      const saved = await postComment(reviewId, currentUserId, trimmed)
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId ? { ...optimistic, id: saved.id, created_at: saved.created_at } : c,
        ),
      )
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== tempId))
      setError(err instanceof Error ? err.message : 'Could not post that. Try again.')
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(commentId: string) {
    const previous = comments
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    try {
      await deleteComment(commentId)
    } catch {
      setComments(previous)
      setError('Could not remove that. Try again.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="mt-2 font-sans text-xs font-bold text-sage transition-opacity active:opacity-60"
      >
        Comments
      </button>
    )
  }

  const visibleComments = showAll ? comments : comments.slice(0, COMMENTS_SHOWN_COLLAPSED)
  const hiddenCount = comments.length - visibleComments.length

  return (
    <div className="mt-2 border-t border-line pt-2">
      {loadState === 'loading' && <p className="font-sans text-xs text-muted">Finding comments.</p>}
      {loadState === 'error' && (
        <p className="font-sans text-xs text-muted">Couldn't load comments right now.</p>
      )}

      {loadState === 'loaded' && (
        <>
          {comments.length === 0 && (
            <p className="font-sans text-xs text-muted">No comments yet.</p>
          )}
          {visibleComments.length > 0 && (
            <ul className="flex flex-col gap-2">
              {visibleComments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  isOwn={comment.user_id === currentUserId}
                  onDelete={() => void handleDelete(comment.id)}
                />
              ))}
            </ul>
          )}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-1.5 font-sans text-xs font-bold text-sage transition-opacity active:opacity-60"
            >
              See {hiddenCount} more comment{hiddenCount === 1 ? '' : 's'}
            </button>
          )}
        </>
      )}

      {currentUserId && (
        <form onSubmit={(e) => void handlePost(e)} className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment"
            disabled={posting}
            className="min-w-0 flex-1 rounded-full border border-line bg-page px-3 py-1 font-sans text-xs text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={posting || !draft.trim()}
            className="flex-none rounded-full bg-sage px-3 py-1 font-sans text-xs font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
          >
            Post
          </button>
        </form>
      )}
      {error && <p className="mt-1 font-sans text-xs text-honey-text">{error}</p>}
    </div>
  )
}

/**
 * One review in a list (public or circle). `byline` is optional since
 * public reviews don't currently carry author info (see getPublicReviews),
 * while circle reviews do (who, and which circle) — see BookPage.tsx.
 * `currentUserId` (from useAuth on BookPage) is threaded through to the
 * comment thread so it knows which comments are the viewer's own.
 */
export function ReviewCard({
  review,
  byline,
  currentUserId,
  currentUserDisplayName,
}: {
  review: Review
  byline?: string
  currentUserId?: string
  currentUserDisplayName?: string
}) {
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
      {revealed && (
        <CommentThread
          reviewId={review.id}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
        />
      )}
    </li>
  )
}
