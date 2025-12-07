// HexCell component - renders a single hexagon as SVG polygon

import { axialToPixel } from '@/game/hexMath'
import { COLORS, GHOST, GLOW, SPECIAL_CELL_VISUALS } from '@/game/renderConstants'
import type { AxialCoord, SpecialCellType } from '@/game/types'
import { memo, useEffect, useId, useRef, useState } from 'react'

// CSS keyframes for special cell pulse animation - injected once globally
// Uses opacity animation to match the JS animation visual exactly:
// - Sine wave oscillation between PULSE_MIN_INTENSITY (0.5) and PULSE_MAX_INTENSITY (1.0)
// - Duration: PULSE_DURATION (1200ms)
const PULSE_ANIMATION_NAME = 'hex-special-pulse'
let pulseStyleInjected = false

function injectPulseStyle() {
  if (pulseStyleInjected || typeof document === 'undefined') return
  pulseStyleInjected = true

  const style = document.createElement('style')
  // Smooth sine wave approximation with more keyframes to eliminate choppiness
  // Using 8 keyframes for smoother interpolation
  const minOpacity = SPECIAL_CELL_VISUALS.PULSE_MIN_INTENSITY
  const maxOpacity = SPECIAL_CELL_VISUALS.PULSE_MAX_INTENSITY
  const range = maxOpacity - minOpacity

  // Generate smooth sine curve: opacity = min + (sin(t * 2π) + 1) / 2 * range
  // More keyframes = smoother animation
  const keyframes = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map((percent) => {
    const t = percent / 100
    const sineValue = Math.sin(t * Math.PI * 2)
    const opacity = minOpacity + ((sineValue + 1) / 2) * range
    return `${percent}% { opacity: ${opacity.toFixed(4)}; }`
  }).join('\n      ')

  style.textContent = `
    @keyframes ${PULSE_ANIMATION_NAME} {
      ${keyframes}
    }
  `
  document.head.appendChild(style)
}

// Inject on module load
injectPulseStyle()

interface HexCellProps {
  coord: AxialCoord
  size: number
  color: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  isGhost?: boolean
  special?: SpecialCellType
  frozenCleared?: boolean
  clearing?: {
    lineCount: number
  }
}

/**
 * Generate polygon points for a flat-top hexagon centered at origin
 * Flat-top means flat edges at top/bottom, points at left/right
 */
function getHexagonPoints(size: number): string {
  const points: [number, number][] = []

  // Generate 6 points at 60-degree intervals
  // Starting at 0° (right point) for flat-top orientation
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    const x = size * Math.cos(angleRad)
    const y = size * Math.sin(angleRad)
    points.push([x, y])
  }

  // Convert to SVG points string
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

/**
 * Generate SVG path for a hexagon with rounded corners
 * Uses quadratic bezier curves at corners, straight lines for flat edges
 * @param size - radius of the hexagon
 * @param cornerRadius - radius of corner rounding (0-1 as fraction of edge length)
 */
function getHexagonPath(size: number, cornerRadius: number = 0.15): string {
  // Generate 6 corner points
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    const x = size * Math.cos(angleRad)
    const y = size * Math.sin(angleRad)
    corners.push([x, y])
  }

  // Edge length of regular hexagon = size
  const edgeLength = size
  // How far from corner to start/end the curve
  const offset = edgeLength * cornerRadius

  const pathParts: string[] = []

  for (let i = 0; i < 6; i++) {
    // All indices are valid (0-5), use ! to assert non-null
    const curr = corners[i]!
    const next = corners[(i + 1) % 6]!
    const prev = corners[(i + 5) % 6]!

    // Vector from current corner to next corner
    const dx = next[0] - curr[0]
    const dy = next[1] - curr[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / len
    const uy = dy / len

    // Vector from previous corner to current (for incoming edge direction)
    const pdx = curr[0] - prev[0]
    const pdy = curr[1] - prev[1]
    const plen = Math.sqrt(pdx * pdx + pdy * pdy)
    const pux = pdx / plen
    const puy = pdy / plen

    // Start point: offset back from corner along previous edge
    const startX = curr[0] - pux * offset
    const startY = curr[1] - puy * offset

    // End point: offset forward from corner along next edge
    const endX = curr[0] + ux * offset
    const endY = curr[1] + uy * offset

    if (i === 0) {
      // Move to first start point
      pathParts.push(`M ${startX} ${startY}`)
    }

    // Quadratic bezier curve through the corner
    pathParts.push(`Q ${curr[0]} ${curr[1]} ${endX} ${endY}`)

    // Line to the start of the next corner's curve
    const nextCorner = corners[(i + 1) % 6]!

    // Next corner's start point (offset back from it along current edge direction)
    const nextStartX = nextCorner[0] - ux * offset
    const nextStartY = nextCorner[1] - uy * offset

    pathParts.push(`L ${nextStartX} ${nextStartY}`)
  }

  pathParts.push('Z')
  return pathParts.join(' ')
}

