// Special cell spawning and behavior logic

import { axialToKey } from './hexMath'
import type { AxialCoord, FieldShape, GridState, SpecialCellType } from './types'

/**
 * Special piece types that can be assigned to an entire piece
 * (frozen is excluded - pieces cannot be frozen)
 */
export type SpecialPieceType = 'bomb' | 'multiplier'

/**
 * Spawn rate constants for special cells
 * Spawn chance is calculated as: baseChance + (level - 1) * increasePerLevel
 * except for frozen cells which have a fixed rate
 */
export const SPECIAL_CELL_SPAWN = {
  /** Base chance (0-1) for bomb cells at level 1 */
  BOMB_BASE_CHANCE: 0.05,
  /** Bomb spawn chance increase per level */
  BOMB_INCREASE_PER_LEVEL: 0.005,
  /** Maximum bomb spawn chance */
  BOMB_MAX_CHANCE: 0.15,

  /** Base chance (0-1) for multiplier cells at level 1 */
  MULTIPLIER_BASE_CHANCE: 0.03,
  /** Multiplier spawn chance increase per level */
  MULTIPLIER_INCREASE_PER_LEVEL: 0.004,
  /** Maximum multiplier spawn chance */
  MULTIPLIER_MAX_CHANCE: 0.12,

  /** Fixed chance (0-1) for frozen cells (does not scale with level) */
  FROZEN_FIXED_CHANCE: 0.025,

  /** Score multiplier applied to lines containing multiplier cells */
  MULTIPLIER_SCORE_BONUS: 2,

  /** Maximum number of bomb cells allowed on the field at once */
  BOMB_MAX_COUNT: 3,
  /** Maximum number of multiplier cells allowed on the field at once */
  MULTIPLIER_MAX_COUNT: 3,
  /** Maximum number of frozen cells allowed on the field at once */
  FROZEN_MAX_COUNT: 1,

  // Special piece spawn rates (for entire pieces to be bomb/multiplier)
  /** Base chance (0-1) for bomb piece at level 1 */
  BOMB_PIECE_BASE_CHANCE: 0.02,
  /** Bomb piece spawn chance increase per level */
  BOMB_PIECE_INCREASE_PER_LEVEL: 0.003,
  /** Maximum bomb piece spawn chance */
  BOMB_PIECE_MAX_CHANCE: 0.08,

  /** Base chance (0-1) for multiplier piece at level 1 */
  MULTIPLIER_PIECE_BASE_CHANCE: 0.015,
  /** Multiplier piece spawn chance increase per level */
  MULTIPLIER_PIECE_INCREASE_PER_LEVEL: 0.002,
  /** Maximum multiplier piece spawn chance */
  MULTIPLIER_PIECE_MAX_CHANCE: 0.06,
} as const

/**
 * Get the 6 hex neighbors of a coordinate
 */
function getHexNeighbors(coord: AxialCoord): AxialCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q, r: coord.r + 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ]
}

/**
 * Calculate spawn chance for a special cell type at a given level
 */
export function getSpawnChance(type: SpecialCellType, level: number): number {
  switch (type) {
    case 'bomb': {
      const chance = SPECIAL_CELL_SPAWN.BOMB_BASE_CHANCE +
        (level - 1) * SPECIAL_CELL_SPAWN.BOMB_INCREASE_PER_LEVEL
      return Math.min(chance, SPECIAL_CELL_SPAWN.BOMB_MAX_CHANCE)
    }
    case 'multiplier': {
      const chance = SPECIAL_CELL_SPAWN.MULTIPLIER_BASE_CHANCE +
        (level - 1) * SPECIAL_CELL_SPAWN.MULTIPLIER_INCREASE_PER_LEVEL
      return Math.min(chance, SPECIAL_CELL_SPAWN.MULTIPLIER_MAX_CHANCE)
    }
    case 'frozen':
      return SPECIAL_CELL_SPAWN.FROZEN_FIXED_CHANCE
  }
}

/**
 * Calculate spawn chance for a special piece type at a given level
 * Only bomb and multiplier pieces can spawn (never frozen)
 */
