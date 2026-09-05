import { describe, expect, it } from 'vitest'
import {
  daysReadFromSessionDates,
  getIsoWeekPeriodKey,
  getMonthPeriodKey,
  isStreakMilestone,
} from './data'

describe('getMonthPeriodKey', () => {
  it('pads single-digit months', () => {
    expect(getMonthPeriodKey(new Date(2026, 0, 15))).toBe('2026-01')
    expect(getMonthPeriodKey(new Date(2026, 8, 4))).toBe('2026-09')
  })

  it('does not pad the year or double-pad the month', () => {
    expect(getMonthPeriodKey(new Date(2026, 11, 31))).toBe('2026-12')
  })
})

describe('getIsoWeekPeriodKey', () => {
  it('puts January 1st-4th in week 1, by definition of the ISO rule', () => {
    expect(getIsoWeekPeriodKey(new Date(2026, 0, 1))).toBe('2026-W01')
    expect(getIsoWeekPeriodKey(new Date(2026, 0, 4))).toBe('2026-W01')
  })

  it('rolls over to week 2 the following Monday', () => {
    expect(getIsoWeekPeriodKey(new Date(2026, 0, 5))).toBe('2026-W02')
  })

  it("assigns late-December dates to the following year's week 1 when the Thursday falls there", () => {
    // 2026-12-28..31 and 2027-01-01..03 all share the same ISO week
    // (their Thursday, 2026-12-31, is still in 2026), so this is 2026's
    // 53rd week even though it stretches into January 2027.
    expect(getIsoWeekPeriodKey(new Date(2026, 11, 28))).toBe('2026-W53')
    expect(getIsoWeekPeriodKey(new Date(2026, 11, 31))).toBe('2026-W53')
    expect(getIsoWeekPeriodKey(new Date(2027, 0, 1))).toBe('2026-W53')
    expect(getIsoWeekPeriodKey(new Date(2027, 0, 3))).toBe('2026-W53')
    expect(getIsoWeekPeriodKey(new Date(2027, 0, 4))).toBe('2027-W01')
  })

  it('handles the other direction: early-January dates belonging to the previous ISO year', () => {
    // 2020 was a 53-week ISO year; 2021-01-01..03 fall in its last week.
    expect(getIsoWeekPeriodKey(new Date(2020, 11, 28))).toBe('2020-W53')
    expect(getIsoWeekPeriodKey(new Date(2021, 0, 3))).toBe('2020-W53')
    expect(getIsoWeekPeriodKey(new Date(2021, 0, 4))).toBe('2021-W01')
  })
})

// Pre-existing function, no behavior change in this section, but it's now
// used from a second call site (the "record your streak" button), so a
// quick regression check here is cheap insurance.
describe('isStreakMilestone', () => {
  it('fires at day 3 and every 7 days after', () => {
    expect(isStreakMilestone(2, 3)).toBe(true)
    expect(isStreakMilestone(6, 7)).toBe(true)
    expect(isStreakMilestone(13, 14)).toBe(true)
  })

  it('does not fire on a non-milestone day or when the streak did not increase', () => {
    expect(isStreakMilestone(3, 4)).toBe(false)
    expect(isStreakMilestone(5, 5)).toBe(false)
    expect(isStreakMilestone(7, 6)).toBe(false)
  })
})

describe('daysReadFromSessionDates', () => {
  const MONDAY = '2026-09-07'

  it('marks Monday and Wednesday true from two session dates', () => {
    expect(daysReadFromSessionDates(['2026-09-07', '2026-09-09'], MONDAY)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('ignores duplicate dates and dates outside the week', () => {
    expect(
      daysReadFromSessionDates(['2026-09-07', '2026-09-07', '2026-09-14', '2026-08-31'], MONDAY),
    ).toEqual([true, false, false, false, false, false, false])
  })

  it('returns all-false for an empty week', () => {
    expect(daysReadFromSessionDates([], MONDAY)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })
})
