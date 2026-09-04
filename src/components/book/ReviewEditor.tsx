import { useState, type FormEvent } from 'react'
import { saveReview } from '../../lib/reviews/data'
import { setReviewTags } from '../../lib/tags/data'
import type { BookTag, Circle, Review } from '../../types/database'
import { TagPicker } from './TagPicker'

/**
 * One instance of this handles ONE review (private, public, or one specific
 * circle) — the Book Page renders one per visibility, since each is an
 * independent row (see reviews table comment in the schema).
 *
 * `shareTargets`/`onShare` are optional: when given (private and public
 * reviews only, see BookPage.tsx), an existing review gets a "share to
 * circle" affordance right here rather than a separate compose flow — it
 * copies this review's body into a circle-visibility review.
 *
 * `showTagPicker` defaults to true, but BookPage passes `false` for the
 * public and circle instances: tagging now happens once, at rating time
 * (see QuickNoteNudge), not repeated in every review. Only the private
 * note's editor still shows/edits tags, for touching them up after the
 * fact outside the rating flow. When it's false, this component doesn't
 * touch a review's tags at all on save, rather than overwriting them with
 * a frozen copy of whatever was passed in.
 */
export function ReviewEditor({
  bookId,
  userId,
  visibility,
  circleId,
  existingReview,
  existingTagIds,
  allTags,
  onSaved,
  shareTargets,
  onShare,
  showTagPicker = true,
}: {
  bookId: string
  userId: string
  visibility: 'private' | 'public' | 'circle'
  circleId?: string
  existingReview: Review | null
  existingTagIds: string[]
  allTags: BookTag[]
  onSaved: (review: Review, tagIds: string[]) => void
  shareTargets?: Circle[]
  onShare?: (circleId: string, body: string) => Promise<void>
  showTagPicker?: boolean
}) {
  const [body, setBody] = useState(existingReview?.body ?? '')
  const [containsSpoilers, setContainsSpoilers] = useState(
    existingReview?.contains_spoilers ?? false,
  )
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(existingTagIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shareCircleId, setShareCircleId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [justShared, setJustShared] = useState(false)

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) {
      setError('Write something before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const review = await saveReview(
        { bookId, userId, body: trimmed, containsSpoilers, visibility, circleId },
        existingReview?.id ?? null,
      )
      if (showTagPicker) await setReviewTags(review.id, selectedTagIds)
      onSaved(review, showTagPicker ? selectedTagIds : existingTagIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    if (!onShare || !shareCircleId || !existingReview) return
    setSharing(true)
    setShareError(null)
    try {
      await onShare(shareCircleId, existingReview.body)
      setJustShared(true)
      window.setTimeout(() => setJustShared(false), 2000)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share that. Try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          visibility === 'private'
            ? 'Your private thoughts.'
            : visibility === 'circle'
              ? 'Write a review for this circle.'
              : 'Write a public review.'
        }
        rows={4}
        className="rounded-2xl border border-line bg-page p-3 font-sans text-sm text-ink outline-none placeholder:text-muted"
        aria-label={
          visibility === 'private'
            ? 'Private journal entry'
            : visibility === 'circle'
              ? 'Circle review'
              : 'Public review'
        }
      />

      <label className="flex items-center gap-2 font-sans text-sm text-ink">
        <input
          type="checkbox"
          checked={containsSpoilers}
          onChange={(e) => setContainsSpoilers(e.target.checked)}
          className="h-4 w-4 accent-sage"
        />
        Has spoilers
      </label>

      {showTagPicker && (
        <TagPicker allTags={allTags} selectedTagIds={selectedTagIds} onToggle={toggleTag} />
      )}

      {error && <p className="font-sans text-sm text-honey-text">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-sage px-4 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
      >
        {saving ? 'Saving…' : existingReview ? 'Update' : 'Save'}
      </button>

      {shareTargets && shareTargets.length > 0 && existingReview && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
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
          {shareError && <span className="font-sans text-xs text-honey-text">{shareError}</span>}
        </div>
      )}
    </form>
  )
}
