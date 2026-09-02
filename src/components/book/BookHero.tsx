import { StarRating } from './StarRating'

/**
 * Purely presentational: the cover, title, synopsis, genre chips, and
 * rating for a book page. Takes plain props rather than fetching anything
 * itself, so it's easy to unit-test without a Supabase session.
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
    <div className="mb-6 flex flex-col gap-5 sm:flex-row">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="h-64 w-44 flex-none self-center rounded-[20px] object-cover shadow-lift sm:self-start"
        />
      ) : (
        <div
          className="flex h-64 w-44 flex-none items-center justify-center self-center rounded-[20px] text-center font-sans text-xs text-muted shadow-lift sm:self-start"
          style={{
            background: 'repeating-linear-gradient(135deg, #E9E0CC 0 9px, #F3EBD9 9px 18px)',
          }}
        >
          No cover yet
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {author && <p className="mt-1 font-sans text-muted">{author}</p>}

        {(pageCount || publishedYear) && (
          <p className="mt-2 font-sans text-sm text-muted">
            {[pageCount ? `${pageCount} pages` : null, publishedYear ?? null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <p className="mt-2 font-sans text-sm font-bold text-honey-text">{aggregateLabel}</p>

        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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

        {description && (
          <p className="mt-4 font-sans text-sm leading-relaxed text-ink">{description}</p>
        )}

        <div className="mt-4">
          <StarRating value={myRating} onChange={onRatingChange} />
        </div>
      </div>
    </div>
  )
}
