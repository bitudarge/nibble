/**
 * Turns one of the recommender's bare genre tag names (see
 * `QUIZ_GENRE_OPTIONS` in `src/lib/recommender/tagVocabulary.ts`, e.g.
 * "sci-fi", "young-adult") into a human-friendly heading for one of
 * Discover's genre shelves, e.g. "Sci-Fi", "Young Adult".
 *
 * Kept as its own tiny module outside `src/lib/recommender/` (a display
 * concern, not scoring/matching logic, and this round's build is
 * deliberately keeping hands off that folder while other sections work in
 * it at the same time) rather than reusing `formatTagLabel` in
 * `scoring.ts`, which is shaped for a different job anyway ("fantasy" ->
 * "fantasy books" reads fine inside an explanation sentence, but a shelf
 * heading just wants the genre's own name).
 *
 * General rule: title-case each hyphen-separated word and join with a
 * space, e.g. "literary-fiction" -> "Literary Fiction". The one
 * exception is "sci-fi", where the hyphen is part of the real-world term
 * itself ("Sci-Fi", not "Sci Fi"), so it's special-cased to keep it.
 */
const HYPHEN_KEPT: Record<string, string> = {
  'sci-fi': 'Sci-Fi',
}

export function genreLabelFor(genre: string): string {
  const special = HYPHEN_KEPT[genre.toLowerCase()]
  if (special) return special

  return genre
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
