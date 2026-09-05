import curious from '../../assets/mascot/mascot-curious.png'
import eating from '../../assets/mascot/mascot-eating.png'
import hearts from '../../assets/mascot/mascot-hearts.png'
import idea from '../../assets/mascot/mascot-idea.png'
import resting from '../../assets/mascot/mascot-resting.png'
import thinking from '../../assets/mascot/mascot-thinking.png'

/**
 * The mascot's expression poses, cropped from the owner's own sprite
 * sheet: `eating` for the profile avatar picker, `resting` next to the
 * rest-day-banked banner (a cozy day off, not literal illness), `idea`
 * for the empty-shelf "go discover" nudge, and `hearts`/`thinking`/
 * `curious` as further avatar picker choices and any future empty state
 * that needs one of these moods.
 */
export const MASCOT_POSES = {
  eating,
  resting,
  idea,
  hearts,
  thinking,
  curious,
} as const

export type MascotPose = keyof typeof MASCOT_POSES
