// HexGrid component - renders a collection of hexagons

import { FIELD_COORDS } from '@/game/gameModes'
import { axialToPixel } from '@/game/hexMath'
import { PADDING } from '@/game/renderConstants'
import type { AxialCoord, FieldShape, RenderableCell } from '@/game/types'
import { HexCell } from './HexCell'

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

export function HexGrid({ cells, size, padding = PADDING.DEFAULT_GRID }: HexGridProps) {
  const bounds = calculateBounds(FIELD_COORDS, size, padding)

  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    return `${size * Math.cos(angleRad)},${size * Math.sin(angleRad)}`
  }).join(' ')

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      className="w-full h-full"
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    >
      {/* Field outline */}
      {FIELD_COORDS.map((coord) => {
        const { x, y } = axialToPixel(coord, size)
        return (
          <polygon
            key={`outline-${coord.q},${coord.r}`}
            points={hexPoints}
            fill="none"
            stroke="#1f2937"
            strokeWidth={1}
            transform={`translate(${x}, ${y})`}
          />
        )
      })}

      {/* Rendered cells */}
      {cells.map((cell, index) => (
        <HexCell
          key={`${cell.coord.q},${cell.coord.r}-${index}`}
          coord={cell.coord}
          size={size}
          color={cell.color}
          opacity={cell.opacity}
          isGhost={cell.isGhost}
          clearing={cell.clearing}
        />
      ))}
    </svg>
  )
}
