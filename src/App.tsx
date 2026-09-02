import { isSupabaseConfigured } from './lib/supabase/client'

/**
 * Placeholder landing page for Phase 1. Real routing, auth-gating, and pages
 * (Dashboard, Search, Book Page, Shelves, Circles, Recommendations, Wrap)
 * are added in later phases. This just proves the scaffold — build, Tailwind,
 * and the Supabase/local-storage wiring — works end to end.
 */
function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold text-stone-900">🐛 Nibble</h1>
      <p className="text-stone-600">An explainable, circle-aware book recommender — in progress.</p>
      <p
        className="rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-600"
        data-testid="connection-status"
      >
        {isSupabaseConfigured ? 'Connected to Supabase' : 'Local-storage fallback mode'}
      </p>
    </main>
  )
}

export default App
