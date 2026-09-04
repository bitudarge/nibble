import { useState } from 'react'

/**
 * An inline way to update reading progress, replacing a `window.prompt()`
 * popup used before this. Native prompts are known to behave unreliably
 * or not appear at all inside an installed PWA's standalone mode on
 * several mobile browsers (this app became installable in round 2 section
 * 1), which is almost certainly why updating progress "didn't really work
 * on the phone". This is a real in-page control instead: when the book's
 * page count is known, a draggable slider styled as the same gradient bar
 * this app already uses to *display* progress, so moving it feels like
 * dragging the bar itself rather than a separate, disconnected input.
 * Without a known page count there's no sensible upper bound for a
 * slider, so it falls back to a plain number field, still inline, still
 * no popup.
 *
 * Commits on release (pointer/touch up, or Enter/arrow-key-then-blur for
 * keyboard users) rather than on every intermediate value while dragging,
 * so it doesn't fire a save per pixel of movement.
 */
export function ProgressControl({
  currentPage,
  pageCount,
  onSave,
}: {
  currentPage: number
  pageCount: number | null
  onSave: (page: number) => Promise<void>
}) {
  const [value, setValue] = useState(currentPage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stay in sync if the real value changes from elsewhere (e.g. after a
  // save resolves and the parent re-renders with a fresh currentPage) —
  // React's own documented pattern for "adjust state when a prop changes"
  // (react.dev), a direct conditional setState during render rather than
  // an effect, since mirroring a prop into state inside useEffect is what
  // the set-state-in-effect lint rule specifically flags, and for good
  // reason: it costs an extra render pass an effect doesn't need to.
  const [lastCurrentPage, setLastCurrentPage] = useState(currentPage)
  if (currentPage !== lastCurrentPage) {
    setLastCurrentPage(currentPage)
    setValue(currentPage)
  }

  async function commit(page: number) {
    if (!Number.isFinite(page) || page < 0 || page === currentPage) return
    setSaving(true)
    setError(null)
    try {
      await onSave(page)
    } catch (err) {
      setValue(currentPage)
      setError(err instanceof Error ? err.message : 'Could not save that. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (pageCount) {
    const percent = Math.min(100, Math.round((value / pageCount) * 100))
    return (
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={pageCount}
          step={1}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={() => void commit(value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key.startsWith('Arrow')) void commit(value)
          }}
          aria-label="Your page in this book"
          className="progress-slider h-3 w-full cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: `linear-gradient(to right, var(--nibbles-sage-deep), var(--nibbles-sage) ${percent}%, var(--nibbles-tint) ${percent}%)`,
          }}
        />
        <div className="flex items-center justify-between font-sans text-xs font-bold text-muted">
          <span>
            page {value} of {pageCount} · {percent}%
          </span>
          {saving && <span>Saving…</span>}
        </div>
        {error && <p className="font-sans text-xs text-honey-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Your page in this book"
          className="w-20 rounded-full border border-line bg-page px-3 py-1 font-sans text-xs text-ink outline-none"
        />
        <button
          type="button"
          onClick={() => void commit(value)}
          disabled={saving || value === currentPage}
          className="flex-none rounded-full bg-leaf px-3 py-1 font-sans text-xs font-bold text-on-leaf transition-transform active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="font-sans text-xs text-honey-text">{error}</p>}
    </div>
  )
}
