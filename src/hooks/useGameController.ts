import { createBlinkGrid, createBombBlinkGrid } from '@/game/animationHelpers'
import { FIELD_SHAPE } from '@/game/gameModes'
import { axialToKey } from '@/game/hexMath'
import type { LineClearStage } from '@/game/lineDetection'
import { detectLinesForAnimation, getGravityFrames } from '@/game/lineDetection'
import { hardDrop, moveDown, moveDownLeft, moveDownRight, moveLeft, moveRight, rotateWithWallKick } from '@/game/movement'
import { getPieceCells } from '@/game/pieces'
import { calculateCascadeScore, calculateLevel, calculateLockScore, calculateSpeed } from '@/game/scoring'
import { applyBombExplosions, getFilledNeighbors, maybeSpawnSpecialCell } from '@/game/specialCells'
import type { AxialCoord, GridState, Piece } from '@/game/types'
import { GameStatus } from '@/game/types'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useGameStore } from '@/stores/gameStore'
import { useHighScoreStore } from '@/stores/highScoreStore'
import { useCallback, useEffect, useEffectEvent } from 'react'

// Animation timing constants (ms)
const ANIMATION_TIMING = {
  BLINK_DURATION: 200,
  CLEAR_DELAY: 150,
  GRAVITY_FRAME: 100,
  STAGE_DELAY: 100,
} as const

/**
 * Promise-based delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Animate gravity frames sequentially
 */
async function animateGravityFrames(frames: GridState[]): Promise<void> {
  for (const frame of frames) {
    useGameStore.setState({ grid: frame })
    await delay(ANIMATION_TIMING.GRAVITY_FRAME)
  }
}





/**
 * Process a single line-clearing stage with animation
 */
async function processLineClearStage(
  stage: LineClearStage,
  previousGridAfterGravity: GridState | null
): Promise<void> {
  // Get base grid for clearing animation
  const currentGrid = previousGridAfterGravity ?? useGameStore.getState().grid

  // Show fade to white animation for line clear
  const blinkGrid = createBlinkGrid(currentGrid, stage.lines)
  useGameStore.setState({ grid: blinkGrid })
  await delay(ANIMATION_TIMING.BLINK_DURATION)

  // Show grid after lines cleared (before bomb explosions)
  useGameStore.setState({ grid: stage.gridAfterLineClear })
  await delay(ANIMATION_TIMING.CLEAR_DELAY)

  // Animate bomb explosions if any
  if (stage.bombExplosionCells.length > 0) {
    const bombBlinkGrid = createBombBlinkGrid(stage.gridAfterLineClear, stage.bombExplosionCells)
    useGameStore.setState({ grid: bombBlinkGrid })
    await delay(ANIMATION_TIMING.BLINK_DURATION)

    // Show grid after bomb explosions
    useGameStore.setState({ grid: stage.gridAfterClear })
    await delay(ANIMATION_TIMING.CLEAR_DELAY)
  }

  // Animate gravity if needed
  if (stage.gravityFrames.length > 0) {
    await animateGravityFrames(stage.gravityFrames)
  }

  await delay(ANIMATION_TIMING.STAGE_DELAY)
}

/**
 * Process all line-clearing stages and update game state
 */
async function processAllLineClearStages(
  stages: LineClearStage[],
  updateScore: (points: number) => void,
  updateLinesCleared: (count: number) => void
): Promise<number> {
  let totalLinesCleared = 0
  let totalPoints = 0
  let previousGridAfterGravity: GridState | null = null

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stage = stages[stageIndex]!
    const cascadeStage = stageIndex + 1 // 1-indexed (1 = initial, 2+ = cascades)

    totalLinesCleared += stage.lines.length

    // Calculate points for this stage with cascade multiplier and special cell bonus
    const latestState = useGameStore.getState()
    const stagePoints = calculateCascadeScore(
      stage.lines.length,
      latestState.level,
      cascadeStage,
      stage.hasMultiplier
    )
    totalPoints += stagePoints

    await processLineClearStage(stage, previousGridAfterGravity)
    previousGridAfterGravity = stage.gridAfterGravity

    // After gravity settles, maybe spawn a special cell
    const currentGrid = useGameStore.getState().grid
    const gridWithSpecial = maybeSpawnSpecialCell(currentGrid, FIELD_SHAPE, latestState.level)
    if (gridWithSpecial !== currentGrid) {
      useGameStore.setState({ grid: gridWithSpecial })
    }
  }

  // Update score and level after all animations complete
  updateScore(totalPoints)
  updateLinesCleared(totalLinesCleared)

  const latestState = useGameStore.getState()
  const newLevel = calculateLevel(latestState.linesCleared + totalLinesCleared)
  const newSpeed = calculateSpeed(newLevel)
  useGameStore.setState({ level: newLevel, speed: newSpeed })

  return totalLinesCleared
}

/**
 * Handle game over: update high score if needed
 */
