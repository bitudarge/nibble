import lockup from '../../assets/brand/nibbles-logo-lockup.png'
import mascot from '../../assets/brand/nibbles-mascot.png'

/**
 * The app's real logo art, isolated here so it's a one-file swap if the
 * owner wants to change it again later, nothing else needs to change.
 * Two variants of the same mark: `full` (mascot + "Nibbles" wordmark) for
 * places with horizontal room, `mark` (mascot alone) for tight spaces like
 * the phone header.
 */
export function Logo({
  className = '',
  variant = 'full',
}: {
  className?: string
  variant?: 'full' | 'mark'
}) {
  // `w-auto` (not `h-auto`) so every call site's own height class (h-9,
  // h-16, ...) is the one thing controlling size — two Tailwind classes
  // that both set `height` fight over CSS source order, which is fragile,
  // so only one of width/height is ever set here, the caller always
  // supplies the other via className.
  if (variant === 'mark') {
    return <img src={mascot} alt="Nibbles" className={`w-auto object-contain ${className}`} />
  }
  return <img src={lockup} alt="Nibbles" className={`w-auto object-contain ${className}`} />
}
