/**
 * Small hand-drawn "freehand" style line icons for the main navigation
 * (bottom tab bar on phone, hamburger menu on desktop) and the header
 * controls. Loosely in the spirit of Streamline's CC-BY freehand icon
 * family (modulated stroke, slightly organic line quality, rounded caps),
 * drawn as original SVGs here rather than copied from anywhere, since
 * this is matching a style direction, not reproducing a specific asset.
 * Styled with currentColor so active/inactive color comes from the parent.
 */
type IconProps = { className?: string }

const common = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.1} className={className}>
      <path d="M3.6 11.2 12 4.2l8.3 7" />
      <path d="M5.6 9.8v9c0 .6.5 1 1 1h3.2v-5.3c0-.5.4-1 1-1h2.3c.6 0 1 .5 1 1V19.8h3.2c.6 0 1-.4 1-1v-9" />
      <path d="M9.5 4.6h1.8v2" />
    </svg>
  )
}

/** A magnifying glass, replacing the old compass icon (explicitly requested for Discover). */
export function DiscoverIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.3} className={className}>
      <path d="M11 4.3c3.9-.3 6.8 2.6 6.7 6.3-.1 3.6-3 6.4-6.7 6.3-3.7-.1-6.5-3-6.4-6.7.1-3.3 2.7-5.7 6.4-5.9z" />
      <path d="M15.6 15.4 20 19.7" />
    </svg>
  )
}

/** A little stack of leaning book spines, replacing the old shelf-divider abstraction. */
export function ShelvesIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2} className={className}>
      <path d="M4.3 20.2V5.4c0-.5.4-1 1-1h1.6c.5 0 1 .5 1 1v14.8" />
      <path d="M9.7 20.2V6.2c0-.5.4-.9 1-.9h1.5c.6 0 1 .4 1 .9v14" />
      <path d="M15 20.1 16.4 6.7c.1-.5.6-.9 1.1-.8l1.6.3c.5.1.9.6.8 1.1L18 20.5" />
      <path d="M4 20.4h16" />
    </svg>
  )
}

/** An open book with a small heart, replacing the old sparkle/star (too generic-AI-looking). */
export function RecsIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.1} className={className}>
      <path d="M12 6.8c-1.4-1.6-3.8-2.1-6-1.4-.4.1-.7.5-.7 1v10.4c0 .7.7 1.1 1.3.9 2-.6 4-.2 5.4 1.1" />
      <path d="M12 6.8c1.4-1.6 3.8-2.1 6-1.4.4.1.7.5.7 1v10.4c0 .7-.7 1.1-1.3.9-2-.6-4-.2-5.4 1.1V6.8z" />
      <path d="M11.6 4.4c.3-.6 1-1 1.7-.8.8.2 1.2 1 1 1.8-.3.9-1.6 1.6-2.1 1.8-.3-.5-.9-1.9-.6-2.8z" />
    </svg>
  )
}

export function CirclesIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.1} className={className}>
      <path d="M8.6 9.3a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8z" />
      <path d="M16.5 11.5a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z" />
      <path d="M3.4 19c.6-3.1 2.5-4.7 5.2-4.7s4.6 1.6 5.2 4.7" />
      <path d="M14.5 15c1.9.3 3.3 1.6 3.9 4" />
    </svg>
  )
}

export function YouIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.1} className={className}>
      <path d="M12 11.5a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" />
      <path d="M5.3 20.3c1-4.1 3.6-5.9 6.7-5.9s5.7 1.8 6.7 5.9" />
    </svg>
  )
}

/** Three slightly uneven rounded bars, for the desktop menu toggle. */
export function HamburgerIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2.2} className={className}>
      <path d="M4 6.7h16" />
      <path d="M4 12.1h13.5" />
      <path d="M4 17.4h16" />
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg {...common} strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  )
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M19 14.5A8 8 0 019.5 5a7 7 0 109.5 9.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}
