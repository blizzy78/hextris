// Line detection and clearing for hexagonal Tetris

import { axialToKey, keyToAxial } from './hexMath'
import type { AxialCoord, CellState, FieldShape, GridState } from './types'

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
 */
function clearLines(grid: GridState, lines: Line[]): GridState {
  const newGrid = new Map(grid)

  // Remove all cells in completed lines
  for (const line of lines) {
    for (const cell of line.cells) {
      newGrid.delete(axialToKey(cell))
    }
  }

  return newGrid
}

/**
 * Apply ONE step of gravity - move all blocks down by one row if possible
 * Returns the new grid state and whether any blocks moved
 */
function applyGravityStep(
  grid: GridState,
  fieldShape: FieldShape
): { grid: GridState; moved: boolean } {
  const newGrid = new Map(grid)
  let moved = false

  // Process cells from bottom to top to avoid conflicts
  // Get all filled cells and sort by r coordinate (descending - bottom first)
  const filledCells: Array<{ key: string; coord: AxialCoord; cellState: CellState }> = []
  for (const [key, cellState] of grid) {
    if (cellState.filled) {
      filledCells.push({ key, coord: keyToAxial(key), cellState })
    }
  }
  filledCells.sort((a, b) => b.coord.r - a.coord.r)

  for (const { key, coord, cellState } of filledCells) {
    const below: AxialCoord = { q: coord.q, r: coord.r + 1 }
    const belowKey = axialToKey(below)

    // Check if the cell below is valid (in field) and empty in newGrid
    const belowCell = newGrid.get(belowKey)
    const isBelowEmpty = !belowCell || !belowCell.filled

    if (fieldShape.has(belowKey) && isBelowEmpty) {
      // Move this cell down
      newGrid.delete(key)
      newGrid.set(belowKey, cellState)
      moved = true
    }
  }

  return { grid: newGrid, moved }
}

/**
 * Get all intermediate gravity frames for animation
 * Each frame represents one row of falling
 * Returns array of grid states from first fall to final resting position
 */
function getGravityFrames(
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
  gridAfterClear: GridState
  gravityFrames: GridState[]  // Intermediate gravity states for animation
  gridAfterGravity: GridState  // Final state after all gravity
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

    // Clear the lines
    const gridAfterClear = clearLines(currentGrid, lines)

    // Get all gravity frames for animation
    const gravityFrames = getGravityFrames(gridAfterClear, fieldShape)

    // Final state is the last frame, or gridAfterClear if no movement
    const gridAfterGravity = gravityFrames.length > 0
      ? gravityFrames[gravityFrames.length - 1]!
      : gridAfterClear

    stages.push({ lines, gridAfterClear, gravityFrames, gridAfterGravity })

    // Continue with the grid after gravity to check for new lines
    currentGrid = gridAfterGravity
  }

  return stages
}
