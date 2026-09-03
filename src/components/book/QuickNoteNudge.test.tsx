import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickNoteNudge } from './QuickNoteNudge'

describe('QuickNoteNudge', () => {
  it('calls onSave with the trimmed text on submit', () => {
    const onSave = vi.fn()
    render(<QuickNoteNudge onSave={onSave} onSkip={vi.fn()} saving={false} error={null} />)
    fireEvent.change(screen.getByLabelText('Want to remember why?'), {
      target: { value: '  loved the ending  ' },
    })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('loved the ending')
  })

  it('calls onSkip when the Skip button is clicked', () => {
    const onSkip = vi.fn()
    render(<QuickNoteNudge onSave={vi.fn()} onSkip={onSkip} saving={false} error={null} />)
    fireEvent.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('treats an empty submit as a skip rather than an empty save', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(<QuickNoteNudge onSave={onSave} onSkip={onSkip} saving={false} error={null} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
    expect(onSkip).toHaveBeenCalled()
  })

  it('shows an error message when given one', () => {
    render(
      <QuickNoteNudge onSave={vi.fn()} onSkip={vi.fn()} saving={false} error="Could not save." />,
    )
    expect(screen.getByText('Could not save.')).toBeInTheDocument()
  })
})
