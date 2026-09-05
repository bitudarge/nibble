import { MASCOT_POSES, type MascotPose } from './mascotPoses'

export function Mascot({
  pose,
  alt,
  className = '',
}: {
  pose: MascotPose
  alt: string
  className?: string
}) {
  return <img src={MASCOT_POSES[pose]} alt={alt} className={`w-auto object-contain ${className}`} />
}
