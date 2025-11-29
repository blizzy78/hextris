import { FIELD_SHAPE } from '@/game/gameModes'
import { axialToKey } from '@/game/hexMath'
import type { Line, LineClearStage } from '@/game/lineDetection'
import { detectLinesForAnimation } from '@/game/lineDetection'
import { hardDrop, moveDown, moveLeft, moveRight, rotateWithWallKick } from '@/game/movement'
import { calculateCascadeScore, calculateLevel, calculateLockScore, calculateSpeed } from '@/game/scoring'
import type { GridState } from '@/game/types'
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
 * Apply blink effect to cells being cleared
 */
function createBlinkGrid(baseGrid: GridState, lines: Line[]): GridState {
  const blinkGrid = new Map(baseGrid)
  const blinkCells = lines.flatMap((line: Line) => line.cells)
  const lineCount = lines.length

  for (const cell of blinkCells) {
    const key = axialToKey(cell)
    const cellState = blinkGrid.get(key)
    if (cellState?.filled) {
      blinkGrid.set(key, {
        filled: true,
        color: '#ffffff',
        clearing: { lineCount },
      })
    }
  }

  return blinkGrid
}

/**
 * Process a single line-clearing stage with animation
 */
async function processLineClearStage(
  stage: LineClearStage,
  previousGridAfterGravity: GridState | null
): Promise<void> {
  // Get base grid for blink effect
  const currentGrid = previousGridAfterGravity ?? useGameStore.getState().grid

  // Show blink effect
  const blinkGrid = createBlinkGrid(currentGrid, stage.lines)
  useGameStore.setState({ grid: blinkGrid })
  await delay(ANIMATION_TIMING.BLINK_DURATION)

  // Show cleared grid
  useGameStore.setState({ grid: stage.gridAfterClear })
  await delay(ANIMATION_TIMING.CLEAR_DELAY)

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

    // Calculate points for this stage with cascade multiplier
    const latestState = useGameStore.getState()
    const stagePoints = calculateCascadeScore(
      stage.lines.length,
      latestState.level,
      cascadeStage
    )
    totalPoints += stagePoints

    await processLineClearStage(stage, previousGridAfterGravity)
    previousGridAfterGravity = stage.gridAfterGravity
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

  // Handle piece drop
  const handleDrop = useCallback(() => {
    const state = useGameStore.getState()
    if (!state.currentPiece || state.status !== GameStatus.Playing) return

    const movedPiece = moveDown(state.currentPiece, state.grid, FIELD_SHAPE)

    if (movedPiece) {
      updateCurrentPiece(movedPiece)
      return
    }

    // Lock piece and award points
    lockPiece(state.currentPiece)
    const lockPoints = calculateLockScore(state.level)
    updateScore(lockPoints)

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
      processAllLineClearStages(stages, updateScore, updateLinesCleared)
        .then(trySpawnOrGameOver)
    } else {
      trySpawnOrGameOver()
    }
  }, [lockPiece, updateCurrentPiece, updateScore, updateLinesCleared, setHighScore, spawnNextPiece, setIsNewHighScore, setPreviousHighScore, highScore])

  // Game loop
  useGameLoop({ onDrop: handleDrop })

  // Keyboard controls
  const onMoveLeft = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const moved = moveLeft(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) updateCurrentPiece(moved)
    }
  }, [updateCurrentPiece])

  const onMoveRight = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const moved = moveRight(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) updateCurrentPiece(moved)
    }
  }, [updateCurrentPiece])

  const onMoveDown = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const moved = moveDown(state.currentPiece, state.grid, FIELD_SHAPE)
      if (moved) updateCurrentPiece(moved)
    }
  }, [updateCurrentPiece])

  const onRotate = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const rotated = rotateWithWallKick(state.currentPiece, state.grid, FIELD_SHAPE)
      if (rotated) updateCurrentPiece(rotated)
    }
  }, [updateCurrentPiece])

  const onHardDrop = useCallback(() => {
    const state = useGameStore.getState()
    if (state.currentPiece) {
      const dropped = hardDrop(state.currentPiece, state.grid, FIELD_SHAPE)
      updateCurrentPiece(dropped)
      handleDrop()
    }
  }, [updateCurrentPiece, handleDrop])

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
