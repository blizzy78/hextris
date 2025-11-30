// GameBoard component - main game display

import { getPieceCoordinates } from '@/game/collision'
import { FIELD_SHAPE } from '@/game/gameModes'
import { axialToKey, keyToAxial } from '@/game/hexMath'
import { calculateDropPosition } from '@/game/movement'
import { CELL_SIZES, getSpecialCellColor, PADDING } from '@/game/renderConstants'
import type { GridState, Piece, RenderableCell } from '@/game/types'
import { HexGrid } from './HexGrid'

interface GameBoardProps {
  grid: GridState
  currentPiece: Piece | null
  size?: number
}

export function GameBoard({ grid, currentPiece, size = CELL_SIZES.BOARD }: GameBoardProps) {
  // Prepare cells for rendering
  const cells: RenderableCell[] = []

  // Add locked cells from grid
  for (const [key, cellState] of grid) {
    if (cellState.filled) {
      const coord = keyToAxial(key)
      cells.push({
        coord,
        color: cellState.color,
        special: cellState.special,
        frozenCleared: cellState.frozenCleared,
        clearing: cellState.clearing
      })
    }
  }

  // Add ghost piece (preview of where piece will land)
  if (currentPiece) {
    const dropPosition = calculateDropPosition(currentPiece, grid, FIELD_SHAPE)
    const ghostPiece: Piece = { ...currentPiece, position: dropPosition }
    const ghostCoords = getPieceCoordinates(ghostPiece)
    // Use special cell color if piece is special, otherwise use piece's base color
    const ghostColor = getSpecialCellColor(currentPiece.special) ?? currentPiece.color

    for (const coord of ghostCoords) {
      const key = axialToKey(coord)
      // Only show ghost if not overlapping with locked cells
      if (!grid.get(key)?.filled) {
        cells.push({ coord, color: ghostColor, isGhost: true })
      }
    }
  }

  // Add current falling piece (will render on top with full opacity)
  if (currentPiece) {
    const pieceCoords = getPieceCoordinates(currentPiece)
    // Use special cell color if piece is special, otherwise use piece's base color
    const pieceColor = getSpecialCellColor(currentPiece.special) ?? currentPiece.color
    for (const coord of pieceCoords) {
      cells.push({ coord, color: pieceColor, special: currentPiece.special })
    }
  }

  return (
    <div className="relative h-full flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
      <HexGrid cells={cells} fieldShape={FIELD_SHAPE} size={size} padding={PADDING.GRID} />
    </div>
  )
}
