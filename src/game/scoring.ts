// Scoring system with combos and level progression

/**
 * Scoring constants
 */
const SCORING = {
  BASE_POINTS_PER_LINE: 100,
  POINTS_PER_PIECE_LOCK: 10, // Points awarded for locking a piece
  COMBO_MULTIPLIERS: {
    1: 1,   // Single line
    2: 3,   // Double
    3: 5,   // Triple
    4: 8    // Quad or more
  },
  LINES_PER_LEVEL: 10, // Level up every 10 lines
  MAX_LEVEL: 20        // Cap at level 20
} as const

/**
 * Calculate score for locking a piece
 * @param currentLevel Current game level
 * @returns Points earned for locking the piece
 */
export function calculateLockScore(currentLevel: number): number {
  return SCORING.POINTS_PER_PIECE_LOCK * currentLevel
}

/**
 * Calculate score for lines cleared
 * @param linesCleared Number of lines cleared simultaneously
 * @param currentLevel Current game level
 * @returns Points earned
 */
export function calculateScore(linesCleared: number, currentLevel: number): number {
  if (linesCleared === 0) return 0

  const basePoints = SCORING.BASE_POINTS_PER_LINE * linesCleared

  // Get combo multiplier (cap at 4+ lines)
  const comboKey = Math.min(linesCleared, 4) as 1 | 2 | 3 | 4
  const comboMultiplier = SCORING.COMBO_MULTIPLIERS[comboKey]

  // Apply level multiplier
  const levelMultiplier = currentLevel

  return basePoints * comboMultiplier * levelMultiplier
}

/**
 * Calculate new level based on total lines cleared
 * @param totalLinesCleared Total lines cleared in the game
 * @returns New level (1-based, capped at MAX_LEVEL)
 */
export function calculateLevel(totalLinesCleared: number): number {
  const level = Math.floor(totalLinesCleared / SCORING.LINES_PER_LEVEL) + 1
  return Math.min(level, SCORING.MAX_LEVEL)
}

/**
 * Calculate drop speed in milliseconds based on level
 * @param level Current level
 * @returns Milliseconds between automatic drops
 */
export function calculateSpeed(level: number): number {
  // Base speed: 1000ms at level 1
  // Decrease by 50ms per level
  // Minimum: 100ms
  const speed = 1000 - (level - 1) * 50
  return Math.max(100, speed)
}
