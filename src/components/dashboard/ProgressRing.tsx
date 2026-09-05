import type { ReactNode } from 'react'

/**
 * A circular progress ring with a number centered inside it, matching the
 * round 4 mockup's "Your goals" weekly ring. Pure/presentational: takes a
 * 0-100 percent and renders the SVG, no data fetching of its own.
 */
export function ProgressRing({
  percent,
  size = 92,
  strokeWidth = 11,
  children,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  children: ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percent))
  const dash = (clamped / 100) * circumference

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--nibbles-line)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--nibbles-sage)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.55s cubic-bezier(.2,.85,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
