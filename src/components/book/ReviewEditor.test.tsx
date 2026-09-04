import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewEditor } from './ReviewEditor'
import type { BookTag, Review } from '../../types/database'

vi.mock('../../lib/reviews/data', () => ({
  saveReview: vi.fn(async () => ({ id: 'r1' }) as Review),
}))
vi.mock('../../lib/tags/data', () => ({
  setReviewTags: vi.fn(async () => undefined),
}))

const TAGS: BookTag[] = [{ id: 't1', type: 'mood', name: 'cozy' }]

describe('ReviewEditor', () => {
  it('shows the tag picker by default', () => {
    render(
      <ReviewEditor
        bookId="b1"
        userId="u1"
        visibility="private"
        existingReview={null}
        existingTagIds={[]}
        allTags={TAGS}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.getByText('cozy')).toBeInTheDocument()
  })

  it('hides the tag picker when showTagPicker is false', () => {
    render(
      <ReviewEditor
        bookId="b1"
        userId="u1"
        visibility="public"
        existingReview={null}
        existingTagIds={[]}
        allTags={TAGS}
        showTagPicker={false}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.queryByText('cozy')).not.toBeInTheDocument()
  })

  it('does not touch review tags on save when showTagPicker is false', async () => {
    const { setReviewTags } = await import('../../lib/tags/data')
    const onSaved = vi.fn()
    render(
      <ReviewEditor
        bookId="b1"
        userId="u1"
        visibility="public"
        existingReview={null}
        existingTagIds={[]}
        allTags={TAGS}
        showTagPicker={false}
        onSaved={onSaved}
      />,
    )
    fireEvent.change(screen.getByLabelText('Public review'), { target: { value: 'A good one.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(setReviewTags).not.toHaveBeenCalled()
  })

  it('saves selected tags when showTagPicker is true', async () => {
    const { setReviewTags } = await import('../../lib/tags/data')
    const onSaved = vi.fn()
    render(
      <ReviewEditor
        bookId="b1"
        userId="u1"
        visibility="private"
        existingReview={null}
        existingTagIds={[]}
        allTags={TAGS}
        onSaved={onSaved}
      />,
    )
    fireEvent.click(screen.getByText('cozy'))
    fireEvent.change(screen.getByLabelText('Private journal entry'), {
      target: { value: 'Loved it.' },
    })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(setReviewTags).toHaveBeenCalledWith('r1', ['t1'])
  })
})
