/**
 * What the onboarding taste quiz collected, in the shape it's edited in.
 * `genres`/`pace`/`moods` are bare tag names (no "genre:"/"pace:"/"mood:"
 * prefix) — see quizProfile.ts for where those get turned into tag keys.
 * `favoriteBookIds` are real `books.id` rows (resolved via getOrCreateBook
 * when picked), not raw search results.
 */
export interface TasteQuizAnswers {
  genres: string[]
  pace: string | null
  moods: string[]
  fictionLean: 'fiction' | 'mixed' | 'nonfiction' | null
  favoriteBookIds: string[]
  /** Informational only (not scored) — see quizProfile.ts. */
  readingFrequency: string | null
}

/** The quiz's contribution to a taste profile: the raw answers (for re-editing) plus what they were turned into. */
export interface TasteQuizProfile {
  answers: TasteQuizAnswers
  tagAffinity: Record<string, number>
  takenAt: string
  /** True if the user exited early rather than reaching the final step — still saved with whatever was answered, just a flag for future "finish it up?" UI, not used to zero anything out. */
  skipped: boolean
}

/** A user's computed reading preferences — the shape stored in taste_profiles.profile. */
export interface TasteProfileData {
  /** e.g. "genre:fantasy" -> 0.8 (loved), "pace:slow-burn" -> -0.3 (disliked). Roughly -1..1, combines quiz + rating signal, see tasteProfile.ts's mergeTagAffinity. */
  tagAffinity: Record<string, number>
  avgRating: number
  ratedBookCount: number
  /** Present once the user has taken or skipped the quiz — see quizProfile.ts. */
  quiz?: TasteQuizProfile
}

/** How often each tag was used across the reviews of one book — the book's "identity". */
export interface BookTagProfile {
  bookId: string
  tagCounts: Record<string, number>
}

/** One circle-mate's rating of a candidate book, plus how much their taste overlaps the viewer's. */
export interface CircleSignal {
  memberName: string
  stars: number
  /** 0..1, based on agreement on books you've both rated — see circleSignals.ts. 0 if no overlap data. */
  overlap: number
}

export interface TagMatch {
  tag: string
  contribution: number
  /**
   * True when this tag's affinity came from the taste quiz rather than
   * ratings (see scoreBook in scoring.ts) — explainScore uses this so it
   * never says "you've rated X highly before" for a tag a zero-rating
   * quiz-only user has never actually rated anything with, that would be
   * false, not just vague, and this app's whole identity is not being a
   * black box.
   */
  fromQuiz: boolean
}

export interface ScoredBook {
  bookId: string
  score: number
  tagMatches: TagMatch[]
  circleSignals: CircleSignal[]
}
