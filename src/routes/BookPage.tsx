import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BareRatingRow } from '../components/book/BareRatingRow'
import { BookHero } from '../components/book/BookHero'
import { FirstRatingExperience } from '../components/book/FirstRatingExperience'
import { PrivateNoteSummary } from '../components/book/PrivateNoteSummary'
import { ProgressControl } from '../components/book/ProgressControl'
import { ReviewCard } from '../components/book/ReviewCard'
import { ReviewEditor } from '../components/book/ReviewEditor'
import { useCelebration } from '../components/celebrate/useCelebration'
import { useAuth } from '../lib/auth/useAuth'
import { enrichBook, getBookById } from '../lib/books/data'
import {
  getCircleReads,
  getMemberProgressForBook,
  getMyCircles,
  startCircleRead,
  type MemberProgress,
} from '../lib/circles/data'
import { getStreak, isStreakMilestone } from '../lib/goals/data'
import { resolveDisplayIdentity } from '../lib/profile/identity'
import {
  getAggregateRating,
  getBareRatings,
  getUserRating,
  setRating,
  type AggregateRating,
  type BareRating,
} from '../lib/ratings/data'
import {
  getOwnPrivateReview,
  getOwnPublicReview,
  getPublicReviews,
  saveReview,
  shareReviewToCircle,
} from '../lib/reviews/data'
import { logReadingProgress } from '../lib/sessions/data'
import { getShelfItemForBook, setShelfStatus } from '../lib/shelf/data'
import { getAllTags, getTagsForReview, setReviewTags } from '../lib/tags/data'
import type { Book, BookTag, Circle, Review, ShelfItem, ShelfStatus } from '../types/database'

