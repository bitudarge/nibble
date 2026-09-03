import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCelebration } from './useCelebration'

describe('useCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing until celebrate is called', () => {
    const { result } = renderHook(() => useCelebration())
    expect(result.current.node).toBeNull()
  })

  it('shows the message after celebrate is called', () => {
    const { result } = renderHook(() => useCelebration())
    act(() => result.current.celebrate('Finished! Nibbles is proud.'))
    const { getByText } = render(<>{result.current.node}</>)
    expect(getByText('Finished! Nibbles is proud.')).toBeInTheDocument()
  })

  it('clears itself after the celebration duration', () => {
    const { result } = renderHook(() => useCelebration())
    act(() => result.current.celebrate('Finished!'))
    expect(result.current.node).not.toBeNull()
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.node).toBeNull()
  })

  it('a second call while one is showing replaces it rather than stacking', () => {
    const { result } = renderHook(() => useCelebration())
    act(() => result.current.celebrate('First'))
    act(() => vi.advanceTimersByTime(500))
    act(() => result.current.celebrate('Second'))
    const { getByText, queryByText } = render(<>{result.current.node}</>)
    expect(getByText('Second')).toBeInTheDocument()
    expect(queryByText('First')).not.toBeInTheDocument()

    // The second call's own timer should still be the one in control, not
    // cut short by the first call's original schedule.
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current.node).not.toBeNull()
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.node).toBeNull()
  })
})
