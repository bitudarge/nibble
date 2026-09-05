import { describe, expect, it } from 'vitest'
import { NO_REASON_YET_MESSAGE } from './scoring'
import {
  hasCircleSignal,
  hasRealReason,
  needsFallback,
  recentShelfAuthors,
  topGenreAffinities,
} from './recommend'
import type { CircleSignal, TasteProfileData } from './types'

function profile(overrides: Partial<TasteProfileData> = {}): TasteProfileData {
  return { tagAffinity: {}, avgRating: 0, ratedBookCount: 0, ...overrides }
}

describe('needsFallback', () => {
  it('is true for a brand new user with no ratings and no quiz signal', () => {
    expect(needsFallback(profile())).toBe(true)
  })

  it('is false once enough books are rated, even with no quiz signal', () => {
    expect(needsFallback(profile({ ratedBookCount: 3 }))).toBe(false)
  })

  it('is false for a quiz-seeded user with zero ratings — the whole point of the quiz', () => {
    expect(
      needsFallback(profile({ ratedBookCount: 0, tagAffinity: { 'genre:fantasy': 0.7 } })),
    ).toBe(false)
  })

  it('is true just below the rating threshold with no quiz signal either', () => {
    expect(needsFallback(profile({ ratedBookCount: 2 }))).toBe(true)
  })
})

describe('topGenreAffinities', () => {
  it('returns genres most-liked first', () => {
    expect(
      topGenreAffinities({
        'genre:fantasy': 0.4,
        'genre:romance': 0.9,
        'genre:horror': 0.6,
      }),
    ).toEqual(['romance', 'horror', 'fantasy'])
  })

  it('ignores non-genre tags and disliked genres', () => {
    expect(
      topGenreAffinities({
        'genre:fantasy': 0.5,
        'pace:slow-burn': 0.8,
        'genre:horror': -0.2,
      }),
    ).toEqual(['fantasy'])
  })

  it('respects the limit', () => {
    expect(
      topGenreAffinities({ 'genre:fantasy': 0.9, 'genre:romance': 0.8, 'genre:horror': 0.7 }, 2),
    ).toEqual(['fantasy', 'romance'])
  })

  it('returns nothing for an empty or all-negative profile', () => {
    expect(topGenreAffinities({})).toEqual([])
    expect(topGenreAffinities({ 'genre:horror': -0.5 })).toEqual([])
  })
})

describe('hasCircleSignal', () => {
  const aSignal: CircleSignal = { memberName: 'Sam', stars: 4, overlap: 0.5 }

  it('is false when no circle-mate has rated the book', () => {
    expect(hasCircleSignal({ circleSignals: [] })).toBe(false)
  })

  it('is true when at least one circle-mate has a signal', () => {
    expect(hasCircleSignal({ circleSignals: [aSignal] })).toBe(true)
  })

  it('is true for multiple circle signals, not just exactly one', () => {
    expect(
      hasCircleSignal({
        circleSignals: [aSignal, { memberName: 'Alex', stars: 2, overlap: 0 }],
      }),
    ).toBe(true)
  })
})

describe('hasRealReason', () => {
  it('is false when the only reason is the generic no-signal filler', () => {
    expect(hasRealReason([NO_REASON_YET_MESSAGE])).toBe(false)
  })

  it('is true for a real tag- or circle-derived reason', () => {
    expect(hasRealReason(['You said you like cozy mysteries.'])).toBe(true)
  })

  it('is true when a real reason sits alongside the filler somehow', () => {
    expect(hasRealReason(['You said you like cozy mysteries.', NO_REASON_YET_MESSAGE])).toBe(true)
  })

  it('is false for an empty reasons list', () => {
    expect(hasRealReason([])).toBe(false)
  })
})

describe('recentShelfAuthors', () => {
  function shelfItem(updatedAt: string, author: string | null) {
    return { updated_at: updatedAt, books: { author } }
  }

  it('returns authors most-recently-updated first', () => {
    const items = [
      shelfItem('2026-01-01T00:00:00Z', 'Old Author'),
      shelfItem('2026-01-03T00:00:00Z', 'Newest Author'),
      shelfItem('2026-01-02T00:00:00Z', 'Middle Author'),
    ]
    expect(recentShelfAuthors(items)).toEqual(['Newest Author', 'Middle Author', 'Old Author'])
  })

  it('dedupes the same author, keeping only their most recent appearance', () => {
    const items = [
      shelfItem('2026-01-01T00:00:00Z', 'Same Author'),
      shelfItem('2026-01-02T00:00:00Z', 'Same Author'),
    ]
    expect(recentShelfAuthors(items)).toEqual(['Same Author'])
  })

  it('skips shelf items with no known author', () => {
    const items = [
      shelfItem('2026-01-01T00:00:00Z', null),
      shelfItem('2026-01-02T00:00:00Z', 'Known Author'),
    ]
    expect(recentShelfAuthors(items)).toEqual(['Known Author'])
  })

  it('returns an empty list for an empty shelf', () => {
    expect(recentShelfAuthors([])).toEqual([])
  })
})
