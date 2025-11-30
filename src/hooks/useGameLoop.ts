// Game loop hook with requestAnimationFrame

import { useEffect, useEffectEvent, useRef } from 'react'
import { GameStatus } from '../game/types'
import { useGameLoopStore } from '../stores/gameLoopStore'
import { useGameStore } from '../stores/gameStore'

// Lock delay in milliseconds - time player has to move/rotate before piece locks
export const LOCK_DELAY_MS = 500

interface GameLoopCallbacks {
  onDrop: () => void
  onLock: () => void
}

/**
 * Game loop hook using requestAnimationFrame
 * Manages automatic piece dropping based on current game speed
 * Also manages lock delay for tucking support
 */
export function useGameLoop(callbacks: GameLoopCallbacks) {
  const lastDropTime = useRef(0)
  const animationFrameId = useRef<number | null>(null)
  const lastFrameTime = useRef<number>(0)

  // Effect Event for non-reactive callback access - always gets latest without triggering Effect re-runs
  const onDrop = useEffectEvent(() => {
    callbacks.onDrop()
  })

  const onLock = useEffectEvent(() => {
    callbacks.onLock()
  })

  const status = useGameStore((state) => state.status)
  const speed = useGameStore((state) => state.speed)

  useEffect(() => {
    // Only run game loop when playing
    if (status !== GameStatus.Playing) {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = null
      }
      return
    }

    // Reset timers when starting
    lastDropTime.current = performance.now()
    lastFrameTime.current = performance.now()

    const gameLoop = (currentTime: number) => {
      const delta = currentTime - lastFrameTime.current
      lastFrameTime.current = currentTime

      // Update elapsed time
      useGameLoopStore.getState().updateElapsed(delta)

      // Check lock delay expiration
      const gameState = useGameStore.getState()
      if (gameState.isLocking && gameState.lockStartTime > 0) {
        const lockElapsed = currentTime - gameState.lockStartTime
        if (lockElapsed >= LOCK_DELAY_MS) {
          onLock()
          // Reset drop timer after lock to give time for new piece
          lastDropTime.current = currentTime
        }
      }

      // Check if it's time to drop (only if not in lock delay)
      if (!gameState.isLocking) {
        const timeSinceLastDrop = currentTime - lastDropTime.current
        if (timeSinceLastDrop >= speed) {
          onDrop()
          lastDropTime.current = currentTime
        }
      }

      // Continue loop
      animationFrameId.current = requestAnimationFrame(gameLoop)
    }

    // Start the loop
    animationFrameId.current = requestAnimationFrame(gameLoop)

    // Cleanup
    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = null
      }
    }
  }, [status, speed])
}