export function getSpecialPieceSpawnChance(type: SpecialPieceType, level: number): number {
  switch (type) {
    case 'bomb': {
      const chance = SPECIAL_CELL_SPAWN.BOMB_PIECE_BASE_CHANCE +
        (level - 1) * SPECIAL_CELL_SPAWN.BOMB_PIECE_INCREASE_PER_LEVEL
      return Math.min(chance, SPECIAL_CELL_SPAWN.BOMB_PIECE_MAX_CHANCE)
    }
    case 'multiplier': {
      const chance = SPECIAL_CELL_SPAWN.MULTIPLIER_PIECE_BASE_CHANCE +
        (level - 1) * SPECIAL_CELL_SPAWN.MULTIPLIER_PIECE_INCREASE_PER_LEVEL
      return Math.min(chance, SPECIAL_CELL_SPAWN.MULTIPLIER_PIECE_MAX_CHANCE)
    }
  }
}

/**
 * Determine if a new piece should be special (bomb/multiplier)
 * Returns the special type if piece should be special, undefined otherwise
 */
export function rollSpecialPieceType(level: number): SpecialPieceType | undefined {
  const bombChance = getSpecialPieceSpawnChance('bomb', level)
  const multiplierChance = getSpecialPieceSpawnChance('multiplier', level)
  const totalChance = bombChance + multiplierChance

  const roll = Math.random()
  if (roll >= totalChance) {
    // No special piece
    return undefined
  }

  // Determine which special type (proportional to individual chances)
  const typeRoll = Math.random() * totalChance
  if (typeRoll < bombChance) {
    return 'bomb'
  }
  return 'multiplier'
}

/**
 * Count the number of special cells of each type on the grid
 */
function countSpecialCells(grid: GridState, fieldShape: FieldShape): Record<SpecialCellType, number> {
  const counts: Record<SpecialCellType, number> = {
    bomb: 0,
    multiplier: 0,
    frozen: 0,
  }

  for (const key of fieldShape) {
    const cellState = grid.get(key)
    if (cellState?.filled && cellState.special) {
      counts[cellState.special]++
    }
  }

  return counts
}

/**
 * Get the maximum allowed count for a special cell type
 */
function getMaxCount(type: SpecialCellType): number {
  switch (type) {
    case 'bomb':
      return SPECIAL_CELL_SPAWN.BOMB_MAX_COUNT
    case 'multiplier':
      return SPECIAL_CELL_SPAWN.MULTIPLIER_MAX_COUNT
    case 'frozen':
      return SPECIAL_CELL_SPAWN.FROZEN_MAX_COUNT
  }
}

/**
 * Get all eligible cells for special cell conversion
 * A cell is eligible if:
 * - It is filled
 * - It is not already a special cell
 * - It is within the field shape
 */
function getEligibleCells(grid: GridState, fieldShape: FieldShape): string[] {
  const eligible: string[] = []

  for (const key of fieldShape) {
    const cellState = grid.get(key)
    if (cellState?.filled && !cellState.special) {
      eligible.push(key)
    }
  }

  return eligible
}

/**
 * Randomly select one cell and convert it to a special type
 * Only one cell may convert per gravity cycle
 * Returns the updated grid
 */
export function maybeSpawnSpecialCell(
  grid: GridState,
  fieldShape: FieldShape,
  level: number
): GridState {
  const eligibleCells = getEligibleCells(grid, fieldShape)

  if (eligibleCells.length === 0) {
    return grid
  }

  // Count current special cells to enforce limits
  const currentCounts = countSpecialCells(grid, fieldShape)

  // Calculate spawn probability, excluding types that are at max count
  const bombChance = currentCounts.bomb >= getMaxCount('bomb')
    ? 0
    : getSpawnChance('bomb', level)
  const multiplierChance = currentCounts.multiplier >= getMaxCount('multiplier')
    ? 0
    : getSpawnChance('multiplier', level)
  const frozenChance = currentCounts.frozen >= getMaxCount('frozen')
    ? 0
    : getSpawnChance('frozen', level)
  const totalChance = bombChance + multiplierChance + frozenChance

  // If all types are at max, no spawn possible
  if (totalChance === 0) {
    return grid
  }

  // Roll to see if any spawn happens
  const spawnRoll = Math.random()
  if (spawnRoll >= totalChance) {
    return grid
  }

  // Determine which type spawns (proportional to individual chances)
  let selectedType: SpecialCellType
  const typeRoll = Math.random() * totalChance

  if (typeRoll < bombChance) {
    selectedType = 'bomb'
  } else if (typeRoll < bombChance + multiplierChance) {
    selectedType = 'multiplier'
  } else {
    selectedType = 'frozen'
  }

  // Randomly select one eligible cell
  const randomIndex = Math.floor(Math.random() * eligibleCells.length)
  const selectedKey = eligibleCells[randomIndex]!

  // Create new grid with the converted cell
  const newGrid = new Map(grid)
  const cellState = newGrid.get(selectedKey)

  if (cellState?.filled) {
    newGrid.set(selectedKey, {
      ...cellState,
      special: selectedType,
    })
  }

  return newGrid
}

