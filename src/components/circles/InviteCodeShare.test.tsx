import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InviteCodeShare } from './InviteCodeShare'

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error — cleaning up a test-only stub, not present by default in jsdom.
  delete navigator.share
})

describe('InviteCodeShare', () => {
  it('shows the code and copies it on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<InviteCodeShare circleName="Sunday Sofa" joinCode="ABC123" />)
    expect(screen.getByText('ABC123')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenCalledWith('ABC123')
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('shows a gentle message rather than breaking when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    })

    render(<InviteCodeShare circleName="Sunday Sofa" joinCode="ABC123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(await screen.findByText(/select the code above/)).toBeInTheDocument()
  })

  it('only offers Share when navigator.share exists', () => {
    render(<InviteCodeShare circleName="Sunday Sofa" joinCode="ABC123" />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()

    // @ts-expect-error — stubbing a browser API jsdom doesn't implement.
    navigator.share = vi.fn().mockResolvedValue(undefined)
    render(<InviteCodeShare circleName="Sunday Sofa" joinCode="ABC123" />)
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
  })
})
