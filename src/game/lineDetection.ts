// Line detection and clearing for hexagonal Tetris

import { axialToKey, keyToAxial } from './hexMath'
import {
    applyBombExplosions,
    getBombCells,
    getFilledNeighbors,
    hasMultiplierCell,
    processFrozenCells,
} from './specialCells'
import type { AxialCoord, CellState, FieldShape, GridState } from './types'

/**
 * Get all cells that will be destroyed by bomb explosions
 * Used for animation purposes
 */
function getBombExplosionCells(
  grid: GridState,
  bombCells: AxialCoord[],
  fieldShape: FieldShape
): AxialCoord[] {
  if (bombCells.length === 0) {
    return []
  }

  const cellsToDestroy = new Set<string>()

  for (const bombCoord of bombCells) {
    const filledNeighbors = getFilledNeighbors(bombCoord, grid, fieldShape)
    for (const neighbor of filledNeighbors) {
      cellsToDestroy.add(axialToKey(neighbor))
    }
  }

  return Array.from(cellsToDestroy).map(key => keyToAxial(key))
}

/**
 * Line direction type - the two meaningful line directions in a hexagonal grid
 */
type LineDirection = 'diagonalRight' | 'diagonalLeft'

/**
 * A complete line with its cells
 */
export interface Line {
  direction: LineDirection
  cells: AxialCoord[]
}

/**
 * Get the constant value for a coordinate in a given direction
 * For flat-top hexagons, the two clearable line directions are:
 * - Diagonal Right: constant r (diagonal going down-right)
 * - Diagonal Left: constant q+r (diagonal going down-left)
 */
function getLineConstant(coord: AxialCoord, direction: LineDirection): number {
  switch (direction) {
    case 'diagonalRight':
      return coord.r
    case 'diagonalLeft':
      return coord.q + coord.r
  }
}/**
 * Detect all complete lines in the grid
 * A line is complete when ALL cells in the field sharing a constant are filled
 */
function detectLines(grid: GridState, fieldShape: FieldShape): Line[] {
  const lines: Line[] = []
  const directions: LineDirection[] = ['diagonalRight', 'diagonalLeft']

  for (const direction of directions) {
    // Group field cells by their line constant
    const lineGroups = new Map<number, AxialCoord[]>()

    for (const key of fieldShape) {
      const coord = keyToAxial(key)
      const constant = getLineConstant(coord, direction)

      if (!lineGroups.has(constant)) {
        lineGroups.set(constant, [])
      }
      lineGroups.get(constant)!.push(coord)
    }

    // Check each line group to see if it's complete
    for (const [, cells] of lineGroups) {
      // A line is complete only if it has cells AND all of them are filled
      if (cells.length === 0) continue

      const allFilled = cells.every(coord => {
        const cellState = grid.get(axialToKey(coord))
        return cellState && cellState.filled
      })

      if (allFilled && cells.length > 0) {
        lines.push({ direction, cells })
      }
    }
  }

  return lines
}

/**
 * Clear lines from the grid and return the new grid state
 * Handles special cells:
 * - Frozen cells: first clear converts to normal, second clear removes
 * - Bomb cells: destroy adjacent cells when cleared (returned for animation)
 * - Multiplier cells: tracked for scoring (handled by caller)
 */
function clearLines(
  grid: GridState,
  lines: Line[],
  fieldShape: FieldShape
): {
  gridAfterLineClear: GridState
  bombExplosionCells: AxialCoord[]
  gridAfterBombs: GridState
  hasMultiplier: boolean
} {
  // Collect all cells to clear from all lines
  const allCellsToCheck: AxialCoord[] = []
  for (const line of lines) {
    allCellsToCheck.push(...line.cells)
  }

  // Check for multiplier cells before clearing
  const hasMultiplier = hasMultiplierCell(grid, allCellsToCheck)

  // Process frozen cells - some may not be removed yet
  const { cellsToRemove, updatedGrid } = processFrozenCells(grid, allCellsToCheck)

  // Get bomb cells from the cells that will be removed
  const bombCells = getBombCells(updatedGrid, cellsToRemove)

  // Remove the cells that should be cleared
  const gridAfterLineClear = new Map(updatedGrid)
  for (const cell of cellsToRemove) {
    gridAfterLineClear.delete(axialToKey(cell))
  }

  // Calculate which cells will be destroyed by bomb explosions (for animation)
  const bombExplosionCells = getBombExplosionCells(gridAfterLineClear, bombCells, fieldShape)

  // Apply bomb explosions after the line is cleared
  const gridAfterBombs = applyBombExplosions(gridAfterLineClear, bombCells, fieldShape)

  return { gridAfterLineClear, bombExplosionCells, gridAfterBombs, hasMultiplier }
}

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
 * Determine which cells are floating vs grounded.
 *
 * A cell is grounded if:
 * 1. It's directly on the floor (nothing below in field), OR
 * 2. The cell directly below it is grounded (vertical support only)
 *
 * Note: For independent gravity, we only propagate grounded status vertically.
 * Adjacent cells in other directions do NOT make a cell grounded.
 */
