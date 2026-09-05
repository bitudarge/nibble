import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book } from '../../types/database'
import { getOrCreateBook } from '../books/data'
import { searchOpenLibraryBySubject } from '../books/openLibrary'
import { discoverBooksForGenres, discoverPopularBooks } from './discovery'

vi.mock('../books/data', () => ({
  getOrCreateBook: vi.fn(),
}))
vi.mock('../books/openLibrary', () => ({
  searchOpenLibraryBySubject: vi.fn(),
}))

function book(id: string, openLibraryId: string): Book {
  return {
    id,
    open_library_id: openLibraryId,
    title: `Book ${id}`,
    author: null,
    cover_url: null,
    published_year: null,
    page_count: null,
    metadata: { enriched: true, description: null, categories: [] },
    created_at: '2026-01-01T00:00:00Z',
  } as Book
}

function searchResult(openLibraryId: string) {
  return {
    openLibraryId,
    title: `Book ${openLibraryId}`,
    author: null,
    publishedYear: null,
    coverUrl: null,
  }
}

const mockedSearch = vi.mocked(searchOpenLibraryBySubject)
const mockedGetOrCreate = vi.mocked(getOrCreateBook)

beforeEach(() => {
  mockedSearch.mockReset()
  mockedGetOrCreate.mockReset()
})

describe('discoverBooksForGenres', () => {
  it('returns nothing when there are no genres to search', async () => {
    expect(await discoverBooksForGenres([], new Set())).toEqual([])
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('searches Open Library per genre and creates a book for each new result', async () => {
    mockedSearch.mockImplementation(async (slug) => [searchResult(`${slug}-1`)])
    mockedGetOrCreate.mockImplementation(async (result) =>
      book('b-' + result.openLibraryId, result.openLibraryId),
    )

    const discovered = await discoverBooksForGenres(['fantasy', 'romance'], new Set())

    expect(mockedSearch).toHaveBeenCalledWith('fantasy', 8, 'new')
    expect(mockedSearch).toHaveBeenCalledWith('romance', 8, 'new')
    expect(discovered.map((b) => b.id)).toEqual(['b-fantasy-1', 'b-romance-1'])
  })

  it('defaults to sorting newest-first, even with no recency answer at all', async () => {
    mockedSearch.mockResolvedValue([])
    await discoverBooksForGenres(['fantasy'], new Set())
    expect(mockedSearch).toHaveBeenCalledWith('fantasy', 8, 'new')
  })

  it('still sorts newest-first for an explicit "newer" or "no-preference" answer', async () => {
    mockedSearch.mockResolvedValue([])
    await discoverBooksForGenres(['fantasy'], new Set(), 'newer')
    expect(mockedSearch).toHaveBeenLastCalledWith('fantasy', 8, 'new')
    await discoverBooksForGenres(['fantasy'], new Set(), 'no-preference')
    expect(mockedSearch).toHaveBeenLastCalledWith('fantasy', 8, 'new')
  })

  it('sorts oldest-first only for an explicit "classics" answer', async () => {
    mockedSearch.mockResolvedValue([])
    await discoverBooksForGenres(['fantasy'], new Set(), 'classics')
    expect(mockedSearch).toHaveBeenLastCalledWith('fantasy', 8, 'old')
  })

  it('excludes books already in the candidate pool or on the shelf', async () => {
    mockedSearch.mockResolvedValue([searchResult('ol1'), searchResult('ol2')])
    mockedGetOrCreate.mockImplementation(async (result) =>
      book('b-' + result.openLibraryId, result.openLibraryId),
    )

    const discovered = await discoverBooksForGenres(['fantasy'], new Set(['b-ol1']))

    expect(discovered.map((b) => b.id)).toEqual(['b-ol2'])
  })

  it('skips a genre whose search fails and a book that fails to save, without throwing', async () => {
    mockedSearch.mockImplementation(async (slug) => {
      if (slug === 'fantasy') throw new Error('network error')
      return [searchResult('ol1'), searchResult('ol2')]
    })
    mockedGetOrCreate.mockImplementation(async (result) => {
      if (result.openLibraryId === 'ol1') throw new Error('save failed')
      return book('b-ol2', 'ol2')
    })

    const discovered = await discoverBooksForGenres(['fantasy', 'romance'], new Set())

    expect(discovered.map((b) => b.id)).toEqual(['b-ol2'])
  })

  it('deduplicates the same Open Library id showing up under two genres', async () => {
    mockedSearch.mockResolvedValue([searchResult('ol1')])
    mockedGetOrCreate.mockImplementation(async (result) =>
      book('b-' + result.openLibraryId, result.openLibraryId),
    )

    const discovered = await discoverBooksForGenres(['fantasy', 'romance'], new Set())

    expect(mockedGetOrCreate).toHaveBeenCalledTimes(1)
    expect(discovered).toHaveLength(1)
  })
})

describe('discoverPopularBooks', () => {
  it('searches the bestseller subject, newest first', async () => {
    mockedSearch.mockResolvedValue([])
    await discoverPopularBooks(new Set())
    expect(mockedSearch).toHaveBeenCalledWith('new_york_times_bestseller', 8, 'new')
  })

  it('creates a book for each result and excludes ones already in the pool', async () => {
    mockedSearch.mockResolvedValue([searchResult('ol1'), searchResult('ol2')])
    mockedGetOrCreate.mockImplementation(async (result) =>
      book('b-' + result.openLibraryId, result.openLibraryId),
    )

    const discovered = await discoverPopularBooks(new Set(['b-ol1']))

    expect(discovered.map((b) => b.id)).toEqual(['b-ol2'])
  })

  it('returns nothing rather than throwing when the search fails', async () => {
    mockedSearch.mockRejectedValue(new Error('network error'))
    expect(await discoverPopularBooks(new Set())).toEqual([])
  })
})
