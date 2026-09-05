import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Search } from './Search'

vi.mock('../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('../lib/recommender', () => ({
  getOrComputeTasteProfile: vi.fn(),
}))

vi.mock('../lib/books/openLibrary', () => ({
  searchOpenLibrary: vi.fn(),
  searchOpenLibraryBySubject: vi.fn(),
}))

const { getOrComputeTasteProfile } = await import('../lib/recommender')
const { searchOpenLibrary, searchOpenLibraryBySubject } = await import('../lib/books/openLibrary')
const mockedGetOrComputeTasteProfile = vi.mocked(getOrComputeTasteProfile)
const mockedSearchOpenLibrary = vi.mocked(searchOpenLibrary)
const mockedSearchOpenLibraryBySubject = vi.mocked(searchOpenLibraryBySubject)

function searchResult(id: string, title: string) {
  return { openLibraryId: id, title, author: null, publishedYear: null, coverUrl: null }
}

beforeEach(() => {
  vi.resetAllMocks()
  mockedGetOrComputeTasteProfile.mockResolvedValue({
    tagAffinity: {},
    avgRating: 0,
    ratedBookCount: 0,
    quiz: {
      answers: {
        genres: ['fantasy', 'romance'],
        pace: null,
        moods: [],
        fictionLean: null,
        favoriteBookIds: [],
        readingFrequency: null,
        recencyPreference: null,
      },
      tagAffinity: {},
      takenAt: '2026-01-01T00:00:00Z',
      skipped: false,
    },
  })
  mockedSearchOpenLibrary.mockResolvedValue([])
  // The "All" chip's mount-time search makes two parallel subject calls
  // (general fiction + bestsellers, round 7.4) — give both an empty,
  // successful default so mount always settles cleanly before a test
  // clicks a specific genre chip and overrides this for that call.
  mockedSearchOpenLibraryBySubject.mockResolvedValue([])
})

async function waitForMountSearchToSettle() {
  // Two calls (fiction + bestsellers) from the auto-run "All" chip.
  await waitFor(() => expect(mockedSearchOpenLibraryBySubject).toHaveBeenCalledTimes(2))
  await screen.findByText(/books? for "All"/i)
  mockedSearchOpenLibraryBySubject.mockClear()
}

describe('Search genre chips', () => {
  it('shows a chip for each quiz genre alongside All, and runs a genre-scoped search on click', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    )
    await waitForMountSearchToSettle()

    mockedSearchOpenLibraryBySubject.mockResolvedValue([searchResult('ol1', 'Some Fantasy Book')])

    const fantasyChip = await screen.findByRole('button', { name: 'Fantasy' })
    expect(screen.getByRole('button', { name: 'Romance' })).toBeInTheDocument()

    await user.click(fantasyChip)

    await waitFor(() =>
      expect(mockedSearchOpenLibraryBySubject).toHaveBeenCalledWith('fantasy', 24, 'new'),
    )
    expect(await screen.findByText('Some Fantasy Book')).toBeInTheDocument()
  })

  it('shows an error with a working retry when a genre search fails', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    )
    await waitForMountSearchToSettle()

    mockedSearchOpenLibraryBySubject
      .mockRejectedValueOnce(new Error('Open Library subject lookup failed (500).'))
      .mockResolvedValueOnce([searchResult('ol1', 'Some Fantasy Book')])

    const fantasyChip = await screen.findByRole('button', { name: 'Fantasy' })
    await user.click(fantasyChip)

    expect(await screen.findByText('Open Library subject lookup failed (500).')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Some Fantasy Book')).toBeInTheDocument()
  })
})
