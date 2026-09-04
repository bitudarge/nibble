import { useState, type FormEvent } from 'react'
import type { BookTag } from '../../types/database'
import { TagPicker } from './TagPicker'

/**
 * The "anti-forgetting nudge": shown right after a rating, only when the
 * user has no private note for this book yet (see BookPage.tsx). This is
 * also where tagging (mood/pace/spice_level/genre) happens now, once, at
 * rating time, rather than being repeated in every review editor — see
 * TagPicker's doc comment. One line of text plus a handful of chip taps,
 * one tap to skip, saves straight to My Notes. Purely presentational and
 * controlled by the parent, which owns the actual save/skip logic and
 * whatever optimistic state it wants around it.
 */
export function QuickNoteNudge({
  allTags,
  onSave,
  onSkip,
  saving,
  error,
}: {
  allTags: BookTag[]
  onSave: (text: string, tagIds: string[]) => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const [text, setText] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    // A tap on a mood/genre chip with no line of text is still real
    // signal worth saving, only truly empty input (no text, no tags)
    // counts as a skip.
    if (!trimmed && selectedTagIds.length === 0) {
      onSkip()
      return
    }
    onSave(trimmed, selectedTagIds)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3 rounded-2xl bg-honey-soft p-3"
      style={{ animation: 'nib-in 0.2s ease both' }}
    >
      <div>
        <label htmlFor="quick-note-input" className="font-sans text-xs font-bold text-honey-text">
          Want to remember why?
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="quick-note-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="One line is plenty."
            disabled={saving}
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <TagPicker allTags={allTags} selectedTagIds={selectedTagIds} onToggle={toggleTag} />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-none rounded-full bg-sage px-3.5 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="flex-none font-sans text-sm font-bold text-muted transition-opacity active:opacity-60 disabled:opacity-50"
        >
          Skip
        </button>
      </div>
      {error && <p className="font-sans text-xs text-honey-text">{error}</p>}
    </form>
  )
}
