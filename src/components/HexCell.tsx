// HexCell component - renders a single hexagon as SVG polygon

import { axialToPixel } from '@/game/hexMath'
import type { AxialCoord } from '@/game/types'
import { memo, useEffect, useRef, useState } from 'react'

interface HexCellProps {
  coord: AxialCoord
  size: number
  color: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  isGhost?: boolean
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

const HexCellComponent = ({
  coord,
  size,
  color,
  stroke = '#374151',
  strokeWidth = 1,
  opacity = 1,
  isGhost = false,
  clearing,
}: HexCellProps) => {
  const { x, y } = axialToPixel(coord, size)
  const points = getHexagonPoints(size)

  // Animate glow from 0 to target intensity when clearing starts
  const [glowIntensity, setGlowIntensity] = useState(clearing ? 0 : 0)
  const animationRef = useRef<number | null>(null)
  const wasClearing = useRef(false)

  useEffect(() => {
    // Only animate when transitioning to clearing state
    if (clearing && !wasClearing.current) {
      wasClearing.current = true
      const startTime = performance.now()
      const duration = 150 // Animation duration in ms

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
          opacity={0.2}
        />
      </g>
    )
  }

  // Calculate glow parameters based on line count
  // Base glow + additional glow per extra line (capped at reasonable max)
  const lineCount = clearing?.lineCount ?? 0
  const baseGlowRadius = 4
  const glowPerLine = 3
  const maxGlowRadius = 20
  const targetGlowRadius = Math.min(baseGlowRadius + (lineCount - 1) * glowPerLine, maxGlowRadius)
  const currentGlowRadius = targetGlowRadius * glowIntensity

  // Glow opacity also scales with line count
  const baseGlowOpacity = 0.6
  const opacityPerLine = 0.1
  const maxGlowOpacity = 1
  const targetGlowOpacity = Math.min(baseGlowOpacity + (lineCount - 1) * opacityPerLine, maxGlowOpacity)
  const currentGlowOpacity = targetGlowOpacity * glowIntensity

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Animated clearing glow effect - only when clearing */}
      {clearing && glowIntensity > 0 && (
        <>
          {/* Outer glow layer */}
          <polygon
            points={points}
            fill="#ffffff"
            opacity={currentGlowOpacity * 0.5}
            style={{
              filter: `blur(${currentGlowRadius * 1.5}px)`,
            }}
          />
          {/* Inner glow layer */}
          <polygon
            points={points}
            fill="#ffffff"
            opacity={currentGlowOpacity * 0.8}
            style={{
              filter: `blur(${currentGlowRadius * 0.5}px)`,
            }}
          />
        </>
      )}

      {/* Shadow/glow effect (normal state) */}
      <polygon
        points={points}
        fill={color}
        opacity={opacity * 0.3}
        filter="blur(3px)"
      />

      {/* Main cell */}
      <polygon
        points={points}
        fill={color}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    </g>
  )
}

export const HexCell = memo(HexCellComponent)
