import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewCard } from './ReviewCard'
import type { CommentWithAuthor } from '../../lib/comments/data'
import type { Review } from '../../types/database'

const { getCommentsForReview, postComment, deleteComment } = vi.hoisted(() => ({
  getCommentsForReview: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
}))
vi.mock('../../lib/comments/data', () => ({ getCommentsForReview, postComment, deleteComment }))

function makeComment(overrides: Partial<CommentWithAuthor> = {}): CommentWithAuthor {
  return {
    id: 'c1',
    review_id: 'r1',
    user_id: 'other-user',
    body: 'Agreed!',
    created_at: '2026-01-02T00:00:00Z',
    profiles: { id: 'other-user', display_name: 'Ada', avatar_url: null, created_at: '' },
    ...overrides,
  }
}

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

describe('ReviewCard comments', () => {
  it('loads and shows comments only after the toggle is opened, not eagerly', () => {
    getCommentsForReview.mockResolvedValue([makeComment()])
    render(<ReviewCard review={makeReview()} currentUserId="me" />)
    expect(getCommentsForReview).not.toHaveBeenCalled()
    expect(screen.queryByText('Agreed!')).not.toBeInTheDocument()
  })

  it('fetches and renders comments once opened', async () => {
    getCommentsForReview.mockResolvedValue([makeComment()])
    render(<ReviewCard review={makeReview()} currentUserId="me" />)
    fireEvent.click(screen.getByText('Comments'))
    await waitFor(() => expect(screen.getByText('Agreed!')).toBeInTheDocument())
    expect(getCommentsForReview).toHaveBeenCalledWith('r1')
  })

  it('only shows a delete affordance on the current user’s own comment', async () => {
    getCommentsForReview.mockResolvedValue([
      makeComment({ id: 'c1', user_id: 'me', body: 'Mine' }),
      makeComment({ id: 'c2', user_id: 'other-user', body: 'Theirs' }),
    ])
    render(<ReviewCard review={makeReview()} currentUserId="me" />)
    fireEvent.click(screen.getByText('Comments'))
    await waitFor(() => expect(screen.getByText('Mine')).toBeInTheDocument())
    expect(screen.getAllByLabelText('Delete comment')).toHaveLength(1)
  })

  it('shows a new comment immediately (optimistic) and keeps it after the save resolves', async () => {
    getCommentsForReview.mockResolvedValue([])
    postComment.mockResolvedValue({
      id: 'real-id',
      review_id: 'r1',
      user_id: 'me',
      body: 'Nice one',
      created_at: '2026-01-03T00:00:00Z',
    })
    render(<ReviewCard review={makeReview()} currentUserId="me" currentUserDisplayName="Me" />)
    fireEvent.click(screen.getByText('Comments'))
    await waitFor(() => expect(getCommentsForReview).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('Add a comment'), {
      target: { value: 'Nice one' },
    })
    fireEvent.click(screen.getByText('Post'))

    expect(screen.getByText('Nice one')).toBeInTheDocument()
    await waitFor(() => expect(postComment).toHaveBeenCalledWith('r1', 'me', 'Nice one'))
  })

  it('rolls back an optimistic comment if posting fails', async () => {
    getCommentsForReview.mockResolvedValue([])
    postComment.mockRejectedValue(new Error('nope'))
    render(<ReviewCard review={makeReview()} currentUserId="me" />)
    fireEvent.click(screen.getByText('Comments'))
    await waitFor(() => expect(getCommentsForReview).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('Add a comment'), {
      target: { value: 'Will fail' },
    })
    fireEvent.click(screen.getByText('Post'))
    expect(screen.getByText('Will fail')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Will fail')).not.toBeInTheDocument())
    expect(screen.getByText('nope')).toBeInTheDocument()
  })

  it('does not show a compose box when there is no signed-in user', async () => {
    getCommentsForReview.mockResolvedValue([])
    render(<ReviewCard review={makeReview()} />)
    fireEvent.click(screen.getByText('Comments'))
    await waitFor(() => expect(getCommentsForReview).toHaveBeenCalled())
    expect(screen.queryByPlaceholderText('Add a comment')).not.toBeInTheDocument()
  })
})
