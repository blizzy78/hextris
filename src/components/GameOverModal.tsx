// GameOverModal component - displayed when game ends

import { useGameStore } from '@/stores/gameStore'
import { useHighScoreStore } from '@/stores/highScoreStore'
import { useEffect, useRef } from 'react'

interface GameOverModalProps {
  score: number
  onPlayAgain: () => void
}

export function GameOverModal({
  score,
  onPlayAgain
}: GameOverModalProps) {
  const highScore = useHighScoreStore((state) => state.highScore)
  const isNewHighScore = useGameStore((state) => state.isNewHighScore)
  const previousHighScore = useGameStore((state) => state.previousHighScore)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Auto-focus the play again button when modal opens
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  const showHighScoreCelebration = isNewHighScore && score > 0

  const modalBorderClasses = showHighScoreCelebration
    ? 'border-2 border-yellow-500 ring-4 ring-yellow-500/20'
    : 'border border-gray-700'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`bg-gray-900 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl ${modalBorderClasses}`}>
        {showHighScoreCelebration ? (
          <>
            <div className="text-center mb-5">
              <span className="text-6xl">🏆</span>
            </div>
            <h2 id="game-over-title" className="text-3xl font-bold text-yellow-400 mb-2 text-center">
              New High Score!
            </h2>
            <p className="text-gray-300 text-center mb-6">
              Congratulations!<br/>You&apos;ve beaten your previous best!
            </p>
          </>
        ) : (
          <h2 id="game-over-title" className="text-3xl font-bold text-white mb-6 text-center">Game Over</h2>
        )}

        <div className="space-y-4 mb-8">
          <div className={`rounded-lg p-4 ${showHighScoreCelebration ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-800'}`}>
            <div className={`text-sm mb-1 ${showHighScoreCelebration ? 'text-yellow-300' : 'text-gray-400'}`}>
              {showHighScoreCelebration ? 'Your New Record' : 'Final Score'}
            </div>
            <div className={`text-3xl font-bold ${showHighScoreCelebration ? 'text-yellow-400' : 'text-white'}`}>
              {score.toLocaleString()}
            </div>
            {showHighScoreCelebration && previousHighScore > 0 && (
              <div className="text-sm text-gray-400 mt-2">
                Previous best: {previousHighScore.toLocaleString()}
              </div>
            )}
          </div>

          {!isNewHighScore && highScore > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">High Score</div>
              <div className="text-xl font-semibold text-gray-300">
                {highScore.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <button
          ref={buttonRef}
          onClick={onPlayAgain}
          className={`w-full font-semibold py-3 px-6 rounded-lg transition-colors ${showHighScoreCelebration ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
