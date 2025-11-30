// Slide Test Page - Visual testing for sliding pieces under grounded blocks

import { isValidPiecePosition } from '@/game/collision'
import { axialToKey, axialToPixel, keyToAxial } from '@/game/hexMath'
import { moveDown, moveLeft, moveRight } from '@/game/movement'
import { getPieceCells, PIECE_METADATA, rotatePiece } from '@/game/pieces'
import type { AxialCoord, CellState, FieldShape, GridState, Piece, RenderableCell } from '@/game/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HexCell } from './HexCell'

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
function getBottomR(q: number): number {
  return TEST_ROWS - 1 - Math.floor(q / 2)
}

// Create a grid with specific cells filled
function createGrid(cells: Array<{ q: number; r: number; color: string }>): GridState {
  const grid = new Map<string, CellState>()
  for (const cell of cells) {
    grid.set(axialToKey({ q: cell.q, r: cell.r }), { filled: true, color: cell.color })
  }
  return grid
}

interface TestCase {
  name: string
  description: string
  initialGrid: GridState
  /** Initial piece position */
  piecePosition: AxialCoord
  /** Initial piece rotation (0-5) */
  pieceRotation: number
  /** Expected: can the piece slide under the overhang? */
  expectedSlide: 'left' | 'right'
}

// Test case: L-piece should slide under grounded overhang
// The scenario:
// - Grounded blocks form an overhang (blocks sticking out from a wall)
// - L-piece is falling next to the overhang
// - When L-piece touches ground, player has 500ms lock delay to slide under the overhang
const TEST_CASES: TestCase[] = [
  {
    name: 'Tuck L Under Overhang',
    description: 'L-piece should be able to tuck right under the overhang. Move piece down until it touches ground, then quickly slide right. Lock delay (500ms) gives time to tuck.',
    initialGrid: createGrid([
      // Overhang: blocks sticking out from the right wall
      // Creates an L-shaped overhang with space underneath
      { q: 4, r: getBottomR(4) - 2, color: '#3b82f6' },
      { q: 5, r: getBottomR(5) - 2, color: '#3b82f6' },
      { q: 6, r: getBottomR(6) - 2, color: '#3b82f6' },
      // Support pillar on the right
      { q: 6, r: getBottomR(6), color: '#6b7280' },
      { q: 6, r: getBottomR(6) - 1, color: '#6b7280' },
    ]),
    // L-piece starts to the left, above the floor
    piecePosition: { q: 2, r: getBottomR(2) - 4 },
    pieceRotation: 0, // Default rotation
    expectedSlide: 'right',
  },
]

// Create an L-piece at the given position
function createLPiece(position: AxialCoord, rotation: number): Piece {
  const metadata = PIECE_METADATA['L_PIECE']
  return {
    type: 'L_PIECE',
    shape: metadata.shape,
    color: metadata.color,
    position,
    rotation,
  }
}

