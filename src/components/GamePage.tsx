import { GameBoard } from '@/components/GameBoard'
import { GameOverModal } from '@/components/GameOverModal'
import { KeyboardControlsDisplay } from '@/components/KeyboardControlsDisplay'
import { NextPiece } from '@/components/NextPiece'
import { PieceShowcase } from '@/components/PieceShowcase'
import { ScoreDisplay } from '@/components/ScoreDisplay'
import { SpecialBlockShowcase } from '@/components/SpecialBlockShowcase'
import { GameStatus } from '@/game/types'
import { useGameController } from '@/hooks/useGameController'

export function GamePage() {
  const { grid, currentPiece, nextPiece, score, level, linesCleared, status, startGame } =
    useGameController()

  return (
    <div className="flex flex-col lg:flex-row items-start justify-center gap-8 h-screen p-8 overflow-hidden">
      <div className="flex flex-col gap-6 w-full lg:w-64 shrink-0">
        <ScoreDisplay
          score={score}
          level={level}
          linesCleared={linesCleared}
        />

        <NextPiece piece={status === GameStatus.Playing ? nextPiece : null} />
      </div>

      <div className="relative flex-1 max-w-2xl w-full h-full flex items-center justify-center">
        <div className="w-full h-full max-h-[calc(100vh-4rem)]">
          <GameBoard grid={grid} currentPiece={currentPiece} size={18} />
        </div>

        {status === GameStatus.Idle && (
          <div className="absolute inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center rounded-lg overflow-y-auto">
            <div className="text-center p-6 max-w-md">
              <div className="text-3xl text-gray-300 animate-pulse mb-12">
                Press any key to start
              </div>
              <PieceShowcase />
              <div className="mt-8">
                <SpecialBlockShowcase />
              </div>
              <div className="mt-6">
                <KeyboardControlsDisplay />
              </div>
            </div>
          </div>
        )}
      </div>

      {status === GameStatus.GameOver && (
        <GameOverModal
          score={score}
          onPlayAgain={startGame}
        />
      )}
    </div>
  )
}
