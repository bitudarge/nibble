import { describe, expect, it } from 'vitest'
import { needsFallback } from './recommend'
import type { TasteProfileData } from './types'

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
