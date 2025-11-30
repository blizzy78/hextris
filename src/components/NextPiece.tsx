// NextPiece component - preview of upcoming piece

import { getPieceCoordinates } from '@/game/collision'
import { axialToPixel } from '@/game/hexMath'
import { CELL_SIZES, PREVIEW } from '@/game/renderConstants'
import type { Piece } from '@/game/types'
import { HexCell } from './HexCell'

interface NextPieceProps {
  piece: Piece | null
  size?: number
}

export function NextPiece({ piece, size = CELL_SIZES.PREVIEW }: NextPieceProps) {
  let renderData: { coords: ReturnType<typeof getPieceCoordinates>; viewBox: string } | null = null

  if (piece) {
    const previewPiece: Piece = {
      ...piece,
      position: { q: 0, r: 0 }
    }

    const coords = getPieceCoordinates(previewPiece)
    const pixels = coords.map(coord => axialToPixel(coord, size))

    // Calculate visual center of piece
    const minX = Math.min(...pixels.map(p => p.x))
    const maxX = Math.max(...pixels.map(p => p.x))
    const minY = Math.min(...pixels.map(p => p.y))
    const maxY = Math.max(...pixels.map(p => p.y))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Fixed square viewBox centered on the piece center
    const viewBoxSize = PREVIEW.VIEWBOX_SIZE
    const halfSize = viewBoxSize / 2

    renderData = {
      coords,
      viewBox: `${centerX - halfSize} ${centerY - halfSize} ${viewBoxSize} ${viewBoxSize}`
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Next</h3>
      <div className="flex justify-center">
        <svg
          viewBox={renderData?.viewBox ?? "0 0 100 100"}
          width={PREVIEW.SVG_SIZE}
          height={PREVIEW.SVG_SIZE}
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
        >
          {piece && renderData && renderData.coords.map((coord, index) => (
            <HexCell
              key={index}
              coord={coord}
              size={size}
              color={piece.color}
              special={piece.special}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
