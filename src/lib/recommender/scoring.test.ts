import { describe, expect, it } from 'vitest'
import { computeTasteOverlap, explainScore, scoreBook } from './scoring'
import type { BookTagProfile, CircleSignal, TasteProfileData } from './types'

describe('scoreBook', () => {
  it('scores a book higher when its tags match liked tags', () => {
    const taste: TasteProfileData = {
      tagAffinity: { 'genre:fantasy': 0.8, 'pace:slow-burn': -0.5 },
      avgRating: 3.5,
      ratedBookCount: 5,
    }

    const likedBook: BookTagProfile = {
      bookId: 'book-liked',
      tagCounts: { 'genre:fantasy': 4 },
    }
    const dislikedBook: BookTagProfile = {
      bookId: 'book-disliked',
      tagCounts: { 'pace:slow-burn': 4 },
    }

    const likedScore = scoreBook(taste, likedBook, [])
    const dislikedScore = scoreBook(taste, dislikedBook, [])

    expect(likedScore.score).toBeGreaterThan(dislikedScore.score)
    expect(likedScore.score).toBeGreaterThan(0)
    expect(dislikedScore.score).toBeLessThan(0)
  })

  it('returns a neutral score for a book with no matching tags', () => {
    const taste: TasteProfileData = {
      tagAffinity: { 'genre:fantasy': 0.9 },
      avgRating: 4,
      ratedBookCount: 3,
    }
    const unrelatedBook: BookTagProfile = { bookId: 'b', tagCounts: { 'genre:memoir': 2 } }

    const scored = scoreBook(taste, unrelatedBook, [])
    expect(scored.score).toBe(0)
    expect(scored.tagMatches).toHaveLength(0)
  })

  it('adds a positive contribution from a highly-rated circle signal', () => {
    const taste: TasteProfileData = { tagAffinity: {}, avgRating: 3, ratedBookCount: 0 }
    const book: BookTagProfile = { bookId: 'b', tagCounts: {} }
    const signals: CircleSignal[] = [{ memberName: 'Alex', stars: 5, overlap: 0.8 }]

    const scored = scoreBook(taste, book, signals)
    expect(scored.score).toBeGreaterThan(0)
  })

  it('weighs a higher-overlap circle-mate more than a lower-overlap one', () => {
    const taste: TasteProfileData = { tagAffinity: {}, avgRating: 3, ratedBookCount: 0 }
    const book: BookTagProfile = { bookId: 'b', tagCounts: {} }

    const highOverlap = scoreBook(taste, book, [{ memberName: 'A', stars: 5, overlap: 0.9 }])
    const lowOverlap = scoreBook(taste, book, [{ memberName: 'B', stars: 5, overlap: 0.1 }])

    expect(highOverlap.score).toBeGreaterThan(lowOverlap.score)
  })
})

describe('computeTasteOverlap', () => {
  it('returns 1 for identical ratings on every shared book', () => {
    const mine = new Map([
      ['a', 5],
      ['b', 3],
    ])
    const theirs = new Map([
      ['a', 5],
      ['b', 3],
    ])
    expect(computeTasteOverlap(mine, theirs)).toBe(1)
  })

  it('returns 0 for maximally opposite ratings', () => {
    const mine = new Map([['a', 5]])
    const theirs = new Map([['a', 0.5]])
    expect(computeTasteOverlap(mine, theirs)).toBe(0)
  })

  it('returns 0 when there are no books rated in common', () => {
    const mine = new Map([['a', 5]])
    const theirs = new Map([['b', 5]])
    expect(computeTasteOverlap(mine, theirs)).toBe(0)
  })

  it('scores partial agreement between the extremes', () => {
    const mine = new Map([
      ['a', 5],
      ['b', 4],
    ])
    const theirs = new Map([
      ['a', 4],
      ['b', 2],
    ])
    const overlap = computeTasteOverlap(mine, theirs)
    expect(overlap).toBeGreaterThan(0)
    expect(overlap).toBeLessThan(1)
  })
})

describe('explainScore', () => {
  it('explains a tag-driven recommendation in plain language', () => {
    const scored = scoreBook(
      { tagAffinity: { 'genre:fantasy': 0.9 }, avgRating: 4, ratedBookCount: 5 },
      { bookId: 'b', tagCounts: { 'genre:fantasy': 3 } },
      [],
    )
    const why = explainScore(scored)
    expect(why[0]).toMatch(/fantasy/)
  })

  it('explains a circle-driven recommendation with the member name and overlap', () => {
    const scored = scoreBook(
      { tagAffinity: {}, avgRating: 3, ratedBookCount: 0 },
      { bookId: 'b', tagCounts: {} },
      [{ memberName: 'Jordan', stars: 5, overlap: 0.75 }],
    )
    const why = explainScore(scored)
    expect(why.some((r) => r.includes('Jordan') && r.includes('75%'))).toBe(true)
  })

  it('omits the overlap percentage when there is no shared-rating history', () => {
    const scored = scoreBook(
      { tagAffinity: {}, avgRating: 3, ratedBookCount: 0 },
      { bookId: 'b', tagCounts: {} },
      [{ memberName: 'Sam', stars: 5, overlap: 0 }],
    )
    const why = explainScore(scored)
    expect(why.some((r) => r.includes('Sam'))).toBe(true)
    expect(why.some((r) => r.includes('%'))).toBe(false)
  })

  it('falls back to an honest "not enough data" reason rather than inventing one', () => {
    const scored = scoreBook(
      { tagAffinity: {}, avgRating: 3, ratedBookCount: 0 },
      { bookId: 'b', tagCounts: {} },
      [],
    )
    const why = explainScore(scored)
    expect(why).toHaveLength(1)
    expect(why[0]).toMatch(/don't have a specific reason/)
  })

  it('never surfaces a negative tag match as a positive reason', () => {
    const scored = scoreBook(
      { tagAffinity: { 'pace:slow-burn': -0.8 }, avgRating: 3, ratedBookCount: 5 },
      { bookId: 'b', tagCounts: { 'pace:slow-burn': 5 } },
      [],
    )
    const why = explainScore(scored)
    expect(why.some((r) => r.includes('slow-burn'))).toBe(false)
  })
})
