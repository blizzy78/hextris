// Collision detection for hexagonal Tetris

import { axialToKey } from './hexMath'
import { getPieceCells } from './pieces'
import type { AxialCoord, FieldShape, GridState, Piece } from './types'

/**
 * Collision result with reason for failure
 */
interface CollisionResult {
  valid: boolean
  reason?: 'out-of-bounds' | 'overlap' | 'none'
}

/**
 * Get all absolute axial coordinates occupied by a piece at its current position
 * Delegates to pieces.ts which handles rotation correctly
 */
export function getPieceCoordinates(piece: Piece): AxialCoord[] {
  return getPieceCells(piece)
}

/**
 * Check if a piece position is valid (within field bounds and no overlap)
 */
export function isValidPiecePosition(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): CollisionResult {
  const coords = getPieceCoordinates(piece)

  for (const coord of coords) {
    const key = axialToKey(coord)

    // Check if within field bounds
    if (!fieldShape.has(key)) {
      return { valid: false, reason: 'out-of-bounds' }
    }

    // Check if cell is already occupied
    const cellState = grid.get(key)
    if (cellState && cellState.filled) {
      return { valid: false, reason: 'overlap' }
    }
  }

  return { valid: true, reason: 'none' }
}
