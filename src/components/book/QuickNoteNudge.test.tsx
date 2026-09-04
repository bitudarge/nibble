import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickNoteNudge } from './QuickNoteNudge'
import type { BookTag } from '../../types/database'

const TAGS: BookTag[] = [
  { id: 't1', type: 'mood', name: 'cozy' },
  { id: 't2', type: 'genre', name: 'fantasy' },
]

describe('QuickNoteNudge', () => {
  it('calls onSave with the trimmed text and no tags on a plain submit', () => {
    const onSave = vi.fn()
    render(
      <QuickNoteNudge
        allTags={TAGS}
        onSave={onSave}
        onSkip={vi.fn()}
        saving={false}
        error={null}
      />,
    )
    fireEvent.change(screen.getByLabelText('Want to remember why?'), {
      target: { value: '  loved the ending  ' },
    })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('loved the ending', [])
  })

  it('includes tapped tag ids alongside the note text', () => {
    const onSave = vi.fn()
    render(
      <QuickNoteNudge
        allTags={TAGS}
        onSave={onSave}
        onSkip={vi.fn()}
        saving={false}
        error={null}
      />,
    )
    fireEvent.change(screen.getByLabelText('Want to remember why?'), {
      target: { value: 'so cozy' },
    })
    fireEvent.click(screen.getByText('cozy'))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('so cozy', ['t1'])
  })

  it('saves tags picked with no note text, rather than treating it as a skip', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(
      <QuickNoteNudge allTags={TAGS} onSave={onSave} onSkip={onSkip} saving={false} error={null} />,
    )
    fireEvent.click(screen.getByText('fantasy'))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('', ['t2'])
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('calls onSkip when the Skip button is clicked', () => {
    const onSkip = vi.fn()
    render(
      <QuickNoteNudge
        allTags={TAGS}
        onSave={vi.fn()}
        onSkip={onSkip}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('treats a submit with no text and no tags as a skip, not an empty save', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(
      <QuickNoteNudge allTags={TAGS} onSave={onSave} onSkip={onSkip} saving={false} error={null} />,
    )
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
    expect(onSkip).toHaveBeenCalled()
  })

  it('shows an error message when given one', () => {
    render(
      <QuickNoteNudge
        allTags={TAGS}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        saving={false}
        error="Could not save."
      />,
    )
    expect(screen.getByText('Could not save.')).toBeInTheDocument()
  })
})