function classifyGroundedAndFloating(
  filledCells: Array<{ key: string; coord: AxialCoord; cellState: CellState }>,
  _filledKeys: Set<string>,
  fieldShape: FieldShape
): { grounded: Set<string>; floating: Set<string> } {
  const grounded = new Set<string>()

  // First pass: find cells that are directly on the floor (nothing below in field)
  for (const { key, coord } of filledCells) {
    const below: AxialCoord = { q: coord.q, r: coord.r + 1 }
    const belowKey = axialToKey(below)
    if (!fieldShape.has(belowKey)) {
      grounded.add(key)
    }
  }

  // Second pass: propagate grounded status ONLY through vertical stacking
  // A cell is grounded if the cell directly below it is grounded
  let changed = true
  while (changed) {
    changed = false
    for (const { key, coord } of filledCells) {
      if (grounded.has(key)) continue

      // Check cell directly below (vertical support)
      const below: AxialCoord = { q: coord.q, r: coord.r + 1 }
      const belowKey = axialToKey(below)
      if (grounded.has(belowKey)) {
        grounded.add(key)
        changed = true
        continue
      }

      // Note: We intentionally do NOT check hex neighbors for grounded status.
      // Each cell falls independently - only vertical support matters.
    }
  }

  // Everything not grounded is floating
  const floating = new Set<string>()
  for (const { key } of filledCells) {
    if (!grounded.has(key)) {
      floating.add(key)
    }
  }

  return { grounded, floating }
}

/**
 * (DEPRECATED - kept for reference)
 * Find connected components among floating cells
 * Two cells are connected if they are hex neighbors
 *
 * Note: This was used when floating masses fell as rigid units.
 * Now each floating block falls independently.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findFloatingComponents(
  floatingCells: Array<{ key: string; coord: AxialCoord; cellState: CellState }>
): Array<Array<{ key: string; coord: AxialCoord; cellState: CellState }>> {
  const floatingKeys = new Set(floatingCells.map(c => c.key))
  const visited = new Set<string>()
  const components: Array<Array<{ key: string; coord: AxialCoord; cellState: CellState }>> = []

  for (const cell of floatingCells) {
    if (visited.has(cell.key)) continue

    // BFS to find all connected cells
    const component: Array<{ key: string; coord: AxialCoord; cellState: CellState }> = []
    const queue = [cell]
    visited.add(cell.key)

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)

      for (const neighbor of getHexNeighbors(current.coord)) {
        const neighborKey = axialToKey(neighbor)
        if (floatingKeys.has(neighborKey) && !visited.has(neighborKey)) {
          visited.add(neighborKey)
          const neighborCell = floatingCells.find(c => c.key === neighborKey)!
          queue.push(neighborCell)
        }
      }
    }

    components.push(component)
  }

  return components
}

/**
 * Apply gravity - each floating block falls independently.
 * Each block falls down one row if the target position is valid and unoccupied.
 * Blocks fall simultaneously but independently - no rigid body behavior.
 */
