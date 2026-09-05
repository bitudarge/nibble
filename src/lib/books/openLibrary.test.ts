import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchOpenLibraryPageCount,
  fetchOpenLibraryWorkDetails,
  searchOpenLibraryBySubject,
} from './openLibrary'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchOpenLibraryBySubject', () => {
  it('maps subject search docs into search results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
            {
              key: '/works/OL82586W',
              title: 'The Hobbit',
              author_name: ['J.R.R. Tolkien'],
              cover_i: 258104,
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

  it('queries by subject and restricts to English-language editions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await searchOpenLibraryBySubject('science_fiction', 10)
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('q')).toBe('subject:science_fiction')
    expect(url.searchParams.get('language')).toBe('eng')
  })

  it('omits the sort param by default, leaving Open Library its own ordering', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await searchOpenLibraryBySubject('fantasy', 10)
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.has('sort')).toBe(false)
  })

  it('passes sort=new through when asked for the newest first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await searchOpenLibraryBySubject('fantasy', 10, 'new')
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('sort')).toBe('new')
  })

  it('passes sort=old through when asked for the oldest first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await searchOpenLibraryBySubject('fantasy', 10, 'old')
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('sort')).toBe('old')
  })

  it('skips docs with no key or title and handles a missing cover/author', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
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

  it('filters out titles that are not in Latin script, as a backstop past the language param', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          docs: [
            { key: '/works/OL1W', title: '曉のヨナ' },
            { key: '/works/OL2W', title: 'Преступление и наказание' },
            { key: '/works/OL3W', title: 'The Hobbit' },
            { key: '/works/OL4W', title: "L'Étranger" },
          ],
        }),
      ),
    )

    const titles = (await searchOpenLibraryBySubject('fiction')).map((r) => r.title)
    expect(titles).toEqual(['The Hobbit', "L'Étranger"])
  })

  it('over-fetches so language-filtering still leaves close to the requested limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await searchOpenLibraryBySubject('fantasy', 10)
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('limit')).toBe('30')
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

describe('fetchOpenLibraryPageCount', () => {
  it('prefers the most common page count among English-language editions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          entries: [
            { number_of_pages: 774, languages: [{ key: '/languages/ger' }] },
            { number_of_pages: 759, languages: [{ key: '/languages/eng' }] },
            { number_of_pages: 759, languages: [{ key: '/languages/eng' }] },
            { number_of_pages: 320, languages: [{ key: '/languages/eng' }] },
          ],
        }),
      ),
    )
    expect(await fetchOpenLibraryPageCount('/works/OL1W')).toBe(759)
  })

  it('treats an edition with no languages field as English', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          entries: [
            { number_of_pages: 300 },
            { number_of_pages: 774, languages: [{ key: '/languages/ger' }] },
          ],
        }),
      ),
    )
    expect(await fetchOpenLibraryPageCount('/works/OL2W')).toBe(300)
  })

  it('falls back to the mode across every edition when none are English', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          entries: [
            { number_of_pages: 590, languages: [{ key: '/languages/por' }] },
            { number_of_pages: 590, languages: [{ key: '/languages/spa' }] },
            { number_of_pages: 678, languages: [{ key: '/languages/ita' }] },
          ],
        }),
      ),
    )
    expect(await fetchOpenLibraryPageCount('/works/OL3W')).toBe(590)
  })

  it('returns null when no edition has a usable page count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ entries: [{}, {}] })))
    expect(await fetchOpenLibraryPageCount('/works/OL4W')).toBeNull()
  })

  it('returns null rather than throwing on a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    expect(await fetchOpenLibraryPageCount('/works/OL5W')).toBeNull()
  })

  it('returns null rather than throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchOpenLibraryPageCount('/works/OL6W')).toBeNull()
  })
})
