import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { useAuth } from '../lib/auth/useAuth'

export function Login() {
  const { session, loading, signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  async function handleSignIn() {
    setError(null)
    setSigningIn(true)
    try {
      // On success, Supabase redirects the whole page to Google and back —
      // there's nothing further to do here in that case.
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong signing in.')
      setSigningIn(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-4 text-center text-ink">
      <h1>
        <Logo className="text-3xl" />
      </h1>
      <p className="font-sans text-muted">Track what you read, with friends.</p>

      {!isSupabaseConfigured && (
        <p className="rounded-2xl border border-line bg-honey-soft px-4 py-3 text-sm text-honey-text">
          Supabase isn't configured yet, so sign-in isn't available. See .env.example.
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={!isSupabaseConfigured || signingIn}
        className="rounded-full bg-sage px-5 py-2.5 font-sans font-bold text-surface shadow-soft transition-transform active:scale-95 disabled:opacity-50"
      >
        {signingIn ? 'Redirecting…' : 'Sign in with Google'}
      </button>
    </main>
  )
}
