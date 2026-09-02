import { supabase } from '../supabase/client'
import type { BookTagProfile } from './types'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * A book's "identity" for scoring purposes: how often each tag was used
 * across its reviews. RLS on review_tags mirrors the underlying review's
 * visibility, so this naturally only counts tags from reviews the current
 * user can see (their own + public + shared-circle ones) — no separate
 * privacy check needed here.
 */
export async function getBookTagProfiles(bookIds: string[]): Promise<Map<string, BookTagProfile>> {
  const profiles = new Map<string, BookTagProfile>(
    bookIds.map((id) => [id, { bookId: id, tagCounts: {} }]),
  )
  if (bookIds.length === 0) return profiles

  const db = requireSupabase()
  const { data, error } = await db
    .from('review_tags')
    .select('book_tags(type, name), reviews!inner(book_id)')
    .in('reviews.book_id', bookIds)
  if (error) throw error

  for (const row of data ?? []) {
    const tag = row.book_tags as unknown as { type: string; name: string } | null
    const review = row.reviews as unknown as { book_id: string } | null
    if (!tag || !review) continue

    const profile = profiles.get(review.book_id)
    if (!profile) continue
    const key = `${tag.type}:${tag.name}`
    profile.tagCounts[key] = (profile.tagCounts[key] ?? 0) + 1
  }

  return profiles
}
