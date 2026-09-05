import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenLibraryWorkDetails, searchOpenLibraryBySubject } from './openLibrary'

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

describe('fetchOpenLibraryWorkDetails', () => {
  it('returns a plain-string description and the subject list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          description: 'A house with infinite rooms.',
          subjects: ['Fantasy fiction', 'Magic'],
        }),
      ),
    )
    expect(await fetchOpenLibraryWorkDetails('/works/OL1W')).toEqual({
      description: 'A house with infinite rooms.',
      subjects: ['Fantasy fiction', 'Magic'],
    })
  })

  it('unwraps the older {value} description shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          description: { value: 'Older-shape synopsis.' },
          subjects: [],
        }),
      ),
    )
    expect(await fetchOpenLibraryWorkDetails('/works/OL2W')).toEqual({
      description: 'Older-shape synopsis.',
      subjects: [],
    })
  })

  it('returns null when there is neither a description nor subjects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    expect(await fetchOpenLibraryWorkDetails('/works/OL3W')).toBeNull()
  })

  it('returns null rather than throwing on a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    expect(await fetchOpenLibraryWorkDetails('/works/OL4W')).toBeNull()
  })

  it('returns null rather than throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchOpenLibraryWorkDetails('/works/OL5W')).toBeNull()
  })
})
