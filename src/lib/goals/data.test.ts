import { describe, expect, it } from 'vitest'
import { isStreakMilestone } from './data'

describe('isStreakMilestone', () => {
  it('is false when the streak did not increase', () => {
    expect(isStreakMilestone(5, 5)).toBe(false)
    expect(isStreakMilestone(5, 4)).toBe(false)
  })

  it('celebrates the first small win at day 3', () => {
    expect(isStreakMilestone(2, 3)).toBe(true)
  })

  it('does not celebrate every day in between', () => {
    expect(isStreakMilestone(0, 1)).toBe(false)
    expect(isStreakMilestone(3, 4)).toBe(false)
    expect(isStreakMilestone(4, 5)).toBe(false)
    expect(isStreakMilestone(5, 6)).toBe(false)
  })

  it('celebrates every multiple of 7 after that', () => {
    expect(isStreakMilestone(6, 7)).toBe(true)
    expect(isStreakMilestone(13, 14)).toBe(true)
    expect(isStreakMilestone(27, 28)).toBe(true)
  })

  it('still celebrates a multiple of 7 even if the streak jumped past it (e.g. a delayed re-fetch)', () => {
    expect(isStreakMilestone(5, 8)).toBe(false)
    expect(isStreakMilestone(5, 7)).toBe(true)
  })
})
