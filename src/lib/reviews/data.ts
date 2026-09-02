import { supabase } from '../supabase/client'
import { analyzeReviewText, recomputeTasteProfile } from '../recommender'
import type { Circle, Profile, Review } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getPublicReviews(bookId: string): Promise<Review[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('book_id', bookId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Review[]
}

/** A user's own private "journal" review of a book, if they've written one. */
export async function getOwnPrivateReview(userId: string, bookId: string): Promise<Review | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('visibility', 'private')
    .maybeSingle()
  if (error) throw error
  return data as Review | null
}

export async function getOwnPublicReview(userId: string, bookId: string): Promise<Review | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('visibility', 'public')
    .maybeSingle()
  if (error) throw error
  return data as Review | null
}

export async function getOwnCircleReview(
  userId: string,
  bookId: string,
  circleId: string,
): Promise<Review | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('visibility', 'circle')
    .eq('circle_id', circleId)
    .maybeSingle()
  if (error) throw error
  return data as Review | null
}

export interface CircleReviewForBook extends Review {
  profiles: Profile
  circles: Circle
}

/** All circle-visibility reviews of this book from circles the viewer belongs to. */
export async function getCircleReviewsForBook(
  bookId: string,
  circleIds: string[],
): Promise<CircleReviewForBook[]> {
  if (circleIds.length === 0) return []
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*, profiles(*), circles(*)')
    .eq('book_id', bookId)
    .eq('visibility', 'circle')
    .in('circle_id', circleIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CircleReviewForBook[]
}

export interface ReviewInput {
  bookId: string
  userId: string
  body: string
  containsSpoilers: boolean
  visibility: 'private' | 'public' | 'circle'
  circleId?: string
}

/**
 * Creates or updates the user's review of this visibility for this book.
 * (private and public are independent rows — see the schema's comment on
 * why there's no unique(user_id, book_id) — so this looks up the existing
 * row for that specific visibility rather than a blind upsert.)
 *
 * Also runs the review text through the recommender's transparent
 * sentiment/keyword analysis and recomputes the user's taste profile —
 * see src/lib/recommender/README.md for what those actually do.
 */
export async function saveReview(input: ReviewInput, existingId: string | null): Promise<Review> {
  const db = requireSupabase()
  const analysis = analyzeReviewText(input.body)

  if (existingId) {
    const { data, error } = await db
      .from('reviews')
      .update({
        body: input.body,
        contains_spoilers: input.containsSpoilers,
        sentiment_score: analysis.sentimentScore,
        extracted_themes: analysis.extractedThemes,
      })
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw error
    void recomputeTasteProfile(input.userId)
    return data as Review
  }

  const { data, error } = await db
    .from('reviews')
    .insert({
      user_id: input.userId,
      book_id: input.bookId,
      body: input.body,
      contains_spoilers: input.containsSpoilers,
      visibility: input.visibility,
      circle_id: input.visibility === 'circle' ? input.circleId : null,
      sentiment_score: analysis.sentimentScore,
      extracted_themes: analysis.extractedThemes,
    })
    .select('*')
    .single()
  if (error) throw error
  void recomputeTasteProfile(input.userId)
  return data as Review
}
