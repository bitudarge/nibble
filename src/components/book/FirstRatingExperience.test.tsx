import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FirstRatingExperience } from './FirstRatingExperience'
import type { BookTag } from '../../types/database'

const TAGS: BookTag[] = [
  { id: 't1', type: 'mood', name: 'cozy' },
  { id: 't2', type: 'genre', name: 'fantasy' },
]

describe('FirstRatingExperience', () => {
  it('starts on the tag step, showing the book title', () => {
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        saving={false}
        error={null}
      />,
    )
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(screen.getByText(/Circe/)).toBeInTheDocument()
  })

  it('calling onSkip on the tag step ends the flow without saving', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={onSave}
        onSkip={onSkip}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('advances to the note step on Continue, keeping tapped tags', () => {
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('cozy'))
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
  })

  it('Save on the note step includes both the typed text and the tags picked earlier', () => {
    const onSave = vi.fn()
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={onSave}
        onSkip={vi.fn()}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('fantasy'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.change(screen.getByPlaceholderText('The bit that stuck with you'), {
      target: { value: '  loved the ending  ' },
    })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('loved the ending', ['t2'])
  })

  it('Skip note with tags already picked saves the tags with an empty note, not a full skip', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={onSave}
        onSkip={onSkip}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('cozy'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Skip note'))
    expect(onSave).toHaveBeenCalledWith('', ['t1'])
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('Skip note with nothing picked at all is a full skip', () => {
    const onSave = vi.fn()
    const onSkip = vi.fn()
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={onSave}
        onSkip={onSkip}
        saving={false}
        error={null}
      />,
    )
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Skip note'))
    expect(onSkip).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows an error message when given one', () => {
    render(
      <FirstRatingExperience
        bookTitle="Circe"
        allTags={TAGS}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        saving={false}
        error="Could not save that note. Try again."
      />,
    )
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Could not save that note. Try again.')).toBeInTheDocument()
  })
})
