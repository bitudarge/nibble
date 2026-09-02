import { isSupabaseConfigured } from '../lib/supabase/client'

/**
 * Placeholder — Phase 4 replaces this with the real dashboard (currently
 * reading, stats, streak, recommended-next strip, circle activity).
 */
export function Home() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-stone-600">
        Your dashboard (currently reading, stats, recommendations) lands in Phase 4.
      </p>
      <p
        className="mt-4 inline-block rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-600"
        data-testid="connection-status"
      >
        {isSupabaseConfigured ? 'Connected to Supabase' : 'Local-storage fallback mode'}
      </p>
    </div>
  )
}
