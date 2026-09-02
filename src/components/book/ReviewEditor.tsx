import { useState, type FormEvent } from 'react'
import { saveReview } from '../../lib/reviews/data'
import { setReviewTags } from '../../lib/tags/data'
import type { BookTag, Review } from '../../types/database'

const TAG_TYPE_LABELS: Record<string, string> = {
  mood: 'Mood',
  pace: 'Pace',
  spice_level: 'Spice level',
  genre: 'Genre',
}

/**
 * One instance of this handles ONE review (private or public) — the Book
 * Page renders two, since a private journal entry and a public review are
 * independent rows (see reviews table comment in the schema).
 */
export function ReviewEditor({
  bookId,
  userId,
  visibility,
  existingReview,
  existingTagIds,
  allTags,
  onSaved,
}: {
  bookId: string
  userId: string
  visibility: 'private' | 'public'
  existingReview: Review | null
  existingTagIds: string[]
  allTags: BookTag[]
  onSaved: (review: Review, tagIds: string[]) => void
}) {
  const [body, setBody] = useState(existingReview?.body ?? '')
  const [containsSpoilers, setContainsSpoilers] = useState(
    existingReview?.contains_spoilers ?? false,
  )
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(existingTagIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        { bookId, userId, body: trimmed, containsSpoilers, visibility },
        existingReview?.id ?? null,
      )
      await setReviewTags(review.id, selectedTagIds)
      onSaved(review, selectedTagIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setSaving(false)
    }
  }

  const tagsByType: Record<string, BookTag[]> = {}
  for (const tag of allTags) {
    ;(tagsByType[tag.type] ??= []).push(tag)
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={visibility === 'private' ? 'Your private thoughts…' : 'Write a public review…'}
        rows={4}
        className="rounded-md border border-stone-300 p-2"
        aria-label={visibility === 'private' ? 'Private journal entry' : 'Public review'}
      />

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={containsSpoilers}
          onChange={(e) => setContainsSpoilers(e.target.checked)}
        />
        Contains spoilers
      </label>

      <div className="flex flex-col gap-2">
        {Object.entries(tagsByType).map(([type, tags]) => (
          <div key={type}>
            <span className="text-xs font-medium uppercase text-stone-500">
              {TAG_TYPE_LABELS[type] ?? type}
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={selectedTagIds.includes(tag.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    selectedTagIds.includes(tag.id)
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 text-stone-600'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-stone-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : existingReview ? 'Update' : 'Save'}
      </button>
    </form>
  )
}
