// Animation helper functions for line clearing effects

import { axialToKey } from './hexMath'
import type { Line } from './lineDetection'
import type { AxialCoord, GridState } from './types'

/**
 * Mark cells as clearing (triggers fade to white animation)
 */
export function createBlinkGrid(baseGrid: GridState, lines: Line[]): GridState {
  const blinkGrid = new Map(baseGrid)
  const blinkCells = lines.flatMap((line: Line) => line.cells)
  const lineCount = lines.length

  for (const cell of blinkCells) {
    const key = axialToKey(cell)
    const cellState = blinkGrid.get(key)
    if (cellState?.filled) {
      blinkGrid.set(key, {
        ...cellState,
        clearing: { lineCount },
      })
    }
  }

  return blinkGrid
}

/**
 * Mark cells as clearing for bomb explosions (triggers fade to white animation)
 */
export function createBombBlinkGrid(baseGrid: GridState, bombCells: AxialCoord[]): GridState {
  const blinkGrid = new Map(baseGrid)

  for (const cell of bombCells) {
    const key = axialToKey(cell)
    const cellState = blinkGrid.get(key)
    if (cellState?.filled) {
      blinkGrid.set(key, {
        ...cellState,
        clearing: { lineCount: 1 },
      })
    }
  }

  return blinkGrid
}
