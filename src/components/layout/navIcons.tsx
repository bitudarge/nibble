/**
 * Small line icons for the main navigation (bottom tab bar on phone,
 * sidebar on desktop). Kept in one file since they're only ever used
 * together, styled with currentColor so active/inactive color comes
 * from the parent.
 */
type IconProps = { className?: string }

const common = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function CompassIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-2 6-4-2 2-6z" />
    </svg>
  )
}

export function ShelvesIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M5 4v16" />
      <path d="M10 4v16" />
      <path d="M14.5 5l4 15" />
      <path d="M4 9.5h6" />
      <path d="M4 15h6" />
    </svg>
  )
}

export function CirclesIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="8.5" cy="9" r="3" />
      <circle cx="17" cy="10.5" r="2.4" />
      <path d="M3.5 19c.6-3 2.5-4.6 5-4.6s4.4 1.6 5 4.6" />
      <path d="M14.7 15.2c1.9.2 3.3 1.6 3.8 3.8" />
    </svg>
  )
}

export function RecsIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M12 3.5l1.8 4.4 4.4 1.8-4.4 1.8-1.8 4.4-1.8-4.4-4.4-1.8 4.4-1.8z" />
      <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
    </svg>
  )
}

export function YouIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5 19.5c1-4 3.6-5.8 7-5.8s6 1.8 7 5.8" />
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
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
