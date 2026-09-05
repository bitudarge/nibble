import type { BookTagProfile, CircleSignal, ScoredBook, TagMatch, TasteProfileData } from './types'

/**
 * The generic filler explainScore falls back to when a scored candidate
 * has no real tag or circle signal at all. Exported so recommend.ts can
 * filter these out by exact match rather than duplicating the string (or
 * guessing at reasons.length === 0 some other way).
 */
export const NO_REASON_YET_MESSAGE =
  "We don't have a specific reason yet. Rate a few books or take the taste quiz to help us explain picks better."

/** How much a circle-mate's rating counts relative to the user's own tag-based taste. Tune here. */
const CIRCLE_SIGNAL_WEIGHT = 0.5

/**
 * Pure scoring function — no I/O, easy to unit-test with fixtures. Combines
 * two signals:
 *  1. Tag match: how much this book's tags line up with tags the user has
 *     historically rated above/below their own average.
 *  2. Circle signal: whether circle-mates (weighted by taste overlap) rated
 *     this book highly.
 */
export function scoreBook(
  tasteProfile: TasteProfileData,
  bookTagProfile: BookTagProfile,
  circleSignals: CircleSignal[],
): ScoredBook {
  const totalTagMentions =
    Object.values(bookTagProfile.tagCounts).reduce((sum, count) => sum + count, 0) || 1

  // A tag counts as "from the quiz" if it's in the quiz's own tagAffinity
  // map — that map only ever holds quiz-derived entries (see
  // buildQuizTagAffinity in quizProfile.ts), so this is an exact check,
  // not a guess. A tag can be both quiz-picked and later reinforced by
  // ratings; explainScore treats "the quiz said so" as the honest framing
  // either way, since that's always true regardless of whether ratings
  // also agree.
  const quizTagAffinity = tasteProfile.quiz?.tagAffinity ?? {}

  const tagMatches: TagMatch[] = Object.entries(bookTagProfile.tagCounts)
    .map(([tag, count]) => {
      const bookWeight = count / totalTagMentions
      const userAffinity = tasteProfile.tagAffinity[tag] ?? 0
      return { tag, contribution: bookWeight * userAffinity, fromQuiz: tag in quizTagAffinity }
    })
    .filter((match) => Math.abs(match.contribution) > 0.001)
    .sort((a, b) => b.contribution - a.contribution)

  const tagScore = tagMatches.reduce((sum, match) => sum + match.contribution, 0)

  const circleScore = circleSignals.reduce(
    (sum, signal) => sum + (signal.stars / 5) * signal.overlap,
    0,
  )

  return {
    bookId: bookTagProfile.bookId,
    score: tagScore + circleScore * CIRCLE_SIGNAL_WEIGHT,
    tagMatches,
    circleSignals,
  }
}

const MAX_POSSIBLE_RATING_GAP = 4.5 // 5.0 - 0.5, the widest possible half-star gap

/**
 * How similarly two people rate the books they've BOTH read, in [0, 1].
 * Deliberately based only on `ratings` (globally readable per RLS, see
 * schema) — never on comparing each other's private taste_profiles, which
 * a user can't read anyway. No books rated in common yet -> 0: an honest
 * "we don't know" rather than a guess.
 */
export function computeTasteOverlap(
  myRatings: Map<string, number>,
  theirRatings: Map<string, number>,
): number {
  const sharedBookIds = [...myRatings.keys()].filter((id) => theirRatings.has(id))
  if (sharedBookIds.length === 0) return 0

  const diffs = sharedBookIds.map((id) => {
    const mine = myRatings.get(id)
    const theirs = theirRatings.get(id)
    return mine !== undefined && theirs !== undefined ? Math.abs(mine - theirs) : 0
  })
  const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length
  return Math.max(0, 1 - avgDiff / MAX_POSSIBLE_RATING_GAP)
}

function formatTagLabel(tag: string): string {
  const [type, name] = tag.split(':')
  if (!name) return tag
  switch (type) {
    case 'genre':
      return `${name} books`
    case 'mood':
      return `${name} stories`
    case 'pace':
      return `${name} pacing`
    case 'spice_level':
      return `${name} spice level`
    default:
      return name
  }
}

function joinLabels(labels: string[]): string {
  return labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

/** Turns a ScoredBook into the plain-language "why" — never a black box. */
export function explainScore(scored: ScoredBook): string[] {
  const reasons: string[] = []

  const positiveMatches = scored.tagMatches.filter((m) => m.contribution > 0).slice(0, 2)
  if (positiveMatches.length > 0) {
    // Split by origin rather than treating every positive match the same
    // way: saying "you've rated cozy books highly before" to someone who
    // took the quiz and has never rated a single book isn't just vague,
    // it's false. Each half only gets a sentence if it actually has
    // matches, so a quiz-only user (the common day-one case) gets a
    // quiz-framed reason instead of a silently-wrong rating-framed one.
    const fromQuiz = positiveMatches.filter((m) => m.fromQuiz)
    const fromRatings = positiveMatches.filter((m) => !m.fromQuiz)

    if (fromQuiz.length > 0) {
      reasons.push(`You said you like ${joinLabels(fromQuiz.map((m) => formatTagLabel(m.tag)))}.`)
    }
    if (fromRatings.length > 0) {
      reasons.push(
        `You've rated ${joinLabels(fromRatings.map((m) => formatTagLabel(m.tag)))} highly before.`,
      )
    }
  }

  for (const signal of scored.circleSignals) {
    if (signal.stars < 4) continue
    if (signal.overlap > 0) {
      reasons.push(
        `${signal.memberName} rated this ${signal.stars}★. You two agree on ${Math.round(signal.overlap * 100)}% of books you've both read.`,
      )
    } else {
      reasons.push(`${signal.memberName} in your circle rated this ${signal.stars}★.`)
    }
  }

  if (reasons.length === 0) {
    reasons.push(NO_REASON_YET_MESSAGE)
  }

  return reasons
}
