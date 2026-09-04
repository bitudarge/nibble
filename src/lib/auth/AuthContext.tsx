import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/database'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True until we've checked whether a session already exists. */
  loading: boolean
  /**
   * The signed-in user's editable profile row (display_name/avatar_url),
   * null until it's loaded or if there's no session. Centralized here
   * rather than fetched separately by every screen that shows a name or
   * avatar, so editing your profile (round 2 section 4) is reflected
   * everywhere immediately, not just on next reload — call refreshProfile
   * after a successful save.
   */
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
