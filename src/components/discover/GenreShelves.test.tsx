import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenLibraryBySubject } from '../../lib/books/openLibrary'
import { GenreShelves } from './GenreShelves'

vi.mock('../../lib/books/openLibrary', () => ({
  searchOpenLibraryBySubject: vi.fn(),
}))

const mockedSearch = vi.mocked(searchOpenLibraryBySubject)

function result(id: string, title = `Book ${id}`) {
  return { openLibraryId: id, title, author: 'Some Author', publishedYear: null, coverUrl: null }
}

afterEach(() => {
  mockedSearch.mockReset()
})

describe('GenreShelves', () => {
  it('renders nothing when there are no genres', () => {
    const { container } = render(<GenreShelves genres={[]} openingId={null} onSelect={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    expect(mockedSearch).not.toHaveBeenCalled()
  })

  it('fetches and shows one shelf per genre, using the genre label as the heading', async () => {
    mockedSearch.mockResolvedValue([result('ol1')])

    render(<GenreShelves genres={['fantasy', 'sci-fi']} openingId={null} onSelect={() => {}} />)

    expect(await screen.findByText('Fantasy')).toBeInTheDocument()
    expect(await screen.findByText('Sci-Fi')).toBeInTheDocument()
    expect(mockedSearch).toHaveBeenCalledWith('fantasy', 10)
    expect(mockedSearch).toHaveBeenCalledWith('science_fiction', 10)
    // One book card per shelf, so two "Book ol1" buttons in total.
    expect(await screen.findAllByRole('button', { name: /Book ol1/ })).toHaveLength(2)
  })

  it('dedupes repeated genres and caps at 5 shelves', async () => {
    mockedSearch.mockResolvedValue([])
    const genres = ['fantasy', 'fantasy', 'romance', 'mystery', 'thriller', 'horror', 'poetry']

    render(<GenreShelves genres={genres} openingId={null} onSelect={() => {}} />)

    // 5-shelf cap, fantasy deduped to one call, so 5 unique genres called once each.
    await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(5))
  })

  it("shows one shelf's error without affecting another shelf's results", async () => {
    mockedSearch.mockImplementation(async (slug) => {
      if (slug === 'fantasy') throw new Error('network down')
      return [result('ol1')]
    })

    render(<GenreShelves genres={['fantasy', 'romance']} openingId={null} onSelect={() => {}} />)

    expect(await screen.findByText('network down')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Book ol1/ })).toBeInTheDocument()
  })

  it('calls onSelect when a book is tapped', async () => {
    mockedSearch.mockResolvedValue([result('ol1')])
    const onSelect = vi.fn()

    render(<GenreShelves genres={['fantasy']} openingId={null} onSelect={onSelect} />)

    const button = await screen.findByRole('button', { name: /Book ol1/ })
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledWith(result('ol1'))
  })

  it('disables every book button while one is opening, and labels the matching one', async () => {
    mockedSearch.mockResolvedValue([result('ol1'), result('ol2')])

    render(<GenreShelves genres={['fantasy']} openingId="ol2" onSelect={() => {}} />)

    const button = await screen.findByRole('button', { name: /Book ol1/ })
    expect(button).toBeDisabled()
    await waitFor(() => expect(screen.getByText('Opening…')).toBeInTheDocument())
  })
})
