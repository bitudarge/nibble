import { supabase } from '../supabase/client'
import { getMyCircles } from '../circles/data'
import { computeTasteOverlap } from './scoring'
import type { CircleSignal } from './types'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

async function getRatingsMap(userId: string): Promise<Map<string, number>> {
  const db = requireSupabase()
  const { data, error } = await db.from('ratings').select('book_id, stars').eq('user_id', userId)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.book_id as string, r.stars as number]))
}

async function getCircleMateIds(userId: string): Promise<string[]> {
  const db = requireSupabase()
  const circles = await getMyCircles(userId)
  if (circles.length === 0) return []

  const { data, error } = await db
    .from('circle_members')
    .select('user_id')
    .in(
      'circle_id',
      circles.map((c) => c.id),
    )
  if (error) throw error

  const ids = new Set((data ?? []).map((row) => row.user_id as string))
  ids.delete(userId)
  return [...ids]
}

/**
 * Circle-mates' ratings of the given candidate books, each paired with a
 * taste-overlap score against the current user (see computeTasteOverlap).
 * Keyed by bookId so the caller can look up signals per candidate.
 */
export async function getCircleSignals(
  userId: string,
  candidateBookIds: string[],
): Promise<Map<string, CircleSignal[]>> {
  const result = new Map<string, CircleSignal[]>()
  if (candidateBookIds.length === 0) return result

  const circleMateIds = await getCircleMateIds(userId)
  if (circleMateIds.length === 0) return result

  const db = requireSupabase()
  const [myRatings, { data: mateRatings, error }] = await Promise.all([
    getRatingsMap(userId),
    db
      .from('ratings')
      .select('user_id, book_id, stars, profiles(display_name)')
      .in('user_id', circleMateIds)
      .in('book_id', candidateBookIds),
  ])
  if (error) throw error

  const overlapCache = new Map<string, number>()
  async function overlapWith(mateId: string): Promise<number> {
    const cached = overlapCache.get(mateId)
    if (cached !== undefined) return cached
    const theirRatings = await getRatingsMap(mateId)
    const overlap = computeTasteOverlap(myRatings, theirRatings)
    overlapCache.set(mateId, overlap)
    return overlap
  }

  for (const row of mateRatings ?? []) {
    const bookId = row.book_id as string
    const mateId = row.user_id as string
    const profile = row.profiles as unknown as { display_name: string } | null
    const signal: CircleSignal = {
      memberName: profile?.display_name ?? 'A circle member',
      stars: row.stars as number,
      overlap: await overlapWith(mateId),
    }
    const existing = result.get(bookId)
    if (existing) existing.push(signal)
    else result.set(bookId, [signal])
  }

  return result
}
