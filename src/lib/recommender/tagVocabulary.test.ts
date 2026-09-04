import { describe, expect, it } from 'vitest'
import { genreTagToSubjectSlug } from './tagVocabulary'

describe('genreTagToSubjectSlug', () => {
  it('uses the real-world synonym phrase when one exists', () => {
    expect(genreTagToSubjectSlug('sci-fi')).toBe('science_fiction')
    expect(genreTagToSubjectSlug('literary-fiction')).toBe('literary_fiction')
    expect(genreTagToSubjectSlug('young-adult')).toBe('young_adult')
  })

  it('falls back to a plain hyphen-to-underscore conversion otherwise', () => {
    expect(genreTagToSubjectSlug('fantasy')).toBe('fantasy')
    expect(genreTagToSubjectSlug('romance')).toBe('romance')
  })
})
