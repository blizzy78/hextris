// HexGrid component - renders a collection of hexagons

import { FIELD_COORDS, FIELD_SHAPE } from '@/game/gameModes'
import { axialToKey, axialToPixel } from '@/game/hexMath'
import { PADDING } from '@/game/renderConstants'
import type { AxialCoord, FieldShape, RenderableCell } from '@/game/types'
import { HexCell, SpecialCellGlow } from './HexCell'

interface HexGridProps {
  cells: RenderableCell[]
  fieldShape: FieldShape
  size: number
  padding?: number
}

/**
 * Calculate the bounding box for a set of hexagon coordinates
 */
function calculateBounds(coords: AxialCoord[], size: number, padding: number) {
  if (coords.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }
  }

  const pixels = coords.map(coord => axialToPixel(coord, size))

  const minX = Math.min(...pixels.map(p => p.x)) - size - padding
  const maxX = Math.max(...pixels.map(p => p.x)) + size + padding
  const minY = Math.min(...pixels.map(p => p.y)) - size - padding
  const maxY = Math.max(...pixels.map(p => p.y)) + size + padding

  const width = maxX - minX
  const height = maxY - minY

  return { minX, maxX, minY, maxY, width, height }
}

/**
 * Get hex vertex positions for flat-top orientation
 * Vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
 * Index 0 = right (0°), 1 = bottom-right (60°), 2 = bottom-left (120°),
 * 3 = left (180°), 4 = top-left (240°), 5 = top-right (300°)
 */
function getHexVertex(size: number, index: number): { x: number; y: number } {
  const angleDeg = 60 * index
  const angleRad = (Math.PI / 180) * angleDeg
  return { x: size * Math.cos(angleRad), y: size * Math.sin(angleRad) }
}

/**
 * Map from edge index to the neighbor direction for that edge.
 * Edge i connects vertex i to vertex (i+1)%6.
 *
 * For flat-top hexagons:
 * - Edge 0 (vertex 0→1): bottom-right edge → neighbor at (q+1, r)
 * - Edge 1 (vertex 1→2): bottom edge → neighbor at (q, r+1)
 * - Edge 2 (vertex 2→3): bottom-left edge → neighbor at (q-1, r+1)
 * - Edge 3 (vertex 3→4): top-left edge → neighbor at (q-1, r)
 * - Edge 4 (vertex 4→5): top edge → neighbor at (q, r-1)
 * - Edge 5 (vertex 5→0): top-right edge → neighbor at (q+1, r-1)
 */
const EDGE_TO_NEIGHBOR: AxialCoord[] = [
  { q: 1, r: 0 },   // Edge 0: bottom-right
  { q: 0, r: 1 },   // Edge 1: bottom
  { q: -1, r: 1 },  // Edge 2: bottom-left
  { q: -1, r: 0 },  // Edge 3: top-left
  { q: 0, r: -1 },  // Edge 4: top
  { q: 1, r: -1 },  // Edge 5: top-right
]

/**
 * Check which edges of a cell are on the outer boundary
 * Returns array of edge indices (0-5) that are boundary edges
 */
function getBoundaryEdges(coord: AxialCoord, field: Set<string>): number[] {
  const boundaryEdges: number[] = []
  for (let i = 0; i < 6; i++) {
    const neighbor = {
      q: coord.q + EDGE_TO_NEIGHBOR[i]!.q,
      r: coord.r + EDGE_TO_NEIGHBOR[i]!.r
    }
    if (!field.has(axialToKey(neighbor))) {
      boundaryEdges.push(i)
    }
  }
  return boundaryEdges
}

/**
 * Determine if a boundary edge should be excluded from emphasis.
 * - Edge 4 (flat top) is always skipped
 * - Edges 3 and 5 (top diagonals) are skipped if they face outside the field
 *   (meaning the cell is on the top boundary)
 */
function shouldSkipBoundaryEdge(edgeIndex: number, boundaryEdges: number[]): boolean {
  // Always skip the flat top edge
  if (edgeIndex === 4) return true

  // Skip top diagonal edges (3=top-left, 5=top-right) only if they're
  // actual top boundary edges (no neighbor above)
  // We detect this by checking if the cell also has edge 4 as boundary
  // (meaning the top neighbor is missing)
  if ((edgeIndex === 3 || edgeIndex === 5) && boundaryEdges.includes(4)) {
    return true
  }

  return false
}

export function HexGrid({ cells, size, padding = PADDING.DEFAULT_GRID }: HexGridProps) {
  const bounds = calculateBounds(FIELD_COORDS, size, padding)

  // Pre-compute boundary edges for emphasized rendering
  const boundaryLines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = []
  for (const coord of FIELD_COORDS) {
    const boundaryEdges = getBoundaryEdges(coord, FIELD_SHAPE)
    const { x, y } = axialToPixel(coord, size)

    for (const edgeIndex of boundaryEdges) {
      // Skip top boundary edges
      if (shouldSkipBoundaryEdge(edgeIndex, boundaryEdges)) continue

      const v1 = getHexVertex(size, edgeIndex)
      const v2 = getHexVertex(size, (edgeIndex + 1) % 6)
      boundaryLines.push({
        x1: x + v1.x,
        y1: y + v1.y,
        x2: x + v2.x,
        y2: y + v2.y,
        key: `boundary-${coord.q},${coord.r}-${edgeIndex}`
      })
    }
  }

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      className="w-full h-full"
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    >
      {/* Emphasized boundary edges (left, right, bottom - not top) */}
      {boundaryLines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#2d3748"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}

      {/* Rendered cells */}
      {cells.map((cell, index) => (
        <HexCell
          key={`${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={cell.opacity}
          isGhost={cell.isGhost}
          special={cell.special}
          frozenCleared={cell.frozenCleared}
          clearing={cell.clearing}
        />
      ))}

      {/* Special cell glow effects rendered on top of all cells */}
      {cells
        .filter((cell) => cell.special && !cell.isGhost && !cell.clearing)
        .map((cell, index) => (
          <SpecialCellGlow
            key={`glow-${cell.coord.q},${cell.coord.r}-${index}`}
            coord={cell.coord}
            size={size}
            special={cell.special!}
            frozenCleared={cell.frozenCleared}
            clearing={cell.clearing}
          />
        ))}
    </svg>
  )
}
