import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getProfile } from '../profile/data'
import { supabase } from '../supabase/client'
import type { Profile } from '../../types/database'
import { AuthContext } from './AuthContext'
import { useInactivityLogout } from './useInactivityLogout'

/**
 * Wraps the app in Supabase's auth state. Everything else (RequireAuth,
 * the login page, the nav's sign-out button) reads from this via useAuth()
 * rather than talking to Supabase directly — so there's one place that
 * knows how sessions work.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Nothing to check without a configured client, so start "not loading".
  const [loading, setLoading] = useState(() => supabase !== null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  // Loads (and reloads on sign-in/sign-out) the editable profile row
  // alongside the Google session, so every screen that shows a name or
  // avatar can prefer it — see resolveDisplayIdentity in lib/profile. The
  // "signed out" branch's setProfile is deferred to a microtask (not
  // called synchronously in the effect body) so it's treated as coming
  // from a callback rather than synchronously from the effect, same
  // pattern already used in Search.tsx and RequireAuth.tsx.
  useEffect(() => {
    let cancelled = false
    if (!supabase || !userId) {
      void Promise.resolve().then(() => {
        if (!cancelled) setProfile(null)
      })
      return () => {
        cancelled = true
      }
    }
    void getProfile(userId).then((row) => {
      if (!cancelled) setProfile(row)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const row = await getProfile(userId)
    setProfile(row)
  }, [userId])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase is not configured — check your .env file.')
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  useInactivityLogout(signOut, session !== null)

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        refreshProfile,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
