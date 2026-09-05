import { describe, expect, it } from 'vitest'
import { buildEnrichmentUpdate, hasUsefulEnrichment, mergeEnrichmentSources } from './data'
import type { Book } from '../../types/database'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    open_library_id: 'OL1W',
    title: 'Piranesi',
    author: 'Susanna Clarke',
    cover_url: null,
    published_year: null,
    page_count: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildEnrichmentUpdate', () => {
  it('fills in page count, year, and cover when Open Library had none', () => {
    const update = buildEnrichmentUpdate(makeBook(), {
      description: 'A house with infinite rooms.',
      categories: ['Fiction'],
      pageCount: 245,
      publishedYear: 2020,
      coverUrl: 'https://example.com/cover.jpg',
    })

    expect(update.page_count).toBe(245)
    expect(update.published_year).toBe(2020)
    expect(update.cover_url).toBe('https://example.com/cover.jpg')
  })

  it('never overwrites fields Open Library already had', () => {
    const book = makeBook({
      page_count: 300,
      published_year: 1999,
      cover_url: 'https://ol.example/cover.jpg',
    })
    const update = buildEnrichmentUpdate(book, {
      description: null,
      categories: [],
      pageCount: 245,
      publishedYear: 2020,
      coverUrl: 'https://google.example/cover.jpg',
    })

    expect(update.page_count).toBeUndefined()
    expect(update.published_year).toBeUndefined()
    expect(update.cover_url).toBeUndefined()
  })

  it('marks the book enriched even when Google Books found nothing', () => {
    const update = buildEnrichmentUpdate(makeBook(), null)

    expect(update.metadata).toMatchObject({ enriched: true, description: null, categories: [] })
    expect(update.page_count).toBeUndefined()
  })

  it('preserves existing metadata fields alongside the new ones', () => {
    const book = makeBook({ metadata: { someOtherFlag: true } })
    const update = buildEnrichmentUpdate(book, {
      description: 'A synopsis.',
      categories: ['Fantasy'],
      pageCount: null,
      publishedYear: null,
      coverUrl: null,
    })

    expect(update.metadata).toMatchObject({
      someOtherFlag: true,
      enriched: true,
      description: 'A synopsis.',
      categories: ['Fantasy'],
    })
  })
})

describe('mergeEnrichmentSources', () => {
  it('returns Google Books data unchanged when there is no fallback', () => {
    const google = {
      description: 'A synopsis.',
      categories: ['Fantasy'],
      pageCount: 245,
      publishedYear: 2020,
      coverUrl: null,
    }
    expect(mergeEnrichmentSources(google, null)).toBe(google)
  })

  it('fills in description and subjects from Open Library when Google had nothing', () => {
    const merged = mergeEnrichmentSources(null, {
      description: 'From Open Library.',
      subjects: ['Fantasy fiction', 'Magic'],
    })
    expect(merged).toEqual({
      description: 'From Open Library.',
      categories: ['Fantasy fiction', 'Magic'],
      pageCount: null,
      publishedYear: null,
      coverUrl: null,
    })
  })

  it('never overwrites a Google description or categories that already exist', () => {
    const merged = mergeEnrichmentSources(
      {
        description: 'Google synopsis.',
        categories: ['Sci-Fi'],
        pageCount: 300,
        publishedYear: 1999,
        coverUrl: null,
      },
      { description: 'Open Library synopsis.', subjects: ['Fantasy fiction'] },
    )
    expect(merged?.description).toBe('Google synopsis.')
    expect(merged?.categories).toEqual(['Sci-Fi'])
  })

  it('fills only the missing half when Google has one but not the other', () => {
    const merged = mergeEnrichmentSources(
      {
        description: null,
        categories: ['Sci-Fi'],
        pageCount: null,
        publishedYear: null,
        coverUrl: null,
      },
      { description: 'Open Library synopsis.', subjects: ['Fantasy fiction'] },
    )
    expect(merged?.description).toBe('Open Library synopsis.')
    expect(merged?.categories).toEqual(['Sci-Fi'])
  })
})

describe('hasUsefulEnrichment', () => {
  it('is false when both description and categories are empty', () => {
    expect(hasUsefulEnrichment(makeBook({ metadata: { description: null, categories: [] } }))).toBe(
      false,
    )
  })

  it('is true when there is a description, even with no categories', () => {
    expect(
      hasUsefulEnrichment(makeBook({ metadata: { description: 'A synopsis.', categories: [] } })),
    ).toBe(true)
  })

  it('is true when there are categories, even with no description', () => {
    expect(
      hasUsefulEnrichment(makeBook({ metadata: { description: null, categories: ['Fantasy'] } })),
    ).toBe(true)
  })

  it('is false for a book with no metadata at all yet', () => {
    expect(hasUsefulEnrichment(makeBook({ metadata: {} }))).toBe(false)
  })
})
