import { useEffect, useRef } from 'react'

/**
 * How long a signed-in user can go without any mouse/keyboard/touch/scroll
 * activity before we sign them out automatically. Supabase itself has no
 * built-in inactivity timeout — this is purely an app-level safeguard.
 * To change it, just edit this number.
 */
export const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000 // 4 hours

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useInactivityLogout(signOut: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(signOut, INACTIVITY_TIMEOUT_MS)
    }

    resetTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [enabled, signOut])
}
