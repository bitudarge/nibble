import { describe, expect, it } from 'vitest'
import { QUIZ_GENRE_OPTIONS } from '../recommender/tagVocabulary'
import { genreLabelFor } from './genreLabel'

describe('genreLabelFor', () => {
  it('title-cases a plain genre', () => {
    expect(genreLabelFor('fantasy')).toBe('Fantasy')
    expect(genreLabelFor('romance')).toBe('Romance')
  })

  it('title-cases every hyphen-separated word for a multi-word genre', () => {
    expect(genreLabelFor('young-adult')).toBe('Young Adult')
    expect(genreLabelFor('literary-fiction')).toBe('Literary Fiction')
    expect(genreLabelFor('historical-fiction')).toBe('Historical Fiction')
    expect(genreLabelFor('graphic-novel')).toBe('Graphic Novel')
  })

  it('special-cases sci-fi to keep the hyphen', () => {
    expect(genreLabelFor('sci-fi')).toBe('Sci-Fi')
  })

  it('produces a non-empty label for every genre in the quiz vocabulary', () => {
    for (const genre of QUIZ_GENRE_OPTIONS) {
      expect(genreLabelFor(genre).length).toBeGreaterThan(0)
    }
  })
})