function handleGameOver(
  highScore: number,
  setHighScore: (score: number) => void,
  setPreviousHighScore: (score: number) => void,
  setIsNewHighScore: (isNew: boolean) => void
): void {
  const finalScore = useGameStore.getState().score
  setPreviousHighScore(highScore)
  setIsNewHighScore(finalScore > highScore)
  setHighScore(finalScore)
}

/**
 * Game controller hook - orchestrates game logic, input handling, and game loop.
 * Keeps route files simple by encapsulating all game behavior.
 */
export function useGameController() {
  const highScore = useHighScoreStore((state) => state.highScore)
  const setHighScore = useHighScoreStore((state) => state.setHighScore)

  // Game state
  const grid = useGameStore((state) => state.grid)
  const currentPiece = useGameStore((state) => state.currentPiece)
  const nextPiece = useGameStore((state) => state.nextPiece)
  const score = useGameStore((state) => state.score)
  const level = useGameStore((state) => state.level)
  const linesCleared = useGameStore((state) => state.linesCleared)
  const status = useGameStore((state) => state.status)

  // Game actions
  const startGame = useGameStore((state) => state.startGame)
  const lockPiece = useGameStore((state) => state.lockPiece)
  const updateCurrentPiece = useGameStore((state) => state.updateCurrentPiece)
  const updateScore = useGameStore((state) => state.updateScore)
  const updateLinesCleared = useGameStore((state) => state.updateLinesCleared)
  const spawnNextPiece = useGameStore((state) => state.spawnNextPiece)
  const setIsNewHighScore = useGameStore((state) => state.setIsNewHighScore)
  const setPreviousHighScore = useGameStore((state) => state.setPreviousHighScore)
  // Lock delay actions
  const startLocking = useGameStore((state) => state.startLocking)
  const resetLocking = useGameStore((state) => state.resetLocking)
  const cancelLocking = useGameStore((state) => state.cancelLocking)

  // Check if piece is in a "would lock" position and manage lock delay accordingly
  // Called after every successful movement to ensure lock delay starts immediately
  const checkAndUpdateLockState = useCallback((piece: NonNullable<typeof currentPiece>) => {
    const state = useGameStore.getState()
    const canMoveDown = moveDown(piece, state.grid, FIELD_SHAPE) !== null

    if (canMoveDown) {
      // Piece can move down - cancel any lock delay
      cancelLocking()
    } else {
      // Piece can't move down - start or reset lock delay
      if (state.isLocking) {
        resetLocking()
      } else {
        startLocking()
      }
    }
  }, [cancelLocking, resetLocking, startLocking])

  // Handle piece drop (called by game loop timer)
  const handleDrop = useCallback(() => {
    const state = useGameStore.getState()
    if (!state.currentPiece || state.status !== GameStatus.Playing) return

    const movedPiece = moveDown(state.currentPiece, state.grid, FIELD_SHAPE)

    if (movedPiece) {
      updateCurrentPiece(movedPiece)
      // Piece moved down successfully, cancel any lock delay
      cancelLocking()
      return
    }

    // Piece can't move down - start lock delay for tucking
    startLocking()
  }, [updateCurrentPiece, startLocking, cancelLocking])

  // Handle actual piece lock (called when lock delay expires or on hard drop)
  // When force=true, skip the "can move down" check (used for hard drop)
  const handleLock = useCallback((force = false) => {
    const state = useGameStore.getState()
    if (!state.currentPiece || state.status !== GameStatus.Playing) return

    // Unless forced, check if piece can still move down (player may have moved it)
    if (!force) {
      const movedPiece = moveDown(state.currentPiece, state.grid, FIELD_SHAPE)
      if (movedPiece) {
        // Piece can now move - cancel lock and continue
        updateCurrentPiece(movedPiece)
        cancelLocking()
        return
      }
    }

    // Capture piece info before locking (needed for bomb animation)
    const lockedPiece = state.currentPiece

    // Lock the piece
    cancelLocking()
    lockPiece(lockedPiece)
    const lockPoints = calculateLockScore(state.level)
    updateScore(lockPoints)

    // Handle bomb piece explosion with animation
    const processBombPieceExplosion = async (piece: Piece): Promise<void> => {
      const pieceCells = getPieceCells(piece)
      const gridAfterLock = useGameStore.getState().grid

      // Get all cells that will be destroyed by the bomb
      const cellsToDestroy: AxialCoord[] = []
      for (const bombCoord of pieceCells) {
        const neighbors = getFilledNeighbors(bombCoord, gridAfterLock, FIELD_SHAPE)
        for (const neighbor of neighbors) {
          // Don't include the bomb cells themselves in the explosion effect
          const neighborKey = axialToKey(neighbor)
          const isBombCell = pieceCells.some(c => axialToKey(c) === neighborKey)
          if (!isBombCell) {
            cellsToDestroy.push(neighbor)
          }
        }
      }

      // Combine bomb cells + destroyed cells for blink effect
      const allAffectedCells = [...pieceCells, ...cellsToDestroy]

      if (allAffectedCells.length > 0) {
        // Brief delay to let React render the locked piece before applying blink
        // This ensures the HexCell component detects the clearing state transition
        await delay(16)  // Allow React render cycle

        // Show blink effect for bomb explosion
        const blinkGrid = createBombBlinkGrid(gridAfterLock, allAffectedCells)
        useGameStore.setState({ grid: blinkGrid })
        await delay(ANIMATION_TIMING.BLINK_DURATION)

        // Apply the actual explosion
        const newGrid = applyBombExplosions(gridAfterLock, pieceCells, FIELD_SHAPE)
        // Remove the bomb cells themselves
        for (const coord of pieceCells) {
          const key = axialToKey(coord)
          newGrid.set(key, { filled: false })
        }
        useGameStore.setState({ grid: newGrid })
        await delay(ANIMATION_TIMING.CLEAR_DELAY)

        // Apply gravity to floating cells after explosion
        const gravityFrames = getGravityFrames(newGrid, FIELD_SHAPE)
        if (gravityFrames.length > 0) {
          await animateGravityFrames(gravityFrames)
        }
      }
    }

    // Continue with rest of lock logic (special cell spawn, line detection, etc.)
    const continueAfterLock = async () => {
      // Maybe spawn a special cell after locking (before line detection)
      const gridAfterLock = useGameStore.getState().grid
      const gridWithSpecial = maybeSpawnSpecialCell(gridAfterLock, FIELD_SHAPE, state.level)
      if (gridWithSpecial !== gridAfterLock) {
        useGameStore.setState({ grid: gridWithSpecial })
      }

      const stages = detectLinesForAnimation(useGameStore.getState().grid, FIELD_SHAPE)

      // Spawn next piece or handle game over
      const trySpawnOrGameOver = () => {
        const spawnSuccessful = spawnNextPiece()
        if (!spawnSuccessful) {
          handleGameOver(highScore, setHighScore, setPreviousHighScore, setIsNewHighScore)
        }
      }

      if (stages.length > 0) {
        // Process line clearing asynchronously
        await processAllLineClearStages(stages, updateScore, updateLinesCleared)
        trySpawnOrGameOver()
      } else {
        trySpawnOrGameOver()
      }
    }

    // If bomb piece, animate explosion first, then continue
    if (lockedPiece.special === 'bomb') {
      processBombPieceExplosion(lockedPiece).then(continueAfterLock)
    } else {
      continueAfterLock()
    }
  }, [lockPiece, updateCurrentPiece, updateScore, updateLinesCleared, setHighScore, spawnNextPiece, setIsNewHighScore, setPreviousHighScore, highScore, cancelLocking])

  // Game loop
  useGameLoop({ onDrop: handleDrop, onLock: handleLock })

  // Keyboard controls - check lock state after every movement
  const onMoveLeft = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      // During lock delay, use diagonal down-left movement to enable tucking
      // Otherwise use horizontal left movement
      const moveFn = state.isLocking ? moveDownLeft : moveLeft
      const moved = moveFn(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) {
        updateCurrentPiece(moved)
        checkAndUpdateLockState(moved)
      }
    }
  }, [updateCurrentPiece, checkAndUpdateLockState])

  const onMoveRight = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      // During lock delay, use diagonal down-right movement to enable tucking
      // Otherwise use horizontal right movement
      const moveFn = state.isLocking ? moveDownRight : moveRight
      const moved = moveFn(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) {
        updateCurrentPiece(moved)
        checkAndUpdateLockState(moved)
      }
    }
  }, [updateCurrentPiece, checkAndUpdateLockState])

  const onMoveDown = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const moved = moveDown(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) {
        updateCurrentPiece(moved)
        checkAndUpdateLockState(moved)
      }
    }
  }, [updateCurrentPiece, checkAndUpdateLockState])

  const onRotate = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const rotated = rotateWithWallKick(state.currentPiece, state.grid, FIELD_SHAPE)
      if (rotated) {
        updateCurrentPiece(rotated)
        checkAndUpdateLockState(rotated)
      }
    }
  }, [updateCurrentPiece, checkAndUpdateLockState])

  const onHardDrop = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      // Drop piece to lowest position and update in store
      const dropped = hardDrop(state.currentPiece, state.grid, FIELD_SHAPE)
      updateCurrentPiece(dropped)
      // Force immediate lock - no further control allowed after hard drop
      handleLock(true)
    }
  }, [updateCurrentPiece, handleLock])

  useKeyboard({ onMoveLeft, onMoveRight, onMoveDown, onRotate, onHardDrop }, status === GameStatus.Playing || status === GameStatus.Idle)

  // Effect Event for non-reactive startGame access
  const onFirstKey = useEffectEvent(() => {
    startGame()
  })

  // Start game on first key press
  useEffect(() => {
    if (status === GameStatus.Idle) {
      window.addEventListener('keydown', onFirstKey, { once: true })
      return () => window.removeEventListener('keydown', onFirstKey)
    }
  }, [status])

  return {
    // State for rendering
    grid,
    currentPiece,
    nextPiece,
    score,
    level,
    linesCleared,
    status,
    // Actions for UI callbacks
    startGame,
  }
}