// Mini hex grid for test visualization
function TestHexGrid({
  cells,
  fieldCoords,
  pieceCells,
  ghostCells,
  size = 20,
}: {
  cells: RenderableCell[]
  fieldCoords: AxialCoord[]
  pieceCells: RenderableCell[]
  ghostCells?: RenderableCell[]
  size?: number
}) {
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

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      className="w-full h-full"
      style={{ maxHeight: '400px' }}
    >
      {/* Field outline */}
      {fieldCoords.map((coord) => {
        const { x, y } = axialToPixel(coord, size)
        return (
          <polygon
            key={`outline-${coord.q},${coord.r}`}
            points={hexPoints}
            fill="none"
            stroke="#374151"
            strokeWidth={1}
            transform={`translate(${x}, ${y})`}
          />
        )
      })}
      {/* Ghost cells (piece target position) */}
      {ghostCells?.map((cell, index) => (
        <HexCell
          key={`ghost-${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={0.3}
        />
      ))}
      {/* Grid cells (grounded blocks) */}
      {cells.map((cell, index) => (
        <HexCell
          key={`${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={cell.opacity}
        />
      ))}
      {/* Piece cells (falling piece) */}
      {pieceCells.map((cell, index) => (
        <HexCell
          key={`piece-${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={1}
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

function pieceToRenderableCells(piece: Piece): RenderableCell[] {
  const coords = getPieceCells(piece)
  return coords.map(coord => ({
    coord,
    color: piece.color,
  }))
}

export function SlideTestPage() {
  const [selectedTest, setSelectedTest] = useState(0)
  const [piece, setPiece] = useState<Piece>(() => {
    const tc = TEST_CASES[0]!
    return createLPiece(tc.piecePosition, tc.pieceRotation)
  })
  const [log, setLog] = useState<string[]>([])

  const testCase = TEST_CASES[selectedTest]!

  // Handle test case change - use key prop pattern instead of effect
  const handleTestSelect = useCallback((index: number) => {
    setSelectedTest(index)
    const tc = TEST_CASES[index]!
    setPiece(createLPiece(tc.piecePosition, tc.pieceRotation))
    setLog([])
  }, [])

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev, msg])
  }, [])

  // Movement handlers
  const handleMoveLeft = useCallback(() => {
    const result = moveLeft(piece, testCase.initialGrid, TEST_FIELD_SHAPE)
    if (result) {
      setPiece(result)
      addLog(`Moved left to (${result.position.q}, ${result.position.r})`)
    } else {
      addLog(`Cannot move left - blocked`)
    }
  }, [piece, testCase.initialGrid, addLog])

  const handleMoveRight = useCallback(() => {
    const result = moveRight(piece, testCase.initialGrid, TEST_FIELD_SHAPE)
    if (result) {
      setPiece(result)
      addLog(`Moved right to (${result.position.q}, ${result.position.r})`)
    } else {
      addLog(`Cannot move right - blocked`)
    }
  }, [piece, testCase.initialGrid, addLog])

  const handleMoveDown = useCallback(() => {
    const result = moveDown(piece, testCase.initialGrid, TEST_FIELD_SHAPE)
    if (result) {
      setPiece(result)
      addLog(`Moved down to (${result.position.q}, ${result.position.r})`)
    } else {
      addLog(`Cannot move down - blocked (would lock)`)
    }
  }, [piece, testCase.initialGrid, addLog])

  const handleRotate = useCallback(() => {
    const rotated = rotatePiece(piece)
    const result = isValidPiecePosition(rotated, testCase.initialGrid, TEST_FIELD_SHAPE)
    if (result.valid) {
      setPiece(rotated)
      addLog(`Rotated to rotation ${rotated.rotation % 6}`)
    } else {
      addLog(`Cannot rotate - blocked (${result.reason})`)
    }
  }, [piece, testCase.initialGrid, addLog])

  const handleReset = useCallback(() => {
    setPiece(createLPiece(testCase.piecePosition, testCase.pieceRotation))
    setLog([])
  }, [testCase.piecePosition, testCase.pieceRotation])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          handleMoveLeft()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleMoveRight()
          break
        case 'ArrowDown':
          e.preventDefault()
          handleMoveDown()
          break
        case 'ArrowUp':
          e.preventDefault()
          handleRotate()
          break
        case 'r':
        case 'R':
          handleReset()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMoveLeft, handleMoveRight, handleMoveDown, handleRotate, handleReset])

  const gridCells = useMemo(() => gridToRenderableCells(testCase.initialGrid), [testCase.initialGrid])
  const pieceCells = useMemo(() => pieceToRenderableCells(piece), [piece])

  // Check if piece can slide in expected direction
  const canSlide = useMemo(() => {
    if (testCase.expectedSlide === 'right') {
      return moveRight(piece, testCase.initialGrid, TEST_FIELD_SHAPE) !== null
    } else {
      return moveLeft(piece, testCase.initialGrid, TEST_FIELD_SHAPE) !== null
    }
  }, [piece, testCase.initialGrid, testCase.expectedSlide])

  // Check collision details for debugging
  const collisionDebug = useMemo(() => {
    const coords = getPieceCells(piece)
    const details: string[] = []
    for (const coord of coords) {
      const key = axialToKey(coord)
      const inField = TEST_FIELD_SHAPE.has(key)
      const cell = testCase.initialGrid.get(key)
      const occupied = cell?.filled ?? false
      details.push(`(${coord.q},${coord.r}): ${inField ? 'in-field' : 'OUT'}, ${occupied ? 'OCCUPIED' : 'empty'}`)
    }
    return details
  }, [piece, testCase.initialGrid])

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Slide Under Test</h1>
      <p className="text-gray-400 mb-6">
        Test whether falling pieces can slide horizontally under grounded blocks (overhangs).
        This is a common Tetris mechanic that allows pieces to be &quot;tucked&quot; into gaps.
      </p>

      <div className="flex gap-8">
        {/* Test case selector */}
        <div className="w-64 space-y-2">
          <h2 className="text-lg font-semibold text-gray-300 mb-2">Test Cases</h2>
          {TEST_CASES.map((tc, index) => (
            <button
              key={tc.name}
              onClick={() => handleTestSelect(index)}
              className={`w-full text-left px-3 py-2 rounded ${
                selectedTest === index
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tc.name}
            </button>
          ))}

          <div className="mt-4 p-3 bg-gray-800 rounded">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Controls</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>← → : Move left/right</li>
              <li>↓ : Move down</li>
              <li>↑ : Rotate</li>
              <li>R : Reset piece</li>
            </ul>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-white mb-2">{testCase.name}</h3>
            <p className="text-gray-400 text-sm mb-4">{testCase.description}</p>

            <div className="flex gap-4 mb-4">
              <button
                onClick={handleMoveLeft}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                ← Left
              </button>
              <button
                onClick={handleMoveRight}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Right →
              </button>
              <button
                onClick={handleMoveDown}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                ↓ Down
              </button>
              <button
                onClick={handleRotate}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
              >
                ↻ Rotate
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                Reset
              </button>
            </div>

            <div className={`p-3 rounded mb-4 ${canSlide ? 'bg-green-900' : 'bg-red-900'}`}>
              <span className={`font-semibold ${canSlide ? 'text-green-300' : 'text-red-300'}`}>
                Can slide {testCase.expectedSlide}: {canSlide ? 'YES ✓' : 'NO ✗'}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                {canSlide
                  ? 'The piece can move in the expected direction.'
                  : 'The piece is blocked. This may indicate a bug if the gap is large enough.'}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4" style={{ height: '450px' }}>
            <TestHexGrid
              cells={gridCells}
              fieldCoords={TEST_FIELD_COORDS}
              pieceCells={pieceCells}
              size={22}
            />
          </div>

          <div className="mt-4 text-gray-400 text-sm">
            <p><span className="text-blue-400">■</span> Blue/Gray = Grounded blocks (overhang/support)</p>
            <p><span style={{ color: PIECE_METADATA['L_PIECE'].color }}>■</span> L-Piece = Falling piece (controllable)</p>
          </div>

          {/* Piece position debug */}
          <div className="mt-4 bg-gray-950 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Piece Debug Info</h4>
            <div className="text-xs text-gray-400 font-mono">
              <p>Position: ({piece.position.q}, {piece.position.r})</p>
              <p>Rotation: {piece.rotation % 6}</p>
              <p>Cells:</p>
              <ul className="ml-4">
                {collisionDebug.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Movement Log */}
          {log.length > 0 && (
            <div className="mt-4 bg-gray-950 rounded-lg p-4 max-h-48 overflow-y-auto">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Movement Log</h4>
              <ul className="text-xs text-gray-400 font-mono space-y-1">
                {log.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
