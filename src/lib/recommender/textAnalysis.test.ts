import { describe, expect, it } from 'vitest'
import { analyzeSentiment, extractKeywords } from './textAnalysis'

describe('analyzeSentiment', () => {
  it('scores clearly positive text near +1', () => {
    expect(analyzeSentiment('I loved this book, it was amazing and beautiful.')).toBeCloseTo(1)
  })

  it('scores clearly negative text near -1', () => {
    expect(analyzeSentiment('This was boring, dull, and honestly a waste of time.')).toBeCloseTo(-1)
  })

  it('scores mixed text between the extremes', () => {
    const score = analyzeSentiment('I loved the characters but the pacing was slow and tedious.')
    expect(score).toBeGreaterThan(-1)
    expect(score).toBeLessThan(1)
  })

  it('returns 0 for text with no sentiment words', () => {
    expect(analyzeSentiment('The protagonist travels to a small coastal town.')).toBe(0)
  })

  it('returns 0 for empty text', () => {
    expect(analyzeSentiment('')).toBe(0)
  })
})

describe('extractKeywords', () => {
  it('picks out repeated subject words, ignoring stopwords', () => {
    const keywords = extractKeywords(
      'The dragons in this story were incredible. I want more dragons and more found-family moments — the found family made the dragons even better.',
    )
    expect(keywords).toContain('dragons')
    expect(keywords).toContain('found-family')
  })

  it('excludes sentiment words from the keyword list', () => {
    const keywords = extractKeywords('amazing amazing amazing wonderful wonderful')
    expect(keywords).not.toContain('amazing')
    expect(keywords).not.toContain('wonderful')
  })

  it('respects the limit', () => {
    const keywords = extractKeywords(
      'apples apples bananas bananas cherries cherries dates dates elderberries elderberries',
      2,
    )
    expect(keywords).toHaveLength(2)
  })

  it('returns an empty array for short/empty text', () => {
    expect(extractKeywords('')).toEqual([])
  })
})
