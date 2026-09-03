import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Celebration } from './Celebration'

// Matches the celebration's total on-screen time (see the nib-fall/nib-toast
// animation durations in src/index.css) plus a small margin, so the message
// is gone from the DOM right as the animation finishes rather than a moment
// before or after.
const CELEBRATION_MS = 1900

/**
 * Lets any page trigger a brief finish/streak celebration without a global
 * provider: call `celebrate(message)`, render `{node}` once near the top
 * of that page's JSX. A second call while one is still showing swaps the
 * message and restarts the animation from scratch (a fresh `id` forces
 * React to remount Celebration) rather than stacking two at once.
 */
export function useCelebration(): { celebrate: (message: string) => void; node: ReactNode } {
  const [shown, setShown] = useState<{ id: number; message: string } | null>(null)
  const nextId = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  const celebrate = useCallback((message: string) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    nextId.current += 1
    setShown({ id: nextId.current, message })
    timeoutRef.current = window.setTimeout(() => setShown(null), CELEBRATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    celebrate,
    node: shown ? <Celebration key={shown.id} message={shown.message} /> : null,
  }
}
