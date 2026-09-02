import { supabase } from '../supabase/client'
import type { Book } from '../../types/database'
import type { OpenLibrarySearchResult } from './openLibrary'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * Every book on Nibble has exactly one canonical row, deduped on
 * open_library_id. This is the "create-or-fetch" the Search page calls
 * after a user picks a result — it never creates a duplicate row for a
 * book someone else already added.
 */
export async function getOrCreateBook(result: OpenLibrarySearchResult): Promise<Book> {
  const db = requireSupabase()

  const { data: existing, error: selectError } = await db
    .from('books')
    .select('*')
    .eq('open_library_id', result.openLibraryId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing as Book

  const { data: created, error: insertError } = await db
    .from('books')
    .insert({
      open_library_id: result.openLibraryId,
      title: result.title,
      author: result.author,
      cover_url: result.coverUrl,
      published_year: result.publishedYear,
    })
    .select('*')
    .single()

  if (insertError) {
    // Unique-violation: someone else added this exact book between our
    // select and insert. Not an error from the user's point of view —
    // just fetch the row they created.
    if (insertError.code === '23505') {
      const { data: raced, error: racedError } = await db
        .from('books')
        .select('*')
        .eq('open_library_id', result.openLibraryId)
        .single()
      if (racedError) throw racedError
      return raced as Book
    }
    throw insertError
  }

  return created as Book
}

export async function getBookById(bookId: string): Promise<Book | null> {
  const db = requireSupabase()
  const { data, error } = await db.from('books').select('*').eq('id', bookId).maybeSingle()
  if (error) throw error
  return data as Book | null
}

/**
 * Dashboard fallback for the "Recommended next" strip until Phase 6's real
 * recommender exists. Deliberately framed as "recently added" rather than
 * "recommended" — Nibble's whole identity is explainable recommendations,
 * so a random/non-personalized list should never wear that label.
 */
export async function getRecentlyAddedBooks(excludeBookIds: string[], limit = 5): Promise<Book[]> {
  const db = requireSupabase()
  let query = db.from('books').select('*').order('created_at', { ascending: false }).limit(limit)
  if (excludeBookIds.length > 0) {
    query = query.not('id', 'in', `(${excludeBookIds.join(',')})`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Book[]
}
