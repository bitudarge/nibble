import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChipToggle } from '../components/quiz/ChipToggle'
import { QuizProgress } from '../components/quiz/QuizProgress'
import { useAuth } from '../lib/auth/useAuth'
import { getBookById, getOrCreateBook } from '../lib/books/data'
import { searchOpenLibrary, type OpenLibrarySearchResult } from '../lib/books/openLibrary'
import {
  getSavedQuizAnswers,
  QUIZ_GENRE_OPTIONS,
  QUIZ_HEAVY_MOOD_OPTIONS,
  QUIZ_LIGHT_MOOD_OPTIONS,
  QUIZ_PACE_OPTIONS,
  QUIZ_READING_FREQUENCY_OPTIONS,
  saveQuizAnswers,
} from '../lib/recommender/quizProfile'
import type { TasteQuizAnswers } from '../lib/recommender/types'
import type { Book } from '../types/database'

const TOTAL_STEPS = 6
const MAX_FAVORITE_BOOKS = 5
const SEARCH_DEBOUNCE_MS = 300

// "sci-fi" -> "sci fi", "thought-provoking" -> "thought provoking" — the
// same casual, lowercase chip style already used for the mood chips on
// the Discover page.
function humanize(name: string): string {
  return name.replace(/-/g, ' ')
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * The onboarding taste quiz: five taps and an optional favorite-books
 * search, all skippable, that seed the recommender before the user has
 * rated a single book. See docs/refinement/master-prompt.md section 4
 * and src/lib/recommender/quizProfile.ts for how answers turn into
 * recommendation signal.
 */
export function TasteQuiz() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [genres, setGenres] = useState<string[]>([])
  const [pace, setPace] = useState<string | null>(null)
  const [moods, setMoods] = useState<string[]>([])
  const [fictionLean, setFictionLean] = useState<TasteQuizAnswers['fictionLean']>(null)
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([])
  const [readingFrequency, setReadingFrequency] = useState<string | null>(null)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [prefillLoaded, setPrefillLoaded] = useState(false)

  // Re-opening the quiz to edit a previous answer set should start from
  // what's already saved, not from scratch.
  useEffect(() => {
    let cancelled = false
    async function loadExisting() {
      if (!user) {
        if (!cancelled) setPrefillLoaded(true)
        return
      }
      try {
        const saved = await getSavedQuizAnswers(user.id)
        if (cancelled || !saved) return
        setGenres(saved.genres)
        setPace(saved.pace)
        setMoods(saved.moods)
        setFictionLean(saved.fictionLean)
        setReadingFrequency(saved.readingFrequency)
        if (saved.favoriteBookIds.length > 0) {
          const books = await Promise.all(saved.favoriteBookIds.map((id) => getBookById(id)))
          if (!cancelled) {
            setFavoriteBooks(books.filter((b): b is Book => b !== null))
          }
        }
      } catch {
        // A failed prefill just means starting fresh — not worth
        // blocking or alarming the user over.
      } finally {
        if (!cancelled) setPrefillLoaded(true)
      }
    }
    void loadExisting()
    return () => {
      cancelled = true
    }
  }, [user])

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function goNext() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function currentAnswers(): TasteQuizAnswers {
    return {
      genres,
      pace,
      moods,
      fictionLean,
      favoriteBookIds: favoriteBooks.map((b) => b.id),
      readingFrequency,
    }
  }

  async function finish(skipped: boolean) {
    if (!user) return
    setSaveState('saving')
    setSaveError(null)
    try {
      await saveQuizAnswers(user.id, currentAnswers(), { skipped })
      setSaveState('saved')
      navigate('/')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your answers.')
      setSaveState('error')
    }
  }

  if (!prefillLoaded) {
    return <p className="font-sans text-sm text-muted">Loading your taste quiz…</p>
  }

  return (
    <div className="mx-auto max-w-lg" style={{ animation: 'nib-in 0.26s ease both' }}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">What do you like to read?</h1>
        <button
          type="button"
          onClick={() => void finish(true)}
          disabled={saveState === 'saving'}
          className="mt-1 flex-none font-sans text-xs font-bold text-muted underline transition-opacity active:opacity-60 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
      <p className="mb-5 font-sans text-sm text-muted">
        A few taps now means better picks from day one. Skip anything you'd rather not answer.
      </p>

      <QuizProgress step={step} total={TOTAL_STEPS} />

      {step === 1 && (
        <QuizStep
          title="Which genres pull you in?"
          hint="Pick as many as you like."
          onNext={goNext}
        >
          <div className="flex flex-wrap gap-2">
            {QUIZ_GENRE_OPTIONS.map((genre) => (
              <ChipToggle
                key={genre}
                label={humanize(genre)}
                selected={genres.includes(genre)}
                onClick={() => toggle(genres, genre, setGenres)}
              />
            ))}
          </div>
        </QuizStep>
      )}

      {step === 2 && (
        <QuizStep title="How do you like a story to move?" onNext={goNext}>
          <div className="flex flex-wrap gap-2">
            {QUIZ_PACE_OPTIONS.map((option) => (
              <ChipToggle
                key={option}
                label={humanize(option)}
                selected={pace === option}
                onClick={() => setPace(pace === option ? null : option)}
              />
            ))}
          </div>
        </QuizStep>
      )}

      {step === 3 && (
        <QuizStep
          title="Light and cozy, or heavier and intense?"
          hint="Pick a few."
          onNext={goNext}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {QUIZ_LIGHT_MOOD_OPTIONS.map((mood) => (
              <ChipToggle
                key={mood}
                label={humanize(mood)}
                selected={moods.includes(mood)}
                onClick={() => toggle(moods, mood, setMoods)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUIZ_HEAVY_MOOD_OPTIONS.map((mood) => (
              <ChipToggle
                key={mood}
                label={humanize(mood)}
                selected={moods.includes(mood)}
                onClick={() => toggle(moods, mood, setMoods)}
              />
            ))}
          </div>
        </QuizStep>
      )}

      {step === 4 && (
        <QuizStep title="Fiction, non-fiction, or a bit of both?" onNext={goNext}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['fiction', 'mostly fiction'],
                ['mixed', 'a mix of both'],
                ['nonfiction', 'mostly non-fiction'],
              ] as const
            ).map(([value, label]) => (
              <ChipToggle
                key={value}
                label={label}
                selected={fictionLean === value}
                onClick={() => setFictionLean(fictionLean === value ? null : value)}
              />
            ))}
          </div>
        </QuizStep>
      )}

      {step === 5 && (
        <QuizStep
          title="A few books you loved?"
          hint="Optional. Search and add up to five."
          onNext={goNext}
        >
          <FavoriteBookSearch books={favoriteBooks} onChange={setFavoriteBooks} />
        </QuizStep>
      )}

      {step === 6 && (
        <QuizStep title="How much are you reading lately?" onNext={() => void finish(false)} isLast>
          <div className="mb-6 flex flex-wrap gap-2">
            {QUIZ_READING_FREQUENCY_OPTIONS.map((option) => (
              <ChipToggle
                key={option}
                label={option}
                selected={readingFrequency === option}
                onClick={() => setReadingFrequency(readingFrequency === option ? null : option)}
              />
            ))}
          </div>

          {saveState === 'error' && (
            <p className="mb-3 rounded-2xl border border-line bg-surface p-3 font-sans text-sm text-ink shadow-soft">
              {saveError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void finish(false)}
            disabled={saveState === 'saving'}
            className="w-full rounded-full bg-sage py-3 font-sans font-bold text-surface shadow-soft transition-transform active:scale-95 disabled:opacity-50"
          >
            {saveState === 'saving' ? 'Saving…' : 'Done, show me some books'}
          </button>
        </QuizStep>
      )}
    </div>
  )
}

function QuizStep({
  title,
  hint,
  onNext,
  isLast = false,
  children,
}: {
  title: string
  hint?: string
  onNext: () => void
  isLast?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">{title}</h2>
      {hint && <p className="mb-3 font-sans text-sm text-muted">{hint}</p>}
      <div className="mb-5">{children}</div>
      {!isLast && (
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-tint px-5 py-2.5 font-sans text-sm font-bold text-ink transition-transform active:scale-95"
        >
          Next
        </button>
      )}
    </div>
  )
}

/** A small self-contained search-to-add for the favorite-books question, reusing the same debounced Open Library search pattern as the Discover page. */
function FavoriteBookSearch({
  books,
  onChange,
}: {
  books: Book[]
  onChange: (books: Book[]) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function scheduleSearch(value: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const trimmed = value.trim()
    if (!trimmed) {
      abortRef.current?.abort()
      setResults([])
      setSearching(false)
      return
    }
    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)
      searchOpenLibrary(trimmed, controller.signal)
        .then((docs) => {
          setResults(docs)
          setSearching(false)
        })
        .catch(() => setSearching(false))
    }, SEARCH_DEBOUNCE_MS)
  }

  async function addBook(result: OpenLibrarySearchResult) {
    if (books.length >= MAX_FAVORITE_BOOKS) return
    setAddingId(result.openLibraryId)
    try {
      const book = await getOrCreateBook(result)
      if (!books.some((b) => b.id === book.id)) onChange([...books, book])
      setQuery('')
      setResults([])
    } catch {
      // A failed add just means this pick didn't stick — not worth
      // blocking the rest of the quiz over.
    } finally {
      setAddingId(null)
    }
  }

  function removeBook(bookId: string) {
    onChange(books.filter((b) => b.id !== bookId))
  }

  return (
    <div>
      {books.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => removeBook(book.id)}
                className="rounded-full bg-leaf px-3.5 py-2 font-sans text-[13px] font-bold text-on-leaf transition-transform active:scale-95"
              >
                {book.title} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {books.length < MAX_FAVORITE_BOOKS && (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              scheduleSearch(e.target.value)
            }}
            placeholder="Search for a book you loved"
            aria-label="Search for a favorite book"
            className="mb-2 w-full rounded-full bg-surface px-4 py-2.5 font-sans text-sm text-ink shadow-soft outline-none placeholder:text-muted"
          />
          {searching && <p className="font-sans text-xs text-muted">Searching…</p>}
          {results.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {results.slice(0, 5).map((result) => (
                <li key={result.openLibraryId}>
                  <button
                    type="button"
                    onClick={() => void addBook(result)}
                    disabled={addingId !== null}
                    className="flex w-full items-center justify-between rounded-2xl bg-surface px-3.5 py-2.5 text-left font-sans text-sm shadow-soft transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <span>
                      {result.title}
                      {result.author && <span className="text-muted"> · {result.author}</span>}
                    </span>
                    <span className="font-bold text-sage">
                      {addingId === result.openLibraryId ? 'Adding…' : 'Add'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
