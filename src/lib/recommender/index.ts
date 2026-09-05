/**
 * Public interface — everything outside this folder should import from
 * here, not from the individual files. That's what "isolated module" means
 * in practice: the UI (Dashboard, Recommendations page) and other data
 * layers (reviews, ratings) only ever call these functions, so the
 * internals can be rewritten without touching a single component.
 */

export { getRecommendations, hasCircleSignal, type Recommendation } from './recommend'
export {
  MIN_RATINGS_FOR_PERSONALIZATION,
  getOrComputeTasteProfile,
  recomputeTasteProfile,
} from './tasteProfile'
export { analyzeReviewText, type ReviewAnalysis } from './textAnalysis'
export type { TasteProfileData } from './types'
