// Coordinate system types for hexagonal grid

/**
 * Axial coordinate system (two-axis hex coordinate system)
 * q = column axis, r = row axis
 */
export interface AxialCoord {
  q: number
  r: number
}

/**
 * Cube coordinate system (three-axis coordinate system)
 * Constraint: x + y + z = 0
 */
export interface CubeCoord {
  x: number
  y: number
  z: number
}

/**
 * Pixel coordinates for screen positioning
 */
export interface PixelCoord {
  x: number
  y: number
}

/**
 * Cell state (empty or filled with a color)
 * When clearing, lineCount indicates how many lines are being cleared simultaneously
 */
export type CellState = {
  filled: false
} | {
  filled: true
  color: string
  clearing?: {
    lineCount: number
  }
}

/**
 * Field shape - set of valid cell coordinates
 * Stored as strings in format "q,r" for fast lookup
 */
export type FieldShape = Set<string>

/**
 * Piece shape - array of relative axial coordinates from origin (center tile)
 * The center tile at (0, 0) is always included implicitly
 */
export type PieceShape = AxialCoord[]

/**
 * Piece type string literal union - 10 tetrahexes
 */
export type PieceType = 'I_PIECE' | 'S_PIECE' | 'Z_PIECE' | 'L_PIECE' | 'J_PIECE' | 'T_PIECE' | 'P_PIECE' | 'U_PIECE' | 'O_PIECE' | 'Y_PIECE'

/**
 * Piece instance with current position and rotation
 */
export interface Piece {
  type: PieceType
  shape: PieceShape
  color: string
  position: AxialCoord
  rotation: number
}

/**
 * Grid state - map of axial coordinates to cell states
 * Key format: "q,r"
 */
export type GridState = Map<string, CellState>

/**
 * Game status enumeration
 */
export enum GameStatus {
  Idle = 'idle',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameOver'
}

/**
 * Complete game state
 */
export interface GameState {
  grid: GridState
  currentPiece: Piece | null
  nextPiece: Piece | null
  score: number
  level: number
  linesCleared: number
  speed: number // milliseconds between drops
  status: GameStatus
}

/**
 * Cell data for rendering in HexGrid
 */
export interface RenderableCell {
  coord: AxialCoord
  color: string
  opacity?: number
  isGhost?: boolean
  clearing?: {
    lineCount: number
  }
}
