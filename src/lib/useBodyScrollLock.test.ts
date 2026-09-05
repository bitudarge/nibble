import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useBodyScrollLock } from './useBodyScrollLock'

describe('useBodyScrollLock', () => {
  beforeEach(() => {
    // jsdom doesn't implement real scrolling/layout — stub it out so
    // these tests can assert scrollTo was called correctly without a
    // console "Not implemented" warning on every run.
    window.scrollTo = (() => {}) as typeof window.scrollTo
    document.body.style.position = ''
    document.body.style.top = ''
  })

  afterEach(() => {
    document.body.style.position = ''
    document.body.style.top = ''
  })

  it('pins the body in place with position: fixed while mounted', () => {
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true })
    const { unmount } = renderHook(() => useBodyScrollLock())

    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-240px')

    unmount()
  })

  it('restores the previous body styles and scroll position on unmount', () => {
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
    const scrollToCalls: [number, number][] = []
    window.scrollTo = ((x: number, y: number) => {
      scrollToCalls.push([x, y])
    }) as typeof window.scrollTo

    const { unmount } = renderHook(() => useBodyScrollLock())
    unmount()

    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(scrollToCalls).toEqual([[0, 100]])
  })
})
