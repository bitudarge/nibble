import { supabase } from '../supabase/client'
import type { Book } from '../../types/database'
import { fetchGoogleBooksDetails, type GoogleBooksDetails } from './googleBooks'
import type { OpenLibrarySearchResult } from './openLibrary'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * The pure "what should change" half of enrichment, kept separate from
 * enrichBook's Supabase call so the merge decision (Google Books is
 * primary, Open Library only fills gaps, never gets overwritten) is
 * testable without mocking a database round trip.
 */
export function buildEnrichmentUpdate(
  book: Book,
  details: GoogleBooksDetails | null,
): Partial<Book> {
  const update: Partial<Book> = {
    metadata: {
      ...book.metadata,
      enriched: true,
      description: details?.description ?? null,
      categories: details?.categories ?? [],
    },
  }
  if (!book.page_count && details?.pageCount) update.page_count = details.pageCount
  if (!book.published_year && details?.publishedYear) {
    update.published_year = details.publishedYear
  }
  if (!book.cover_url && details?.coverUrl) update.cover_url = details.coverUrl
  return update
}

/**
 * Fills in the rich detail Open Library doesn't have: synopsis, genre
 * categories, and a better page count/year/cover for whichever of those
 * Open Library was missing (Google Books is the primary source for detail,
 * Open Library the fallback, never the other way round).
 *
 * Runs once per book: the `enriched` flag in metadata marks that we've
 * already asked Google Books, whether or not it had anything useful,
 * so a book with no Google Books match doesn't get re-queried on every
 * page view. If the update fails for any reason, the caller just gets
 * the book back unchanged rather than an error, since a page that already
 * renders fine with Open Library data shouldn't break over this.
 */
export async function enrichBook(book: Book): Promise<Book> {
  if (book.metadata.enriched) return book
  const db = requireSupabase()

  const details = await fetchGoogleBooksDetails(book.title, book.author)
  const update = buildEnrichmentUpdate(book, details)

  const { data: updated, error } = await db
    .from('books')
    .update(update)
    .eq('id', book.id)
    .select('*')
    .single()

  if (error) return book
  return updated as Book
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

  // Enrich right away so whoever added this book (almost always the first
  // person to view it) lands on an already-rich page, instead of every
  // future viewer racing to be the one who triggers the lookup.
  return enrichBook(created as Book)
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
