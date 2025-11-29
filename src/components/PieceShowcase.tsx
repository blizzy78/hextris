// PieceShowcase component - displays all piece types in a grid

import { axialToPixel } from '@/game/hexMath';
import { PIECE_METADATA } from '@/game/pieces';
import { CELL_SIZES, PADDING } from '@/game/renderConstants';
import type { PieceType } from '@/game/types';
import { HexCell } from './HexCell';

const PIECE_TYPES: PieceType[] = ['I_PIECE', 'S_PIECE', 'Z_PIECE', 'L_PIECE', 'J_PIECE', 'T_PIECE', 'P_PIECE', 'U_PIECE', 'O_PIECE', 'Y_PIECE'];

export function PieceShowcase() {
  const cellSize = CELL_SIZES.SHOWCASE

  return (
    <div className="grid grid-cols-2 gap-4">
      {PIECE_TYPES.map((type) => {
        const metadata = PIECE_METADATA[type]
        // Get all cells for this piece (include center only if hasCenter)
        const coords = metadata.hasCenter
          ? [{ q: 0, r: 0 }, ...metadata.shape]
          : [...metadata.shape]
        const pixels = coords.map(coord => axialToPixel(coord, cellSize))
        const minX = Math.min(...pixels.map(p => p.x)) - cellSize - PADDING.SHOWCASE
        const maxX = Math.max(...pixels.map(p => p.x)) + cellSize + PADDING.SHOWCASE
        const minY = Math.min(...pixels.map(p => p.y)) - cellSize - PADDING.SHOWCASE
        const maxY = Math.max(...pixels.map(p => p.y)) + cellSize + PADDING.SHOWCASE
        const width = maxX - minX
        const height = maxY - minY

        return (
          <div key={type} className="flex items-center justify-center">
            <svg
              viewBox={`${minX} ${minY} ${width} ${height}`}
              className="w-16 h-16"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            >
              {coords.map((coord, index) => (
                <HexCell
                  key={index}
                  coord={coord}
                  size={cellSize}
                  color={metadata.color}
                  stroke="#374151"
                  strokeWidth={1}
                />
              ))}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
