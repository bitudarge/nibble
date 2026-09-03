import { useState, type FormEvent } from 'react'

/**
 * The "anti-forgetting nudge": shown right after a rating, only when the
 * user has no private note for this book yet (see BookPage.tsx). One
 * line, one tap to skip, saves straight to My Notes. Purely presentational
 * and controlled by the parent, which owns the actual save/skip logic and
 * whatever optimistic state it wants around it.
 */
export function QuickNoteNudge({
  onSave,
  onSkip,
  saving,
  error,
}: {
  onSave: (text: string) => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const [text, setText] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      onSkip()
      return
    }
    onSave(trimmed)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 rounded-2xl bg-honey-soft p-3"
      style={{ animation: 'nib-in 0.2s ease both' }}
    >
      <label htmlFor="quick-note-input" className="font-sans text-xs font-bold text-honey-text">
        Want to remember why?
      </label>
      <div className="flex items-center gap-2">
        <input
          id="quick-note-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="One line is plenty."
          disabled={saving}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 font-sans text-sm text-ink outline-none placeholder:text-muted"
        />
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