/**
 * Get filled neighbors of a coordinate that are within the field
 */
export function getFilledNeighbors(
  coord: AxialCoord,
  grid: GridState,
  fieldShape: FieldShape
): AxialCoord[] {
  const neighbors = getHexNeighbors(coord)
  const filled: AxialCoord[] = []

  for (const neighbor of neighbors) {
    const key = axialToKey(neighbor)
    if (fieldShape.has(key)) {
      const cellState = grid.get(key)
      if (cellState?.filled) {
        filled.push(neighbor)
      }
    }
  }

  return filled
}

/**
 * Apply bomb explosions to cleared cells
 * Each bomb destroys ALL directly adjacent filled cells
 * Returns the grid with bomb explosion effects applied
 */
export function applyBombExplosions(
  grid: GridState,
  bombCells: AxialCoord[],
  fieldShape: FieldShape
): GridState {
  if (bombCells.length === 0) {
    return grid
  }

  const newGrid = new Map(grid)
  const cellsToDestroy = new Set<string>()

  for (const bombCoord of bombCells) {
    const filledNeighbors = getFilledNeighbors(bombCoord, newGrid, fieldShape)

    // Destroy all adjacent filled cells
    for (const neighbor of filledNeighbors) {
      cellsToDestroy.add(axialToKey(neighbor))
    }
  }

  // Remove all cells marked for destruction
  for (const key of cellsToDestroy) {
    newGrid.delete(key)
  }

  return newGrid
}

/**
 * Process frozen cells in a line clear
 * First clear: converts frozen cell to normal (frozenCleared = true)
 * Second clear: removes the cell
 * Returns which cells should actually be removed and the updated grid
 */
export function processFrozenCells(
  grid: GridState,
  cellsToCheck: AxialCoord[]
): { cellsToRemove: AxialCoord[]; updatedGrid: GridState } {
  const newGrid = new Map(grid)
  const cellsToRemove: AxialCoord[] = []

  for (const coord of cellsToCheck) {
    const key = axialToKey(coord)
    const cellState = newGrid.get(key)

    if (!cellState?.filled) {
      continue
    }

    if (cellState.special === 'frozen' && !cellState.frozenCleared) {
      // First clear: mark as cleared but keep the cell (now normal)
      newGrid.set(key, {
        filled: true,
        color: cellState.color,
        frozenCleared: true,
        // Remove special type - it's now a normal cell
      })
    } else {
      // Normal cell or already-cleared frozen cell: remove it
      cellsToRemove.push(coord)
    }
  }

  return { cellsToRemove, updatedGrid: newGrid }
}

/**
 * Check if any cells in a list contain multiplier cells
 */
export function hasMultiplierCell(grid: GridState, cells: AxialCoord[]): boolean {
  for (const coord of cells) {
    const key = axialToKey(coord)
    const cellState = grid.get(key)
    if (cellState?.filled && cellState.special === 'multiplier') {
      return true
    }
  }
  return false
}

/**
 * Get all bomb cells from a list of coordinates
 */
export function getBombCells(grid: GridState, cells: AxialCoord[]): AxialCoord[] {
  const bombCells: AxialCoord[] = []

  for (const coord of cells) {
    const key = axialToKey(coord)
    const cellState = grid.get(key)
    if (cellState?.filled && cellState.special === 'bomb') {
      bombCells.push(coord)
    }
  }

  return bombCells
}
