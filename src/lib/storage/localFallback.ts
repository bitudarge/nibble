/**
 * Small typed wrapper around localStorage, used when Supabase isn't
 * configured yet (see src/lib/supabase/client.ts). Kept generic and minimal
 * here — later phases add feature-specific fallback data as those features
 * are built, rather than guessing the shape now.
 */

const PREFIX = 'nibble:'

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    // Private browsing, storage disabled, or corrupt JSON — treat as empty.
    return null
  }
}

export function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or disabled — silently no-op rather than crash the UI.
  }
}
