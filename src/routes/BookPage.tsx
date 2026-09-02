import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReviewCard } from '../components/book/ReviewCard'
import { ReviewEditor } from '../components/book/ReviewEditor'
import { StarRating } from '../components/book/StarRating'
import { useAuth } from '../lib/auth/useAuth'
import { getBookById } from '../lib/books/data'
import {
  getAggregateRating,
  getUserRating,
  setRating,
  type AggregateRating,
} from '../lib/ratings/data'
import { getOwnPrivateReview, getOwnPublicReview, getPublicReviews } from '../lib/reviews/data'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemForBook, setShelfStatus } from '../lib/shelf/data'
import { getAllTags, getTagsForReview } from '../lib/tags/data'
import type { Book, BookTag, Review, ShelfItem, ShelfStatus } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded' | 'not-found'

export function BookPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()

  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [book, setBook] = useState<Book | null>(null)
  const [aggregate, setAggregate] = useState<AggregateRating>({ average: null, count: 0 })
  const [shelfItem, setShelfItem] = useState<ShelfItem | null>(null)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [publicReviews, setPublicReviews] = useState<Review[]>([])
  const [privateReview, setPrivateReview] = useState<Review | null>(null)
  const [privateTagIds, setPrivateTagIds] = useState<string[]>([])
  const [publicReview, setPublicReview] = useState<Review | null>(null)
  const [publicTagIds, setPublicTagIds] = useState<string[]>([])
  const [allTags, setAllTags] = useState<BookTag[]>([])

  const [progressInput, setProgressInput] = useState('')
  const [progressError, setProgressError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!bookId || !user) return
      setState('loading')
      setError(null)
      try {
        const foundBook = await getBookById(bookId)
        if (!foundBook) {
          if (!cancelled) setState('not-found')
          return
        }

        const [agg, shelf, rating, pubReviews, priv, pub, tags] = await Promise.all([
          getAggregateRating(bookId),
          getShelfItemForBook(user.id, bookId),
          getUserRating(user.id, bookId),
          getPublicReviews(bookId),
          getOwnPrivateReview(user.id, bookId),
          getOwnPublicReview(user.id, bookId),
          getAllTags(),
        ])

        if (cancelled) return
        setBook(foundBook)
        setAggregate(agg)
        setShelfItem(shelf)
        setMyRating(rating?.stars ?? null)
        setPublicReviews(pubReviews)
        setPrivateReview(priv)
        setPublicReview(pub)
        setAllTags(tags)
        setPrivateTagIds(
          priv ? await getTagsForReview(priv.id).then((t) => t.map((tag) => tag.id)) : [],
        )
        setPublicTagIds(
          pub ? await getTagsForReview(pub.id).then((t) => t.map((tag) => tag.id)) : [],
        )
        if (!cancelled) setState('loaded')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this book.')
          setState('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [bookId, user])

  async function handleShelfChange(status: ShelfStatus) {
    if (!user || !bookId) return
    try {
      const updated = await setShelfStatus(user.id, bookId, status)
      setShelfItem(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your shelf.')
    }
  }

  async function handleRatingChange(stars: number) {
    if (!user || !bookId) return
    try {
      const updated = await setRating(user.id, bookId, stars)
      setMyRating(updated.stars)
      const agg = await getAggregateRating(bookId)
      setAggregate(agg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your rating.')
    }
  }

  async function handleLogProgress() {
    if (!user || !bookId) return
    const toPage = Number(progressInput)
    if (!Number.isFinite(toPage) || toPage < 0) {
      setProgressError('Enter a valid page number.')
      return
    }
    setProgressError(null)
    try {
      await logReadingProgress(
        user.id,
        bookId,
        shelfItem?.current_page ?? null,
        toPage,
        book?.page_count ?? null,
      )
      const updatedShelf = await getShelfItemForBook(user.id, bookId)
      setShelfItem(updatedShelf)
      setProgressInput('')
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : 'Could not log your progress.')
    }
  }

  if (state === 'loading') {
    return <p className="text-stone-500">Loading…</p>
  }

  if (state === 'not-found') {
    return <p className="text-stone-500">That book couldn't be found.</p>
  }

  if (state === 'error' || !book) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
        {error ?? 'Something went wrong loading this book.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex gap-4">
        {book.cover_url ? (
          <img src={book.cover_url} alt="" className="h-48 w-32 rounded object-cover" />
        ) : (
          <div className="flex h-48 w-32 items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
            No cover
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{book.title}</h1>
          {book.author && <p className="text-stone-600">{book.author}</p>}
          {book.page_count && <p className="text-sm text-stone-500">{book.page_count} pages</p>}
          <p className="mt-2 text-sm text-stone-600">
            {aggregate.count > 0
              ? `★ ${aggregate.average?.toFixed(1)} average (${aggregate.count} rating${aggregate.count === 1 ? '' : 's'})`
              : 'No ratings yet'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-md border border-stone-200 p-3">
        <label className="flex items-center gap-2 text-sm">
          Shelf:
          <select
            value={shelfItem?.status ?? ''}
            onChange={(e) => void handleShelfChange(e.target.value as ShelfStatus)}
            className="rounded-md border border-stone-300 px-2 py-1"
          >
            <option value="" disabled>
              Add to a shelf
            </option>
            <option value="want_to_read">Want to read</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
        </label>

        <StarRating value={myRating} onChange={(v) => void handleRatingChange(v)} />

        {shelfItem?.status === 'reading' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              placeholder={`Page (${shelfItem.current_page ?? 0} so far)`}
              className="w-36 rounded-md border border-stone-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleLogProgress()}
              className="rounded-md bg-stone-900 px-3 py-1 text-sm text-white"
            >
              Log progress
            </button>
          </div>
        )}
      </section>
      {progressError && <p className="mb-4 text-sm text-red-700">{progressError}</p>}

      {user && (
        <section className="mb-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-medium text-stone-900">Your private journal</h2>
            <ReviewEditor
              bookId={book.id}
              userId={user.id}
              visibility="private"
              existingReview={privateReview}
              existingTagIds={privateTagIds}
              allTags={allTags}
              onSaved={(review, tagIds) => {
                setPrivateReview(review)
                setPrivateTagIds(tagIds)
              }}
            />
          </div>
          <div>
            <h2 className="mb-2 text-lg font-medium text-stone-900">Your public review</h2>
            <ReviewEditor
              bookId={book.id}
              userId={user.id}
              visibility="public"
              existingReview={publicReview}
              existingTagIds={publicTagIds}
              allTags={allTags}
              onSaved={(review, tagIds) => {
                setPublicReview(review)
                setPublicTagIds(tagIds)
                setPublicReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)])
              }}
            />
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-medium text-stone-900">Public reviews</h2>
        {publicReviews.length === 0 ? (
          <p className="text-stone-500">No public reviews yet — be the first.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {publicReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-stone-900">Your circles</h2>
        <p className="text-stone-500">You're not in any circles yet — circles land in Phase 5.</p>
      </section>
    </div>
  )
}
