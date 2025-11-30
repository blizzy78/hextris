// Keyboard input handling hook

import { useEffect, useEffectEvent, useRef } from 'react'

export interface KeyboardControls {
  onMoveLeft: () => void
  onMoveRight: () => void
  onMoveDown: () => void
  onRotate: () => void
  onHardDrop: () => void
}

/**
 * Hook to handle keyboard input for game controls
 * Prevents default browser behavior for game keys
 * Implements debouncing for continuous key presses
 */
// Debounce intervals in milliseconds (defined outside component to avoid recreation)
const DEBOUNCE_INTERVALS = {
  move: 50,      // Horizontal/vertical movement
  rotate: 50,    // Rotation
  hardDrop: 300   // Hard drop (prevent accidental double drops)
}

export function useKeyboard(controls: KeyboardControls, enabled = true) {
  // Track last action time for debouncing
  const lastActionTime = useRef<Record<string, number>>({})

  // Effect Events for non-reactive control access - always get latest callbacks without triggering Effect re-runs
  const onMoveLeft = useEffectEvent(() => controls.onMoveLeft())
  const onMoveRight = useEffectEvent(() => controls.onMoveRight())
  const onMoveDown = useEffectEvent(() => controls.onMoveDown())
  const onRotate = useEffectEvent(() => controls.onRotate())
  const onHardDrop = useEffectEvent(() => controls.onHardDrop())

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now()

      // Check debounce for specific actions
      const checkDebounce = (action: string, interval: number): boolean => {
        const lastTime = lastActionTime.current[action] || 0
        if (now - lastTime < interval) {
          return false
        }
        lastActionTime.current[action] = now
        return true
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          if (checkDebounce('moveLeft', DEBOUNCE_INTERVALS.move)) {
            onMoveLeft()
          }
          break

        case 'ArrowRight':
          event.preventDefault()
          if (checkDebounce('moveRight', DEBOUNCE_INTERVALS.move)) {
            onMoveRight()
          }
          break

        case 'ArrowDown':
          event.preventDefault()
          if (checkDebounce('moveDown', DEBOUNCE_INTERVALS.move)) {
            onMoveDown()
          }
          break

        case 'ArrowUp':
          event.preventDefault()
          if (checkDebounce('rotate', DEBOUNCE_INTERVALS.rotate)) {
            onRotate()
          }
          break

        case ' ':
          event.preventDefault()
          if (checkDebounce('hardDrop', DEBOUNCE_INTERVALS.hardDrop)) {
            onHardDrop()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled]) // Effect only re-runs when enabled changes, not when callbacks change
}
