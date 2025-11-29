// Scoring system with combos and level progression

/**
 * Scoring constants
 */
export const SCORING = {
  BASE_POINTS_PER_LINE: 100,
  POINTS_PER_PIECE_LOCK: 10, // Points awarded for locking a piece
  COMBO_MULTIPLIERS: {
    1: 1,   // Single line
    2: 3,   // Double
    3: 5,   // Triple
    4: 8    // Quad or more
  },
  // Cascade multipliers for chain reactions (stage 1 = initial clear, stage 2+ = cascades)
  CASCADE_MULTIPLIERS: {
    1: 1,     // Initial clear (no bonus)
    2: 1.5,   // First cascade
    3: 2,     // Second cascade
    4: 2.5,   // Third cascade
    5: 3      // Fourth+ cascade (capped)
  },
  MAX_CASCADE_STAGE: 5, // Cap cascade multiplier at this stage
  LINES_PER_LEVEL: 10, // Level up every 10 lines
  MAX_LEVEL: 20,       // Cap at level 20
  // Speed constants (milliseconds)
  BASE_DROP_SPEED: 1000,       // Drop interval at level 1
  SPEED_DECREASE_PER_LEVEL: 50, // Speed increase per level
  MIN_DROP_SPEED: 100,         // Fastest possible drop interval
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
 * Calculate score for a cascade stage
 * @param linesCleared Number of lines cleared in this stage
 * @param currentLevel Current game level
 * @param cascadeStage Which stage of the cascade (1 = initial, 2+ = chain reactions)
 * @returns Points earned for this stage
 */
export function calculateCascadeScore(
  linesCleared: number,
  currentLevel: number,
  cascadeStage: number
): number {
  if (linesCleared === 0) return 0

  // Get base score (includes combo and level multipliers)
  const baseScore = calculateScore(linesCleared, currentLevel)

  // Get cascade multiplier (cap at MAX_CASCADE_STAGE)
  const cascadeKey = Math.min(cascadeStage, SCORING.MAX_CASCADE_STAGE) as 1 | 2 | 3 | 4 | 5
  const cascadeMultiplier = SCORING.CASCADE_MULTIPLIERS[cascadeKey]

  return Math.floor(baseScore * cascadeMultiplier)
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
  const speed = SCORING.BASE_DROP_SPEED - (level - 1) * SCORING.SPEED_DECREASE_PER_LEVEL
  return Math.max(SCORING.MIN_DROP_SPEED, speed)
}
