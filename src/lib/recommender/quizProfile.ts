import { getBookById } from '../books/data'
import { supabase } from '../supabase/client'
import { computeRatingBasedProfile, mergeTagAffinity, saveTasteProfile } from './tasteProfile'
// Re-exported below for existing importers (TasteQuiz.tsx) — the
// vocabulary/matcher live in their own leaf module now, see
// tagVocabulary.ts's file comment for why (breaks an import cycle with
// bookTagProfile.ts, which also needs matchCategoryToGenreTag).
import {
  matchCategoryToGenreTag,
  QUIZ_GENRE_OPTIONS,
  QUIZ_HEAVY_MOOD_OPTIONS,
  QUIZ_LIGHT_MOOD_OPTIONS,
  QUIZ_PACE_OPTIONS,
  QUIZ_READING_FREQUENCY_OPTIONS,
} from './tagVocabulary'
import type { TasteProfileData, TasteQuizAnswers, TasteQuizProfile } from './types'

export {
  matchCategoryToGenreTag,
  QUIZ_GENRE_OPTIONS,
  QUIZ_HEAVY_MOOD_OPTIONS,
  QUIZ_LIGHT_MOOD_OPTIONS,
  QUIZ_PACE_OPTIONS,
  QUIZ_READING_FREQUENCY_OPTIONS,
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

// An explicit pick says more than an inferred one (a favorite book's
// genre), which says more than a soft fiction/non-fiction lean.
const GENRE_PICK_WEIGHT = 0.7
const PACE_PICK_WEIGHT = 0.6
const MOOD_PICK_WEIGHT = 0.5
const FAVORITE_BOOK_GENRE_WEIGHT = 0.5
const NONFICTION_LEAN_WEIGHT = 0.7
const MIXED_LEAN_WEIGHT = 0.3

/**
 * Turns quiz answers (plus the Google Books categories of any favorite
 * books picked) into tag affinity contributions, in the same "genre:x"
 * key format the rest of the recommender uses. Pure and side-effect free
 * so it's easy to unit-test independent of the database.
 */
export function buildQuizTagAffinity(
  answers: TasteQuizAnswers,
  favoriteBookCategories: string[][],
): Record<string, number> {
  const affinity: Record<string, number> = {}
  const add = (key: string, weight: number) => {
    affinity[key] = (affinity[key] ?? 0) + weight
  }

  for (const genre of answers.genres) add(`genre:${genre}`, GENRE_PICK_WEIGHT)
  if (answers.pace) add(`pace:${answers.pace}`, PACE_PICK_WEIGHT)
  for (const mood of answers.moods) add(`mood:${mood}`, MOOD_PICK_WEIGHT)

  if (answers.fictionLean === 'nonfiction') {
    add('genre:non-fiction', NONFICTION_LEAN_WEIGHT)
    add('genre:memoir', NONFICTION_LEAN_WEIGHT)
  } else if (answers.fictionLean === 'mixed') {
    add('genre:non-fiction', MIXED_LEAN_WEIGHT)
    add('genre:memoir', MIXED_LEAN_WEIGHT)
  }

  for (const categories of favoriteBookCategories) {
    // A Set per book: a book listed under both "Fantasy" and "Fantasy /
    // Epic" should only count once, not twice.
    const matched = new Set<string>()
    for (const category of categories) {
      const genre = matchCategoryToGenreTag(category)
      if (genre) matched.add(genre)
    }
    for (const genre of matched) add(`genre:${genre}`, FAVORITE_BOOK_GENRE_WEIGHT)
  }

  return affinity
}

/**
 * Saves quiz answers (whether the quiz was finished or exited early) as
 * the taste profile's quiz component, merged with whatever the user's
 * ratings already contribute — see mergeTagAffinity in tasteProfile.ts
 * for why this is additive rather than a straight overwrite.
 */
export async function saveQuizAnswers(
  userId: string,
  answers: TasteQuizAnswers,
  options: { skipped: boolean },
): Promise<TasteProfileData> {
  let favoriteBookCategories: string[][] = []
  if (answers.favoriteBookIds.length > 0) {
    const books = await Promise.all(answers.favoriteBookIds.map((id) => getBookById(id)))
    favoriteBookCategories = books
      .filter((book): book is NonNullable<typeof book> => book !== null)
      .map((book) => (Array.isArray(book.metadata.categories) ? book.metadata.categories : []))
  }

  const quiz: TasteQuizProfile = {
    answers,
    tagAffinity: buildQuizTagAffinity(answers, favoriteBookCategories),
    takenAt: new Date().toISOString(),
    skipped: options.skipped,
  }

  const ratingBased = await computeRatingBasedProfile(userId)
  const profile: TasteProfileData = {
    ...ratingBased,
    tagAffinity: mergeTagAffinity(quiz.tagAffinity, ratingBased.tagAffinity),
    quiz,
  }

  await saveTasteProfile(userId, profile)
  return profile
}

/**
 * Whether this user has ever finished or explicitly skipped the quiz —
 * the one-time "prompt them after sign-in" redirect in RequireAuth.tsx
 * uses this so it never nags a repeat visitor.
 */
export async function hasTakenOrSkippedQuiz(userId: string): Promise<boolean> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('taste_profiles')
    .select('profile')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const profile = data?.profile as TasteProfileData | undefined
  return Boolean(profile?.quiz)
}

/** Reads back the saved quiz answers, if any, so the quiz can re-open pre-filled for editing. */
export async function getSavedQuizAnswers(userId: string): Promise<TasteQuizAnswers | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('taste_profiles')
    .select('profile')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const profile = data?.profile as TasteProfileData | undefined
  return profile?.quiz?.answers ?? null
}
