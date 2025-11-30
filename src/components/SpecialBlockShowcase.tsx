// SpecialBlockShowcase component - displays special block types with pulsing animations

import { CELL_SIZES, COLORS, getSpecialCellColor, PADDING, SPECIAL_CELL_VISUALS } from '@/game/renderConstants'
import type { SpecialCellType } from '@/game/types'
import { HexCell } from './HexCell'

interface SpecialBlockInfo {
  type: SpecialCellType
  name: string
  description: string
}

const SPECIAL_BLOCKS: SpecialBlockInfo[] = [
  {
    type: 'bomb',
    name: 'Bomb',
    description: 'Clears neighbors',
  },
  {
    type: 'multiplier',
    name: 'Multiplier',
    description: '2× line score',
  },
  {
    type: 'frozen',
    name: 'Frozen',
    description: 'Clears twice',
  },
]

export function SpecialBlockShowcase() {
  const cellSize = CELL_SIZES.SHOWCASE
  // Base viewBox size matching piece showcase (cell + padding)
  const baseSize = cellSize * 2 + PADDING.SHOWCASE * 2
  // Additional padding for glow effect
  const glowPadding = Math.max(
    SPECIAL_CELL_VISUALS.BOMB_GLOW_RADIUS,
    SPECIAL_CELL_VISUALS.MULTIPLIER_GLOW_RADIUS,
    SPECIAL_CELL_VISUALS.FROZEN_GLOW_RADIUS
  ) + 4
  const viewBoxSize = cellSize * 2 + glowPadding * 2
  // Scale up SVG size proportionally to maintain same visual cell size as piece showcase
  const svgSize = 64 * (2 / 3) * (viewBoxSize / baseSize) // 64px = w-16 h-16 from piece showcase, scaled to 2/3

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-gray-400 font-medium">Special Blocks</div>
      <div className="flex justify-center gap-6">
        {SPECIAL_BLOCKS.map((block) => (
          <div key={block.type} className="flex flex-col items-center gap-1">
            <svg
              viewBox={`${-viewBoxSize / 2} ${-viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
              style={{ width: svgSize, height: svgSize, overflow: 'visible' }}
            >
              <HexCell
                coord={{ q: 0, r: 0 }}
                size={cellSize}
                color={getSpecialCellColor(block.type) ?? COLORS.CELL_STROKE}
                stroke={COLORS.CELL_STROKE}
                strokeWidth={1}
                special={block.type}
              />
            </svg>
            <div className="text-xs text-gray-300">{block.name}</div>
            <div className="text-xs text-gray-500">{block.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
