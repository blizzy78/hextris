// Gravity Test Page - Visual testing for gravity behavior after line clears

import { axialToKey, axialToPixel, keyToAxial } from '@/game/hexMath'
import { applyGravityStep, detectLinesForAnimation } from '@/game/lineDetection'
import type { AxialCoord, CellState, FieldShape, GridState, RenderableCell } from '@/game/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HexCell } from './HexCell'

/**
 * Line direction type - matching lineDetection.ts
 */
type LineDirection = 'diagonalRight' | 'diagonalLeft'

/**
 * A selected line with direction and the constant value
 */
interface SelectedLine {
  direction: LineDirection
  constant: number
}

// Smaller test field for easier visualization
const TEST_COLUMNS = 7
const TEST_ROWS = 10

function generateTestFieldShape(): FieldShape {
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

const TEST_FIELD_SHAPE = generateTestFieldShape()
const TEST_FIELD_COORDS: AxialCoord[] = Array.from(TEST_FIELD_SHAPE).map(key => {
  const parts = key.split(',').map(Number)
  return { q: parts[0]!, r: parts[1]! }
})

// Helper to get the bottom r value for a given column
// For column q, rows 0-9 map to r = row - floor(q/2)
// So bottom row (row=9) gives r = 9 - floor(q/2)
function getBottomR(q: number): number {
  return TEST_ROWS - 1 - Math.floor(q / 2)
}

// Helper to get the top r value for a given column
function getTopR(q: number): number {
  return -Math.floor(q / 2)
}

interface TestCase {
  name: string
  description: string
  initialGrid: GridState
}

// Create a grid with specific cells filled
function createGrid(cells: Array<{ q: number; r: number; color: string }>): GridState {
  const grid = new Map<string, CellState>()
  for (const cell of cells) {
    grid.set(axialToKey({ q: cell.q, r: cell.r }), { filled: true, color: cell.color })
  }
  return grid
}

// Test cases
// Bottom r values per column: q=2→8, q=3→8, q=4→7, q=5→7
const TEST_CASES: TestCase[] = [
  {
    name: 'Simple Gap',
    description: 'Two blocks above a gap, one block at bottom. Blocks above should fall together and stop on the block below.',
    initialGrid: createGrid([
      // Two blocks at top (floating)
      { q: 3, r: getTopR(3), color: '#ef4444' },
      { q: 4, r: getTopR(4), color: '#ef4444' },
      // Gap in between
      // One block at bottom (grounded) - and one above it
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
      { q: 3, r: getBottomR(3) - 1, color: '#3b82f6' },
    ]),
  },
  {
    name: 'Diagonal Shape',
    description: 'L-shaped blocks above a gap. All should fall as one rigid unit.',
    initialGrid: createGrid([
      // L-shape at top (floating)
      { q: 2, r: getTopR(2), color: '#ef4444' },
      { q: 3, r: getTopR(3), color: '#ef4444' },
      { q: 3, r: getTopR(3) + 1, color: '#ef4444' },
      // Gap in between
      // Bottom row blocks (grounded)
      { q: 2, r: getBottomR(2), color: '#3b82f6' },
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
      { q: 4, r: getBottomR(4), color: '#3b82f6' },
    ]),
  },
  {
    name: 'Two Separate Columns',
    description: 'Two SEPARATE floating columns (not connected). Each should fall independently to their own floor/obstruction.',
    initialGrid: createGrid([
      // Left column (floating) - will hit obstruction
      { q: 2, r: getTopR(2) + 1, color: '#ef4444' },
      { q: 2, r: getTopR(2) + 2, color: '#ef4444' },
      // Right column (floating) - goes to floor (no obstruction)
      { q: 5, r: getTopR(5), color: '#22c55e' },
      { q: 5, r: getTopR(5) + 1, color: '#22c55e' },
      // Left column has obstruction
      { q: 2, r: getBottomR(2), color: '#3b82f6' },
      { q: 2, r: getBottomR(2) - 1, color: '#3b82f6' },
    ]),
  },
  {
    name: 'Three Separate Masses',
    description: 'Three separate floating masses at different heights. Each falls independently.',
    initialGrid: createGrid([
      // Left mass (2 cells vertical)
      { q: 1, r: getTopR(1), color: '#ef4444' },
      { q: 1, r: getTopR(1) + 1, color: '#ef4444' },
      // Middle mass (single cell)
      { q: 3, r: getTopR(3) + 2, color: '#22c55e' },
      // Right mass (2 cells horizontal-ish)
      { q: 5, r: getTopR(5) + 1, color: '#a855f7' },
      { q: 6, r: getTopR(6) + 1, color: '#a855f7' },
      // Floor obstructions at different heights
      { q: 1, r: getBottomR(1), color: '#3b82f6' },
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
      { q: 3, r: getBottomR(3) - 1, color: '#3b82f6' },
    ]),
  },
  {
    name: 'Masses Merge On Landing',
    description: 'Two separate masses that land and connect. After first lands, second should stop when touching.',
    initialGrid: createGrid([
      // Upper mass - will fall and land first
      { q: 3, r: getTopR(3), color: '#ef4444' },
      { q: 4, r: getTopR(4), color: '#ef4444' },
      // Lower mass - closer to ground, lands first
      { q: 3, r: getTopR(3) + 5, color: '#22c55e' },
      { q: 4, r: getTopR(4) + 5, color: '#22c55e' },
      // Ground
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
    ]),
  },
  {
    name: 'Stacked Separate Masses',
    description: 'Two masses in same column with gap between. Lower falls first, upper follows.',
    initialGrid: createGrid([
      // Upper mass
      { q: 3, r: getTopR(3), color: '#ef4444' },
      { q: 3, r: getTopR(3) + 1, color: '#ef4444' },
      // Gap
      // Lower mass
      { q: 3, r: getTopR(3) + 4, color: '#22c55e' },
      { q: 3, r: getTopR(3) + 5, color: '#22c55e' },
      // Ground
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
    ]),
  },
  {
    name: 'No Gap (Nothing Should Move)',
    description: 'Blocks stacked from bottom with no gap. Nothing should move.',
    initialGrid: createGrid([
      // Stack from bottom up - no gaps
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
      { q: 3, r: getBottomR(3) - 1, color: '#a855f7' },
      { q: 3, r: getBottomR(3) - 2, color: '#22c55e' },
      { q: 3, r: getBottomR(3) - 3, color: '#ef4444' },
    ]),
  },
  {
    name: 'Wide Floating Mass',
    description: 'Wide block of cells floating above gap. Should fall as one unit.',
    initialGrid: createGrid([
      // 3x2 block floating at top
      { q: 2, r: getTopR(2), color: '#ef4444' },
      { q: 3, r: getTopR(3), color: '#ef4444' },
      { q: 4, r: getTopR(4), color: '#ef4444' },
      { q: 2, r: getTopR(2) + 1, color: '#ef4444' },
      { q: 3, r: getTopR(3) + 1, color: '#ef4444' },
      { q: 4, r: getTopR(4) + 1, color: '#ef4444' },
      // Gap
      // Single block at bottom
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
    ]),
  },
  {
    name: 'Multiple Gaps Same Column',
    description: 'Blocks with multiple gaps between them in same column. Each section falls independently.',
    initialGrid: createGrid([
      // Top block (floating)
      { q: 3, r: getTopR(3), color: '#ef4444' },
      // Gap
      // Middle block (also floating - gap below it)
      { q: 3, r: getTopR(3) + 3, color: '#22c55e' },
      // Gap
      // Bottom blocks (grounded - stacked at floor)
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
      { q: 3, r: getBottomR(3) - 1, color: '#3b82f6' },
    ]),
  },
  {
    name: 'Race To Bottom',
    description: 'Multiple masses at same height racing to different floor depths.',
    initialGrid: createGrid([
      // Left mass - short drop
      { q: 1, r: getTopR(1) + 3, color: '#ef4444' },
      // Middle mass - medium drop
      { q: 3, r: getTopR(3) + 3, color: '#22c55e' },
      // Right mass - long drop (no obstruction)
      { q: 5, r: getTopR(5) + 3, color: '#a855f7' },
      // Obstructions at different heights
      { q: 1, r: getBottomR(1), color: '#3b82f6' },
      { q: 1, r: getBottomR(1) - 1, color: '#3b82f6' },
      { q: 1, r: getBottomR(1) - 2, color: '#3b82f6' },
      { q: 3, r: getBottomR(3), color: '#3b82f6' },
    ]),
  },
  {
    name: 'Complex Shape',
    description: 'Complex connected shape (T-piece-like) falls as one unit.',
    initialGrid: createGrid([
      // T-shape at top
      { q: 2, r: getTopR(2) + 1, color: '#ef4444' },
      { q: 3, r: getTopR(3) + 1, color: '#ef4444' },
      { q: 4, r: getTopR(4) + 1, color: '#ef4444' },
      { q: 3, r: getTopR(3), color: '#ef4444' },
      // Ground with gap in middle
      { q: 2, r: getBottomR(2), color: '#3b82f6' },
      { q: 4, r: getBottomR(4), color: '#3b82f6' },
    ]),
  },
]

/**
 * Get the line constant for a coordinate in a given direction
 * Matches lineDetection.ts logic
 */
function getLineConstant(coord: AxialCoord, direction: LineDirection): number {
  switch (direction) {
    case 'diagonalRight':
      return coord.r
    case 'diagonalLeft':
      return coord.q + coord.r
  }
}

/**
 * Check if a coordinate is part of the highlighted line
 */
function isInLine(coord: AxialCoord, line: SelectedLine | null): boolean {
  if (!line) return false
  return getLineConstant(coord, line.direction) === line.constant
}

/**
 * Convert pixel coordinates to axial coordinates (inverse of axialToPixel)
 * Returns null if not within the field
 */
function pixelToAxial(px: number, py: number, size: number): AxialCoord {
  // Inverse of axialToPixel:
  // x = size * (3/2) * q
  // y = size * (sqrt(3)/2 * q + sqrt(3) * r)
  const q = px / (size * (3 / 2))
  const r = (py / size - (Math.sqrt(3) / 2) * q) / Math.sqrt(3)
  return { q: Math.round(q), r: Math.round(r) }
}

/**
 * Determine which direction based on x position within the hex
 * Left half = diagonalRight, Right half = diagonalLeft
 */
function getDirectionFromOffset(offsetX: number): LineDirection {
  return offsetX < 0 ? 'diagonalRight' : 'diagonalLeft'
}

// Mini hex grid for test visualization with click-to-select line
function TestHexGrid({
  cells,
  fieldCoords,
  fieldShape,
  size = 20,
  highlightedLine,
  onLineHover,
  onLineClick,
  godMode,
}: {
  cells: RenderableCell[]
  fieldCoords: AxialCoord[]
  fieldShape: FieldShape
  size?: number
  highlightedLine: SelectedLine | null
  onLineHover: (line: SelectedLine | null) => void
  onLineClick: (line: SelectedLine) => void
  godMode: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  const bounds = useMemo(() => {
    const padding = 10
    const pixels = fieldCoords.map(coord => axialToPixel(coord, size))
    const minX = Math.min(...pixels.map(p => p.x)) - size - padding
    const maxX = Math.max(...pixels.map(p => p.x)) + size + padding
    const minY = Math.min(...pixels.map(p => p.y)) - size - padding
    const maxY = Math.max(...pixels.map(p => p.y)) + size + padding
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  }, [fieldCoords, size])

  const hexPoints = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const angleDeg = 60 * i
      const angleRad = (Math.PI / 180) * angleDeg
      return `${size * Math.cos(angleRad)},${size * Math.sin(angleRad)}`
    }).join(' '),
  [size])

  // Convert mouse event to SVG coordinates
  const getSvgCoords = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return null

    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return point.matrixTransform(ctm.inverse())
  }, [])

  // Handle mouse move to detect which line is being hovered
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!godMode) {
      onLineHover(null)
      return
    }

    const svgCoords = getSvgCoords(e)
    if (!svgCoords) return

    // Find which hex cell the mouse is over
    const axial = pixelToAxial(svgCoords.x, svgCoords.y, size)
    const key = axialToKey(axial)

    if (!fieldShape.has(key)) {
      onLineHover(null)
      return
    }

    // Get pixel center of this cell
    const cellCenter = axialToPixel(axial, size)
    // Offset from cell center
    const offsetX = svgCoords.x - cellCenter.x

    // Determine direction based on which half of the cell
    const direction = getDirectionFromOffset(offsetX)
    const constant = getLineConstant(axial, direction)

    onLineHover({ direction, constant })
  }, [godMode, getSvgCoords, size, fieldShape, onLineHover])

  const handleMouseLeave = useCallback(() => {
    onLineHover(null)
  }, [onLineHover])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!godMode || !highlightedLine) return
    e.preventDefault()
    onLineClick(highlightedLine)
  }, [godMode, highlightedLine, onLineClick])

  return (
    <svg
      ref={svgRef}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      className="w-full h-full"
      style={{ maxHeight: '400px', cursor: godMode ? 'crosshair' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Field outline */}
      {fieldCoords.map((coord) => {
        const { x, y } = axialToPixel(coord, size)
        const isHighlighted = isInLine(coord, highlightedLine)
        // Use different colors for different directions
        const highlightColor = highlightedLine?.direction === 'diagonalLeft' ? '#f97316' : '#eab308'
        return (
          <polygon
            key={`outline-${coord.q},${coord.r}`}
            points={hexPoints}
            fill={isHighlighted ? `${highlightColor}40` : 'none'}
            stroke={isHighlighted ? highlightColor : '#374151'}
            strokeWidth={isHighlighted ? 2 : 1}
            transform={`translate(${x}, ${y})`}
          />
        )
      })}
      {/* Cells */}
      {cells.map((cell, index) => (
        <HexCell
          key={`${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={cell.opacity}
        />
      ))}
    </svg>
  )
}

function gridToRenderableCells(grid: GridState): RenderableCell[] {
  const cells: RenderableCell[] = []
  for (const [key, cellState] of grid) {
    if (cellState.filled) {
      cells.push({
        coord: keyToAxial(key),
        color: cellState.color,
      })
    }
  }
  return cells
}

// Debug version - get hex neighbors
function getHexNeighborsDebug(coord: AxialCoord): AxialCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q, r: coord.r + 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ]
}

// Debug version - find connected components
function findComponentsDebug(
  floatingKeys: Set<string>
): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const key of floatingKeys) {
    if (visited.has(key)) continue

    const component: string[] = []
    const queue = [key]
    visited.add(key)

    while (queue.length > 0) {
      const currentKey = queue.shift()!
      component.push(currentKey)
      const currentCoord = keyToAxial(currentKey)

      for (const neighbor of getHexNeighborsDebug(currentCoord)) {
        const neighborKey = axialToKey(neighbor)
        if (floatingKeys.has(neighborKey) && !visited.has(neighborKey)) {
          visited.add(neighborKey)
          queue.push(neighborKey)
        }
      }
    }

    components.push(component)
  }

  return components
}

// Debug version of classification to trace the logic
// Uses same algorithm as lineDetection.ts - propagates through hex neighbors
function classifyDebug(
  filledKeys: Set<string>,
  fieldShape: FieldShape
): { grounded: Set<string>; floating: Set<string> } {
  const grounded = new Set<string>()

  // First pass: find cells directly on floor
  for (const key of filledKeys) {
    const coord = keyToAxial(key)
    const below: AxialCoord = { q: coord.q, r: coord.r + 1 }
    const belowKey = axialToKey(below)
    if (!fieldShape.has(belowKey)) {
      grounded.add(key)
    }
  }

  // Propagate grounded status through vertical AND horizontal connections
  let changed = true
  while (changed) {
    changed = false
    for (const key of filledKeys) {
      if (grounded.has(key)) continue
      const coord = keyToAxial(key)

      // Check cell directly below (vertical support)
      const below: AxialCoord = { q: coord.q, r: coord.r + 1 }
      const belowKey = axialToKey(below)
      if (grounded.has(belowKey)) {
        grounded.add(key)
        changed = true
        continue
      }

      // Check all hex neighbors (connected component support)
      for (const neighbor of getHexNeighborsDebug(coord)) {
        const neighborKey = axialToKey(neighbor)
        if (filledKeys.has(neighborKey) && grounded.has(neighborKey)) {
          grounded.add(key)
          changed = true
          break
        }
      }
    }
  }

  // Everything not grounded is floating
  const floating = new Set<string>()
  for (const key of filledKeys) {
    if (!grounded.has(key)) {
      floating.add(key)
    }
  }

  return { grounded, floating }
}

export function GravityTestPage() {
  const [selectedTest, setSelectedTest] = useState(0)
  const [animationFrames, setAnimationFrames] = useState<GridState[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [godMode, setGodMode] = useState(false)
  const [hoveredLine, setHoveredLine] = useState<SelectedLine | null>(null)
  const [customGrid, setCustomGrid] = useState<GridState | null>(null)

  // Refs to access current state in interval callbacks
  const animationFramesRef = useRef<GridState[]>([])
  const currentFrameRef = useRef(0)

  // Keep refs in sync with state
  useEffect(() => {
    animationFramesRef.current = animationFrames
  }, [animationFrames])

  useEffect(() => {
    currentFrameRef.current = currentFrame
  }, [currentFrame])

  const testCase = TEST_CASES[selectedTest]!

  // Get the current working grid (custom if modified, otherwise test case initial)
  const workingGrid = customGrid ?? testCase.initialGrid

  // Clear a specific line from the grid
  const clearLine = useCallback((line: SelectedLine) => {
    // Use current visible grid
    const baseGrid = animationFramesRef.current.length > 0
      ? animationFramesRef.current[currentFrameRef.current]!
      : workingGrid
    const newGrid = new Map(baseGrid)
    // Remove all cells matching the line
    for (const key of TEST_FIELD_SHAPE) {
      const coord = keyToAxial(key)
      const constant = line.direction === 'diagonalRight' ? coord.r : coord.q + coord.r
      if (constant === line.constant) {
        newGrid.delete(key)
      }
    }
    setCustomGrid(newGrid)

    // Regenerate frames from cleared grid, keeping current frame position
    const newFrames: GridState[] = animationFramesRef.current.slice(0, currentFrameRef.current)
    newFrames.push(newGrid)

    // Generate all remaining gravity frames
    let gridState = newGrid
    for (let i = 0; i < 20; i++) {
      const { grid: nextGrid, moved } = applyGravityStep(gridState, TEST_FIELD_SHAPE)
      if (!moved) break
      newFrames.push(nextGrid)
      gridState = nextGrid
    }

    setAnimationFrames(newFrames)
  }, [workingGrid])

  // Reset to original test case
  const resetToTestCase = useCallback(() => {
    setCustomGrid(null)
    setAnimationFrames([])
    setCurrentFrame(0)
    setHoveredLine(null)
    setDebugLog([])
  }, [])

  const runGravity = useCallback(() => {
    // Simulate what happens after a line clear - just run gravity on the working grid
    const stages = detectLinesForAnimation(workingGrid, TEST_FIELD_SHAPE)
    const log: string[] = []

    // If no lines detected (expected), manually run gravity
    // We need to create frames by repeatedly applying gravity
    if (stages.length === 0) {
      const frames: GridState[] = [workingGrid]
      let currentGrid = workingGrid

      // Log initial state
      log.push('=== Initial State ===')
      for (const [key, cellState] of currentGrid) {
        if (cellState.filled) {
          log.push(`  Cell ${key}: ${cellState.color}`)
        }
      }

      // Manually apply gravity step by step (max 20 iterations to prevent infinite loop)
      for (let i = 0; i < 20; i++) {
        log.push(`\n=== Step ${i + 1} ===`)

        // Collect filled cells for debug
        const filledKeys = new Set<string>()
        for (const [key, cellState] of currentGrid) {
          if (cellState.filled) filledKeys.add(key)
        }

        // Check floating status of each cell using new classification
        const { floating } = classifyDebug(filledKeys, TEST_FIELD_SHAPE)
        for (const key of filledKeys) {
          const isFloating = floating.has(key)
          log.push(`  ${key}: ${isFloating ? 'FLOATING' : 'GROUNDED'}`)
        }

        // Show connected components
        const components = findComponentsDebug(floating)
        log.push(`  Components: ${components.length}`)
        for (let ci = 0; ci < components.length; ci++) {
          log.push(`    Component ${ci + 1}: ${components[ci]!.join(', ')}`)
        }

        const { grid: nextGrid, moved } = applyGravityStep(currentGrid, TEST_FIELD_SHAPE)
        log.push(`  Moved: ${moved}`)

        if (!moved) {
          log.push('  No movement - stopping')
          break
        }
        frames.push(nextGrid)
        currentGrid = nextGrid
      }

      setAnimationFrames(frames)
      setCurrentFrame(0)
      setDebugLog(log)
    } else {
      // There were lines - use the animation frames from the stages
      const allFrames: GridState[] = [workingGrid]
      for (const stage of stages) {
        allFrames.push(stage.gridAfterClear)
        allFrames.push(...stage.gravityFrames)
      }
      setAnimationFrames(allFrames)
      setCurrentFrame(0)
      setDebugLog(['Lines detected - using built-in animation'])
    }
  }, [workingGrid])

  const playAnimation = useCallback(() => {
    if (animationFramesRef.current.length <= 1) return
    setIsAnimating(true)
    // Start from current frame, not 0
    let frame = currentFrameRef.current

    const interval = setInterval(() => {
      frame++
      // Use ref to get latest frame count (may change if line cleared)
      if (frame >= animationFramesRef.current.length) {
        clearInterval(interval)
        setIsAnimating(false)
        // Update customGrid to final state
        const finalGrid = animationFramesRef.current[animationFramesRef.current.length - 1]
        if (finalGrid) {
          setCustomGrid(finalGrid)
        }
        return
      }
      setCurrentFrame(frame)
    }, 300)
  }, [])

  const currentGrid = animationFrames.length > 0
    ? animationFrames[currentFrame]!
    : workingGrid

  const cells = gridToRenderableCells(currentGrid)

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Gravity Test</h1>

      <div className="flex gap-8">
        {/* Test case selector */}
        <div className="w-64 space-y-2">
          <h2 className="text-lg font-semibold text-gray-300 mb-2">Test Cases</h2>
          {TEST_CASES.map((tc, index) => (
            <button
              key={tc.name}
              onClick={() => {
                setSelectedTest(index)
                setCustomGrid(null)
                setAnimationFrames([])
                setCurrentFrame(0)
                setDebugLog([])
              }}
              className={`w-full text-left px-3 py-2 rounded ${
                selectedTest === index
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tc.name}
            </button>
          ))}
        </div>

        {/* Visualization */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-white mb-2">{testCase.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{testCase.description}</p>

            <div className="flex gap-4 mb-4">
              <button
                onClick={runGravity}
                disabled={isAnimating}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
              >
                Apply Gravity
              </button>
              <button
                onClick={playAnimation}
                disabled={isAnimating || animationFrames.length <= 1}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded"
              >
                Play Animation
              </button>
              <button
                onClick={() => {
                  setAnimationFrames([])
                  setCurrentFrame(0)
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                Reset
              </button>
              {customGrid && (
                <button
                  onClick={resetToTestCase}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded"
                >
                  Reset to Test Case
                </button>
              )}
            </div>

            {/* God Mode - Line Clear */}
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={godMode}
                    onChange={(e) => setGodMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  God Mode (Click to Clear Lines)
                </label>
                {godMode && (
                  <span className="text-gray-500 text-sm">
                    Hover: <span className="text-yellow-400">left half → diagonal right (r)</span>,{' '}
                    <span className="text-orange-400">right half → diagonal left (q+r)</span>
                  </span>
                )}
              </div>
            </div>

            {animationFrames.length > 1 && (
              <div className="text-gray-400 text-sm mb-4">
                Frame {currentFrame + 1} / {animationFrames.length}
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4" style={{ height: '450px' }}>
            <TestHexGrid
              cells={cells}
              fieldCoords={TEST_FIELD_COORDS}
              fieldShape={TEST_FIELD_SHAPE}
              size={22}
              highlightedLine={hoveredLine}
              onLineHover={setHoveredLine}
              onLineClick={clearLine}
              godMode={godMode}
            />
          </div>

          <div className="mt-4 text-gray-400 text-sm">
            <p><span className="text-red-400">■</span> Red = Floating blocks (should fall)</p>
            <p><span className="text-blue-400">■</span> Blue = Grounded blocks (should stay)</p>
            <p><span className="text-green-400">■</span> Green = Additional floating blocks</p>
          </div>

          {/* Debug Log */}
          {debugLog.length > 0 && (
            <div className="mt-4 bg-gray-950 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Debug Log (copy this for feedback):</h4>
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
                {debugLog.join('\n')}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
