import { supabase } from '../supabase/client'
import { updateShelfProgress } from '../shelf/data'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * Logs a reading_sessions row AND updates the matching shelf_items row's
 * current_page/percent_complete, so "quick update progress" on the
 * Dashboard/Book Page keeps both in sync in one call.
 */
export async function logReadingProgress(
  userId: string,
  bookId: string,
  fromPage: number | null,
  toPage: number,
  totalPages: number | null,
): Promise<void> {
  const db = requireSupabase()
  const pagesRead = fromPage != null ? Math.max(toPage - fromPage, 0) : null

  const { error } = await db.from('reading_sessions').insert({
    user_id: userId,
    book_id: bookId,
    from_page: fromPage,
    to_page: toPage,
    pages_read: pagesRead,
  })
  if (error) throw error

  const percent = totalPages ? Math.min((toPage / totalPages) * 100, 100) : null
  await updateShelfProgress(userId, bookId, toPage, percent)
}
