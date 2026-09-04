import { supabase } from '../supabase/client'
import { getTagsForReview } from '../tags/data'
import type { Book, BookTag, Rating, Review } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

interface RatingWithBook extends Rating {
  books: Book
}

export interface MyRatedBook {
  book: Book
  rating: Rating
  note: Review | null
  tags: BookTag[]
}

/**
 * Everything a user put in for a book they've rated: their own rating,
 * their own private note if they wrote one, their own tags if they picked
 * any. Deliberately never anyone else's public/circle reviews, this is
 * "my ratings and notes," not a feed of what everyone else said. Powers
 * the /my-books page.
 */
export async function getMyRatedBooks(userId: string): Promise<MyRatedBook[]> {
  const db = requireSupabase()

  const { data, error } = await db
    .from('ratings')
    .select('*, books(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error

  const ratingRows = (data ?? []) as unknown as RatingWithBook[]
  if (ratingRows.length === 0) return []

  const bookIds = ratingRows.map((row) => row.book_id)
  const { data: noteRows, error: notesError } = await db
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('visibility', 'private')
    .in('book_id', bookIds)
  if (notesError) throw notesError

  const notesByBookId = new Map<string, Review>()
  for (const note of (noteRows ?? []) as Review[]) notesByBookId.set(note.book_id, note)

  const tagsByReviewId = new Map<string, BookTag[]>()
  await Promise.all(
    [...notesByBookId.values()].map(async (note) => {
      tagsByReviewId.set(note.id, await getTagsForReview(note.id))
    }),
  )

  return ratingRows.map(({ books, ...rating }) => {
    const note = notesByBookId.get(rating.book_id) ?? null
    return {
      book: books,
      rating,
      note,
      tags: note ? (tagsByReviewId.get(note.id) ?? []) : [],
    }
  })
}
