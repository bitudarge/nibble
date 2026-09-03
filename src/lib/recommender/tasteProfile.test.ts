import { describe, expect, it } from 'vitest'
import { mergeTagAffinity } from './tasteProfile'

describe('mergeTagAffinity', () => {
  it('adds values together per tag when both sides have a signal', () => {
    const merged = mergeTagAffinity({ 'genre:fantasy': 0.7 }, { 'genre:fantasy': 0.3 })
    expect(merged['genre:fantasy']).toBeCloseTo(1.0)
  })

  it('keeps quiz-only tags untouched by an unrelated rating signal', () => {
    const merged = mergeTagAffinity({ 'genre:fantasy': 0.7 }, { 'mood:cozy': 0.4 })
    expect(merged['genre:fantasy']).toBe(0.7)
    expect(merged['mood:cozy']).toBe(0.4)
  })

  it('returns the rating affinity unchanged when there is no quiz signal', () => {
    const merged = mergeTagAffinity(undefined, { 'pace:slow-burn': -0.2 })
    expect(merged).toEqual({ 'pace:slow-burn': -0.2 })
  })

  it('returns the quiz affinity unchanged when there are no ratings yet', () => {
    const merged = mergeTagAffinity({ 'genre:fantasy': 0.7 }, {})
    expect(merged).toEqual({ 'genre:fantasy': 0.7 })
  })
})
