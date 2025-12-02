// Hexagonal math utilities for flat-top hexagons

import type { AxialCoord, CubeCoord, PixelCoord } from './types'

// Coordinate conversions

/**
 * Convert axial coordinates to cube coordinates
 */
export function axialToCube(axial: AxialCoord): CubeCoord {
  const x = axial.q
  const y = axial.r
  const z = -axial.q - axial.r
  return { x, y, z }
}

/**
 * Convert cube coordinates to axial coordinates
 */
export function cubeToAxial(cube: CubeCoord): AxialCoord {
  const q = cube.x
  const r = cube.y
  return { q, r }
}

// Pixel positioning

/**
 * Convert axial coordinates to pixel coordinates
 * For flat-top hexagons where size = distance from center to corner
 */
export function axialToPixel(axial: AxialCoord, size: number): PixelCoord {
  const x = size * (3 / 2) * axial.q
  const y = size * (Math.sqrt(3) / 2 * axial.q + Math.sqrt(3) * axial.r)
  return { x, y }
}

// Neighbor directions

/**
 * Six neighbor directions in axial coordinates
 * Order: Top, TopRight, BottomRight, Bottom, BottomLeft, TopLeft
 */
export const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 0, r: -1 },   // Top
  { q: 1, r: -1 },   // TopRight
  { q: 1, r: 0 },    // BottomRight
  { q: 0, r: 1 },    // Bottom
  { q: -1, r: 1 },   // BottomLeft
  { q: -1, r: 0 },   // TopLeft
]

// Utility functions

/**
 * Convert axial coordinate to string key for Map/Set
 */
export function axialToKey(axial: AxialCoord): string {
  return `${axial.q},${axial.r}`
}

/**
 * Parse string key back to axial coordinate
 * @throws Error if key is malformed
 */
export function keyToAxial(key: string): AxialCoord {
  const parts = key.split(',').map(Number)
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error(`Invalid axial key: ${key}`)
  }
  return { q: parts[0]!, r: parts[1]! }
}

/**
 * Get the 6 hex neighbors of a coordinate
 * Returns neighbors in order: right, left, bottom, top, bottom-right, top-left
 */
export function getHexNeighbors(coord: AxialCoord): AxialCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q, r: coord.r + 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ]
}
