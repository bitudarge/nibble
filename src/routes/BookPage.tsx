import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookHero } from '../components/book/BookHero'
import { QuickNoteNudge } from '../components/book/QuickNoteNudge'
import { ReviewCard } from '../components/book/ReviewCard'
import { ReviewEditor } from '../components/book/ReviewEditor'
import { useCelebration } from '../components/celebrate/useCelebration'
import { useAuth } from '../lib/auth/useAuth'
import { enrichBook, getBookById } from '../lib/books/data'
import { getMyCircles } from '../lib/circles/data'
import { getStreak, isStreakMilestone } from '../lib/goals/data'
import { resolveDisplayIdentity } from '../lib/profile/identity'
import {
  getAggregateRating,
  getUserRating,
  setRating,
  type AggregateRating,
} from '../lib/ratings/data'
import {
  getCircleReviewsForBook,
  getOwnCircleReview,
  getOwnPrivateReview,
  getOwnPublicReview,
  getPublicReviews,
  saveReview,
  shareReviewToCircle,
  type CircleReviewForBook,
} from '../lib/reviews/data'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemForBook, setShelfStatus } from '../lib/shelf/data'
import { getAllTags, getTagsForReview, setReviewTags } from '../lib/tags/data'
import type { Book, BookTag, Circle, Review, ShelfItem, ShelfStatus } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded' | 'not-found'

