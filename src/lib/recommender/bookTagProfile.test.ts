import { describe, expect, it } from 'vitest'
import { addCategoryTagCounts } from './bookTagProfile'

describe('addCategoryTagCounts', () => {
  it('adds a genre:* entry for each matched category', () => {
    const result = addCategoryTagCounts({}, ['Fiction / Fantasy'])
    expect(result).toEqual({ 'genre:fantasy': 1 })
  })

  it('leaves existing review-derived counts untouched and adds alongside them', () => {
    const result = addCategoryTagCounts({ 'mood:cozy': 3 }, ['Fiction / Fantasy'])
    expect(result).toEqual({ 'mood:cozy': 3, 'genre:fantasy': 1 })
  })

  it('only counts a genre once even if multiple categories match the same tag', () => {
    const result = addCategoryTagCounts({}, ['Fiction / Fantasy', 'Fantasy / Epic'])
    expect(result).toEqual({ 'genre:fantasy': 1 })
  })

  it('stacks with an existing count on the same genre from real reviews', () => {
    const result = addCategoryTagCounts({ 'genre:fantasy': 2 }, ['Fiction / Fantasy'])
    expect(result).toEqual({ 'genre:fantasy': 3 })
  })

  it('ignores categories that match nothing, without erroring', () => {
    const result = addCategoryTagCounts({ 'mood:cozy': 1 }, ['Cooking'])
    expect(result).toEqual({ 'mood:cozy': 1 })
  })

  it('is pure: does not mutate the input object', () => {
    const input = { 'mood:cozy': 1 }
    addCategoryTagCounts(input, ['Fiction / Fantasy'])
    expect(input).toEqual({ 'mood:cozy': 1 })
  })

  it('returns the same reference when no categories match, avoiding an unnecessary copy', () => {
    const input = { 'mood:cozy': 1 }
    expect(addCategoryTagCounts(input, ['Cooking'])).toBe(input)
  })

  it('handles an empty categories list', () => {
    const input = { 'mood:cozy': 1 }
    expect(addCategoryTagCounts(input, [])).toBe(input)
  })
})
