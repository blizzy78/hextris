// Piece movement functions

import { isValidPiecePosition } from './collision'
import { AXIAL_DIRECTIONS } from './hexMath'
import { rotatePiece } from './pieces'
import type { AxialCoord, FieldShape, GridState, Piece } from './types'

/**
 * Move piece down one row (increment r coordinate)
 */
export function moveDown(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): Piece | null {
  const newPiece: Piece = {
    ...piece,
    position: { q: piece.position.q, r: piece.position.r + 1 }
  }

  const result = isValidPiecePosition(newPiece, grid, fieldShape)
  return result.valid ? newPiece : null
}

/**
 * Move piece left (moves horizontally left in visual space)
 * For rectangular fields with vertical columns, adjust r to maintain visual row
 * Pattern: r = row - floor(q/2), so moving left (q-1):
 * - from even q to odd q: floor decreases, so r must increase by 1
 * - from odd q to even q: floor stays same, so r stays same
 */
export function moveLeft(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): Piece | null {
  const newQ = piece.position.q - 1
  // Adjust r based on destination column parity
  const rAdjust = newQ % 2 === 1 ? 1 : 0
  const newPiece: Piece = {
    ...piece,
    position: { q: newQ, r: piece.position.r + rAdjust }
  }

  const result = isValidPiecePosition(newPiece, grid, fieldShape)
  return result.valid ? newPiece : null
}

/**
 * Move piece right (moves horizontally right in visual space)
 * For rectangular fields with vertical columns, adjust r to maintain visual row
 * Pattern: r = row - floor(q/2), so moving right (q+1):
 * - from even q to odd q: floor stays same, so r stays same
 * - from odd q to even q: floor increases, so r must decrease by 1
 */
export function moveRight(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): Piece | null {
  const newQ = piece.position.q + 1
  // Adjust r based on destination column parity
  const rAdjust = newQ % 2 === 0 ? -1 : 0
  const newPiece: Piece = {
    ...piece,
    position: { q: newQ, r: piece.position.r + rAdjust }
  }

  const result = isValidPiecePosition(newPiece, grid, fieldShape)
  return result.valid ? newPiece : null
}

/**
 * Calculate the lowest valid position for a piece (for hard drop and ghost piece)
 */
export function calculateDropPosition(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): AxialCoord {
  let testPiece = piece
  let lastValid = piece.position

  // Keep moving down until collision
  while (true) {
    const moved = moveDown(testPiece, grid, fieldShape)
    if (!moved) {
      break
    }
    testPiece = moved
    lastValid = moved.position
  }

  return lastValid
}

/**
 * Instantly move piece to lowest valid position
 */
export function hardDrop(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): Piece {
  const dropPosition = calculateDropPosition(piece, grid, fieldShape)
  return {
    ...piece,
    position: dropPosition
  }
}

/**
 * Attempt to rotate piece clockwise with wall kick system
 * Returns rotated piece if successful, null otherwise
 */
export function rotateWithWallKick(
  piece: Piece,
  grid: GridState,
  fieldShape: FieldShape
): Piece | null {
  // First try rotating in place
  const rotated = rotatePiece(piece)
  if (isValidPiecePosition(rotated, grid, fieldShape).valid) {
    return rotated
  }

  // Try wall kicks in all 6 neighbor directions
  for (const direction of AXIAL_DIRECTIONS) {
    const kicked: Piece = {
      ...rotated,
      position: {
        q: rotated.position.q + direction.q,
        r: rotated.position.r + direction.r
      }
    }

    if (isValidPiecePosition(kicked, grid, fieldShape).valid) {
      return kicked
    }
  }

  // Try moving down one step as additional wall kick
  const kickedDown: Piece = {
    ...rotated,
    position: {
      q: rotated.position.q,
      r: rotated.position.r + 1
    }
  }

  if (isValidPiecePosition(kickedDown, grid, fieldShape).valid) {
    return kickedDown
  }

  // All wall kicks failed, rotation rejected
  return null
}