export function BookPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const { user, profile } = useAuth()
  const { celebrate, node: celebrationNode } = useCelebration()
  // For the optimistic comment shown the instant you post one, before the
  // real row (with its real profile join) comes back — see ReviewCard.tsx.
  const { displayName: currentUserDisplayName } = resolveDisplayIdentity(user, profile)

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

  const [myCircles, setMyCircles] = useState<Circle[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState<string>('')
  const [circleReviews, setCircleReviews] = useState<CircleReviewForBook[]>([])
  const [circleReview, setCircleReview] = useState<Review | null>(null)
  const [circleTagIds, setCircleTagIds] = useState<string[]>([])

  const [progressInput, setProgressInput] = useState('')
  const [progressError, setProgressError] = useState<string | null>(null)

  // The anti-forgetting nudge: shown right after a rating, only while the
  // user has no private note yet for this book (once they save one, or
  // already had one, there's nothing to nudge for).
  const [showQuickNote, setShowQuickNote] = useState(false)
  const [quickNoteSaving, setQuickNoteSaving] = useState(false)
  const [quickNoteError, setQuickNoteError] = useState<string | null>(null)

  // "Write a Review" is a secondary, opt-in action now, not an editor
  // sitting open next to the shelf/rating area by default (see round 2's
  // rating/review restructure). Once opened for this page visit it stays
  // open, saving doesn't collapse it back.
  const [showReviewComposer, setShowReviewComposer] = useState(false)

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

        const [agg, shelf, rating, pubReviews, priv, pub, tags, circles] = await Promise.all([
          getAggregateRating(bookId),
          getShelfItemForBook(user.id, bookId),
          getUserRating(user.id, bookId),
          getPublicReviews(bookId),
          getOwnPrivateReview(user.id, bookId),
          getOwnPublicReview(user.id, bookId),
          getAllTags(),
          getMyCircles(user.id),
        ])

        if (cancelled) return
        setBook(foundBook)
        // Books added before this feature existed (or that Google Books
        // had nothing for last time) get their one-time enrichment lookup
        // here, in the background, so the rest of the page never waits on
        // it — it just fills in once it resolves.
        if (!foundBook.metadata.enriched) {
          void enrichBook(foundBook).then((richer) => {
            if (!cancelled) setBook(richer)
          })
        }
        setAggregate(agg)
        setShelfItem(shelf)
        setMyRating(rating?.stars ?? null)
        setPublicReviews(pubReviews)
        setPrivateReview(priv)
        setPublicReview(pub)
        setAllTags(tags)
        setMyCircles(circles)
        setPrivateTagIds(
          priv ? await getTagsForReview(priv.id).then((t) => t.map((tag) => tag.id)) : [],
        )
        setPublicTagIds(
          pub ? await getTagsForReview(pub.id).then((t) => t.map((tag) => tag.id)) : [],
        )

        const circleIds = circles.map((c) => c.id)
        setCircleReviews(await getCircleReviewsForBook(bookId, circleIds))
        if (circles.length > 0 && circles[0]) setSelectedCircleId(circles[0].id)

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

  // Load the user's existing review for whichever circle is currently
  // selected in the picker below — re-runs when they switch circles.
  useEffect(() => {
    let cancelled = false

    async function loadCircleReview() {
      if (!user || !bookId || !selectedCircleId) {
        setCircleReview(null)
        setCircleTagIds([])
        return
      }
      const review = await getOwnCircleReview(user.id, bookId, selectedCircleId)
      if (cancelled) return
      setCircleReview(review)
      setCircleTagIds(review ? (await getTagsForReview(review.id)).map((tag) => tag.id) : [])
    }

    void loadCircleReview()
    return () => {
      cancelled = true
    }
  }, [bookId, user, selectedCircleId])

  async function handleShelfChange(status: ShelfStatus) {
    if (!user || !bookId) return
    const wasFinished = shelfItem?.status === 'finished'
    try {
      const updated = await setShelfStatus(user.id, bookId, status)
      setShelfItem(updated)
      if (status === 'finished' && !wasFinished) {
        celebrate(`Finished ${book?.title ?? 'that one'}! Nibbles is proud.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your shelf.')
    }
  }

  // Optimistic: the stars update the instant you tap them, before the
  // network round-trip resolves. If the save fails, roll the display back
  // to what it was and say so, rather than leaving a rating shown that
  // never actually saved.
  async function handleRatingChange(stars: number) {
    if (!user || !bookId) return
    const previous = myRating
    setMyRating(stars)
    if (!privateReview) setShowQuickNote(true)
    try {
      const updated = await setRating(user.id, bookId, stars)
      setMyRating(updated.stars)
      const agg = await getAggregateRating(bookId)
      setAggregate(agg)
    } catch (err) {
      setMyRating(previous)
      setShowQuickNote(false)
      setError(err instanceof Error ? err.message : 'Could not save your rating. Try again.')
    }
  }

  async function handleQuickNoteSave(text: string, tagIds: string[]) {
    if (!user || !bookId) return
    setQuickNoteSaving(true)
    setQuickNoteError(null)
    try {
      const review = await saveReview(
        { bookId, userId: user.id, body: text, containsSpoilers: false, visibility: 'private' },
        null,
      )
      await setReviewTags(review.id, tagIds)
      setPrivateReview(review)
      setPrivateTagIds(tagIds)
      setShowQuickNote(false)
    } catch (err) {
      setQuickNoteError(err instanceof Error ? err.message : 'Could not save that note. Try again.')
    } finally {
      setQuickNoteSaving(false)
    }
  }

  function handleQuickNoteSkip() {
    setShowQuickNote(false)
  }

  async function handleShareToCircle(circleId: string, body: string) {
    if (!user || !bookId) return
    const shared = await shareReviewToCircle(user.id, bookId, circleId, body)
    if (shared.circle_id === selectedCircleId) {
      setCircleReview(shared)
    }
    const refreshed = await getCircleReviewsForBook(
      bookId,
      myCircles.map((c) => c.id),
    )
    setCircleReviews(refreshed)
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
      // Read the streak before logging so a milestone can be detected by
      // comparing before/after, rather than guessing at what changed.
      const streakBefore = await getStreak(user.id)
      await logReadingProgress(
        user.id,
        bookId,
        shelfItem?.current_page ?? null,
        toPage,
        book?.page_count ?? null,
      )
      const [updatedShelf, streakAfter] = await Promise.all([
        getShelfItemForBook(user.id, bookId),
        getStreak(user.id),
      ])
      setShelfItem(updatedShelf)
      setProgressInput('')
      const before = streakBefore?.current_streak ?? 0
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(before, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : 'Could not log your progress.')
    }
  }

  if (state === 'loading') {
    return <p className="font-sans text-muted">Finding that book…</p>
  }

  if (state === 'not-found') {
    return <p className="font-sans text-muted">That book couldn't be found.</p>
  }

  if (state === 'error' || !book) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 font-sans text-ink shadow-soft">
        {error ?? 'Something went wrong loading this book.'}
      </div>
    )
  }

  const description =
    typeof book.metadata.description === 'string' ? book.metadata.description : null
  const categories = Array.isArray(book.metadata.categories)
    ? book.metadata.categories.filter((c): c is string => typeof c === 'string')
    : []
  const aggregateLabel =
    aggregate.count > 0
      ? `★ ${aggregate.average?.toFixed(1)} average (${aggregate.count} rating${aggregate.count === 1 ? '' : 's'})`
      : 'No ratings yet'

  return (
    <div className="mx-auto max-w-3xl" style={{ animation: 'nib-in 0.26s ease both' }}>
      {celebrationNode}
      <BookHero
        title={book.title}
        author={book.author}
        coverUrl={book.cover_url}
        description={description}
        categories={categories}
        pageCount={book.page_count}
        publishedYear={book.published_year}
        aggregateLabel={aggregateLabel}
        myRating={myRating}
        onRatingChange={(v) => void handleRatingChange(v)}
      />

      {showQuickNote && (
        <QuickNoteNudge
          allTags={allTags}
          onSave={(text, tagIds) => void handleQuickNoteSave(text, tagIds)}
          onSkip={handleQuickNoteSkip}
          saving={quickNoteSaving}
          error={quickNoteError}
        />
      )}

      {error && (
        <p className="mb-4 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      {/* Shelf status, progress, and My Notes are grouped together: this is
          the "my shelf entry for this book" part of the page. Reviewing
          (public or circle) is a clearly separate, secondary action below,
          see round 2's rating/review restructure. */}
      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft">
        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          Shelf
          <select
            value={shelfItem?.status ?? ''}
            onChange={(e) => void handleShelfChange(e.target.value as ShelfStatus)}
            className="rounded-full border border-line bg-page px-3 py-1.5 font-sans text-sm text-ink"
          >
            <option value="" disabled>
              Add to a shelf
            </option>
            <option value="want_to_read">Want to read</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
        </label>

        {shelfItem?.status === 'reading' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              placeholder={`Page (${shelfItem.current_page ?? 0} so far)`}
              className="w-36 rounded-full border border-line bg-page px-3 py-1.5 font-sans text-sm text-ink"
            />
            <button
              type="button"
              onClick={() => void handleLogProgress()}
              className="rounded-full bg-sage px-4 py-1.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95"
            >
              Log progress
            </button>
          </div>
        )}
      </section>
      {progressError && <p className="mb-4 font-sans text-sm text-honey-text">{progressError}</p>}

      {user && (
        <section className="mb-6 rounded-2xl bg-surface p-4 shadow-soft">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">My Notes</h2>
          <p className="mb-3 font-sans text-xs text-muted">
            Just for you. Never public unless you share it to a circle.
          </p>
          <ReviewEditor
            // Remounts fresh whenever the private review's identity changes
            // (null -> a real row, e.g. right after QuickNoteNudge saves
            // one), otherwise this editor's internal body/tag state would
            // stay frozen at whatever it had on first mount and silently
            // not show the note that was just saved.
            key={privateReview?.id ?? 'private-new'}
            bookId={book.id}
            userId={user.id}
            visibility="private"
            existingReview={privateReview}
            existingTagIds={privateTagIds}
            allTags={allTags}
            shareTargets={myCircles}
            onShare={(circleId, body) => handleShareToCircle(circleId, body)}
            onSaved={(review, tagIds) => {
              setPrivateReview(review)
              setPrivateTagIds(tagIds)
            }}
          />
        </section>
      )}

      <section className="mb-6 rounded-2xl bg-surface p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Write a Review</h2>
            <p className="font-sans text-xs text-muted">Optional, and public once you save it.</p>
          </div>
          {!showReviewComposer && (
            <button
              type="button"
              onClick={() => setShowReviewComposer(true)}
              className="flex-none rounded-full bg-tint px-3.5 py-1.5 font-sans text-xs font-bold text-ink transition-transform active:scale-95"
            >
              {publicReview ? 'Edit review' : 'Write a review'}
            </button>
          )}
        </div>

        {showReviewComposer && user && (
          <div className="mt-3">
            <ReviewEditor
              bookId={book.id}
              userId={user.id}
              visibility="public"
              existingReview={publicReview}
              existingTagIds={publicTagIds}
              allTags={allTags}
              showTagPicker={false}
              shareTargets={myCircles}
              onShare={(circleId, body) => handleShareToCircle(circleId, body)}
              onSaved={(review, tagIds) => {
                setPublicReview(review)
                setPublicTagIds(tagIds)
                setPublicReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)])
              }}
            />
          </div>
        )}

        <div className="mt-4 border-t border-line pt-4">
          {publicReviews.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              No public reviews yet. Be the first to share a thought.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {publicReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={user?.id}
                  currentUserDisplayName={currentUserDisplayName}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-soft">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">From your circle</h2>
        <p className="mb-3 font-sans text-xs text-muted">Small rooms, not a public feed.</p>

        {myCircles.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            You're not in any circles yet.{' '}
            <Link to="/circles" className="font-bold text-sage underline">
              Create or join one
            </Link>
            .
          </p>
        ) : (
          <>
            {circleReviews.length === 0 ? (
              <p className="mb-3 font-sans text-sm text-muted">
                No circle reviews of this book yet.
              </p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {circleReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    byline={`${review.profiles.display_name} in ${review.circles.name}`}
                    currentUserId={user?.id}
                    currentUserDisplayName={currentUserDisplayName}
                  />
                ))}
              </ul>
            )}

            {user && (
              <div>
                <label className="mb-2 flex items-center gap-2 font-sans text-sm text-ink">
                  Post a review to
                  <select
                    value={selectedCircleId}
                    onChange={(e) => setSelectedCircleId(e.target.value)}
                    className="rounded-full border border-line bg-page px-3 py-1.5 font-sans text-sm text-ink"
                  >
                    {myCircles.map((circle) => (
                      <option key={circle.id} value={circle.id}>
                        {circle.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedCircleId && (
                  <ReviewEditor
                    key={selectedCircleId}
                    bookId={book.id}
                    userId={user.id}
                    visibility="circle"
                    circleId={selectedCircleId}
                    existingReview={circleReview}
                    existingTagIds={circleTagIds}
                    allTags={allTags}
                    showTagPicker={false}
                    onSaved={(review, tagIds) => {
                      setCircleReview(review)
                      setCircleTagIds(tagIds)
                      void getCircleReviewsForBook(
                        book.id,
                        myCircles.map((c) => c.id),
                      ).then(setCircleReviews)
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
