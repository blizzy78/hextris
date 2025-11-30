// HexCell component - renders a single hexagon as SVG polygon

import { axialToPixel } from '@/game/hexMath'
import { COLORS, GHOST, GLOW, SHADOW, SPECIAL_CELL_VISUALS } from '@/game/renderConstants'
import type { AxialCoord, SpecialCellType } from '@/game/types'
import { memo, useEffect, useRef, useState } from 'react'

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

  // Animate glow from 0 to target intensity when clearing starts
  const [glowIntensity, setGlowIntensity] = useState(clearing ? 0 : 0)
  const animationRef = useRef<number | null>(null)
  const wasClearing = useRef(false)

  // Pulse animation for special cells - use ref to avoid sync setState in effect
  const [pulseIntensity, setPulseIntensity] = useState(1)
  const pulseAnimationRef = useRef<number | null>(null)
  const isPulsing = special && !clearing

  // Start pulse animation when special cell is present
  useEffect(() => {
    if (isPulsing) {
      const startTime = performance.now()
      const duration = SPECIAL_CELL_VISUALS.PULSE_DURATION
      const minIntensity = SPECIAL_CELL_VISUALS.PULSE_MIN_INTENSITY
      const maxIntensity = SPECIAL_CELL_VISUALS.PULSE_MAX_INTENSITY

      const animatePulse = (currentTime: number) => {
        const elapsed = currentTime - startTime
        // Use sine wave for smooth fade in/out (0 to 1 to 0)
        const progress = (elapsed % duration) / duration
        const sineValue = Math.sin(progress * Math.PI * 2)
        // Map sine (-1 to 1) to intensity range
        const intensity = minIntensity + ((sineValue + 1) / 2) * (maxIntensity - minIntensity)
        setPulseIntensity(intensity)
        pulseAnimationRef.current = requestAnimationFrame(animatePulse)
      }

      pulseAnimationRef.current = requestAnimationFrame(animatePulse)
    }

    return () => {
      if (pulseAnimationRef.current !== null) {
        cancelAnimationFrame(pulseAnimationRef.current)
        pulseAnimationRef.current = null
      }
    }
  }, [isPulsing])

  // Reset pulse intensity when not pulsing (computed value, not in effect)
  const effectivePulseIntensity = isPulsing ? pulseIntensity : 1

  useEffect(() => {
    // Only animate when transitioning to clearing state
    if (clearing && !wasClearing.current) {
      wasClearing.current = true
      const startTime = performance.now()
      const duration = GLOW.ANIMATION_DURATION

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out curve for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3)
        setGlowIntensity(eased)

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

  // Ghost pieces render with dim fill
  if (isGhost) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <polygon
          points={points}
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
  const fillColor = specialGlow ? specialGlow.color : color

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Special cell glow effect (bomb/multiplier/frozen) with pulse animation */}
      {specialGlow && !clearing && (
        <>
          {/* Outer glow layer */}
          <polygon
            points={points}
            fill={specialGlow.color}
            opacity={specialGlow.opacity * SPECIAL_CELL_VISUALS.OUTER_OPACITY_MULT * effectivePulseIntensity}
            style={{
              filter: `blur(${specialGlow.radius * GLOW.OUTER_BLUR_MULT}px)`,
            }}
          />
          {/* Inner glow layer */}
          <polygon
            points={points}
            fill={specialGlow.color}
            opacity={specialGlow.opacity * SPECIAL_CELL_VISUALS.INNER_OPACITY_MULT * effectivePulseIntensity}
            style={{
              filter: `blur(${specialGlow.radius * GLOW.INNER_BLUR_MULT}px)`,
            }}
          />
        </>
      )}

      {/* Animated clearing glow effect - only when clearing */}
      {clearing && glowIntensity > 0 && (
        <>
          {/* Outer glow layer */}
          <polygon
            points={points}
            fill={COLORS.CLEARING_GLOW}
            opacity={currentGlowOpacity * GLOW.OUTER_OPACITY_MULT}
            style={{
              filter: `blur(${currentGlowRadius * GLOW.OUTER_BLUR_MULT}px)`,
            }}
          />
          {/* Inner glow layer */}
          <polygon
            points={points}
            fill={COLORS.CLEARING_GLOW}
            opacity={currentGlowOpacity * GLOW.INNER_OPACITY_MULT}
            style={{
              filter: `blur(${currentGlowRadius * GLOW.INNER_BLUR_MULT}px)`,
            }}
          />
        </>
      )}

      {/* Shadow/glow effect (normal state) */}
      <polygon
        points={points}
        fill={fillColor}
        opacity={opacity * SHADOW.OPACITY}
        filter={`blur(${SHADOW.BLUR_PX}px)`}
      />

      {/* Main cell */}
      <polygon
        points={points}
        fill={fillColor}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    </g>
  )
}

export const HexCell = memo(HexCellComponent)
