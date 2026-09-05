/**
 * The bottom tab bar / desktop menu icons, redrawn to match the round 4
 * mockup's own exact shapes (a house outline for Home, three leaning book
 * spines for Shelves, a magnifying glass for Discover, a five-point star
 * for Picks, two overlapping circles for Circles) rather than this app's
 * earlier hand-drawn freehand set. Styled with `currentColor` so active/
 * inactive color still comes from the parent, same as before.
 */
type IconProps = { className?: string }

export function HomeIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M4 11l8-6.6 8 6.6v7.5a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
    </svg>
  )
}

/** A little stack of leaning book spines, matching the mockup's Shelves icon exactly. */
export function ShelvesIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden
      className={className}
    >
      <rect x="3.5" y="4" width="5.2" height="16" rx="1.8" />
      <rect x="10.8" y="7.5" width="5.2" height="12.5" rx="1.8" />
      <rect x="18.1" y="10.5" width="2.6" height="9.5" rx="1.3" />
    </svg>
  )
}

export function DiscoverIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <circle cx="11" cy="11" r="6.8" />
      <path d="M16.2 16.2L20.5 20.5" />
    </svg>
  )
}

/** A five-point star, for the Picks/Recs tab — matching the mockup's exact shape. */
export function RecsIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 3.4l2.7 5.4 6 .9-4.4 4.2 1.1 5.9-5.4-2.8-5.4 2.8 1.1-5.9L3.3 9.7l6-.9z" />
    </svg>
  )
}

export function CirclesIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden
      className={className}
    >
      <circle cx="9.5" cy="10" r="4.2" />
      <circle cx="16.2" cy="13.2" r="3.4" />
    </svg>
  )
}

/** Three slightly uneven rounded bars, for the desktop menu toggle. */
export function HamburgerIcon({ className }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M4 6.7h16" />
      <path d="M4 12.1h13.5" />
      <path d="M4 17.4h16" />
    </svg>
  )
}

/** The header streak pill's leaf/flame glyph, the same shape the mockup uses for both the streak icon and the "days this week" pips. */
export function StreakIcon({ className }: IconProps) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M20 4C10 4 4 9.5 4 16.5c0 1.4.3 2.6.8 3.5C7 15 11.5 11.5 18 10c-4.5 2.2-8 5.6-9.6 10 1 .3 2 .5 3.1.5 6 0 8.5-6 8.5-16.5z"
      />
    </svg>
  )
}
