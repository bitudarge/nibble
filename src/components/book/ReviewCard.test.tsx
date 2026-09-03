import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewCard } from './ReviewCard'
import type { Review } from '../../types/database'

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    user_id: 'u1',
    book_id: 'b1',
    body: 'A quiet, lovely book.',
    contains_spoilers: false,
    visibility: 'public',
    circle_id: null,
    sentiment_score: null,
    extracted_themes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ReviewCard', () => {
  it('shows the body right away when there are no spoilers', () => {
    render(<ReviewCard review={makeReview()} />)
    expect(screen.getByText('A quiet, lovely book.')).toBeInTheDocument()
  })

  it('hides the body behind a tap-to-peek button when marked spoilery', () => {
    render(<ReviewCard review={makeReview({ contains_spoilers: true })} />)
    expect(screen.queryByText('A quiet, lovely book.')).not.toBeInTheDocument()
    expect(screen.getByText('Spoilers. Tap to peek.')).toBeInTheDocument()
  })

  it('reveals the body after tapping the spoiler button', () => {
    render(<ReviewCard review={makeReview({ contains_spoilers: true })} />)
    fireEvent.click(screen.getByText('Spoilers. Tap to peek.'))
    expect(screen.getByText('A quiet, lovely book.')).toBeInTheDocument()
  })

  it('shows a byline when given one', () => {
    render(<ReviewCard review={makeReview()} byline="Ada in Sunday Sofa" />)
    expect(screen.getByText('Ada in Sunday Sofa')).toBeInTheDocument()
  })

  it('renders no byline row when none is given', () => {
    const { container } = render(<ReviewCard review={makeReview()} />)
    expect(container.querySelectorAll('li > div').length).toBe(0)
  })
})
