import { useState } from 'react'
import type { BookTag } from '../../types/database'
import { TagPicker } from './TagPicker'

type Step = 'tags' | 'note'

/**
 * A genuinely immersive moment right after rating a book for the first
 * time (see BookPage.tsx: only shown while there's no private review yet
 * for this book). Replaces the old compact inline QuickNoteNudge with a
 * full-screen two-step flow, tag the book, then an optional note, both
 * skippable, both saving into the same private review row the old inline
 * version used (saveReview + setReviewTags, wired up by BookPage.tsx).
 * Deliberately still quick (two short steps, not a long form) even though
 * it takes over the screen, "immersive" here means it gets real space and
 * a clear finish, not that it takes real time.
 */
export function FirstRatingExperience({
  bookTitle,
  allTags,
  onSave,
  onSkip,
  saving,
  error,
}: {
  bookTitle: string
  allTags: BookTag[]
  onSave: (text: string, tagIds: string[]) => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const [step, setStep] = useState<Step>('tags')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [text, setText] = useState('')

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  // "Save" (with whatever's typed) and "Skip note" (tags only, or a full
  // skip if there weren't any tags either) both end the flow, they just
  // differ in whether the typed text comes along.
  function handleSaveWithNote() {
    onSave(text.trim(), selectedTagIds)
  }

  function handleSkipNote() {
    if (selectedTagIds.length === 0) {
      onSkip()
      return
    }
    onSave('', selectedTagIds)
  }

  return (
    <div
      role="dialog"
      aria-label={`Rate and tag ${bookTitle}`}
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      style={{ animation: 'nib-in 0.18s ease both' }}
    >
      <div className="flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-lift sm:max-w-md sm:rounded-[28px] sm:p-6">
        <div className="mb-1 font-sans text-xs font-bold tracking-wide text-muted uppercase">
          Step {step === 'tags' ? 1 : 2} of 2
        </div>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-sage transition-all duration-300"
            style={{ width: step === 'tags' ? '50%' : '100%' }}
          />
        </div>

        {step === 'tags' ? (
          <>
            <h2 className="mb-1 font-display text-xl font-semibold text-ink">
              What made {bookTitle} feel that way?
            </h2>
            <p className="mb-4 font-sans text-sm text-muted">
              Tag as many or as few as fit, you can always change these later.
            </p>
            <TagPicker allTags={allTags} selectedTagIds={selectedTagIds} onToggle={toggleTag} />
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setStep('note')}
                className="flex-1 rounded-full bg-sage px-4 py-2.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="font-sans text-sm font-bold text-muted transition-opacity active:opacity-60"
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 font-display text-xl font-semibold text-ink">
              Want to remember why?
            </h2>
            <p className="mb-4 font-sans text-sm text-muted">
              A line or two is plenty, just for you unless you share it later.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="The bit that stuck with you"
              rows={4}
              disabled={saving}
              autoFocus
              className="rounded-2xl border border-line bg-page p-3 font-sans text-sm text-ink outline-none placeholder:text-muted"
            />
            {error && <p className="mt-2 font-sans text-xs text-honey-text">{error}</p>}
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={handleSaveWithNote}
                disabled={saving}
                className="flex-1 rounded-full bg-sage px-4 py-2.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleSkipNote}
                disabled={saving}
                className="font-sans text-sm font-bold text-muted transition-opacity active:opacity-60 disabled:opacity-50"
              >
                Skip note
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
