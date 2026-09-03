import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { hasTakenOrSkippedQuiz } from '../lib/recommender/quizProfile'

function CenteredLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page font-sans text-muted">
      Loading…
    </div>
  )
}

/**
 * Redirects signed-out visitors to /login. All app pages sit behind this.
 * Also sends a freshly signed-in user to the taste quiz exactly once, if
 * they've never taken or skipped it — see src/routes/TasteQuiz.tsx and
 * quizProfile.ts's hasTakenOrSkippedQuiz.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [quizCheckDone, setQuizCheckDone] = useState(false)
  const [needsQuizPrompt, setNeedsQuizPrompt] = useState(false)
  // Flips true the moment we've sent the user to /quiz once, so this
  // never fires again even if they navigate away before finishing it —
  // a single friendly detour, not a wall.
  const [hasPromptedQuiz, setHasPromptedQuiz] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!user) return
      try {
        const taken = await hasTakenOrSkippedQuiz(user.id)
        if (!cancelled) setNeedsQuizPrompt(!taken)
      } catch {
        // A failed check just means no prompt this time — never worth
        // trapping someone behind a broken loading screen over it.
        if (!cancelled) setNeedsQuizPrompt(false)
      } finally {
        if (!cancelled) setQuizCheckDone(true)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [user])

  const shouldPromptQuiz = needsQuizPrompt && !hasPromptedQuiz && location.pathname !== '/quiz'

  // The setState + navigate below run from a microtask rather than the
  // effect body directly, so React treats them as coming from a
  // callback rather than synchronously from the effect (same pattern as
  // Search.tsx's initial-query effect).
  useEffect(() => {
    if (!shouldPromptQuiz) return
    void Promise.resolve().then(() => {
      setHasPromptedQuiz(true)
      navigate('/quiz', { replace: true })
    })
  }, [shouldPromptQuiz, navigate])

  if (loading) return <CenteredLoading />
  if (!session) return <Navigate to="/login" replace />
  if (!quizCheckDone) return <CenteredLoading />
  // Held here for one extra tick while the effect above navigates away,
  // rather than flashing the real page first.
  if (shouldPromptQuiz) return <CenteredLoading />

  return <>{children}</>
}
