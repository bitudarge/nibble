/**
 * A single pulsing placeholder block, shaped (via className/style) like
 * whatever real content will replace it — a book cover, a line of text, a
 * card. The owner asked for "a skeleton so that the user doesn't leave"
 * after finding page loads slow: a content-shaped placeholder that shows
 * up instantly reads as "the page is working," where a blank screen or a
 * single line of "Loading…" text reads as broken or stalled, especially
 * on a slow connection. `aria-hidden` since a screen reader has nothing
 * useful to announce about a placeholder shape — each page's own loading
 * wrapper carries the real "loading" announcement.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-tint ${className}`} />
}
