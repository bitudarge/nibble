/**
 * The app's wordmark, isolated here so the owner can swap in a real logo
 * later by editing only this file — nothing else needs to change.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight text-sage ${className}`}>
      Nibbles
    </span>
  )
}
