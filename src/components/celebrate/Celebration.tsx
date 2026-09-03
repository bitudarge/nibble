/**
 * The visual half of a finish/streak celebration: a handful of small
 * honey/sage petals drifting down (nib-fall, staggered per particle) plus
 * a toast-style message (nib-toast), both defined in src/index.css. Purely
 * decorative (aria-hidden particles, the message itself is the only thing
 * announced) and pointer-events-none so it never blocks a tap underneath
 * it. Self-dismissing: whoever renders this only needs to stop rendering
 * it after a bit, see useCelebration in useCelebration.ts for that timing.
 */
const PARTICLE_COUNT = 9

export function Celebration({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute top-0 h-2.5 w-4 rounded-full"
          style={{
            left: `${6 + i * 10}%`,
            background: i % 2 === 0 ? 'var(--nibbles-honey)' : 'var(--nibbles-sage)',
            animation: `nib-fall 1.6s ease-in ${((i % 5) * 0.12).toFixed(2)}s both`,
          }}
        />
      ))}
      <div
        role="status"
        className="absolute inset-x-0 bottom-24 mx-auto w-fit max-w-[85%] rounded-full bg-ink px-4 py-2.5 text-center font-sans text-sm font-bold text-page shadow-lift"
        style={{ animation: 'nib-toast 1.8s ease both' }}
      >
        {message}
      </div>
    </div>
  )
}
