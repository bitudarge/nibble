import { useState } from 'react'
import { Navigate } from 'react-router-dom'
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold text-stone-900">🐛 Nibble</h1>
      <p className="text-stone-600">Track what you read, with friends.</p>

      {!isSupabaseConfigured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase isn't configured yet, so sign-in isn't available. See .env.example.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={!isSupabaseConfigured || signingIn}
        className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {signingIn ? 'Redirecting…' : 'Sign in with Google'}
      </button>
    </main>
  )
}
