import { axialToKey } from '@/game/hexMath'
import { applyGravityStep } from '@/game/lineDetection'
import type { CellState, FieldShape, GridState } from '@/game/types'
import { describe, expect, it } from 'vitest'

// Create a small test field (5 columns x 6 rows)
const TEST_COLUMNS = 5
const TEST_ROWS = 6

function createTestFieldShape(): FieldShape {
  const field = new Set<string>()
  for (let col = 0; col < TEST_COLUMNS; col++) {
    for (let row = 0; row < TEST_ROWS; row++) {
      const q = col
      const r = row - Math.floor(col / 2)
      field.add(`${q},${r}`)
    }
  }
  return field
}

const TEST_FIELD = createTestFieldShape()

// Helper to get bottom r value for a column
function getBottomR(q: number): number {
  return TEST_ROWS - 1 - Math.floor(q / 2)
}

// Helper to create a grid with specific cells filled
function createGrid(cells: Array<{ q: number; r: number; color?: string }>): GridState {
  const grid = new Map<string, CellState>()
  for (const cell of cells) {
    grid.set(axialToKey({ q: cell.q, r: cell.r }), { filled: true, color: cell.color ?? '#ff0000' })
  }
  return grid
}

// Helper to get all filled cell positions from a grid
function getFilledPositions(grid: GridState): Array<{ q: number; r: number }> {
  const positions: Array<{ q: number; r: number }> = []
  for (const [key, cellState] of grid) {
    if (cellState.filled) {
      const [q, r] = key.split(',').map(Number)
      positions.push({ q: q!, r: r! })
    }
  }
  return positions.sort((a, b) => a.q - b.q || a.r - b.r)
}

// Helper to apply gravity until nothing moves
function applyGravityUntilSettled(grid: GridState, fieldShape: FieldShape): GridState {
  let currentGrid = grid
  for (let i = 0; i < 20; i++) {
    const { grid: nextGrid, moved } = applyGravityStep(currentGrid, fieldShape)
    if (!moved) break
    currentGrid = nextGrid
  }
  return currentGrid
}

