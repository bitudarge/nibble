import { supabase } from '../supabase/client'
import type { Review } from '../../types/database'

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

export interface ReviewInput {
  bookId: string
  userId: string
  body: string
  containsSpoilers: boolean
  visibility: 'private' | 'public'
}

/**
 * Creates or updates the user's review of this visibility for this book.
 * (private and public are independent rows — see the schema's comment on
 * why there's no unique(user_id, book_id) — so this looks up the existing
 * row for that specific visibility rather than a blind upsert.)
 */
export async function saveReview(input: ReviewInput, existingId: string | null): Promise<Review> {
  const db = requireSupabase()

  if (existingId) {
    const { data, error } = await db
      .from('reviews')
      .update({ body: input.body, contains_spoilers: input.containsSpoilers })
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw error
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
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Review
}
