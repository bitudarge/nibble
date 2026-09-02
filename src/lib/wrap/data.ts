import { supabase } from '../supabase/client'
import type { ShelfItemWithBook } from '../shelf/data'
import type { Book } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export interface WrapData {
  year: number
  finishedBooks: ShelfItemWithBook[]
  totalBooks: number
  totalPages: number
  topTags: { tag: string; count: number }[]
  favoriteBooks: { book: Book; stars: number }[]
}

/** Everything the Wrap page needs for one year, in one call. */
export async function getWrapData(userId: string, year: number): Promise<WrapData> {
  const db = requireSupabase()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const { data: finished, error: finishedError } = await db
    .from('shelf_items')
    .select('*, books(*)')
    .eq('user_id', userId)
    .eq('status', 'finished')
    .gte('finished_at', yearStart)
    .lt('finished_at', yearEnd)
  if (finishedError) throw finishedError

  const finishedBooks = (finished ?? []) as unknown as ShelfItemWithBook[]
  const totalPages = finishedBooks.reduce((sum, item) => sum + (item.books.page_count ?? 0), 0)

  let favoriteBooks: { book: Book; stars: number }[] = []
  const bookIds = finishedBooks.map((item) => item.book_id)
  if (bookIds.length > 0) {
    const { data: ratings, error: ratingsError } = await db
      .from('ratings')
      .select('book_id, stars')
      .eq('user_id', userId)
      .in('book_id', bookIds)
      .order('stars', { ascending: false })
      .limit(3)
    if (ratingsError) throw ratingsError

    favoriteBooks = (ratings ?? []).flatMap((r) => {
      const item = finishedBooks.find((i) => i.book_id === r.book_id)
      return item ? [{ book: item.books, stars: r.stars as number }] : []
    })
  }

  const { data: tagRows, error: tagsError } = await db
    .from('review_tags')
    .select('book_tags(type, name), reviews!inner(user_id, created_at)')
    .eq('reviews.user_id', userId)
    .gte('reviews.created_at', yearStart)
    .lt('reviews.created_at', yearEnd)
  if (tagsError) throw tagsError

  const tagCounts = new Map<string, number>()
  for (const row of tagRows ?? []) {
    const tag = row.book_tags as unknown as { type: string; name: string } | null
    if (!tag) continue
    const key = `${tag.type}:${tag.name}`
    tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1)
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }))

  return {
    year,
    finishedBooks,
    totalBooks: finishedBooks.length,
    totalPages,
    topTags,
    favoriteBooks,
  }
}