/**
 * Generate corner points for a hexagon at given size
 */
function getHexCorners(size: number): [number, number][] {
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push([size * Math.cos(angleRad), size * Math.sin(angleRad)])
  }
  return corners
}
/**
 * Darken a hex color by a factor (0-1, where 0 = black, 1 = original)
 */
function darkenColor(hex: string, factor: number): string {
  // Parse hex color
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Darken
  const dr = Math.round(r * factor)
  const dg = Math.round(g * factor)
  const db = Math.round(b * factor)

  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

/**
 * Lighten a hex color by mixing with white
 */
function lightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const lr = Math.round(r + (255 - r) * factor)
  const lg = Math.round(g + (255 - g) * factor)
  const lb = Math.round(b + (255 - b) * factor)

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/**
 * Get glow configuration for a special cell type
 */
function getSpecialCellGlow(
  special: SpecialCellType | undefined,
  frozenCleared: boolean | undefined
): { color: string; radius: number; opacity: number } | null {
  if (!special) return null

  switch (special) {
    case 'bomb':
      return {
        color: SPECIAL_CELL_VISUALS.BOMB_GLOW_COLOR,
        radius: SPECIAL_CELL_VISUALS.BOMB_GLOW_RADIUS,
        opacity: SPECIAL_CELL_VISUALS.BOMB_GLOW_OPACITY,
      }
    case 'multiplier':
      return {
        color: SPECIAL_CELL_VISUALS.MULTIPLIER_GLOW_COLOR,
        radius: SPECIAL_CELL_VISUALS.MULTIPLIER_GLOW_RADIUS,
        opacity: SPECIAL_CELL_VISUALS.MULTIPLIER_GLOW_OPACITY,
      }
    case 'frozen':
      return {
        color: SPECIAL_CELL_VISUALS.FROZEN_GLOW_COLOR,
        radius: SPECIAL_CELL_VISUALS.FROZEN_GLOW_RADIUS,
        opacity: frozenCleared
          ? SPECIAL_CELL_VISUALS.FROZEN_CLEARED_GLOW_OPACITY
          : SPECIAL_CELL_VISUALS.FROZEN_GLOW_OPACITY,
      }
  }
}

const HexCellComponent = ({
  coord,
  size,
  color,
  stroke = COLORS.CELL_STROKE,
  strokeWidth = 1,
  opacity = 1,
  isGhost = false,
  special,
  frozenCleared,
  clearing,
}: HexCellProps) => {
  const { x, y } = axialToPixel(coord, size)
  const points = getHexagonPoints(size)

  // Bevel geometry: outer hex and inner (raised) hex
  const bevelDepth = 0.3  // How much smaller the inner hex is (0-1)
  const outerCorners = getHexCorners(size)
  const innerCorners = getHexCorners(size * (1 - bevelDepth))

  // Rounded corner paths
  const outerHexPath = getHexagonPath(size, 0.1)
  // Rounded corner path for inner top face
  const innerHexPath = getHexagonPath(size * (1 - bevelDepth), 0.12)

  // Unique clip ID for this cell
  const clipId = useId()

  // Animate glow from 0 to target intensity when clearing starts
  const [glowIntensity, setGlowIntensity] = useState(clearing ? 0 : 0)
  const animationRef = useRef<number | null>(null)
  const wasClearing = useRef(false)

  useEffect(() => {
    // Only animate when transitioning to clearing state
    if (clearing && !wasClearing.current) {
      wasClearing.current = true
      const startTime = performance.now()
      // Duration scales with line count: more lines = longer animation
      const duration = GLOW.BASE_DURATION + (clearing.lineCount - 1) * GLOW.DURATION_PER_LINE

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Simple ease-out curve for smooth fade to white
        const intensity = 1 - Math.pow(1 - progress, 3)
        setGlowIntensity(intensity)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    } else if (!clearing && wasClearing.current) {
      wasClearing.current = false
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [clearing])

  // Ghost pieces render with dim fill (simple, no 3D effects)
  // Use a slightly smaller path than full size to maintain some visual separation
  const ghostHexPath = getHexagonPath(size * 0.92, 0.1)
  if (isGhost) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <path
          d={ghostHexPath}
          fill={color}
          opacity={GHOST.OPACITY}
        />
      </g>
    )
  }

  // Calculate glow parameters based on line count
  // Base glow + additional glow per extra line (capped at reasonable max)
  const lineCount = clearing?.lineCount ?? 0
  const targetGlowRadius = Math.min(
    GLOW.BASE_RADIUS + (lineCount - 1) * GLOW.RADIUS_PER_LINE,
    GLOW.MAX_RADIUS
  )
  const currentGlowRadius = targetGlowRadius * glowIntensity

  // Glow opacity also scales with line count
  const targetGlowOpacity = Math.min(
    GLOW.BASE_OPACITY + (lineCount - 1) * GLOW.OPACITY_PER_LINE,
    GLOW.MAX_OPACITY
  )
  const currentGlowOpacity = targetGlowOpacity * glowIntensity

  // Get special cell glow configuration
  const specialGlow = getSpecialCellGlow(special, frozenCleared)

  // Determine actual fill color - special cells use their glow color
  let fillColor = specialGlow ? specialGlow.color : color

  // When clearing, smoothly fade the color toward white
  if (clearing && glowIntensity > 0) {
    fillColor = lightenColor(fillColor, glowIntensity * 0.85)
  }

  // Facet colors - simulate light from top-left
  // Each facet gets different shading based on its angle
  const topFaceColor = lightenColor(fillColor, 0.15)      // Top face is brightest
  const topLeftFacet = lightenColor(fillColor, 0.08)      // Catching light
  const topRightFacet = fillColor                          // Neutral
  const rightFacet = darkenColor(fillColor, 0.8)          // Light shadow
  const bottomRightFacet = darkenColor(fillColor, 0.65)   // Shadow
  const bottomLeftFacet = darkenColor(fillColor, 0.7)     // Shadow
  const leftFacet = darkenColor(fillColor, 0.85)          // Light shadow

  // Stroke color for inner bevel lines - slightly darker than base
  const bevelStroke = darkenColor(fillColor, 0.6)

  const facetColors = [
    rightFacet,        // 0: right point
    bottomRightFacet,  // 1: bottom-right
    bottomLeftFacet,   // 2: bottom-left
    leftFacet,         // 3: left point
    topLeftFacet,      // 4: top-left
    topRightFacet,     // 5: top-right
  ]

  // Generate unique filter IDs for clearing animation blur effects
  const clearingOuterBlurId = `blur-clear-outer-${clipId}`
  const clearingInnerBlurId = `blur-clear-inner-${clipId}`

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* SVG filter definitions for high-quality blur without color banding */}
      <defs>
        {clearing && glowIntensity > 0 && (
          <>
            <filter id={clearingOuterBlurId} colorInterpolationFilters="sRGB" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={currentGlowRadius * GLOW.OUTER_BLUR_MULT} />
            </filter>
            <filter id={clearingInnerBlurId} colorInterpolationFilters="sRGB" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={currentGlowRadius * GLOW.INNER_BLUR_MULT} />
            </filter>
          </>
        )}
      </defs>

      {/* Special cell glow is now rendered in a separate top layer via SpecialCellGlow component */}

      {/* Animated clearing glow effect - only when clearing */}
      {clearing && glowIntensity > 0 && (
        <>
          {/* Outer glow layer */}
          <polygon
            points={points}
            fill={COLORS.CLEARING_GLOW}
            filter={`url(#${clearingOuterBlurId})`}
            opacity={currentGlowOpacity * GLOW.OUTER_OPACITY_MULT}
          />
          {/* Inner glow layer */}
          <polygon
            points={points}
            fill={COLORS.CLEARING_GLOW}
            filter={`url(#${clearingInnerBlurId})`}
            opacity={currentGlowOpacity * GLOW.INNER_OPACITY_MULT}
          />
          {/* Golden warmth overlay for 3+ line clears */}
          {lineCount >= 3 && (
            <>
              <polygon
                points={points}
                fill={COLORS.GOLD_OVERLAY}
                filter={`url(#${clearingOuterBlurId})`}
                opacity={currentGlowOpacity * GLOW.OUTER_OPACITY_MULT * GLOW.GOLD_OVERLAY_OPACITY}
              />
              <polygon
                points={points}
                fill={COLORS.GOLD_OVERLAY}
                filter={`url(#${clearingInnerBlurId})`}
                opacity={currentGlowOpacity * GLOW.INNER_OPACITY_MULT * GLOW.GOLD_OVERLAY_OPACITY}
              />
            </>
          )}
        </>
      )}

      {/* Clip path to contain bevel strokes */}
      <defs>
        <clipPath id={clipId}>
          <path d={outerHexPath} />
        </clipPath>
      </defs>

      {/* Beveled body clipped to outer hex shape */}
      <g clipPath={`url(#${clipId})`}>
        {/* 6 beveled facets - trapezoids connecting outer to inner hex */}
        {outerCorners.map((_, i) => {
          const outerA = outerCorners[i]!
          const outerB = outerCorners[(i + 1) % 6]!
          const innerA = innerCorners[i]!
          const innerB = innerCorners[(i + 1) % 6]!

          // Trapezoid: outerA -> outerB -> innerB -> innerA
          const facetPath = `M ${outerA[0]} ${outerA[1]} L ${outerB[0]} ${outerB[1]} L ${innerB[0]} ${innerB[1]} L ${innerA[0]} ${innerA[1]} Z`

          return (
            <path
              key={i}
              d={facetPath}
              fill={facetColors[i]}
              stroke={bevelStroke}
              strokeWidth={strokeWidth * 0.5}
              opacity={opacity}
            />
          )
        })}

        {/* Inner top face - the raised platform */}
        <path
          d={innerHexPath}
          fill={topFaceColor}
          stroke={bevelStroke}
          strokeWidth={strokeWidth * 0.5}
          opacity={opacity}
        />
      </g>

      {/* Outer stroke for crisp edge with rounded corners */}
      <path
        d={outerHexPath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    </g>
  )
}

