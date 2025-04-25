import { Board } from "@/components/board";
import { ChessErrorBoundary } from "@/components/ChessErrorBoundary";
import { getGameEndReason } from "@/services/chess/chess-utils";
import { Chess, Move } from "chess.js";
import { useEffect, useState } from "react";

interface ChessboardWrapperProps {
  fen: string | null;
  isLoading: boolean;
  isThinking: boolean;
  boardVisible: boolean;
  isBoardPlayable: boolean;
  boardOrientation: "white" | "black";
  generationStatus: string;
  positionsAttempted: number;
  onFenChange: (fen: string) => void;
  onMove: (move: Move) => void;
}

export function ChessboardWrapper({
  fen,
  isLoading = false,
  isThinking = false,
  boardVisible = false,
  isBoardPlayable = false,
  boardOrientation = "white",
  generationStatus = "",
  positionsAttempted = 0,
  onFenChange,
  onMove,
}: ChessboardWrapperProps) {
  // Use local state only to stabilize rendering
  // This helps prevent flickering when props change quickly
  const [stableRender, setStableRender] = useState(false);
  
  // More reliable board visibility detection
  const showBoard = !isLoading && fen && boardVisible;
  
  // Check for game end conditions
  const [gameEndState, setGameEndState] = useState<{
    isGameOver: boolean;
    isDraw: boolean;
    isCheckmate: boolean;
    inCheck: boolean;
    message: string;
  }>({
    isGameOver: false,
    isDraw: false,
    isCheckmate: false,
    inCheck: false,
    message: "",
  });
  
  // Update game end state when FEN changes
  useEffect(() => {
    if (fen) {
      try {
        const chess = new Chess(fen);
        const isGameOver = chess.isGameOver();
        const isDraw = chess.isDraw();
        const inCheck = chess.inCheck();
        const isCheckmate = chess.isCheckmate();
        
        let message = "";
        if (isCheckmate) {
          const winner = chess.turn() === 'w' ? "Black" : "White";
          message = `Checkmate! ${winner} wins`;
        } else if (isDraw) {
          message = getGameEndReason(chess) || "Draw";
        }
        
        setGameEndState({
          isGameOver,
          isDraw,
          isCheckmate,
          inCheck,
          message
        });
      } catch (error) {
        console.error("Error checking game state:", error);
      }
    }
  }, [fen]);
  
  // Use an effect with a delay to stabilize transitions
  useEffect(() => {
    // When board should be shown, we apply a small delay
    // This prevents quick flashes during state transitions
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (showBoard && !stableRender) {
      console.log("Board should show - setting stable render after delay");
      timeoutId = setTimeout(() => {
        setStableRender(true);
      }, 50); // Small delay to help with state stabilization
    } else if (!showBoard && stableRender) {
      console.log("Board should hide - updating stable render state");
      setStableRender(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showBoard, stableRender]);
  
  // Log visibly when board state changes
  useEffect(() => {
    console.log("ChessboardWrapper render state:", {
      props: { isLoading, boardVisible, hasFen: !!fen },
      derived: { showBoard, stableRender }
    });
  }, [isLoading, boardVisible, fen, showBoard, stableRender]);

  // Always show the loading state when isLoading is true
  if (isLoading === true) {
    return (
      <div className="relative w-full max-w-md aspect-square">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-center font-medium">{generationStatus}</p>
          <p className="text-center text-sm text-gray-500 mt-2">Positions tested: {positionsAttempted}</p>
        </div>
      </div>
    );
  } else if (fen) {
    return (
      <div className="relative w-full max-w-md aspect-square">
        <ChessErrorBoundary>
          <div className="relative">
            <Board
              fen={fen}
              playable={isBoardPlayable}
              onFenChange={onFenChange}
              onMove={onMove}
              orientation={boardOrientation}
            />
            {isThinking && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                <p className="text-white text-xl font-semibold">AI Thinking...</p>
              </div>
            )}
            
            {/* Game end indicators */}
            {gameEndState.isGameOver && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center rounded ${
                gameEndState.isCheckmate 
                  ? 'bg-gradient-to-r from-red-500/70 to-orange-500/70' 
                  : 'bg-gradient-to-r from-blue-500/70 to-indigo-500/70'
              }`}>
                <div className="bg-white/90 p-4 rounded-lg shadow-lg text-center">
                  <h3 className="text-xl font-bold mb-2">
                    {gameEndState.isCheckmate ? '♚ Checkmate! ♚' : '⚖️ Game Over ⚖️'}
                  </h3>
                  <p className="text-lg font-medium">{gameEndState.message}</p>
                </div>
              </div>
            )}
            
            {/* Check indicator */}
            {gameEndState.inCheck && !gameEndState.isGameOver && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full shadow text-sm font-medium">
                Check!
              </div>
            )}
          </div>
        </ChessErrorBoundary>
      </div>
    );
  }
}