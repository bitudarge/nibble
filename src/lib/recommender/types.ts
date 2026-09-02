/** A user's computed reading preferences — the shape stored in taste_profiles.profile. */
export interface TasteProfileData {
  /** e.g. "genre:fantasy" -> 0.8 (loved), "pace:slow-burn" -> -0.3 (disliked). Roughly -1..1. */
  tagAffinity: Record<string, number>
  avgRating: number
  ratedBookCount: number
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
}

export interface ScoredBook {
  bookId: string
  score: number
  tagMatches: TagMatch[]
  circleSignals: CircleSignal[]
}
