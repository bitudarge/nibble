import { supabase } from '../supabase/client'
import type { Book, ShelfItem, ShelfStatus } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getShelfItems(userId: string): Promise<ShelfItem[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('shelf_items')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ShelfItem[]
}

export interface ShelfItemWithBook extends ShelfItem {
  books: Book
}

/** Powers the My Shelves page — one query instead of N+1 per-book lookups. */
export async function getShelfItemsWithBooks(userId: string): Promise<ShelfItemWithBook[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('shelf_items')
    .select('*, books(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ShelfItemWithBook[]
}

export async function getShelfItemForBook(
  userId: string,
  bookId: string,
): Promise<ShelfItem | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('shelf_items')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data as ShelfItem | null
}

/** Moves a book to a shelf, creating the shelf_items row if it doesn't exist yet. */
export async function setShelfStatus(
  userId: string,
  bookId: string,
  status: ShelfStatus,
): Promise<ShelfItem> {
  const db = requireSupabase()

  const patch: { user_id: string; book_id: string; status: ShelfStatus } & Record<string, unknown> =
    { user_id: userId, book_id: bookId, status }
  if (status === 'reading') patch.started_at = new Date().toISOString()
  if (status === 'finished') patch.finished_at = new Date().toISOString()

  const { data, error } = await db
    .from('shelf_items')
    .upsert(patch, { onConflict: 'user_id,book_id' })
    .select('*')
    .single()
  if (error) throw error
  return data as ShelfItem
}

export async function updateShelfProgress(
  userId: string,
  bookId: string,
  currentPage: number,
  percentComplete: number | null,
): Promise<void> {
  const db = requireSupabase()
  const { error } = await db
    .from('shelf_items')
    .update({ current_page: currentPage, percent_complete: percentComplete })
    .eq('user_id', userId)
    .eq('book_id', bookId)
  if (error) throw error
}
