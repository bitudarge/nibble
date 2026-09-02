import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoogleBooksDetails } from './googleBooks'

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchGoogleBooksDetails', () => {
  it('returns the details of the first title-matching volume', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              volumeInfo: {
                title: 'Piranesi',
                description: 'A house with infinite rooms.',
                categories: ['Fiction', 'Fantasy'],
                pageCount: 245,
                publishedDate: '2020-09-15',
                imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
              },
            },
          ],
        }),
      ),
    )

    const details = await fetchGoogleBooksDetails('Piranesi', 'Susanna Clarke')

    expect(details).toEqual({
      description: 'A house with infinite rooms.',
      categories: ['Fiction', 'Fantasy'],
      pageCount: 245,
      publishedYear: 2020,
      // http:// upgraded to https:// since the app is served over https.
      coverUrl: 'https://books.google.com/cover.jpg',
    })
  })

  it('skips a result whose title does not match at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [{ volumeInfo: { title: 'Some Completely Unrelated Book' } }],
        }),
      ),
    )

    expect(await fetchGoogleBooksDetails('Piranesi', null)).toBeNull()
  })

  it('returns null when there are no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [] })))
    expect(await fetchGoogleBooksDetails('Nonexistent Book Title', null)).toBeNull()
  })

  it('returns null instead of throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchGoogleBooksDetails('Piranesi', null)).toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)))
    expect(await fetchGoogleBooksDetails('Piranesi', null)).toBeNull()
  })

  it('only appends the key param when VITE_GOOGLE_BOOKS_API_KEY is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchGoogleBooksDetails('Piranesi', null)

    const calledUrl = fetchMock.mock.calls[0]?.[0] as URL
    expect(calledUrl.searchParams.has('key')).toBe(false)
  })
})
