import { supabase } from '../supabase/client'
import { matchCategoryToGenreTag } from './tagVocabulary'
import type { BookTagProfile } from './types'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

/**
 * Folds a book's Google Books categories into its tag counts as
 * `genre:*` entries, one point each (a book listed under both "Fantasy"
 * and "Fantasy / Epic" only counts once, same dedupe as the taste quiz's
 * favorite-book matching in quizProfile.ts, which this reuses). This is
 * what lets a book with zero reviews still carry real genre signal, since
 * `review_tags` alone is empty for every book nobody has reviewed yet.
 * Pure and side-effect free (doesn't mutate `tagCounts`) so it's testable
 * without a database.
 */
export function addCategoryTagCounts(
  tagCounts: Record<string, number>,
  categories: string[],
): Record<string, number> {
  const matched = new Set<string>()
  for (const category of categories) {
    const genre = matchCategoryToGenreTag(category)
    if (genre) matched.add(genre)
  }
  if (matched.size === 0) return tagCounts

  const next = { ...tagCounts }
  for (const genre of matched) {
    const key = `genre:${genre}`
    next[key] = (next[key] ?? 0) + 1
  }
  return next
}

/**
 * A book's "identity" for scoring purposes: how often each tag was used
 * across its reviews, PLUS a genre signal inferred from its Google Books
 * categories (see addCategoryTagCounts above) — the recommender needs both
 * to produce good picks before real reviews exist for most books (see
 * docs/refinement/master-prompt.md section 7). RLS on review_tags mirrors
 * the underlying review's visibility, so the review-derived half of this
 * naturally only counts tags from reviews the current user can see (their
 * own + public + shared-circle ones) — no separate privacy check needed
 * there. The category-derived half is unaffected by review visibility,
 * since it comes from the book row itself, which every signed-in user can
 * already read.
 */
export async function getBookTagProfiles(bookIds: string[]): Promise<Map<string, BookTagProfile>> {
  const profiles = new Map<string, BookTagProfile>(
    bookIds.map((id) => [id, { bookId: id, tagCounts: {} }]),
  )
  if (bookIds.length === 0) return profiles

  const db = requireSupabase()
  const [{ data: tagRows, error: tagError }, { data: bookRows, error: bookError }] =
    await Promise.all([
      db
        .from('review_tags')
        .select('book_tags(type, name), reviews!inner(book_id)')
        .in('reviews.book_id', bookIds),
      db.from('books').select('id, metadata').in('id', bookIds),
    ])
  if (tagError) throw tagError
  if (bookError) throw bookError

  for (const row of tagRows ?? []) {
    const tag = row.book_tags as unknown as { type: string; name: string } | null
    const review = row.reviews as unknown as { book_id: string } | null
    if (!tag || !review) continue

    const profile = profiles.get(review.book_id)
    if (!profile) continue
    const key = `${tag.type}:${tag.name}`
    profile.tagCounts[key] = (profile.tagCounts[key] ?? 0) + 1
  }

  for (const book of bookRows ?? []) {
    const profile = profiles.get(book.id as string)
    if (!profile) continue
    const categories = (book.metadata as { categories?: unknown })?.categories
    if (!Array.isArray(categories) || categories.length === 0) continue
    profile.tagCounts = addCategoryTagCounts(
      profile.tagCounts,
      categories.filter((c): c is string => typeof c === 'string'),
    )
  }

  return profiles
}
