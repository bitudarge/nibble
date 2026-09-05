import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookHero } from './BookHero'

// The cover image uses alt="" (it's decorative — title/author already say
// what it is), which removes it from the accessibility tree, so it has to
// be queried directly rather than via getByRole('img').
function getCoverImage(container: HTMLElement) {
  return container.querySelector('img')
}

const baseProps = {
  title: 'Piranesi',
  author: 'Susanna Clarke',
  coverUrl: null as string | null,
  description: null as string | null,
  categories: [] as string[],
  pageCount: null as number | null,
  publishedYear: null as number | null,
  aggregateLabel: 'No ratings yet',
  myRating: null,
  onRatingChange: vi.fn(),
}

describe('BookHero', () => {
  it('shows the synopsis when the book has one', () => {
    render(<BookHero {...baseProps} description="A house with infinite rooms." />)
    expect(screen.getByText('A house with infinite rooms.')).toBeInTheDocument()
  })

  it('renders nothing extra when there is no synopsis', () => {
    render(<BookHero {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Piranesi' })).toBeInTheDocument()
  })

  it('shows a chip for each category', () => {
    render(<BookHero {...baseProps} categories={['Fiction', 'Fantasy']} />)
    expect(screen.getByText('Fiction')).toBeInTheDocument()
    expect(screen.getByText('Fantasy')).toBeInTheDocument()
  })

  it('falls back to a placeholder when there is no cover', () => {
    render(<BookHero {...baseProps} />)
    expect(screen.getByText('No cover yet')).toBeInTheDocument()
  })

  it('renders an image instead of the placeholder when a cover exists', () => {
    const { container } = render(
      <BookHero {...baseProps} coverUrl="https://example.com/cover.jpg" />,
    )
    expect(screen.queryByText('No cover yet')).not.toBeInTheDocument()
    expect(getCoverImage(container)).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('shows the About card and its facts row even with no synopsis or categories', () => {
    render(<BookHero {...baseProps} pageCount={245} publishedYear={2020} />)
    expect(screen.getByText('About this book')).toBeInTheDocument()
    expect(screen.getByText('No synopsis found for this one yet.')).toBeInTheDocument()
    expect(screen.getByText('245')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
  })

  it('pulls the average rating number out of the aggregate label for the facts row', () => {
    render(<BookHero {...baseProps} pageCount={245} aggregateLabel="★ 4.4 average (12 ratings)" />)
    expect(screen.getByText('4.4')).toBeInTheDocument()
  })
})
