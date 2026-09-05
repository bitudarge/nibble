import angry from '../../assets/mascot/mascot-angry.png'
import cheerful from '../../assets/mascot/mascot-cheerful.png'
import cheering from '../../assets/mascot/mascot-cheering.png'
import cool from '../../assets/mascot/mascot-cool.png'
import curious from '../../assets/mascot/mascot-curious.png'
import dizzy from '../../assets/mascot/mascot-dizzy.png'
import eating from '../../assets/mascot/mascot-eating.png'
import glasses from '../../assets/mascot/mascot-glasses.png'
import happy from '../../assets/mascot/mascot-happy.png'
import hearts from '../../assets/mascot/mascot-hearts.png'
import hiding from '../../assets/mascot/mascot-hiding.png'
import hug from '../../assets/mascot/mascot-hug.png'
import idea from '../../assets/mascot/mascot-idea.png'
import laptop from '../../assets/mascot/mascot-laptop.png'
import laughing from '../../assets/mascot/mascot-laughing.png'
import lyingHeart from '../../assets/mascot/mascot-lying-heart.png'
import lyingSad from '../../assets/mascot/mascot-lying-sad.png'
import resting from '../../assets/mascot/mascot-resting.png'
import sad from '../../assets/mascot/mascot-sad.png'
import sleepy from '../../assets/mascot/mascot-sleepy.png'
import surprised from '../../assets/mascot/mascot-surprised.png'
import thinking from '../../assets/mascot/mascot-thinking.png'
import waving from '../../assets/mascot/mascot-waving.png'
import wink from '../../assets/mascot/mascot-wink.png'

/**
 * The mascot's expression poses, cropped from the owner's own sprite
 * sheet (round 6: re-cropped from a higher-resolution 24-pose sheet using
 * `scripts/crop-mascots.cjs`, isolating each pose's actual alpha content
 * instead of a fixed 256x256 grid slice — the old crops showed a sliver
 * of the neighboring pose bleeding in at one edge, since poses don't sit
 * on a perfectly rigid grid).
 *
 * `eating`/`resting`/`idea` are used directly in fixed spots (profile
 * avatar picker, the rest-day-banked banner, the empty-shelf nudge) — see
 * their call sites. Every pose here is also offered in EditProfile's
 * mascot avatar picker.
 */
export const MASCOT_POSES = {
  eating,
  resting,
  idea,
  hearts,
  thinking,
  curious,
  happy,
  wink,
  laughing,
  hug,
  surprised,
  sleepy,
  glasses,
  laptop,
  cheerful,
  hiding,
  sad,
  cool,
  cheering,
  lyingSad,
  lyingHeart,
  dizzy,
  angry,
  waving,
} as const

export type MascotPose = keyof typeof MASCOT_POSES
