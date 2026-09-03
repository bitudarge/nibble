import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

const STAR_COUNT = 5
const PULSE_MS = 220

/** How full one star (1-indexed) should look for a given displayed value, 0-100. */
function starFillPercent(displayValue: number, starIndex: number): number {
  const diff = displayValue - (starIndex - 1)
  if (diff >= 1) return 100
  if (diff <= 0) return 0
  return Math.round(diff * 100)
}

function StarShape({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-full w-full ${className}`} aria-hidden>
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6-5.8-3-5.8 3 1.1-6.6L2.5 9.4l6.6-.9z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.5}
      />
    </svg>
  )
}

/**
 * Five tappable stars, half-star precision (the data model stores 0.5
 * steps, so this doesn't regress that). Mouse/touch: tap the left or
 * right half of a star for a half or whole value. Keyboard: each star is
 * a real focusable button (Enter/Space sets that whole value), and arrow
 * keys nudge by half a star for finer control without a mouse. A brief
 * scale pulse on the tapped star gives the tap some weight; respects
 * prefers-reduced-motion via the global transition-duration override in
 * index.css, nothing extra needed here.
 */
export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [pulseStar, setPulseStar] = useState<number | null>(null)
  const displayValue = hoverValue ?? value ?? 0

  // Tracked so a rapid second tap clears the first pulse's timer instead of
  // stacking two, and so unmounting mid-pulse (e.g. navigating away right
  // after rating) never calls setPulseStar on a gone component.
  const pulseTimeoutRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current)
    }
  }, [])

  function commit(next: number) {
    onChange(next)
    setPulseStar(Math.ceil(next))
    if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current)
    pulseTimeoutRef.current = window.setTimeout(() => setPulseStar(null), PULSE_MS)
  }

  function halfFromEvent(e: MouseEvent<HTMLButtonElement>, starIndex: number): number {
    const rect = e.currentTarget.getBoundingClientRect()
    const isLeftHalf = e.clientX - rect.left < rect.width / 2
    return isLeftHalf ? starIndex - 0.5 : starIndex
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const current = value ?? 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      commit(Math.min(STAR_COUNT, current + 0.5))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      commit(Math.max(0.5, current - 0.5))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Star rating"
        className="flex gap-0.5"
        onMouseLeave={() => setHoverValue(null)}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((starIndex) => {
          const fillPercent = starFillPercent(displayValue, starIndex)
          return (
            <button
              key={starIndex}
              type="button"
              disabled={disabled}
              aria-label={`Rate ${starIndex} star${starIndex === 1 ? '' : 's'}`}
              onClick={(e) => commit(halfFromEvent(e, starIndex))}
              onMouseMove={(e) => setHoverValue(halfFromEvent(e, starIndex))}
              className="relative h-7 w-7 flex-none disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                transform: pulseStar === starIndex ? 'scale(1.3)' : 'scale(1)',
                transition: `transform ${pulseStar === starIndex ? 120 : 160}ms ease`,
              }}
            >
              <StarShape filled={false} className="absolute inset-0 text-line" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
              >
                <StarShape filled className="text-honey" />
              </span>
            </button>
          )
        })}
      </div>
      <span className="font-sans text-sm text-muted">
        {value ? `★ ${value.toFixed(1)}` : 'Not rated'}
      </span>
    </div>
  )
}
