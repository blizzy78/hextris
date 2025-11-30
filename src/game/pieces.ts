// Piece definitions and rotation logic

import { axialToCube, cubeToAxial } from './hexMath'
import type { AxialCoord, Piece, PieceShape, PieceType } from './types'

// Neighbor offsets for hexagonal grid (flat-top orientation)
// These represent the 6 directions from a center tile at (0, 0)
const NEIGHBORS = {
  top: { q: 0, r: -1 },
  topRight: { q: 1, r: -1 },
  bottomRight: { q: 1, r: 0 },
  bottom: { q: 0, r: 1 },
  bottomLeft: { q: -1, r: 1 },
  topLeft: { q: -1, r: 0 }
} as const

// Piece shape definitions - 9 Tetrahexes with mirrors
// Center tile at (0, 0) is always filled implicitly
// These arrays define additional 3 filled neighbors (total 4 hexagons per piece)

// I - Vertical straight bar (rotates around center-bottom)
const I_PIECE: PieceShape = [
  NEIGHBORS.top,
  NEIGHBORS.bottom,
  { q: 0, r: 2 } // extends down two from center
]

// S - Horizontal zigzag (rotates around center)
const S_PIECE: PieceShape = [
  NEIGHBORS.topLeft,
  NEIGHBORS.topRight,
  { q: 2, r: -1 } // extends right from topRight
]

// Z - Mirror zigzag (rotates around center)
const Z_PIECE: PieceShape = [
  NEIGHBORS.topRight,
  NEIGHBORS.topLeft,
  { q: -2, r: 1 } // extends left from topLeft
]

// L - L-shape (rotates around center at corner)
const L_PIECE: PieceShape = [
  NEIGHBORS.top,
  { q: 0, r: -2 }, // extends up from top
  NEIGHBORS.bottomRight
]

// J - Mirror L-shape (rotates around center at corner)
const J_PIECE: PieceShape = [
  NEIGHBORS.top,
  { q: 0, r: -2 }, // extends up from top
  NEIGHBORS.bottomLeft
]

// T - Pistol: 3-vertical-bar with block on side (rotates around center)
const T_PIECE: PieceShape = [
  NEIGHBORS.top,
  NEIGHBORS.bottom,
  NEIGHBORS.topRight
]

// P - Mirror pistol: 3-vertical-bar with block on other side (rotates around center)
const P_PIECE: PieceShape = [
  NEIGHBORS.top,
  NEIGHBORS.bottom,
  NEIGHBORS.topLeft
]

// U - U-shape: arc orbiting around empty center
// 4 hexes on ring around (0,0): top, topRight, bottomRight, bottom
const U_PIECE: PieceShape = [
  NEIGHBORS.top,
  NEIGHBORS.topRight,
  NEIGHBORS.bottomRight,
  NEIGHBORS.bottom
]

// O - Rhombus (rotates around center)
const O_PIECE: PieceShape = [
  NEIGHBORS.topRight,
  NEIGHBORS.bottomRight,
  NEIGHBORS.bottom
]

// Y - Propeller: 3-way symmetric branching (rotates around center)
const Y_PIECE: PieceShape = [
  NEIGHBORS.top,
  NEIGHBORS.bottomRight,
  NEIGHBORS.bottomLeft
]

// Piece metadata - unified source of truth for all piece information
// hasCenter: true = center (0,0) is filled, false = center is empty (piece orbits around it)
// rotationStates: number of unique rotation positions (6 for most pieces, 3 for pieces with 180° symmetry)
export const PIECE_METADATA: Record<PieceType, { shape: PieceShape; color: string; name: string; hasCenter: boolean; rotationStates: number }> = {
  'I_PIECE': { shape: I_PIECE, color: '#06b6d4', name: 'Bar', hasCenter: true, rotationStates: 3 },
  'S_PIECE': { shape: S_PIECE, color: '#f97316', name: 'Worm', hasCenter: true, rotationStates: 3 },
  'Z_PIECE': { shape: Z_PIECE, color: '#84cc16', name: 'Mirror Worm', hasCenter: true, rotationStates: 3 },
  'L_PIECE': { shape: L_PIECE, color: '#3b82f6', name: 'L-Shape', hasCenter: true, rotationStates: 6 },
  'J_PIECE': { shape: J_PIECE, color: '#f59e0b', name: 'Mirror L', hasCenter: true, rotationStates: 6 },
  'T_PIECE': { shape: T_PIECE, color: '#8b5cf6', name: 'Pistol', hasCenter: true, rotationStates: 6 },
  'P_PIECE': { shape: P_PIECE, color: '#ec4899', name: 'Mirror Pistol', hasCenter: true, rotationStates: 6 },
  'U_PIECE': { shape: U_PIECE, color: '#22c55e', name: 'U-Shape', hasCenter: false, rotationStates: 6 },
  'O_PIECE': { shape: O_PIECE, color: '#ef4444', name: 'Rhombus', hasCenter: true, rotationStates: 3 },
  'Y_PIECE': { shape: Y_PIECE, color: '#eab308', name: 'Propeller', hasCenter: true, rotationStates: 6 }
}

