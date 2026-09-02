import { supabase } from '../supabase/client'
import type { BookTag } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/** The full controlled vocabulary, seeded by migration 20260901000004. */
export async function getAllTags(): Promise<BookTag[]> {
  const db = requireSupabase()
  const { data, error } = await db.from('book_tags').select('*').order('type').order('name')
  if (error) throw error
  return (data ?? []) as BookTag[]
}

export async function getTagsForReview(reviewId: string): Promise<BookTag[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('review_tags')
    .select('book_tags(*)')
    .eq('review_id', reviewId)
  if (error) throw error
  return (data ?? []).flatMap((row) => (row.book_tags ? [row.book_tags as unknown as BookTag] : []))
}

/** Replaces a review's tag selection wholesale — simpler than diffing. */
export async function setReviewTags(reviewId: string, tagIds: string[]): Promise<void> {
  const db = requireSupabase()

  const { error: deleteError } = await db.from('review_tags').delete().eq('review_id', reviewId)
  if (deleteError) throw deleteError

  if (tagIds.length === 0) return

  const { error: insertError } = await db
    .from('review_tags')
    .insert(tagIds.map((tagId) => ({ review_id: reviewId, tag_id: tagId })))
  if (insertError) throw insertError
}
