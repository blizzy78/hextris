// Field shape and spawn position constants

import type { AxialCoord, FieldShape } from './types'

/**
 * Field dimensions
 */
const FIELD_COLUMNS = 11
const FIELD_ROWS = 20

/**
 * Generate the rectangular field shape (11 columns × 20 rows)
 */
function generateFieldShape(): FieldShape {
  const field = new Set<string>()

  // For flat-top hexagons in a rectangle, use column-based offset
  // This makes vertical columns instead of slanted rows
  for (let col = 0; col < FIELD_COLUMNS; col++) {
    for (let row = 0; row < FIELD_ROWS; row++) {
      // Use direct axial coordinates for rectangular field
      // q represents columns, r represents rows with offset based on column
      const q = col
      const r = row - Math.floor(col / 2)
      field.add(`${q},${r}`)
    }
  }

  return field
}

/**
 * The game's field shape - 11 columns × 20 rows rectangular grid
 */
export const FIELD_SHAPE: FieldShape = generateFieldShape()

/**
 * Pre-computed field coordinates for rendering optimization
 */
export const FIELD_COORDS: AxialCoord[] = Array.from(FIELD_SHAPE).map(key => {
  const parts = key.split(',').map(Number)
  return { q: parts[0]!, r: parts[1]! }
})

/**
 * Spawn position at top center (middle column, row 0)
 * Use field coordinate formula: q = col, r = row - floor(col/2)
 * For col=5, row=0: q=5, r=0-2=-2
 */
export const SPAWN_POSITION: AxialCoord = { q: 5, r: -2 }
