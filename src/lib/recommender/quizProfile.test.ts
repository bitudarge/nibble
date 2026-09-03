import { describe, expect, it } from 'vitest'
import { buildQuizTagAffinity, matchCategoryToGenreTag } from './quizProfile'
import type { TasteQuizAnswers } from './types'

function emptyAnswers(overrides: Partial<TasteQuizAnswers> = {}): TasteQuizAnswers {
  return {
    genres: [],
    pace: null,
    moods: [],
    fictionLean: null,
    favoriteBookIds: [],
    readingFrequency: null,
    ...overrides,
  }
}

describe('matchCategoryToGenreTag', () => {
  it('matches a category that names the genre directly', () => {
    expect(matchCategoryToGenreTag('Fiction / Fantasy')).toBe('fantasy')
  })

  it('matches common real-world Google Books category phrasing via synonyms', () => {
    expect(matchCategoryToGenreTag('Fiction / Science Fiction / General')).toBe('sci-fi')
    expect(matchCategoryToGenreTag('Biography & Autobiography')).toBe('memoir')
    expect(matchCategoryToGenreTag('Juvenile Fiction / Fantasy')).toBe('fantasy')
    expect(matchCategoryToGenreTag('Comics & Graphic Novels')).toBe('graphic-novel')
  })

  it('is case-insensitive', () => {
    expect(matchCategoryToGenreTag('HORROR')).toBe('horror')
  })

  it('returns null when nothing lines up', () => {
    expect(matchCategoryToGenreTag('Cooking')).toBeNull()
  })
})

describe('buildQuizTagAffinity', () => {
  it('adds a positive contribution for each picked genre', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ genres: ['fantasy', 'mystery'] }), [])
    expect(affinity['genre:fantasy']).toBeGreaterThan(0)
    expect(affinity['genre:mystery']).toBeGreaterThan(0)
  })

  it('adds a positive contribution for the picked pace', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ pace: 'slow-burn' }), [])
    expect(affinity['pace:slow-burn']).toBeGreaterThan(0)
    expect(Object.keys(affinity)).toEqual(['pace:slow-burn'])
  })

  it('adds a positive contribution for each picked mood', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ moods: ['cozy', 'dark'] }), [])
    expect(affinity['mood:cozy']).toBeGreaterThan(0)
    expect(affinity['mood:dark']).toBeGreaterThan(0)
  })

  it('leans non-fiction and memoir when the fiction lean is nonfiction, more than for a mix', () => {
    const nonfiction = buildQuizTagAffinity(emptyAnswers({ fictionLean: 'nonfiction' }), [])
    const mixed = buildQuizTagAffinity(emptyAnswers({ fictionLean: 'mixed' }), [])
    expect(nonfiction['genre:non-fiction']).toBeGreaterThan(mixed['genre:non-fiction']!)
    expect(nonfiction['genre:memoir']).toBeGreaterThan(0)
  })

  it('contributes nothing for a "mostly fiction" lean', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ fictionLean: 'fiction' }), [])
    expect(affinity['genre:non-fiction']).toBeUndefined()
  })

  it('derives genre affinity from favorite books’ Google Books categories', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ favoriteBookIds: ['b1'] }), [
      ['Fiction', 'Fiction / Fantasy'],
    ])
    expect(affinity['genre:fantasy']).toBeGreaterThan(0)
  })

  it('only counts a genre once per book even if it appears in multiple category strings', () => {
    const affinity = buildQuizTagAffinity(emptyAnswers({ favoriteBookIds: ['b1'] }), [
      ['Fiction / Fantasy', 'Fiction / Fantasy / Epic'],
    ])
    // One favorite-book contribution, not two stacked on top of each other.
    expect(affinity['genre:fantasy']).toBeLessThan(1)
  })

  it('an explicit genre pick counts for more than an inferred one from a favorite book', () => {
    const explicit = buildQuizTagAffinity(emptyAnswers({ genres: ['fantasy'] }), [])
    const inferred = buildQuizTagAffinity(emptyAnswers({ favoriteBookIds: ['b1'] }), [
      ['Fiction / Fantasy'],
    ])
    expect(explicit['genre:fantasy']).toBeGreaterThan(inferred['genre:fantasy']!)
  })

  it('returns an empty object when every question was skipped', () => {
    expect(buildQuizTagAffinity(emptyAnswers(), [])).toEqual({})
  })
})
