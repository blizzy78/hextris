import { describe, expect, it } from 'vitest'
import {
	calculateCascadeScore,
	calculateLevel,
	calculateLockScore,
	calculateScore,
	calculateSpeed,
	SCORING,
} from './scoring'

describe('calculateScore', () => {
  it('returns 0 for 0 lines', () => {
    expect(calculateScore(0, 1)).toBe(0)
  })

  it('applies combo multipliers correctly', () => {
    // Single line at level 1: 100 * 1 * 1 = 100
    expect(calculateScore(1, 1)).toBe(100)
    // Double at level 1: 200 * 3 * 1 = 600
    expect(calculateScore(2, 1)).toBe(600)
    // Triple at level 1: 300 * 5 * 1 = 1500
    expect(calculateScore(3, 1)).toBe(1500)
    // Quad at level 1: 400 * 8 * 1 = 3200
    expect(calculateScore(4, 1)).toBe(3200)
  })

  it('applies level multiplier', () => {
    // Single line at level 5: 100 * 1 * 5 = 500
    expect(calculateScore(1, 5)).toBe(500)
  })
})

describe('calculateCascadeScore', () => {
  it('returns 0 for 0 lines', () => {
    expect(calculateCascadeScore(0, 1, 1)).toBe(0)
  })

  it('applies no cascade bonus for stage 1 (initial clear)', () => {
    const baseScore = calculateScore(1, 1)
    expect(calculateCascadeScore(1, 1, 1)).toBe(baseScore)
  })

  it('applies 1.5x multiplier for stage 2 (first cascade)', () => {
    const baseScore = calculateScore(1, 1)
    expect(calculateCascadeScore(1, 1, 2)).toBe(Math.floor(baseScore * 1.5))
  })

  it('applies 2x multiplier for stage 3 (second cascade)', () => {
    const baseScore = calculateScore(1, 1)
    expect(calculateCascadeScore(1, 1, 3)).toBe(Math.floor(baseScore * 2))
  })

  it('applies 2.5x multiplier for stage 4 (third cascade)', () => {
    const baseScore = calculateScore(1, 1)
    expect(calculateCascadeScore(1, 1, 4)).toBe(Math.floor(baseScore * 2.5))
  })

  it('caps cascade multiplier at stage 5', () => {
    const baseScore = calculateScore(1, 1)
    const cappedScore = Math.floor(baseScore * SCORING.CASCADE_MULTIPLIERS[5])
    expect(calculateCascadeScore(1, 1, 5)).toBe(cappedScore)
    expect(calculateCascadeScore(1, 1, 6)).toBe(cappedScore)
    expect(calculateCascadeScore(1, 1, 10)).toBe(cappedScore)
  })

  it('combines cascade with combo and level multipliers', () => {
    // Double at level 3, stage 2: (200 * 3 * 3) * 1.5 = 2700
    expect(calculateCascadeScore(2, 3, 2)).toBe(2700)
  })
})

describe('calculateLockScore', () => {
  it('scales with level', () => {
    expect(calculateLockScore(1)).toBe(10)
    expect(calculateLockScore(5)).toBe(50)
    expect(calculateLockScore(20)).toBe(200)
  })
})

describe('calculateLevel', () => {
  it('starts at level 1', () => {
    expect(calculateLevel(0)).toBe(1)
  })

  it('levels up every 10 lines', () => {
    expect(calculateLevel(9)).toBe(1)
    expect(calculateLevel(10)).toBe(2)
    expect(calculateLevel(19)).toBe(2)
    expect(calculateLevel(20)).toBe(3)
  })

  it('caps at max level', () => {
    expect(calculateLevel(200)).toBe(SCORING.MAX_LEVEL)
    expect(calculateLevel(1000)).toBe(SCORING.MAX_LEVEL)
  })
})

describe('calculateSpeed', () => {
  it('starts at base speed', () => {
    expect(calculateSpeed(1)).toBe(SCORING.BASE_DROP_SPEED)
  })

  it('decreases by 50ms per level', () => {
    expect(calculateSpeed(2)).toBe(950)
    expect(calculateSpeed(5)).toBe(800)
  })

  it('caps at minimum speed', () => {
    expect(calculateSpeed(20)).toBe(SCORING.MIN_DROP_SPEED)
    expect(calculateSpeed(100)).toBe(SCORING.MIN_DROP_SPEED)
  })
})