export function applyGravityStep(
  grid: GridState,
  fieldShape: FieldShape
): { grid: GridState; moved: boolean } {
  // Collect all filled cells
  const filledCells: Array<{ key: string; coord: AxialCoord; cellState: CellState }> = []
  const filledKeys = new Set<string>()
  for (const [key, cellState] of grid) {
    if (cellState.filled) {
      filledCells.push({ key, coord: keyToAxial(key), cellState })
      filledKeys.add(key)
    }
  }

  if (filledCells.length === 0) {
    return { grid, moved: false }
  }

  // Classify cells as grounded or floating
  const { grounded: groundedKeys, floating: floatingKeys } = classifyGroundedAndFloating(
    filledCells,
    filledKeys,
    fieldShape
  )

  const floatingCells = filledCells.filter(c => floatingKeys.has(c.key))
  const groundedCells = filledCells.filter(c => groundedKeys.has(c.key))

  if (floatingCells.length === 0) {
    return { grid, moved: false }
  }

  // Build new grid starting with grounded cells
  const newGrid = new Map<string, CellState>()
  for (const { key, cellState } of groundedCells) {
    newGrid.set(key, cellState)
  }

  // Track which cells are now occupied
  const occupiedKeys = new Set(groundedKeys)

  // Sort floating cells by r descending (bottom to top) to process lower cells first
  // This prevents cells from falling "through" each other
  const sortedFloatingCells = [...floatingCells].sort((a, b) => b.coord.r - a.coord.r)

  let anyMoved = false

  // Process each floating block independently
  for (const { coord, cellState } of sortedFloatingCells) {
    const targetCoord = { q: coord.q, r: coord.r + 1 }
    const targetKey = axialToKey(targetCoord)

    // Check if this block can move down
    const canMove = fieldShape.has(targetKey) && !occupiedKeys.has(targetKey)

    if (canMove) {
      // Move block down by one row
      newGrid.set(targetKey, cellState)
      occupiedKeys.add(targetKey)
      anyMoved = true
    } else {
      // Block stays in place
      const currentKey = axialToKey(coord)
      newGrid.set(currentKey, cellState)
      occupiedKeys.add(currentKey)
    }
  }

  return { grid: newGrid, moved: anyMoved }
}

/**
 * Get all intermediate gravity frames for animation
 * Each frame represents one row of falling
 * Returns array of grid states from first fall to final resting position
 */
export function getGravityFrames(
  grid: GridState,
  fieldShape: FieldShape
): GridState[] {
  const frames: GridState[] = []
  let currentGrid = grid

  while (true) {
    const { grid: nextGrid, moved } = applyGravityStep(currentGrid, fieldShape)
    if (!moved) break
    frames.push(nextGrid)
    currentGrid = nextGrid
  }

  return frames
}

/**
 * Stage in the cascading line clear animation
 */
export interface LineClearStage {
  lines: Line[]
  gridAfterLineClear: GridState  // Grid after lines cleared, before bomb explosions
  bombExplosionCells: AxialCoord[]  // Cells destroyed by bomb explosions
  gridAfterClear: GridState  // Grid after lines AND bombs cleared
  gravityFrames: GridState[]  // Intermediate gravity states for animation
  gridAfterGravity: GridState  // Final state after all gravity
  hasMultiplier: boolean      // Whether any multiplier cell was cleared in this stage
}

/**
 * Detect lines and return all cascade stages for animation
 * Keeps detecting lines after gravity until no more lines form
 */
export function detectLinesForAnimation(
  grid: GridState,
  fieldShape: FieldShape
): LineClearStage[] {
  const stages: LineClearStage[] = []
  let currentGrid = grid

  // Keep detecting lines until no more are found
  while (true) {
    const lines = detectLines(currentGrid, fieldShape)

    if (lines.length === 0) {
      break
    }

    // Clear the lines (handles frozen cells, bomb explosions, multiplier detection)
    const {
      gridAfterLineClear,
      bombExplosionCells,
      gridAfterBombs,
      hasMultiplier
    } = clearLines(currentGrid, lines, fieldShape)

    // Get all gravity frames for animation
    const gravityFrames = getGravityFrames(gridAfterBombs, fieldShape)

    // Final state is the last frame, or gridAfterBombs if no movement
    const gridAfterGravity = gravityFrames.length > 0
      ? gravityFrames[gravityFrames.length - 1]!
      : gridAfterBombs

    stages.push({
      lines,
      gridAfterLineClear,
      bombExplosionCells,
      gridAfterClear: gridAfterBombs,
      gravityFrames,
      gridAfterGravity,
      hasMultiplier
    })

    // Continue with the grid after gravity to check for new lines
    currentGrid = gridAfterGravity
  }

  return stages
}