/**
 * Get all cells occupied by a piece
 * Center tile is included only if hasCenter is true for the piece type
 */
export function getPieceCells(piece: Piece): AxialCoord[] {
  const cells: AxialCoord[] = []
  const metadata = PIECE_METADATA[piece.type]

  // Include center tile only if piece has filled center
  if (metadata.hasCenter) {
    cells.push(piece.position)
  }

  // Normalize rotation based on piece's number of unique rotation states
  // (e.g., rhombus has 3 states due to 180° symmetry, others have 6)
  const normalizedRotation = ((piece.rotation % metadata.rotationStates) + metadata.rotationStates) % metadata.rotationStates

  // Add rotated shape offsets to piece position
  const rotatedShape = rotatePieceShape(piece.shape, normalizedRotation)
  for (const offset of rotatedShape) {
    cells.push({
      q: piece.position.q + offset.q,
      r: piece.position.r + offset.r
    })
  }

  return cells
}

/**
 * Rotate a piece shape by the given number of 60° steps clockwise
 */
function rotatePieceShape(shape: PieceShape, rotationSteps: number): PieceShape {
  // Normalize rotation to 0-5 range
  const normalizedSteps = ((rotationSteps % 6) + 6) % 6

  if (normalizedSteps === 0) {
    return shape
  }

  return shape.map(offset => rotateCoordinate(offset, normalizedSteps))
}

/**
 * Rotate a single coordinate around origin (0, 0) by given 60° steps clockwise
 * Uses cube coordinate rotation with cycling
 */
function rotateCoordinate(coord: AxialCoord, steps: number): AxialCoord {
  let cube = axialToCube(coord)

  // Apply rotation steps times
  for (let i = 0; i < steps; i++) {
    // Clockwise rotation: cycle [x, y, z] → [z, x, y], then negate all
    cube = {
      x: -cube.z,
      y: -cube.x,
      z: -cube.y
    }
  }

  return cubeToAxial(cube)
}

/**
 * Create a new piece instance at the given position
 */
function createPiece(
  type: PieceType,
  position: AxialCoord,
  rotation = 0
): Piece {
  const metadata = PIECE_METADATA[type]
  return {
    type,
    shape: metadata.shape,
    color: metadata.color,
    position,
    rotation
  }
}

/**
 * Rotate a piece by 60° clockwise
 */
export function rotatePiece(piece: Piece): Piece {
  return {
    ...piece,
    rotation: piece.rotation + 1
  }
}

/**
 * Get a random piece type
 * @param excludeTypes Optional piece types to exclude from random selection
 */
function getRandomPieceType(excludeTypes?: PieceType[]): PieceType {
  const types: PieceType[] = ['I_PIECE', 'S_PIECE', 'Z_PIECE', 'L_PIECE', 'J_PIECE', 'T_PIECE', 'P_PIECE', 'U_PIECE', 'O_PIECE', 'Y_PIECE']
  const excludeSet = new Set(excludeTypes ?? [])
  const availableTypes = types.filter(t => !excludeSet.has(t))
  // Invariant: availableTypes.length >= 7 (10 types, max 3 excluded)
  const randomIndex = Math.floor(Math.random() * availableTypes.length)
  return availableTypes[randomIndex] as PieceType
}

/**
 * Calculate the minimum r offset for a piece type (topmost cell relative to center)
 * Returns 0 if piece has center, otherwise finds min r in shape
 */
function getMinROffset(type: PieceType): number {
  const metadata = PIECE_METADATA[type]
  // Start with 0 if piece has center (center is at r=0 relative to position)
  let minR = metadata.hasCenter ? 0 : Infinity

  // Check all shape offsets
  for (const offset of metadata.shape) {
    minR = Math.min(minR, offset.r)
  }

  return minR
}

/**
 * Spawn a new random piece at the given position
 * Adjusts position so the topmost block of the piece touches the spawn row
 * @param position Base spawn position (top edge of field)
 * @param excludeTypes Optional piece types to exclude from random selection
 */
export function spawnPiece(position: AxialCoord, excludeTypes?: PieceType[]): Piece {
  const type = getRandomPieceType(excludeTypes)

  // Calculate offset to ensure topmost block is at spawn position
  // minR is negative (e.g., -1 for top neighbor), so we subtract it to push piece down
  const minROffset = getMinROffset(type)
  const adjustedPosition: AxialCoord = {
    q: position.q,
    r: position.r - minROffset  // If minR is -2, piece center moves to r+2 so top block is at r
  }

  return createPiece(type, adjustedPosition)
}
