import { supabase } from '../supabase/client'
import type { Profile } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export interface Comment {
  id: string
  review_id: string
  user_id: string
  body: string
  created_at: string
}

export interface CommentWithAuthor extends Comment {
  profiles: Profile
}

/**
 * Comments on one review, oldest first (reads like a conversation, not a
 * feed). RLS on review_comments mirrors the review's own visibility, so
 * this naturally only returns comments the current user is allowed to see,
 * no extra check needed here.
 */
export async function getCommentsForReview(reviewId: string): Promise<CommentWithAuthor[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('review_comments')
    .select('*, profiles(*)')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CommentWithAuthor[]
}

/**
 * Posts a comment. RLS re-checks that the poster can actually see the
 * review being commented on (same rule as the select policy), so a bad
 * reviewId just gets rejected by the database rather than needing a
 * separate visibility check here.
 */
export async function postComment(
  reviewId: string,
  userId: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('Write something before posting.')

  const db = requireSupabase()
  const { data, error } = await db
    .from('review_comments')
    .insert({ review_id: reviewId, user_id: userId, body: trimmed })
    .select('*')
    .single()
  if (error) throw error
  return data as Comment
}

/** RLS restricts this to the comment's own author, nothing else to check here. */
export async function deleteComment(commentId: string): Promise<void> {
  const db = requireSupabase()
  const { error } = await db.from('review_comments').delete().eq('id', commentId)
  if (error) throw error
}
