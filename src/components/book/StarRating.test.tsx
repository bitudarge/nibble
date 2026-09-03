import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StarRating } from './StarRating'

// jsdom's getBoundingClientRect returns all zeros unless mocked, which
// would make every click land on the (zero-width) left half. Stub it so
// clicks can meaningfully target the left or right half of a star.
function stubStarWidth() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 28,
    height: 28,
    top: 0,
    left: 0,
    right: 28,
    bottom: 28,
    toJSON: () => ({}),
  })
}

describe('StarRating', () => {
  it('reports a whole-star value when the right half of a star is clicked', () => {
    stubStarWidth()
    const onChange = vi.fn()
    render(<StarRating value={null} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Rate 4 stars'), { clientX: 20 })
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('reports a half-star value when the left half of a star is clicked', () => {
    stubStarWidth()
    const onChange = vi.fn()
    render(<StarRating value={null} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Rate 4 stars'), { clientX: 5 })
    expect(onChange).toHaveBeenCalledWith(3.5)
  })

  it('nudges the value up half a star on ArrowRight', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group', { name: 'Star rating' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(3.5)
  })

  it('shows "Not rated" with no value, and the star value once rated', () => {
    const { rerender } = render(<StarRating value={null} onChange={vi.fn()} />)
    expect(screen.getByText('Not rated')).toBeInTheDocument()
    rerender(<StarRating value={4.5} onChange={vi.fn()} />)
    expect(screen.getByText('★ 4.5')).toBeInTheDocument()
  })

  it('disables every star button when disabled', () => {
    render(<StarRating value={3} onChange={vi.fn()} disabled />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Rate ${i} star${i === 1 ? '' : 's'}`)).toBeDisabled()
    }
  })
})
