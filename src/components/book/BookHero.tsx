import { StarRating } from './StarRating'

/**
 * Purely presentational: the cover, title, synopsis, genre chips, and
 * rating for a book page. Takes plain props rather than fetching anything
 * itself, so it's easy to unit-test without a Supabase session. Centered,
 * stacked layout matching the round 4 mockup's book detail page.
 */
export function BookHero({
  title,
  author,
  coverUrl,
  description,
  categories,
  pageCount,
  publishedYear,
  aggregateLabel,
  myRating,
  onRatingChange,
}: {
  title: string
  author: string | null
  coverUrl: string | null
  description: string | null
  categories: string[]
  pageCount: number | null
  publishedYear: number | null
  aggregateLabel: string
  myRating: number | null
  onRatingChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-64 w-44 rounded-[20px] object-cover shadow-lift" />
      ) : (
        <div
          className="flex h-64 w-44 items-center justify-center rounded-[20px] text-center font-sans text-xs text-muted shadow-lift"
          style={{
            background: 'repeating-linear-gradient(135deg, #DCE8D3 0 9px, #F6FAF3 9px 18px)',
          }}
        >
          No cover yet
        </div>
      )}

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{title}</h1>
      {author && <p className="mt-1 font-sans text-muted">{author}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-full bg-surface px-4 py-2 shadow-soft">
        <span className="font-sans text-sm font-bold text-honey-text">{aggregateLabel}</span>
        {(pageCount || publishedYear) && (
          <>
            <span className="text-line">|</span>
            <span className="font-sans text-sm text-muted">
              {[pageCount ? `${pageCount} pages` : null, publishedYear ?? null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </>
        )}
      </div>

      <div className="mt-4">
        <StarRating value={myRating} onChange={onRatingChange} />
      </div>

      {/* Shows whenever there's anything at all to say about the book —
          not just when there's a synopsis — so a book Google Books and
          Open Library both came up empty on still shows its own known
          facts (pages, year, average) rather than the whole card
          vanishing. */}
      {(description || categories.length > 0 || pageCount || publishedYear) && (
        <div className="mt-5 w-full rounded-[26px] bg-surface p-4 text-left shadow-soft">
          <h2 className="mb-2 font-display text-base font-semibold text-ink">About this book</h2>
          {categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-leaf px-3 py-1 font-sans text-xs font-bold text-on-leaf"
                >
                  {category}
                </span>
              ))}
            </div>
          )}
          {description ? (
            <p className="font-sans text-sm leading-relaxed text-ink">{description}</p>
          ) : (
            <p className="font-sans text-sm text-muted">No synopsis found for this one yet.</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3.5 text-center">
            <div>
              <div className="font-display text-base font-semibold text-ink">
                {publishedYear ?? '—'}
              </div>
              <div className="mt-0.5 font-sans text-[10.5px] font-bold tracking-wide text-muted uppercase">
                First published
              </div>
            </div>
            <div>
              <div className="font-display text-base font-semibold text-ink">
                {pageCount ?? '—'}
              </div>
              <div className="mt-0.5 font-sans text-[10.5px] font-bold tracking-wide text-muted uppercase">
                Pages
              </div>
            </div>
            <div>
              <div className="font-display text-base font-semibold text-ink">
                {aggregateLabel.startsWith('★') ? aggregateLabel.split(' ')[1] : '—'}
              </div>
              <div className="mt-0.5 font-sans text-[10.5px] font-bold tracking-wide text-muted uppercase">
                Average
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
