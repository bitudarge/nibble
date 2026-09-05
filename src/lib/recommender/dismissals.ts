import { supabase } from '../supabase/client'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * "Not for me" on a recommendation — a real, persisted per-user
 * dismissal (unlike the round 4 mockup's own version, which only ever
 * lived in in-memory session state and reset on every reload). Excluded
 * from every future getRecommendations call for that user, the same way
 * a shelved book already is (see recommend.ts).
 */
export async function getDismissedBookIds(userId: string): Promise<string[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('dismissed_recommendations')
    .select('book_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => row.book_id as string)
}

export async function dismissRecommendation(userId: string, bookId: string): Promise<void> {
  const db = requireSupabase()
  const { error } = await db
    .from('dismissed_recommendations')
    .upsert({ user_id: userId, book_id: bookId }, { onConflict: 'user_id,book_id' })
  if (error) throw error
}
