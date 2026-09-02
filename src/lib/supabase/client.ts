import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Central place that decides whether the app talks to Supabase or falls
 * back to local storage. Every other module should import `isSupabaseConfigured`
 * and `supabase` from here rather than reading `import.meta.env` directly —
 * that way there's exactly one spot that knows how the app is wired up.
 *
 * Until real tables exist (Phase 2) and auth is wired (Phase 3), this client
 * is created but mostly idle — features are added to use it phase by phase.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[nibble] Supabase env vars are missing — running in local-storage fallback mode. ' +
      'See .env.example for the variables to set.',
  )
}

// `supabase` is null in fallback mode. Callers must check `isSupabaseConfigured`
// (or handle a null client) before using it — this keeps the "never trust
// unconfigured state" rule explicit at every call site instead of hidden.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null
