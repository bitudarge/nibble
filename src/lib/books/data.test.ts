import { describe, expect, it } from 'vitest'
import { buildEnrichmentUpdate } from './data'
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
