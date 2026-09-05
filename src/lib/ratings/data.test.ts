import { describe, expect, it } from 'vitest'
import { excludeReviewedRatings } from './data'

describe('excludeReviewedRatings', () => {
  it('drops ratings from anyone whose public review already shows separately', () => {
    const rows = [
      { user_id: 'u1', stars: 4, profiles: { display_name: 'Ada' } },
      { user_id: 'u2', stars: 5, profiles: { display_name: 'Bo' } },
    ]
    expect(excludeReviewedRatings(rows, ['u1'])).toEqual([
      { userId: 'u2', displayName: 'Bo', stars: 5 },
    ])
  })

  it('keeps every rating when nobody has a public review yet', () => {
    const rows = [{ user_id: 'u1', stars: 3, profiles: { display_name: 'Ada' } }]
    expect(excludeReviewedRatings(rows, [])).toEqual([
      { userId: 'u1', displayName: 'Ada', stars: 3 },
    ])
  })

  it('falls back to a generic label when the profile join comes back null', () => {
    const rows = [{ user_id: 'u1', stars: 2, profiles: null }]
    expect(excludeReviewedRatings(rows, [])).toEqual([
      { userId: 'u1', displayName: 'A reader', stars: 2 },
    ])
  })

  it('returns nothing for an empty rating list', () => {
    expect(excludeReviewedRatings([], [])).toEqual([])
  })
})