export const HexCell = memo(HexCellComponent)

/**
 * Separate component that renders ONLY the special cell glow/pulse effect.
 * This is rendered in a separate layer above all cells to ensure visibility.
 */
interface SpecialCellGlowProps {
  coord: AxialCoord
  size: number
  special: SpecialCellType
  frozenCleared?: boolean
  clearing?: {
    lineCount: number
  }
}

const SpecialCellGlowComponent = ({
  coord,
  size,
  special,
  frozenCleared,
  clearing,
}: SpecialCellGlowProps) => {
  const { x, y } = axialToPixel(coord, size)
  const points = getHexagonPoints(size)

  // Generate unique filter IDs
  const clipId = useId()
  const outerBlurId = `blur-glow-outer-${clipId}`
  const innerBlurId = `blur-glow-inner-${clipId}`

  // Only render when not clearing and has special effect
  const isPulsing = special && !clearing
  if (!isPulsing) return null

  const specialGlow = getSpecialCellGlow(special, frozenCleared)
  if (!specialGlow) return null

  // CSS animation style for pulse effect
  const pulseAnimationStyle = {
    animation: `${PULSE_ANIMATION_NAME} ${SPECIAL_CELL_VISUALS.PULSE_DURATION}ms linear infinite`,
    willChange: 'opacity' as const,
  }

  // Calculate blur radii
  const outerBlurRadius = specialGlow.radius * GLOW.OUTER_BLUR_MULT
  const innerBlurRadius = specialGlow.radius * GLOW.INNER_BLUR_MULT

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <filter id={outerBlurId} colorInterpolationFilters="sRGB" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={outerBlurRadius} />
        </filter>
        <filter id={innerBlurId} colorInterpolationFilters="sRGB" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={innerBlurRadius} />
        </filter>
      </defs>

      {/* Outer glow layer */}
      <polygon
        points={points}
        fill={specialGlow.color}
        filter={`url(#${outerBlurId})`}
        style={{
          opacity: specialGlow.opacity * SPECIAL_CELL_VISUALS.OUTER_OPACITY_MULT,
          ...pulseAnimationStyle,
        }}
      />
      {/* Inner glow layer */}
      <polygon
        points={points}
        fill={specialGlow.color}
        filter={`url(#${innerBlurId})`}
        style={{
          opacity: specialGlow.opacity * SPECIAL_CELL_VISUALS.INNER_OPACITY_MULT,
          ...pulseAnimationStyle,
        }}
      />
    </g>
  )
}

export const SpecialCellGlow = memo(SpecialCellGlowComponent)
