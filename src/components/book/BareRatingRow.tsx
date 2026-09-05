/**
 * One line for someone who rated this book but hasn't written a public
 * review for it — a lighter-weight sibling to ReviewCard, shown in the
 * Review tab's list so a bare rating is visible somewhere besides just
 * being folded into the aggregate average. See getBareRatings in
 * src/lib/ratings/data.ts for why this is safe to show (ratings are
 * already globally readable, unlike review text).
 */
export function BareRatingRow({ displayName, stars }: { displayName: string; stars: number }) {
  return (
    <li className="flex items-center gap-2.5 rounded-2xl bg-page px-3 py-2.5">
      <div
        aria-hidden
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-leaf text-[11px] font-bold text-on-leaf"
      >
        {displayName.charAt(0).toUpperCase()}
      </div>
      <span className="font-sans text-sm text-ink">
        <span className="font-bold">{displayName}</span> rated it{' '}
        <span className="font-bold text-honey-text">★ {stars.toFixed(1)}</span>
      </span>
    </li>
  )
}
