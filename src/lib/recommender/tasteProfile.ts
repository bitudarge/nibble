import { supabase } from '../supabase/client'
import { getBookTagProfiles } from './bookTagProfile'
import type { TasteProfileData } from './types'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/** Below this many ratings, we don't have enough signal to personalize — see recommend.ts. */
export const MIN_RATINGS_FOR_PERSONALIZATION = 3

/**
 * Builds a taste profile from scratch off the user's ratings: for each
 * rated book, weight its tags by how far that rating sits from the user's
 * own average (a 5★ from someone who averages 3★ says more than a 5★ from
 * someone who averages 4.5★), then normalize to roughly [-1, 1].
 */
export async function computeTasteProfile(userId: string): Promise<TasteProfileData> {
  const db = requireSupabase()
  const { data: ratings, error } = await db
    .from('ratings')
    .select('book_id, stars')
    .eq('user_id', userId)
  if (error) throw error

  if (!ratings || ratings.length === 0) {
    return { tagAffinity: {}, avgRating: 0, ratedBookCount: 0 }
  }

  const avgRating = ratings.reduce((sum, r) => sum + (r.stars as number), 0) / ratings.length
  const bookTagProfiles = await getBookTagProfiles(ratings.map((r) => r.book_id as string))

  const tagAffinity: Record<string, number> = {}
  for (const rating of ratings) {
    const profile = bookTagProfiles.get(rating.book_id as string)
    if (!profile) continue
    const total = Object.values(profile.tagCounts).reduce((sum, c) => sum + c, 0)
    if (total === 0) continue

    const delta = (rating.stars as number) - avgRating
    for (const [tag, count] of Object.entries(profile.tagCounts)) {
      const bookWeight = count / total
      tagAffinity[tag] = (tagAffinity[tag] ?? 0) + bookWeight * delta
    }
  }

  const maxAbs = Math.max(1, ...Object.values(tagAffinity).map(Math.abs))
  for (const tag of Object.keys(tagAffinity)) {
    const value = tagAffinity[tag]
    if (value !== undefined) tagAffinity[tag] = value / maxAbs
  }

  return { tagAffinity, avgRating, ratedBookCount: ratings.length }
}

export async function saveTasteProfile(userId: string, profile: TasteProfileData): Promise<void> {
  const db = requireSupabase()
  const { error } = await db.from('taste_profiles').upsert(
    {
      user_id: userId,
      profile: profile as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/** Recomputes and persists — call this after a rating or review changes. */
export async function recomputeTasteProfile(userId: string): Promise<TasteProfileData> {
  const profile = await computeTasteProfile(userId)
  await saveTasteProfile(userId, profile)
  return profile
}

/** Reads the cached profile, computing it fresh if none exists yet. */
export async function getOrComputeTasteProfile(userId: string): Promise<TasteProfileData> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('taste_profiles')
    .select('profile')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (data?.profile) return data.profile as unknown as TasteProfileData
  return recomputeTasteProfile(userId)
}
