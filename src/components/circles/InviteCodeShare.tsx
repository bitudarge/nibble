import { useState } from 'react'

/**
 * A circle's join code, shown big, with a real way to get it to a friend
 * (copy, or the phone's native share sheet where available) instead of
 * the plain text the owner had to manually select before. Same
 * "brief confirmation, then reset" shape as ReviewEditor's "Shared"
 * button (see handleShare there) for a consistent feel.
 */
export function InviteCodeShare({
  circleName,
  joinCode,
}: {
  circleName: string
  joinCode: string
}) {
  const [justCopied, setJustCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const shareText = `Join my circle "${circleName}" on Nibbles. Use the code ${joinCode} to join.`

  async function handleCopy() {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(joinCode)
      setJustCopied(true)
      window.setTimeout(() => setJustCopied(false), 2000)
    } catch {
      // Clipboard access can fail (non-HTTPS, older browsers, permission
      // denied) — the code is still shown on screen either way, so this
      // is a nudge to select it manually, not a broken feature.
      setCopyError("Couldn't copy automatically. You can select the code above instead.")
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ text: shareText })
    } catch {
      // Includes the user simply canceling the share sheet — not an error
      // worth surfacing.
    }
  }

  return (
    <div className="rounded-3xl bg-tint p-5 text-center">
      <div className="font-sans text-xs font-bold tracking-wide text-muted uppercase">
        Invite code
      </div>
      <div className="mt-1.5 font-display text-3xl font-bold tracking-wide text-ink">
        {joinCode}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-full bg-sage px-5 py-2.5 font-sans text-sm font-bold text-surface transition-transform active:scale-95"
        >
          {justCopied ? 'Copied!' : 'Copy code'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => void handleShare()}
            className="rounded-full border-2 border-line bg-surface px-5 py-2.5 font-sans text-sm font-bold text-ink transition-transform active:scale-95"
          >
            Share
          </button>
        )}
      </div>
      {copyError && <p className="mt-2 font-sans text-xs text-honey-text">{copyError}</p>}
    </div>
  )
}
