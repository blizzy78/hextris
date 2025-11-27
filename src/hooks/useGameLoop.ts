// Game loop hook with requestAnimationFrame

import { useEffect, useEffectEvent, useRef } from 'react'
import { GameStatus } from '../game/types'
import { useGameLoopStore } from '../stores/gameLoopStore'
import { useGameStore } from '../stores/gameStore'

interface GameLoopCallbacks {
  onDrop: () => void
}

/**
 * Game loop hook using requestAnimationFrame
 * Manages automatic piece dropping based on current game speed
 */
export function useGameLoop(callbacks: GameLoopCallbacks) {
  const lastDropTime = useRef(0)
  const animationFrameId = useRef<number | null>(null)
  const lastFrameTime = useRef<number>(0)

  // Effect Event for non-reactive callback access - always gets latest without triggering Effect re-runs
  const onDrop = useEffectEvent(() => {
    callbacks.onDrop()
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

      // Check if it's time to drop
      const timeSinceLastDrop = currentTime - lastDropTime.current
      if (timeSinceLastDrop >= speed) {
        onDrop()
        lastDropTime.current = currentTime
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
