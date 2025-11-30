// Game state store using Zustand

import { create } from 'zustand'
import { FIELD_SHAPE, SPAWN_POSITION } from '../game/gameModes'
import { axialToKey } from '../game/hexMath'
import { getPieceCells, spawnPiece } from '../game/pieces'
import { calculateLevel, calculateSpeed, SCORING } from '../game/scoring'
import type { GameState, GridState, Piece } from '../game/types'
import { GameStatus } from '../game/types'
import { useGameLoopStore } from './gameLoopStore'

/**
 * Initialize an empty grid
 */
function initializeGrid(): GridState {
  const grid: GridState = new Map()

  // Initialize all field cells as empty
  for (const key of FIELD_SHAPE) {
    grid.set(key, { filled: false })
  }

  return grid
}

interface GameStore extends GameState {
  // Additional state
  isNewHighScore: boolean
  previousHighScore: number
  // Lock delay state for tucking support
  isLocking: boolean
  lockStartTime: number
  // Actions
  startGame: () => void
  spawnNextPiece: () => boolean
  lockPiece: (piece: Piece) => void
  updateCurrentPiece: (piece: Piece | null) => void
  updateScore: (points: number) => void
  updateLinesCleared: (count: number) => void
  setStatus: (status: GameStatus) => void
  setIsNewHighScore: (isNew: boolean) => void
  setPreviousHighScore: (score: number) => void
  gameOver: () => void
  // Lock delay actions
  startLocking: () => void
  resetLocking: () => void
  cancelLocking: () => void
}

/**
 * Global game store
 */
export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  grid: initializeGrid(),
  currentPiece: null,
  nextPiece: null,
  pieceHistory: [],
  score: 0,
  level: 1,
  linesCleared: 0,
  speed: SCORING.BASE_DROP_SPEED,
  status: GameStatus.Idle,
  isNewHighScore: false,
  previousHighScore: 0,
  isLocking: false,
  lockStartTime: 0,

  // Actions
  startGame: () => {
    useGameLoopStore.getState().resetElapsed()
    // Level 1 at start, no special pieces for the first two pieces
    const currentPiece = spawnPiece(SPAWN_POSITION, undefined, 1)
    const history = [currentPiece.type]
    const nextPiece = spawnPiece(SPAWN_POSITION, history, 1)
    history.unshift(nextPiece.type)
    set({
      grid: initializeGrid(),
      currentPiece,
      nextPiece,
      pieceHistory: history.slice(0, 3),
      score: 0,
      level: 1,
      linesCleared: 0,
      speed: SCORING.BASE_DROP_SPEED,
      status: GameStatus.Playing,
      isNewHighScore: false,
      isLocking: false,
      lockStartTime: 0
    })
  },

  spawnNextPiece: (): boolean => {
    const state = get()
    const nextCurrent = state.nextPiece

    if (!nextCurrent) {
      return false
    }

    // Check if next piece can spawn (if not, game over)
    // Use getPieceCells to correctly handle hasCenter property
    const spawnCoords = getPieceCells(nextCurrent)

    // Check if any spawn position is blocked
    for (const coord of spawnCoords) {
      const key = axialToKey(coord)
      const cellState = state.grid.get(key)
      if (cellState && cellState.filled) {
        // Keep the piece that triggered game over visible
        set({ status: GameStatus.GameOver, currentPiece: nextCurrent })
        return false
      }
    }

    const newNextPiece = spawnPiece(SPAWN_POSITION, state.pieceHistory, state.level)
    const newHistory = [newNextPiece.type, ...state.pieceHistory].slice(0, 3)
    set({
      currentPiece: nextCurrent,
      nextPiece: newNextPiece,
      pieceHistory: newHistory
    })
    return true
  },

  lockPiece: (piece: Piece): void => {
    const state = get()
    const newGrid = new Map(state.grid)

    // Get all cells occupied by the piece (accounts for rotation)
    const coords = getPieceCells(piece)

    // Mark all piece cells as filled, applying special type if piece is special
    for (const coord of coords) {
      const key = axialToKey(coord)
      if (piece.special) {
        newGrid.set(key, { filled: true, color: piece.color, special: piece.special })
      } else {
        newGrid.set(key, { filled: true, color: piece.color })
      }
    }

    // Note: Bomb piece explosions are handled separately in useGameController
    // with animation, not here in the store

    set({
      grid: newGrid,
      currentPiece: null
    })
    },

    updateCurrentPiece: (piece: Piece | null) => {
      set({ currentPiece: piece })
    },

    updateScore: (points: number) => {
      const state = get()
      set({ score: state.score + points })
    },

    updateLinesCleared: (count: number) => {
      const state = get()
      const newLinesCleared = state.linesCleared + count
      const newLevel = calculateLevel(newLinesCleared)
      const newSpeed = calculateSpeed(newLevel)

      set({
        linesCleared: newLinesCleared,
        level: newLevel,
        speed: newSpeed
      })
    },

    setStatus: (status: GameStatus) => {
      set({ status })
    },

    setIsNewHighScore: (isNew: boolean) => {
      set({ isNewHighScore: isNew })
    },

    setPreviousHighScore: (score: number) => {
      set({ previousHighScore: score })
    },

  gameOver: () => {
    set({ status: GameStatus.GameOver })
  },

  startLocking: () => {
    const state = get()
    if (!state.isLocking) {
      set({ isLocking: true, lockStartTime: performance.now() })
    }
  },

  resetLocking: () => {
    set({ isLocking: true, lockStartTime: performance.now() })
  },

  cancelLocking: () => {
    set({ isLocking: false, lockStartTime: 0 })
  }
}))
