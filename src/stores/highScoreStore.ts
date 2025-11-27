// High score store with localStorage persistence

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * High score storage
 */
interface HighScoreStore {
  highScore: number
  getHighScore: () => number
  setHighScore: (score: number) => void
}

/**
 * High score store with automatic localStorage persistence
 */
export const useHighScoreStore = create<HighScoreStore>()(
  persist(
    (set, get) => ({
      highScore: 0,

      getHighScore: () => {
        return get().highScore
      },

      setHighScore: (score: number) => {
        const currentHigh = get().highScore
        if (score > currentHigh) {
          set({ highScore: score })
        }
      }
    }),
    {
      name: 'hextris-highscores',
      skipHydration: false,
      merge: (persisted, current) => ({
        ...current,
        highScore:
          typeof (persisted as { highScore?: unknown })?.highScore === 'number' &&
          (persisted as { highScore: number }).highScore >= 0
            ? (persisted as { highScore: number }).highScore
            : 0
      })
    }
  )
)