type LoadState = 'loading' | 'error' | 'loaded' | 'not-found'
type Tab = 'about' | 'circle' | 'notes' | 'review'

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'about', label: 'About' },
  { tab: 'circle', label: 'Your circle' },
  { tab: 'notes', label: 'Your notes' },
  { tab: 'review', label: 'Review' },
]

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
  const [bareRatings, setBareRatings] = useState<BareRating[]>([])
  const [allTags, setAllTags] = useState<BookTag[]>([])

  const [myCircles, setMyCircles] = useState<Circle[]>([])
  // Which of my circles (if any) are actively reading this book together,
  // and who's where in it — mirrors the mockup's "Your circles" section
  // exactly rather than the old circle-review composer this tab used to
  // hold (posting/sharing a review to a circle still works fine from the
  // Notes and Review tabs' own "share" actions).
  const [readingTogether, setReadingTogether] = useState<{ circle: Circle; readId: string }[]>([])
  const [memberProgress, setMemberProgress] = useState<MemberProgress[]>([])
  const [addingToCircleId, setAddingToCircleId] = useState<string | null>(null)

  const [progressError, setProgressError] = useState<string | null>(null)

  // The immersive first-rating flow: shown right after rating, only while
  // the user has no private note yet for this book (once they save one,
  // or already had one, there's nothing to prompt for). Once a private
  // review exists, "My Notes" shows it read-only (see showNoteEditor
  // below) instead of always leaving the raw edit form open.
  const [showFirstRatingFlow, setShowFirstRatingFlow] = useState(false)
  const [firstRatingSaving, setFirstRatingSaving] = useState(false)
  const [firstRatingError, setFirstRatingError] = useState<string | null>(null)
  const [showNoteEditor, setShowNoteEditor] = useState(false)

  // "Write a Review" is a secondary, opt-in action now, not an editor
  // sitting open next to the shelf/rating area by default (see round 2's
  // rating/review restructure). Once opened for this page visit it stays
  // open, saving doesn't collapse it back.
  const [showReviewComposer, setShowReviewComposer] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('about')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!bookId || !user) return
      setState('loading')
      setError(null)
      // The route has no per-book `key`, so navigating from one book's
      // page straight to another (e.g. via a search result Link) reuses
      // this same component instance rather than remounting it. Without
      // resetting these here, leaving Book A's note open for editing and
      // then navigating to Book B would land on Book B's note already in
      // edit mode, exactly the "feels like the first time every time"
      // problem this component exists to avoid.
      setShowNoteEditor(false)
      setShowFirstRatingFlow(false)
      setFirstRatingError(null)
      setActiveTab('about')
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
        // Everyone who rated this book but has no public review to show
        // for it — see getBareRatings's doc comment for why this is safe
        // to surface even though it's not the current user's own data.
        setBareRatings(
          await getBareRatings(
            bookId,
            pubReviews.map((r) => r.user_id),
          ),
        )

        // Which of my circles (if any) have this exact book as an active
        // shared read, plus everyone's progress on it, for the "Your
        // circle" tab below.
        const readsPerCircle = await Promise.all(
          circles.map((circle) => getCircleReads(circle.id).then((reads) => ({ circle, reads }))),
        )
        const matches = readsPerCircle.flatMap(({ circle, reads }) =>
          reads
            .filter((read) => read.book_id === bookId && read.status === 'active')
            .map((read) => ({ circle, readId: read.id })),
        )
        setReadingTogether(matches)
        setMemberProgress(matches.length > 0 ? await getMemberProgressForBook(bookId) : [])

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
    if (!privateReview) setShowFirstRatingFlow(true)
    try {
      const updated = await setRating(user.id, bookId, stars)
      setMyRating(updated.stars)
      const agg = await getAggregateRating(bookId)
      setAggregate(agg)
    } catch (err) {
      setMyRating(previous)
      setShowFirstRatingFlow(false)
      setError(err instanceof Error ? err.message : 'Could not save your rating. Try again.')
    }
  }

  async function handleFirstRatingSave(text: string, tagIds: string[]) {
    if (!user || !bookId) return
    setFirstRatingSaving(true)
    setFirstRatingError(null)
    try {
      const review = await saveReview(
        { bookId, userId: user.id, body: text, containsSpoilers: false, visibility: 'private' },
        null,
      )
      await setReviewTags(review.id, tagIds)
      setPrivateReview(review)
      setPrivateTagIds(tagIds)
      setShowFirstRatingFlow(false)
    } catch (err) {
      setFirstRatingError(
        err instanceof Error ? err.message : 'Could not save that note. Try again.',
      )
    } finally {
      setFirstRatingSaving(false)
    }
  }

  function handleFirstRatingSkip() {
    setShowFirstRatingFlow(false)
  }

  async function handleShareToCircle(circleId: string, body: string) {
    if (!user || !bookId) return
    await shareReviewToCircle(user.id, bookId, circleId, body)
  }

  async function handleAddToCircle(circle: Circle) {
    if (!bookId) return
    setAddingToCircleId(circle.id)
    setError(null)
    try {
      const read = await startCircleRead(circle.id, bookId, null)
      setReadingTogether((prev) => [...prev, { circle, readId: read.id }])
      setMemberProgress(await getMemberProgressForBook(bookId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that to the circle.')
    } finally {
      setAddingToCircleId(null)
    }
  }

  async function handleLogProgress(toPage: number) {
    if (!user || !bookId) return
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
      const before = streakBefore?.current_streak ?? 0
      const after = streakAfter?.current_streak ?? 0
      if (isStreakMilestone(before, after)) {
        celebrate(`${after} days in a row. Keep it warm.`)
      }
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : 'Could not log your progress.')
      throw err // ProgressControl needs this to know the save failed and roll back its own display.
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

      {/* The immersive first-rating flow is a full-screen overlay, shown
          regardless of which tab is active — it's triggered by rating
          from the About tab, but it takes over the whole screen either
          way, so which tab sits underneath it doesn't matter. */}
      {showFirstRatingFlow && (
        <FirstRatingExperience
          bookTitle={book.title}
          allTags={allTags}
          onSave={(text, tagIds) => void handleFirstRatingSave(text, tagIds)}
          onSkip={handleFirstRatingSkip}
          saving={firstRatingSaving}
          error={firstRatingError}
        />
      )}

      {error && (
        <p className="mb-4 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
          {error}
        </p>
      )}

      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-full bg-tint p-1.5">
        {TABS.map(({ tab, label }) => {
          const active = tab === activeTab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-10 flex-1 rounded-full font-sans text-[12px] font-extrabold whitespace-nowrap transition-all active:scale-95 ${
                active ? 'bg-sage text-surface shadow-soft' : 'text-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {activeTab === 'about' && (
        <div style={{ animation: 'nib-in 0.2s ease both' }}>
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

          {/* Shelf status and progress are "my shelf entry for this book",
              grouped with the cover/rating/blurb above rather than with
              reviewing, which lives in its own tab now. A big primary CTA
              for starting/re-reading (mirrors the round 4 mockup's own
              "Start reading"/"Read it again" button), the progress slider
              takes over as the primary action once actually reading. */}
          <div className="mt-5 flex flex-col gap-3">
            {shelfItem?.status !== 'reading' && (
              <button
                type="button"
                onClick={() => void handleShelfChange('reading')}
                className="btn-cta w-full rounded-full bg-sage py-3.5 font-sans text-base font-bold text-surface"
              >
                {shelfItem?.status === 'finished' ? 'Read it again' : 'Start reading'}
              </button>
            )}

            {shelfItem?.status === 'reading' && (
              <div className="rounded-[22px] bg-surface p-4 shadow-soft">
                <h2 className="mb-3 font-display text-base font-semibold text-ink">
                  Your progress
                </h2>
                <ProgressControl
                  currentPage={shelfItem.current_page ?? 0}
                  pageCount={book.page_count}
                  onSave={(page) => handleLogProgress(page)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleShelfChange('want_to_read')}
                disabled={shelfItem?.status === 'want_to_read'}
                className="flex-1 rounded-full border-2 border-line bg-surface py-2.5 font-sans text-sm font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-60"
              >
                {shelfItem?.status === 'want_to_read' ? 'On your list ✓' : 'Save for later'}
              </button>
              <button
                type="button"
                onClick={() => void handleShelfChange('finished')}
                disabled={shelfItem?.status === 'finished'}
                className="flex-1 rounded-full border-2 border-line bg-surface py-2.5 font-sans text-sm font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-60"
              >
                {shelfItem?.status === 'finished' ? 'Finished ✓' : 'Mark finished'}
              </button>
            </div>
          </div>
          {progressError && (
            <p className="mt-2 font-sans text-sm text-honey-text">{progressError}</p>
          )}
        </div>
      )}

      {activeTab === 'circle' && (
        <section
          className="rounded-2xl bg-surface p-4 shadow-soft"
          style={{ animation: 'nib-in 0.2s ease both' }}
        >
          <p className="mb-3 font-sans text-xs text-muted">Small rooms, not a public feed.</p>

          {myCircles.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              You're not in any circles yet.{' '}
              <Link to="/circles" className="font-bold text-sage underline">
                Create or join one
              </Link>
              .
            </p>
          ) : readingTogether.length > 0 ? (
            <div className="flex flex-col gap-3">
              {readingTogether.map(({ circle, readId }) => (
                <Link
                  key={readId}
                  to={`/circles/${circle.id}`}
                  className="block rounded-2xl bg-tint p-3.5 transition-transform active:scale-[.985]"
                >
                  <span className="mb-1 block font-sans text-[11px] font-bold tracking-wide text-sage uppercase">
                    Reading this together
                  </span>
                  <span className="mb-3 block font-display text-base font-semibold text-ink">
                    {circle.name}
                  </span>
                  <ul className="flex flex-col gap-2.5">
                    {memberProgress.map((progress) => (
                      <li key={progress.id} className="flex items-center gap-2.5">
                        <span className="w-16 flex-none truncate font-sans text-xs font-bold text-muted">
                          {progress.profiles.id === user?.id
                            ? 'You'
                            : progress.profiles.display_name}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(progress.percent_complete ?? 0, 100)}%`,
                              background:
                                progress.profiles.id === user?.id
                                  ? 'var(--nibbles-ink)'
                                  : 'var(--nibbles-sage)',
                            }}
                          />
                        </div>
                        <span className="w-9 flex-none text-right font-sans text-xs font-bold text-muted">
                          {Math.round(progress.percent_complete ?? 0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
              <p className="font-sans text-xs text-muted">
                Nobody sees your exact page unless you share it.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="font-sans text-sm text-muted">
                None of your circles are reading this yet.
              </p>
              {myCircles.map((circle) => (
                <button
                  key={circle.id}
                  type="button"
                  onClick={() => void handleAddToCircle(circle)}
                  disabled={addingToCircleId === circle.id}
                  className="rounded-full border-2 border-line bg-surface py-2.5 font-sans text-sm font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-60"
                >
                  {addingToCircleId === circle.id ? 'Adding…' : `Add to ${circle.name}`}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'notes' && user && (
        <section
          className="rounded-2xl bg-surface p-4 shadow-soft"
          style={{ animation: 'nib-in 0.2s ease both' }}
        >
          <p className="mb-3 font-sans text-xs text-muted">
            Just for you. Never public unless you share it to a circle.
          </p>
          {privateReview && !showNoteEditor ? (
            // Read-only once a note exists, matching "Write a Review"'s
            // reveal-on-click shape, tapping Edit reveals the same form
            // the first-rating flow's save writes into. Avoids landing on
            // a raw edit form every visit once there's already something
            // saved, per the owner's "I don't want it to feel like the
            // first time every time" request.
            <PrivateNoteSummary
              review={privateReview}
              tags={allTags.filter((tag) => privateTagIds.includes(tag.id))}
              onEdit={() => setShowNoteEditor(true)}
              shareTargets={myCircles}
              onShare={(circleId, body) => handleShareToCircle(circleId, body)}
            />
          ) : (
            <ReviewEditor
              // Remounts fresh whenever the private review's identity
              // changes (null -> a real row, e.g. right after the
              // first-rating flow saves one), otherwise this editor's
              // internal body/tag state would stay frozen at whatever it
              // had on first mount and silently not show the note that
              // was just saved.
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
                setShowNoteEditor(false)
              }}
            />
          )}
        </section>
      )}

      {activeTab === 'review' && (
        <section
          className="rounded-2xl bg-surface p-4 shadow-soft"
          style={{ animation: 'nib-in 0.2s ease both' }}
        >
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
                  // Now shown as a full review above, not a bare rating row.
                  setBareRatings((prev) => prev.filter((r) => r.userId !== review.user_id))
                }}
              />
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4">
            {publicReviews.length === 0 && bareRatings.length === 0 ? (
              <p className="font-sans text-sm text-muted">
                No ratings or reviews yet. Be the first to share a thought.
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
                {/* Rated, but no public review to show, so a bare rating
                    still shows up here instead of only ever counting
                    silently toward the aggregate average up top. */}
                {bareRatings.map((rating) => (
                  <BareRatingRow
                    key={rating.userId}
                    displayName={rating.displayName}
                    stars={rating.stars}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
