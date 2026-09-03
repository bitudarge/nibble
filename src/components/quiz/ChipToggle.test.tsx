import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChipToggle } from './ChipToggle'

describe('ChipToggle', () => {
  it('shows the label and reflects selected state via aria-pressed', () => {
    render(<ChipToggle label="cosy" selected onClick={vi.fn()} />)
    const chip = screen.getByRole('button', { name: 'cosy' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('reflects unselected state', () => {
    render(<ChipToggle label="cosy" selected={false} onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'cosy' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when tapped', () => {
    const onClick = vi.fn()
    render(<ChipToggle label="cosy" selected={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'cosy' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
