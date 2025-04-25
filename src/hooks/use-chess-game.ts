import { safeChessMutate } from '@/services/chess/chess-utils';
import { PositionGeneratorOptions } from '@/services/chess/position-generator';
import { Move } from 'chess.js';
import { useCallback, useEffect, useState } from 'react';
import { useChessPosition } from './use-chess-position';
import { AiDifficulty, useStockfish } from './use-stockfish';

// Define game modes
export type GameMode = "random" | "vsBot" | "local";
export type PlayerSide = "white" | "black";

interface UseChessGameProps {
  initialMode?: GameMode;
  initialPlayerSide?: PlayerSide;
  initialDifficulty?: AiDifficulty;
}

export function useChessGame({
  initialMode = "random",
  initialPlayerSide = "white",
  initialDifficulty = "max"
}: UseChessGameProps = {}) {
  // Set up game state
  const [gameMode, setGameMode] = useState<GameMode>(initialMode);
  const [playerSide, setPlayerSide] = useState<PlayerSide>(initialPlayerSide);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(initialDifficulty);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);
  const [modeChanged, setModeChanged] = useState(false);
  // Add a flag to skip board reset on next mode change
  const [skipNextModeChangeReset, setSkipNextModeChangeReset] = useState(false);
  // Add previous fen state for undo functionality
  const [previousFenStates, setPreviousFenStates] = useState<string[]>([]);
  
  // Use our custom hooks
  const {
    fen,
    chess,
    fairnessInfo,
    isLoading,
    positionsAttempted,
    generationStatus,
    positionOptions,
    resetToStartingPosition,
    generateNewPosition,
    analyzeCurrentPosition,
    updateFen,
    updatePositionOptions
  } = useChessPosition({
    // Set analysis depth based on difficulty level
    analysisDepth: 
      aiDifficulty === 'easy' ? 8 : 
      aiDifficulty === 'medium' ? 12 :
      aiDifficulty === 'hard' ? 15 :
      20 // Max depth for 'max' difficulty
  });
  
  const { isThinking, getBotMove } = useStockfish({ difficulty: aiDifficulty });

  // Compute boardVisible as a pure derived value
  const boardVisible = !!fen && !isLoading;
  
  // Reset the game state
  const resetGame = useCallback((targetFen?: string) => {
    console.log("Resetting game with FEN:", targetFen || "default");
    
    if (targetFen) {
      updateFen(targetFen);
    } else {
      resetToStartingPosition();
    }
    
    setMoveHistory([]);
    setMoveCount(0);
    console.log("Game reset complete, board will be visible");
  }, [resetToStartingPosition, updateFen]);
  
  // Handle moves
  const handleMove = useCallback((move: Move, isBotMove = false) => {
    // Store current FEN for undo functionality
    if (fen) {
      setPreviousFenStates(prev => [...prev, fen]);
    }
    
    // Record move in history
    setMoveHistory(prev => [...prev, move]);
    setMoveCount(prev => prev + 1);
    
    // Apply the move safely to get the new FEN
    const safeGameUpdate = (chessCopy: typeof chess, moveSan: string) => {
      return safeChessMutate(chessCopy, (gameCopy) => {
        const result = gameCopy.move(moveSan);
        return result ? gameCopy.fen() : null;
      });
    };
    
    // If chess is available, update the FEN
    if (chess) {
      const fenAfter = safeGameUpdate(chess, move.san);
      if (fenAfter) {
        // Update FEN, which will trigger position analysis via useChessPosition hook
        updateFen(fenAfter);
      } else {
        console.error("Failed to apply valid move object:", move);
      }
    }
  }, [chess, updateFen, fen]);
  
  // Undo last move
  const undoLastMove = useCallback(() => {
    if (moveHistory.length > 0 && previousFenStates.length > 0) {
      // Get the previous FEN state
      const prevFen = previousFenStates[previousFenStates.length - 1];
      
      // Remove the last move from history
      setMoveHistory(prev => prev.slice(0, -1));
      setMoveCount(prev => prev - 1);
      
      // Remove the last FEN from the stack
      setPreviousFenStates(prev => prev.slice(0, -1));
      
      // Update the position to the previous state
      updateFen(prevFen);
      
      return true;
    }
    return false;
  }, [moveHistory, previousFenStates, updateFen]);
  
  // Function to generate a new game position
  const startNewGame = useCallback(async (customOptions?: Partial<PositionGeneratorOptions>) => {
    console.log("Starting new game, mode:", gameMode);
    // Hide board during generation to avoid showing incomplete states
    setMoveHistory([]);
    setMoveCount(0);
    
    try {
      console.log("Generating random position...");
      await generateNewPosition(customOptions);
      
      console.log("Position ready, allowing board to show");
      return true;
    } catch (error) {
      console.error("Error in startNewGame:", error);
      // Ensure board is visible even if there's an error
      return false;
    }
  }, [gameMode, generateNewPosition]);
  
  // Function to use the current position against AI
  const useCurrentPositionVsAI = useCallback(() => {
    console.log("Using current position vs AI");
    // Keep the current position/FEN but switch to vsBot mode
    setSkipNextModeChangeReset(true); // Set flag to skip reset
    setGameMode('vsBot');
    // Reset move history
    setMoveHistory([]);
    setMoveCount(0);
  }, []);
  
  // Effect to handle AI moves when it's the bot's turn
  useEffect(() => {
    if (
      gameMode === 'vsBot' &&
      !isLoading &&
      !isThinking &&
      boardVisible &&
      chess &&
      !chess.isGameOver() &&
      !chess.isDraw()
    ) {
      const currentTurnColor = chess.turn();
      const botColor = playerSide === 'white' ? 'b' : 'w';
      
      if (currentTurnColor === botColor) {
        console.log(`AI's turn (${botColor}) detected. Triggering AI.`);
        // Use setTimeout to prevent rapid state updates
        const timerId = setTimeout(() => {
          getBotMove(chess, (move) => {
            handleMove(move, true);
          });
        }, 200);
        return () => clearTimeout(timerId);
      }
    }
  }, [chess, gameMode, isLoading, isThinking, boardVisible, playerSide, getBotMove, handleMove]);
  
  // Effect to initialize on first load
  useEffect(() => {
    if (!initialized) {
      console.log("Initializing chess game for the first time");
      startNewGame().then(() => {
        setInitialized(true);
        console.log("Initialization complete, initialized =", true);
      });
    }
  }, [startNewGame, initialized]);
  
  // Effect to handle game mode changes
  useEffect(() => {
    // Don't run on initial render, only when gameMode actually changes
    if (initialized) {
      console.log("Game mode changed to:", gameMode);
      setModeChanged(true);
    }
  }, [gameMode, initialized]);

  // Effect to respond to game mode changes
  useEffect(() => {
    // Only run this effect when mode changed and we're not loading
    if (modeChanged && !isLoading && initialized) {
      console.log("Responding to game mode change, isLoading =", isLoading);
      setModeChanged(false); // Reset the flag to prevent repeated executions
      if (skipNextModeChangeReset) {
        setSkipNextModeChangeReset(false); // Reset the skip flag
        return; // Do not reset the board
      }
      startNewGame();
    }
  }, [isLoading, startNewGame, modeChanged, initialized, skipNextModeChangeReset]);

  // Additional effect to ensure board is shown after loading completes
  useEffect(() => {
    // If we have a FEN and loading is complete, make sure the board is showing
    if (!isLoading && fen && initialized) {
      console.log("Loading complete, ensuring board can be visible");
    }
  }, [isLoading, fen, initialized]);
  
  // Calculate board orientation and playability
  const boardOrientation: "black" | "white" = playerSide === "black" ? "black" : "white";
  const isPlayerTurn = chess ? chess.turn() === (playerSide === "white" ? 'w' : 'b') : true;
  const isBoardPlayable = !isLoading && !isThinking && (
    gameMode === 'local' ||
    gameMode === 'random' || // Allow controlling both sides in random for analysis
    (gameMode === 'vsBot' && isPlayerTurn)
  );
  
  return {
    // State
    fen,
    chess,
    fairnessInfo,
    isLoading,
    isThinking,
    gameMode,
    playerSide,
    aiDifficulty,
    moveHistory,
    moveCount,
    boardVisible,
    positionsAttempted,
    generationStatus,
    boardOrientation,
    isBoardPlayable,
    isPlayerTurn,
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
    analyzeCurrentPosition,
    updateFen,
    updatePositionOptions,
    undoLastMove
  };
}