import { PositionOptions } from "@/components/PositionOptions";
import { Button } from "@/components/ui/button";
import { GameMode, PlayerSide } from '@/hooks/use-chess-game';
import { AiDifficulty } from "@/hooks/use-stockfish";
import { useI18n } from "@/lib/i18n/i18n-context";
import { PositionGeneratorOptions } from "@/services/chess/position-generator";

interface GameControlsProps {
  gameMode: GameMode;
  playerSide: PlayerSide;
  aiDifficulty: AiDifficulty;
  isLoading: boolean;
  isThinking: boolean;
  positionOptions: PositionGeneratorOptions;
  moveHistory?: any[];
  setGameMode: (mode: GameMode) => void;
  setPlayerSide: (side: PlayerSide) => void;
  setAiDifficulty: (difficulty: AiDifficulty) => void;
  updatePositionOptions: (options: Partial<PositionGeneratorOptions>) => void;
  generateNewPosition: () => void;
  startNewGame: () => void;
  resetGame: () => void;
  undoLastMove?: () => boolean;
  useCurrentPositionVsAI: () => void;
}

export function GameControls({
  gameMode,
  playerSide,
  aiDifficulty,
  isLoading,
  isThinking,
  positionOptions,
  moveHistory = [],
  setGameMode,
  setPlayerSide,
  setAiDifficulty,
  updatePositionOptions,
  generateNewPosition,
  startNewGame,
  resetGame,
  undoLastMove,
  useCurrentPositionVsAI
}: GameControlsProps) {
  // Use i18n for translations
  const { t } = useI18n();
  
  // Available difficulty levels
  const difficultyLevels: AiDifficulty[] = ['easy', 'medium', 'hard', 'max'];
  
  return (
    <div className="w-full space-y-4">
      {/* Main Controls */}
      <div className="flex space-x-2">
        {gameMode === 'random' ? (
          <Button
            onClick={generateNewPosition}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? t('chess:generation.generating') : t('chess:generation.generateNew')}
          </Button>
        ) : (
          <Button
            onClick={startNewGame}
            className="flex-1"
            disabled={isLoading || isThinking}
          >
            {t('chess:actions.newGame')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={resetGame}
          disabled={isLoading || isThinking}
        >
          {t('actions.reset')}
        </Button>
        
        {/* Undo button */}
        {undoLastMove && (
          <Button
            variant="outline"
            onClick={undoLastMove}
            disabled={isLoading || isThinking || (moveHistory && moveHistory.length === 0)}
            title={t('actions.undo')}
          >
            {t('actions.undo')}
          </Button>
        )}
      </div>

      {/* Button to use current position against AI - only for random mode */}
      {gameMode === 'random' && (
        <Button
          onClick={useCurrentPositionVsAI}
          className="w-full"
          variant="secondary"
          disabled={isLoading || isThinking}
        >
          {t('chess:actions.playWithAI')}
        </Button>
      )}

      {/* Play as controls & Difficulty controls - only for vsBot */}
      {gameMode === 'vsBot' && (
        <div className="space-y-2">
          {/* Play As */}
          <div className="flex items-center justify-between">
            <span>{t('chess:settings.playAs')}:</span>
            <div className="flex space-x-2">
              <Button
                variant={playerSide === "white" ? "default" : "outline"}
                size="sm"
                onClick={() => { setPlayerSide("white"); startNewGame(); }}
                disabled={isLoading || isThinking}
              >
                {t('chess:players.white')}
              </Button>
              <Button
                variant={playerSide === "black" ? "default" : "outline"}
                size="sm"
                onClick={() => { setPlayerSide("black"); startNewGame(); }}
                disabled={isLoading || isThinking}
              >
                {t('chess:players.black')}
              </Button>
            </div>
          </div>
          {/* Difficulty */}
          <div className="flex items-center justify-between">
            <span>{t('chess:settings.difficulty')}:</span>
            <div className="flex space-x-2">
              {difficultyLevels.map((level) => (
                <Button
                  key={level}
                  variant={aiDifficulty === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAiDifficulty(level)}
                  disabled={isLoading || isThinking}
                  className="capitalize"
                >
                  {t(`chess:difficulty.${level}.title`, { fallback: level })}
                </Button>
              ))}
            </div>
          </div>
          {/* Difficulty Info Box */}
          <div className="mt-2">
            <div className="flex justify-end">
              <div className="w-full max-w-xs bg-muted rounded p-3 border text-sm shadow">
                <div className="font-semibold mb-1">{t(`chess:difficulty.${aiDifficulty}.title`)}</div>
                <div>{t(`chess:difficulty.${aiDifficulty}.description`)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="block">ELO: {t(`chess:difficulty.${aiDifficulty}.elo`)}</span>
                  <span className="block">UCI: {t(`chess:difficulty.${aiDifficulty}.uci`)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Position Generation Options - only show in random mode */}
      {gameMode === 'random' && (
        <PositionOptions
          initialOptions={positionOptions}
          onOptionsChange={updatePositionOptions}
        />
      )}
    </div>
  );
}