"use client";

import { AboutCard } from "@/components/AboutCard";
import { PositionAnalysis } from "@/components/analysis/PositionAnalysis";
import { ChessboardWrapper } from "@/components/ChessboardWrapper";
import { GameControls } from "@/components/GameControls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/i18n-context";

import { useChessGame } from "@/hooks/use-chess-game";

export default function Home() {
  // Use our custom hook for managing the game
  const game = useChessGame();
  // Use the i18n hook for translations
  const { t } = useI18n();
  
  // Destructure all the game state and actions we need
  const {
    fen,
    chess,
    fairnessInfo,
    isLoading,
    isThinking,
    gameMode,
    playerSide,
    aiDifficulty,
    moveHistory,
    generationStatus,
    positionsAttempted,
    boardVisible,
    boardOrientation,
    isBoardPlayable,
    positionOptions,
    
    // Actions
    setGameMode,
    setPlayerSide,
    setAiDifficulty,
    handleMove,
    resetGame,
    startNewGame,
    useCurrentPositionVsAI,
    generateNewPosition,
    updateFen,
    updatePositionOptions,
    undoLastMove
  } = game;

  // Define the standard starting position for reset
  const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-6 px-4">
      <div className="w-full max-w-6xl flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">{t('appName')}</h1>
        <LanguageSwitcher />
      </div>
      
      {/* Game Mode Selection - Moved back to the top */}
      <div className="flex space-x-2 mb-4">
        <Button 
          variant={gameMode === 'random' ? 'default' : 'outline'} 
          onClick={() => setGameMode('random')}
        >
          {t('chess:gameModes.random')}
        </Button>
        <Button 
          variant={gameMode === 'vsBot' ? 'default' : 'outline'} 
          onClick={() => setGameMode('vsBot')}
        >
          {t('chess:gameModes.vsBot')}
        </Button>
        <Button 
          variant={gameMode === 'local' ? 'default' : 'outline'} 
          onClick={() => setGameMode('local')}
        >
          {t('chess:gameModes.local')}
        </Button>
      </div>
      
      <p className="text-gray-600 mb-6 text-center max-w-lg">
        {gameMode === 'random' && t('chess:gameModeDescriptions.random')}
        {gameMode === 'vsBot' && t('chess:gameModeDescriptions.vsBot', { side: playerSide === 'white' ? t('chess:players.white') : t('chess:players.black') })}
        {gameMode === 'local' && t('chess:gameModeDescriptions.local')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* Left column: Chess board and primary controls */}
        <div className="flex flex-col items-center">
          <ChessboardWrapper
            fen={fen}
            isLoading={isLoading}
            isThinking={isThinking}
            boardVisible={boardVisible}
            isBoardPlayable={isBoardPlayable}
            boardOrientation={boardOrientation}
            generationStatus={generationStatus}
            positionsAttempted={positionsAttempted}
            onFenChange={updateFen}
            onMove={handleMove}
          />

          <div className="mt-6 w-full">
            <GameControls
              gameMode={gameMode}
              playerSide={playerSide}
              aiDifficulty={aiDifficulty}
              isLoading={isLoading}
              isThinking={isThinking}
              positionOptions={positionOptions}
              moveHistory={moveHistory}
              setGameMode={setGameMode}
              setPlayerSide={setPlayerSide}
              setAiDifficulty={setAiDifficulty}
              updatePositionOptions={updatePositionOptions}
              generateNewPosition={generateNewPosition}
              startNewGame={startNewGame}
              resetGame={() => resetGame(STANDARD_FEN)}
              undoLastMove={undoLastMove}
              useCurrentPositionVsAI={useCurrentPositionVsAI}
            />
          </div>
        </div>

        {/* Right column: Analysis and information */}
        <div className="flex flex-col space-y-4">
          {/* Show loading placeholder when generating position */}
          {isLoading ? (
            <Card className="p-4">
              <h2 className="text-xl font-semibold mb-2">
                {gameMode === 'random' ? t('analysis:positionAnalysis') : t('analysis:gameInfo')}
              </h2>
              <Separator className="my-2" />
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            </Card>
          ) : (
            (gameMode !== 'local' || fairnessInfo) && chess && (
              <PositionAnalysis
                chess={chess}
                fairnessInfo={fairnessInfo}
                fen={fen}
                moveHistory={moveHistory}
                gameMode={gameMode}
              />
            )
          )}

          {/* About Card */}
          <AboutCard />
        </div>
      </div>
    </div>
  );
}