describe('Gravity', () => {
  describe('single block falling', () => {
    it('should fall to the bottom when nothing below', () => {
      const grid = createGrid([{ q: 2, r: 0 }])
      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(1)
      expect(positions[0]).toEqual({ q: 2, r: getBottomR(2) })
    })

    it('should stop on top of grounded block', () => {
      const grid = createGrid([
        { q: 2, r: 0 }, // floating
        { q: 2, r: getBottomR(2) }, // grounded at bottom
      ])
      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(2)
      expect(positions).toContainEqual({ q: 2, r: getBottomR(2) })
      expect(positions).toContainEqual({ q: 2, r: getBottomR(2) - 1 })
    })
  })

  describe('connected blocks (rigid body)', () => {
    it('should fall together as one unit', () => {
      // Two horizontally adjacent blocks at top
      const grid = createGrid([
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ])
      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(2)
      // Both stop when the first one hits the floor (rigid body)
      // Column 1 has bottomR=5, column 2 has bottomR=4
      // The block at q=2 hits floor first (r=4), so both stop there
      expect(positions).toContainEqual({ q: 1, r: 4 })
      expect(positions).toContainEqual({ q: 2, r: 4 })
    })

    it('should stop when any cell hits obstruction', () => {
      // L-shaped piece at top
      const grid = createGrid([
        { q: 2, r: 0 },
        { q: 2, r: 1 },
        { q: 3, r: 1 },
        // Obstruction under q=3
        { q: 3, r: getBottomR(3) },
      ])
      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(4)
      // The L-piece should stop when q=3 cell lands on obstruction
      expect(positions).toContainEqual({ q: 3, r: getBottomR(3) }) // original obstruction
      expect(positions).toContainEqual({ q: 3, r: getBottomR(3) - 1 }) // L-piece bottom-right
    })
  })

  describe('separate floating masses', () => {
    it('should fall independently to different depths', () => {
      // Two separate single blocks in different columns
      const grid = createGrid([
        { q: 1, r: 0, color: 'red' }, // left column - clear path to bottom
        { q: 3, r: 0, color: 'green' }, // right column - has obstruction
        { q: 3, r: getBottomR(3) }, // obstruction
      ])
      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(3)
      // Left block goes all the way to bottom
      expect(positions).toContainEqual({ q: 1, r: getBottomR(1) })
      // Right block stops on obstruction
      expect(positions).toContainEqual({ q: 3, r: getBottomR(3) - 1 })
      expect(positions).toContainEqual({ q: 3, r: getBottomR(3) })
    })

    it('should move at independent speeds (one lands while other keeps falling)', () => {
      // Left mass closer to ground, right mass higher up
      const grid = createGrid([
        { q: 1, r: getBottomR(1) - 2 }, // left - 2 rows to fall
        { q: 3, r: 0 }, // right - many rows to fall
      ])

      // Apply one step - both should move
      const step1 = applyGravityStep(grid, TEST_FIELD)
      expect(step1.moved).toBe(true)

      // Apply steps until left lands
      let current = grid
      let steps = 0
      while (steps < 10) {
        const { grid: next, moved } = applyGravityStep(current, TEST_FIELD)
        if (!moved) break
        current = next
        steps++
      }

      // Both should have reached their destinations
      const positions = getFilledPositions(current)
      expect(positions).toContainEqual({ q: 1, r: getBottomR(1) })
      expect(positions).toContainEqual({ q: 3, r: getBottomR(3) })
    })
  })

  describe('masses merging on landing', () => {
    it('should stop upper mass when it touches landed lower mass', () => {
      // Lower mass closer to ground
      // Upper mass will fall and should stop when it touches the lower mass
      const grid = createGrid([
        // Upper mass (2 cells)
        { q: 2, r: 0, color: 'red' },
        { q: 2, r: 1, color: 'red' },
        // Lower mass (2 cells) - will land first
        { q: 2, r: 3, color: 'blue' },
        { q: 2, r: 4, color: 'blue' },
      ])

      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(4)
      // All 4 cells should be stacked from bottom
      const bottomR = getBottomR(2)
      expect(positions).toContainEqual({ q: 2, r: bottomR })
      expect(positions).toContainEqual({ q: 2, r: bottomR - 1 })
      expect(positions).toContainEqual({ q: 2, r: bottomR - 2 })
      expect(positions).toContainEqual({ q: 2, r: bottomR - 3 })
    })

    it('should merge horizontally adjacent masses after one lands', () => {
      // Two separate masses that will become adjacent after falling
      const grid = createGrid([
        // Left mass
        { q: 1, r: 0 },
        // Right mass
        { q: 2, r: 0 },
        // Ground block that will make them adjacent when they land
        { q: 1, r: getBottomR(1) },
      ])

      const result = applyGravityUntilSettled(grid, TEST_FIELD)
      const positions = getFilledPositions(result)

      expect(positions).toHaveLength(3)
      // Left mass lands on obstruction
      expect(positions).toContainEqual({ q: 1, r: getBottomR(1) - 1 })
      // Right mass lands at bottom
      expect(positions).toContainEqual({ q: 2, r: getBottomR(2) })
      // Original obstruction
      expect(positions).toContainEqual({ q: 1, r: getBottomR(1) })
    })

    it('should fall as rigid merged mass after line clear below (with overhang)', () => {
      // Scenario:
      // - Upper mass: L-shaped with overhang (q=1,r=0 and q=2,r=0 and q=2,r=1)
      // - Lower mass: single block below upper mass (q=2,r=3)
      // - Ground line: full row that will be cleared (simulates line clear)
      //
      // After falling and merging, clear the ground line.
      // The merged mass should then fall as ONE rigid body.
      // The overhang at q=1 should NOT fall faster than q=2 cells.

      // First: let two separate masses fall and merge
      const upperMass = [
        { q: 1, r: 0, color: 'red' }, // overhang - extends left
        { q: 2, r: 0, color: 'red' },
        { q: 2, r: 1, color: 'red' },
      ]
      const lowerMass = [{ q: 2, r: 3, color: 'blue' }]

      // Ground row at bottom that we'll clear later
      const groundRow = [
        { q: 0, r: getBottomR(0), color: 'gray' },
        { q: 1, r: getBottomR(1), color: 'gray' },
        { q: 2, r: getBottomR(2), color: 'gray' },
        { q: 3, r: getBottomR(3), color: 'gray' },
        { q: 4, r: getBottomR(4), color: 'gray' },
      ]

      const initialGrid = createGrid([...upperMass, ...lowerMass, ...groundRow])

      // Step 1: Let masses fall until they merge and land on the ground row
      const afterFirstFall = applyGravityUntilSettled(initialGrid, TEST_FIELD)

      // Verify they've landed on the ground row
      // Lower mass at q=2 should be at bottomR-1 (on top of ground)
      // Upper mass should be stacked above it
      const bottomR2 = getBottomR(2)
      const positionsAfterFirst = getFilledPositions(afterFirstFall)
      expect(positionsAfterFirst).toContainEqual({ q: 2, r: bottomR2 - 1 }) // lower mass on ground
      expect(positionsAfterFirst).toContainEqual({ q: 2, r: bottomR2 - 2 }) // upper mass cell
      expect(positionsAfterFirst).toContainEqual({ q: 2, r: bottomR2 - 3 }) // upper mass cell
      expect(positionsAfterFirst).toContainEqual({ q: 1, r: bottomR2 - 3 }) // overhang

      // Step 2: Clear the ground row (simulate line clear)
      const afterClear = new Map(afterFirstFall)
      for (const cell of groundRow) {
        afterClear.delete(axialToKey({ q: cell.q, r: cell.r }))
      }

      // Step 3: Apply gravity - the merged mass should fall as ONE unit
      // The overhang at q=1 should NOT separate from the rest
      const finalGrid = applyGravityUntilSettled(afterClear, TEST_FIELD)
      const finalPositions = getFilledPositions(finalGrid)

      // The merged mass has 4 cells total
      expect(finalPositions).toHaveLength(4)

      // Key test: rigid body behavior
      // Column 1 has bottomR=5, column 2 has bottomR=4
      // If rigid: all cells stop when q=2 column hits bottom (r=4)
      // If NOT rigid: q=1 overhang would fall to r=5 independently

      // The lowest cell in q=2 column should be at bottomR(2) = 4
      expect(finalPositions).toContainEqual({ q: 2, r: 4 }) // bottom of q=2 stack
      expect(finalPositions).toContainEqual({ q: 2, r: 3 }) // middle of q=2 stack
      expect(finalPositions).toContainEqual({ q: 2, r: 2 }) // top of q=2 stack
      // The overhang at q=1 should be at the SAME row as top of q=2 (r=2), NOT at bottomR(1)=5
      expect(finalPositions).toContainEqual({ q: 1, r: 2 }) // overhang stays connected
    })
  })

  describe('grounded blocks', () => {
    it('should not move blocks already at bottom', () => {
      const grid = createGrid([{ q: 2, r: getBottomR(2) }])
      const { grid: result, moved } = applyGravityStep(grid, TEST_FIELD)

      expect(moved).toBe(false)
      expect(getFilledPositions(result)).toEqual([{ q: 2, r: getBottomR(2) }])
    })

    it('should not move blocks connected to grounded blocks', () => {
      // Stack of 3 blocks from bottom - all grounded
      const bottomR = getBottomR(2)
      const grid = createGrid([
        { q: 2, r: bottomR },
        { q: 2, r: bottomR - 1 },
        { q: 2, r: bottomR - 2 },
      ])
      const { grid: result, moved } = applyGravityStep(grid, TEST_FIELD)

      expect(moved).toBe(false)
      const positions = getFilledPositions(result)
      expect(positions).toContainEqual({ q: 2, r: bottomR })
      expect(positions).toContainEqual({ q: 2, r: bottomR - 1 })
      expect(positions).toContainEqual({ q: 2, r: bottomR - 2 })
    })
  })
})
