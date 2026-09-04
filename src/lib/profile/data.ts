import { supabase } from '../supabase/client'
import type { Profile } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = requireSupabase()
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export interface ProfileUpdate {
  display_name?: string
  avatar_url?: string | null
}

/**
 * Saves display_name/avatar_url edits. RLS (profiles_update_own) already
 * restricts this to the caller's own row, nothing else to check here.
 */
export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}
