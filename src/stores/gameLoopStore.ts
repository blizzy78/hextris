// Game loop store for timing control

import { create } from 'zustand'

interface GameLoopStore {
  elapsed: number
  updateElapsed: (delta: number) => void
  resetElapsed: () => void
}

/**
 * Game loop store manages timing state
 * Use subscribe for external timing control without re-renders
 */
export const useGameLoopStore = create<GameLoopStore>((set) => ({
  elapsed: 0,

  updateElapsed: (delta: number) =>
    set((state) => ({ elapsed: state.elapsed + delta })),

  resetElapsed: () => set({ elapsed: 0 })
}))
