import { useEffect } from 'react'

/**
 * Locks the page behind a full-screen overlay (PageLogSheet, and any
 * future one) while it's mounted. A plain `overflow: hidden` on `<body>`
 * — what this replaced — does NOT reliably stop touch scrolling on iOS
 * Safari: the background page can still be dragged underneath a `fixed`
 * overlay, which is very likely what the owner's phone testing described
 * as the sheet "getting stuck" (the overlay and the still-scrollable page
 * fighting over the same touch gesture, so the whole screen feels frozen
 * or jumps around). The standard, actually-reliable fix is to pin the
 * body itself in place with `position: fixed` at its current scroll
 * offset, then restore both the styles and the scroll position on
 * cleanup so the page doesn't jump when the overlay closes.
 */
export function useBodyScrollLock() {
  useEffect(() => {
    const { body } = document
    const scrollY = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      window.scrollTo(0, scrollY)
    }
  }, [])
}
