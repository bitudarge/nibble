/**
 * The recommender's tag vocabulary and the Google-Books-category matcher,
 * pulled out into their own leaf module (no imports from elsewhere in this
 * package) so both quizProfile.ts and bookTagProfile.ts can depend on it
 * without depending on each other — bookTagProfile.ts needs the matcher,
 * quizProfile.ts needs both the matcher and the option lists, and
 * tasteProfile.ts (which bookTagProfile.ts already imports) is in turn
 * imported by quizProfile.ts, so a module that sat inside either of those
 * two files would create an import cycle.
 */

/**
 * Tap-able genre options for the quiz, in the exact vocabulary
 * supabase/migrations/20260901000004_seed_book_tags.sql seeds `book_tags`
 * with — quiz-derived affinity only matches real books if the tag names
 * line up exactly, so keep this list in sync if that seed migration ever
 * changes.
 */
export const QUIZ_GENRE_OPTIONS = [
  'fantasy',
  'sci-fi',
  'romance',
  'mystery',
  'thriller',
  'literary-fiction',
  'historical-fiction',
  'horror',
  'memoir',
  'young-adult',
  'contemporary',
  'classics',
  'poetry',
  'graphic-novel',
  // 'non-fiction' deliberately excluded here — the fiction/non-fiction
  // lean question covers that on its own.
] as const

export const QUIZ_PACE_OPTIONS = ['slow-burn', 'moderate', 'fast-paced', 'page-turner'] as const

export const QUIZ_LIGHT_MOOD_OPTIONS = ['cozy', 'heartwarming', 'funny', 'uplifting'] as const
export const QUIZ_HEAVY_MOOD_OPTIONS = [
  'dark',
  'tense',
  'melancholic',
  'thought-provoking',
] as const

export const QUIZ_READING_FREQUENCY_OPTIONS = [
  'a book a week',
  'a book a month',
  'a few a year',
  'getting back into it',
] as const

// Google Books' categories are free-text ("Fiction / Science Fiction /
// General") and don't line up 1:1 with our fixed tag vocabulary, so a
// bare substring check misses common real cases (nobody writes "sci-fi"
// in a Google Books category). This is the small set of synonyms that
// actually shows up in practice; falls back to a plain hyphen-to-space
// substring check for everything else.
const GENRE_SYNONYMS: Partial<Record<string, string[]>> = {
  'sci-fi': ['science fiction', 'sci-fi', 'sci fi'],
  'literary-fiction': ['literary fiction'],
  'historical-fiction': ['historical fiction'],
  'young-adult': ['young adult', 'juvenile fiction'],
  'graphic-novel': ['graphic novel', 'comics'],
  memoir: ['biography', 'autobiography', 'memoir'],
  'non-fiction': ['non-fiction', 'nonfiction'],
}

const ALL_GENRE_TAGS = [...QUIZ_GENRE_OPTIONS, 'non-fiction']

/**
 * Matches one Google Books category string against our genre tag
 * vocabulary with a loose, case-insensitive check. Returns null rather
 * than guessing when nothing lines up, a missed match just means one
 * less signal, not a wrong one. Used both by the taste quiz (favorite-book
 * picks) and by bookTagProfile.ts (every candidate book's own categories).
 */
export function matchCategoryToGenreTag(category: string): string | null {
  const lower = category.toLowerCase()
  for (const genre of ALL_GENRE_TAGS) {
    const synonyms = GENRE_SYNONYMS[genre] ?? [genre.replace(/-/g, ' ')]
    if (synonyms.some((synonym) => lower.includes(synonym))) return genre
  }
  return null
}

/**
 * The reverse direction: turns one of our genre tags into an Open Library
 * subject slug ("sci-fi" -> "science_fiction") for genre-based discovery
 * search (`src/lib/recommender/discovery.ts`). Reuses the same synonym
 * list `matchCategoryToGenreTag` uses, so the two stay in sync — the first
 * synonym listed is always the real-world phrase ("science fiction"), not
 * our internal hyphenated tag name. Falls back to a plain hyphen-to-space
 * conversion for genres with no synonym entry, which already matches Open
 * Library's actual subject slugs for most of them (fantasy, romance,
 * mystery, thriller, horror, poetry, classics). A slug Open Library
 * doesn't recognize isn't an error, it just comes back with zero results.
 */
export function genreTagToSubjectSlug(genre: string): string {
  const phrase = GENRE_SYNONYMS[genre]?.[0] ?? genre.replace(/-/g, ' ')
  return phrase.trim().toLowerCase().replace(/\s+/g, '_')
}
