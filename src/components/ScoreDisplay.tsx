// ScoreDisplay component - shows game stats

import { useHighScoreStore } from '@/stores/highScoreStore'
import { memo } from 'react'

interface ScoreDisplayProps {
  score: number
  level: number
  linesCleared: number
}

const ScoreDisplayComponent = ({ score, level, linesCleared }: ScoreDisplayProps) => {
  const highScore = useHighScoreStore((state) => state.getHighScore())
  const isNewHighScore = score > highScore

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 space-y-3">
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide">Score</div>
        <div className={`text-2xl font-bold ${isNewHighScore ? 'text-yellow-400' : 'text-white'}`}>
          {score.toLocaleString()}
        </div>
        {isNewHighScore && score > 0 && (
          <div className="text-xs text-yellow-400 mt-1">New High Score!</div>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Level</div>
          <div className="text-xl font-semibold text-white">{level}</div>
        </div>

        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Lines</div>
          <div className="text-xl font-semibold text-white">{linesCleared}</div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-400 uppercase tracking-wide">High Score</div>
        <div className="text-lg font-medium text-gray-300">{highScore.toLocaleString()}</div>
      </div>
    </div>
  )
}

export const ScoreDisplay = memo(ScoreDisplayComponent)
