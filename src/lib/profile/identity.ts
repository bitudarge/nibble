import type { User } from '@supabase/supabase-js'
import type { Profile } from '../../types/database'

/**
 * What to actually show for "this person's name/avatar" anywhere in the
 * app. Every screen used to read straight from the Google OAuth session
 * (`user.user_metadata.full_name`/`avatar_url`), which meant editing your
 * profile (round 2 section 4) had no visible effect anywhere, the whole
 * point of an editable profile. Now: prefer the editable `profiles` row
 * whenever it has something set, fall back to whatever Google handed over
 * at signup, and only fall back further to a bare email or "Reader" once
 * neither has a name. Pure so it's testable without a live session.
 */
export function resolveDisplayIdentity(
  user: User | null,
  profile: Profile | null,
): { displayName: string; avatarUrl: string | undefined } {
  const googleName = user?.user_metadata?.full_name
  const googleAvatar = user?.user_metadata?.avatar_url

  const displayName =
    profile?.display_name ||
    (typeof googleName === 'string' && googleName ? googleName : undefined) ||
    user?.email ||
    'Reader'

  const avatarUrl =
    profile?.avatar_url ||
    (typeof googleAvatar === 'string' && googleAvatar ? googleAvatar : undefined)

  return { displayName, avatarUrl: avatarUrl ?? undefined }
}
