import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenLibraryBySubject } from './openLibrary'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchOpenLibraryBySubject', () => {
  it('maps subject works into search results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          works: [
            {
              key: '/works/OL82586W',
              title: 'The Hobbit',
              authors: [{ name: 'J.R.R. Tolkien' }],
              cover_id: 258104,
              first_publish_year: 1937,
            },
          ],
        }),
      ),
    )

    expect(await searchOpenLibraryBySubject('fantasy')).toEqual([
      {
        openLibraryId: '/works/OL82586W',
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        publishedYear: 1937,
        coverUrl: 'https://covers.openlibrary.org/b/id/258104-M.jpg',
      },
    ])
  })

  it('skips works with no key or title and handles a missing cover/author', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          works: [
            { key: '', title: 'No key' },
            { key: '/works/OL1W', title: '' },
            { key: '/works/OL2W', title: 'Bare Bones' },
          ],
        }),
      ),
    )

    expect(await searchOpenLibraryBySubject('romance')).toEqual([
      {
        openLibraryId: '/works/OL2W',
        title: 'Bare Bones',
        author: null,
        publishedYear: null,
        coverUrl: null,
      },
    ])
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    await expect(searchOpenLibraryBySubject('horror')).rejects.toThrow(
      'Open Library subject lookup failed (500).',
    )
  })
})
