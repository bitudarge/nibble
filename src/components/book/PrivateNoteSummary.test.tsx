import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrivateNoteSummary } from './PrivateNoteSummary'
import type { BookTag, Circle, Review } from '../../types/database'

const REVIEW: Review = {
  id: 'r1',
  user_id: 'u1',
  book_id: 'b1',
  body: 'Loved the ending.',
  contains_spoilers: false,
  visibility: 'private',
  circle_id: null,
  sentiment_score: null,
  extracted_themes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const TAGS: BookTag[] = [{ id: 't1', type: 'mood', name: 'cozy' }]
const CIRCLES: Circle[] = [
  { id: 'c1', name: 'Sunday Sofa', owner_id: 'u1', join_code: 'abc', created_at: '2026-01-01' },
]

describe('PrivateNoteSummary', () => {
  it('shows the note body and tags read-only', () => {
    render(
      <PrivateNoteSummary
        review={REVIEW}
        tags={TAGS}
        onEdit={vi.fn()}
        shareTargets={[]}
        onShare={vi.fn()}
      />,
    )
    expect(screen.getByText('“Loved the ending.”')).toBeInTheDocument()
    expect(screen.getByText('cozy')).toBeInTheDocument()
  })

  it('shows a placeholder when there are tags but no note text', () => {
    render(
      <PrivateNoteSummary
        review={{ ...REVIEW, body: '' }}
        tags={TAGS}
        onEdit={vi.fn()}
        shareTargets={[]}
        onShare={vi.fn()}
      />,
    )
    expect(screen.getByText('Tagged, no note written this time.')).toBeInTheDocument()
  })

  it('calls onEdit when the edit button is tapped', () => {
    const onEdit = vi.fn()
    render(
      <PrivateNoteSummary
        review={REVIEW}
        tags={TAGS}
        onEdit={onEdit}
        shareTargets={[]}
        onShare={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Edit this note'))
    expect(onEdit).toHaveBeenCalled()
  })

  it('does not show the share controls when there are no circles to share with', () => {
    render(
      <PrivateNoteSummary
        review={REVIEW}
        tags={TAGS}
        onEdit={vi.fn()}
        shareTargets={[]}
        onShare={vi.fn()}
      />,
    )
    expect(screen.queryByText('Sunday Sofa')).not.toBeInTheDocument()
  })

  it('shares the review body to whichever circle chip is tapped', async () => {
    const onShare = vi.fn().mockResolvedValue(undefined)
    render(
      <PrivateNoteSummary
        review={REVIEW}
        tags={TAGS}
        onEdit={vi.fn()}
        shareTargets={CIRCLES}
        onShare={onShare}
      />,
    )
    fireEvent.click(screen.getByText('Sunday Sofa'))
    expect(onShare).toHaveBeenCalledWith('c1', 'Loved the ending.')
  })
})
