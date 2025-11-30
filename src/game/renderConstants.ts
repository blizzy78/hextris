// Rendering constants for visual elements

/**
 * Cell size constants for different display contexts
 */
export const CELL_SIZES = {
  /** Default cell size for main game board */
  BOARD: 20,
  /** Cell size for next piece preview panel */
  PREVIEW: 15,
  /** Cell size for piece showcase display */
  SHOWCASE: 12,
} as const

/**
 * Grid and layout padding constants
 */
export const PADDING = {
  /** Padding around the main game grid */
  GRID: 20,
  /** Default padding for HexGrid component */
  DEFAULT_GRID: 10,
  /** Padding around showcase piece bounding boxes */
  SHOWCASE: 5,
} as const

/**
 * Preview panel sizing constants
 */
export const PREVIEW = {
  /** ViewBox size for next piece preview */
  VIEWBOX_SIZE: 100,
  /** SVG element width/height for next piece preview */
  SVG_SIZE: 128,
} as const

/**
 * Ghost piece rendering constants
 */
export const GHOST = {
  /** Opacity for ghost piece preview */
  OPACITY: 0.2,
} as const

/**
 * Shadow effect constants for normal cell rendering
 */
export const SHADOW = {
  /** Shadow layer opacity */
  OPACITY: 0.3,
  /** Shadow blur radius in pixels */
  BLUR_PX: 3,
} as const

/**
 * Glow effect constants for line clearing animation
 */
export const GLOW = {
  /** Animation duration for glow fade-in (ms) */
  ANIMATION_DURATION: 150,
  /** Base glow radius for single line clear */
  BASE_RADIUS: 4,
  /** Additional glow radius per extra line cleared */
  RADIUS_PER_LINE: 3,
  /** Maximum glow radius cap */
  MAX_RADIUS: 20,
  /** Base glow opacity for single line clear */
  BASE_OPACITY: 0.6,
  /** Additional opacity per extra line cleared */
  OPACITY_PER_LINE: 0.1,
  /** Maximum glow opacity cap */
  MAX_OPACITY: 1,
  /** Opacity multiplier for outer glow layer */
  OUTER_OPACITY_MULT: 0.5,
  /** Blur multiplier for outer glow layer */
  OUTER_BLUR_MULT: 1.5,
  /** Opacity multiplier for inner glow layer */
  INNER_OPACITY_MULT: 0.8,
  /** Blur multiplier for inner glow layer */
  INNER_BLUR_MULT: 0.5,
} as const

/**
 * Special cell visual constants
 */
export const SPECIAL_CELL_VISUALS = {
  /** Bomb cell glow color (red) */
  BOMB_GLOW_COLOR: '#ff4444',
  /** Bomb cell glow radius */
  BOMB_GLOW_RADIUS: 12,
  /** Bomb cell glow opacity */
  BOMB_GLOW_OPACITY: 1.0,

  /** Multiplier cell glow color (gold) */
  MULTIPLIER_GLOW_COLOR: '#ffd700',
  /** Multiplier cell glow radius */
  MULTIPLIER_GLOW_RADIUS: 10,
  /** Multiplier cell glow opacity */
  MULTIPLIER_GLOW_OPACITY: 0.9,

  /** Frozen cell glow color (icy blue) */
  FROZEN_GLOW_COLOR: '#88ddff',
  /** Frozen cell glow radius */
  FROZEN_GLOW_RADIUS: 10,
  /** Frozen cell glow opacity */
  FROZEN_GLOW_OPACITY: 0.85,
  /** Frozen cell partially cleared glow opacity (dimmer) */
  FROZEN_CLEARED_GLOW_OPACITY: 0.4,

  /** Opacity multiplier for outer glow layer of special cells */
  OUTER_OPACITY_MULT: 0.9,
  /** Opacity multiplier for inner glow layer of special cells */
  INNER_OPACITY_MULT: 1.0,

  /** Duration of one full pulse cycle (ms) */
  PULSE_DURATION: 1200,
  /** Minimum glow intensity during pulse (0-1) */
  PULSE_MIN_INTENSITY: 0.5,
  /** Maximum glow intensity during pulse (0-1) */
  PULSE_MAX_INTENSITY: 1.0,
} as const
