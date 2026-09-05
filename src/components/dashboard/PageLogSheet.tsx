import { useEffect, useState } from 'react'
import { BookCover } from '../book/BookCover'
import type { ShelfItemWithBook } from '../../lib/shelf/data'

type View = 'picker' | 'slider'

/**
 * The page-log bottom sheet from the mockup: a picker view (when there's
 * more than one currently-reading book and none was specified) that lists
 * every book with its current page, and a slider view for actually moving
 * a bookmark. Unlike the old inline `ProgressControl`, this only commits
 * on an explicit Save tap — the owner's own testing found the previous
 * drag-release/keyup auto-commit unreliable, so dragging here is purely
 * local state until "Save my place" is pressed. A direct number field
 * sits alongside the slider for typing an exact page instead of dragging.
 */
export function PageLogSheet({
  items,
  initialItemId,
  onClose,
  onSave,
}: {
  items: ShelfItemWithBook[]
  initialItemId: string | null
  onClose: () => void
  onSave: (item: ShelfItemWithBook, toPage: number) => Promise<void>
}) {
  const initial = initialItemId
    ? (items.find((it) => it.id === initialItemId) ?? null)
    : items.length === 1
      ? (items[0] ?? null)
      : null

  const [view, setView] = useState<View>(initial ? 'slider' : 'picker')
  const [selected, setSelected] = useState<ShelfItemWithBook | null>(initial)
  const [value, setValue] = useState(initial?.current_page ?? 0)
  const [pageInput, setPageInput] = useState(String(initial?.current_page ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Locks the page underneath while the sheet is open. Without this, a
  // touch-drag anywhere over the backdrop on mobile could scroll the
  // Home page behind it instead of just the sheet, which is what made
  // reaching Save feel like "having to scroll all the way down" — the
  // sheet itself was already correctly sized and positioned, the
  // background was the thing moving.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function selectItem(item: ShelfItemWithBook) {
    setSelected(item)
    setValue(item.current_page ?? 0)
    setPageInput(String(item.current_page ?? 0))
    setError(null)
    setView('slider')
  }

  function applyValue(next: number, pageCount: number | null) {
    const max = pageCount ?? Number.MAX_SAFE_INTEGER
    const clamped = Math.min(Math.max(0, Math.round(next)), max)
    setValue(clamped)
    setPageInput(String(clamped))
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await onSave(selected, value)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const pageCount = selected?.books.page_count ?? null
  const pagesLeft = pageCount ? Math.max(0, pageCount - value) : null
  const pct = pageCount ? Math.min(100, Math.round((value / pageCount) * 100)) : null
  const atMax = pageCount != null && value >= pageCount

  return (
    <div
      role="dialog"
      aria-label={
        view === 'picker'
          ? 'Which one are you reading?'
          : `Log your page in ${selected?.books.title ?? ''}`
      }
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      style={{ animation: 'nib-in 0.18s ease both' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-lift sm:max-w-md sm:rounded-[28px] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'picker' ? (
          <>
            <h2 className="font-display text-xl font-semibold text-ink">
              Which one are you reading?
            </h2>
            <p className="mt-1 mb-4 font-sans text-sm text-muted">
              Nibbles remembers your pick for next time.
            </p>
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const itemPageCount = item.books.page_count
                const itemPct = itemPageCount
                  ? Math.min(100, Math.round(((item.current_page ?? 0) / itemPageCount) * 100))
                  : null
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className="flex items-center gap-3 rounded-2xl bg-tint p-3 text-left transition-transform active:scale-[.985]"
                  >
                    <BookCover
                      coverUrl={item.books.cover_url}
                      title={item.books.title}
                      className="h-14 w-10 flex-none"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-ink">
                        {item.books.title}
                      </div>
                      <div className="mt-0.5 font-sans text-xs text-muted">
                        page {item.current_page ?? 0} of {item.books.page_count ?? '?'}
                      </div>
                      {itemPct !== null && (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-sage"
                            style={{ width: `${itemPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 font-sans text-sm font-bold text-muted transition-opacity active:opacity-60"
            >
              Not now
            </button>
          </>
        ) : selected ? (
          <>
            <h2 className="font-display text-xl font-semibold text-ink">{selected.books.title}</h2>
            <p className="mt-1 mb-5 font-sans text-sm text-muted">
              Slide to where your bookmark sits.
            </p>

            <div className="text-center">
              <div className="font-display text-5xl font-semibold text-ink">{value}</div>
              <p className="mt-1 font-sans text-xs font-bold text-muted">
                {pageCount ? `of ${pageCount} pages · ${pct}%` : 'page'}
              </p>
              {pagesLeft !== null && (
                <p className="mt-1 font-sans text-sm font-extrabold text-sage-deep">
                  {pagesLeft} page{pagesLeft === 1 ? '' : 's'} left
                </p>
              )}
            </div>

            {pageCount ? (
              <input
                type="range"
                min={0}
                max={pageCount}
                step={1}
                value={value}
                disabled={saving}
                onChange={(e) => applyValue(Number(e.target.value), pageCount)}
                aria-label="Your page in this book"
                className="progress-slider mt-5 h-3.5 w-full cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: `linear-gradient(to right, var(--nibbles-sage-deep), var(--nibbles-sage) ${pct}%, var(--nibbles-tint) ${pct}%)`,
                }}
              />
            ) : null}

            <div className="mt-4 flex items-center justify-center gap-2">
              {[-10, 10, 25].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  disabled={saving}
                  onClick={() => applyValue(value + delta, pageCount)}
                  className="rounded-full bg-tint px-3.5 py-1.5 font-sans text-xs font-extrabold text-sage-deep transition-transform active:scale-95 disabled:opacity-50"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
              <label className="ml-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={pageCount ?? undefined}
                  value={pageInput}
                  disabled={saving}
                  onChange={(e) => {
                    setPageInput(e.target.value)
                    const n = Number(e.target.value)
                    if (e.target.value !== '' && Number.isFinite(n)) applyValue(n, pageCount)
                  }}
                  aria-label="Type your exact page"
                  className="w-20 rounded-full border border-line bg-page px-3 py-1.5 text-center font-sans text-sm text-ink outline-none"
                />
              </label>
            </div>

            {error && <p className="mt-3 font-sans text-xs text-honey-text">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-full bg-tint px-4 py-3 font-sans text-sm font-bold text-ink transition-transform active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn-cta flex-1 rounded-full bg-sage px-4 py-3 font-sans text-sm font-bold text-surface disabled:opacity-50"
              >
                {saving ? 'Saving…' : atMax ? 'Finish the book' : 'Save my place'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
