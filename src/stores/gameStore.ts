// Game state store using Zustand

import { create } from 'zustand'
import { FIELD_SHAPE, SPAWN_POSITION } from '../game/gameModes'
import { axialToKey } from '../game/hexMath'
import { getPieceCells, spawnPiece } from '../game/pieces'
import { calculateLevel, calculateSpeed } from '../game/scoring'
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
}

/**
 * Global game store
 */
export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  grid: initializeGrid(),
  currentPiece: null,
  nextPiece: spawnPiece(SPAWN_POSITION),
  score: 0,
  level: 1,
  linesCleared: 0,
  speed: 1000,
  status: GameStatus.Idle,
  isNewHighScore: false,
  previousHighScore: 0,

  // Actions
  startGame: () => {
    useGameLoopStore.getState().resetElapsed()
    const currentPiece = spawnPiece(SPAWN_POSITION)
    set({
      grid: initializeGrid(),
      currentPiece,
      nextPiece: spawnPiece(SPAWN_POSITION, currentPiece.type),
      score: 0,
      level: 1,
      linesCleared: 0,
      speed: 1000,
      status: GameStatus.Playing,
      isNewHighScore: false
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
        set({ status: GameStatus.GameOver, currentPiece: null })
        return false
      }
    }

    set({
      currentPiece: nextCurrent,
      nextPiece: spawnPiece(SPAWN_POSITION, nextCurrent.type)
    })
    return true
  },

  lockPiece: (piece: Piece): void => {
    const state = get()
    const newGrid = new Map(state.grid)

    // Get all cells occupied by the piece (accounts for rotation)
    const coords = getPieceCells(piece)

    // Mark all piece cells as filled
    for (const coord of coords) {
      const key = axialToKey(coord)
      newGrid.set(key, { filled: true, color: piece.color })
    }

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
  }
}))
