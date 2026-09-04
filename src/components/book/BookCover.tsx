/**
 * A book cover image, or a soft cream-striped placeholder when there is
 * no cover yet. Shared across Dashboard, Shelves, and Recommendations so
 * the placeholder always looks the same wherever a cover might be missing.
 */
export function BookCover({
  coverUrl,
  title,
  className = '',
}: {
  coverUrl: string | null
  title: string
  className?: string
}) {
  if (coverUrl) {
    return (
      <img src={coverUrl} alt="" className={`rounded-2xl object-cover shadow-soft ${className}`} />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-2xl p-2 text-center font-sans text-xs text-muted shadow-soft ${className}`}
      style={{
        background: 'repeating-linear-gradient(135deg, #DCE8D3 0 7px, #F6FAF3 7px 14px)',
      }}
    >
      {title}
    </div>
  )
}
