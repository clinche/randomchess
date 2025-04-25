"use client";
import { Chess, Move, Square } from "chess.js";
import { useCallback, useEffect, useState } from "react";
import { Chessboard } from 'react-chessboard';

interface BoardProps {
  fen: string;
  onFenChange?: (fen: string) => void;
  onMove?: (move: Move) => void;
  playable?: boolean;
  orientation?: "white" | "black";
}

export const Board: React.FC<BoardProps> = ({
  fen,
  onFenChange,
  onMove,
  playable = true,
  orientation = "white",
}) => {
  // Create a new mutable copy of the FEN string when initializing
  const [game, setGame] = useState(new Chess(fen ? String(fen) : undefined));
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Update the game state when fen prop changes
    try {
      const fenCopy = fen ? String(fen) : undefined;
      const newGame = new Chess(fenCopy);
      setGame(newGame);
    } catch (e) {
      console.error("Invalid FEN:", e);
    }
  }, [fen]);

  // Reset all highlights
  const resetHighlightSquares = useCallback(() => {
    setHighlightSquares({});
  }, []);

  // Highlight a square
  const highlightSquare = useCallback((square: Square, color: string) => {
    setHighlightSquares((prev) => ({
      ...prev,
      [square]: color,
    }));
  }, []);

  // Highlight legal moves for a square
  const highlightLegalMoves = useCallback((square: Square) => {
    resetHighlightSquares();
    
    // Highlight the selected square
    highlightSquare(square, "rgba(255, 255, 0, 0.4)");
    
    try {
      // Create a proper deep copy of the game
      const tempGame = new Chess(game.fen());
      
      // Highlight legal moves using the temporary instance
      const moves = tempGame.moves({ square, verbose: true });
      moves.forEach((move) => {
        highlightSquare(move.to, "rgba(0, 255, 0, 0.4)");
      });
    } catch (error) {
      console.error("Error highlighting legal moves:", error);
    }
  }, [game, highlightSquare, resetHighlightSquares]);

  // Handle piece selection
  const onSquareClick = (square: Square) => {
    if (!playable) return;

    // If we already have a piece selected
    if (moveFrom) {
      // Check if the clicked square is the same as moveFrom
      if (moveFrom === square) {
        setMoveFrom(null);
        resetHighlightSquares();
        return;
      }

      // Try to make a move
      const moveAttempt = makeMove(moveFrom, square);
      
      // Reset selection after move attempt
      if (moveAttempt) {
        setMoveFrom(null);
        resetHighlightSquares();
        return;
      }
      
      // Check if the target square is empty
      try {
        const tempGame = new Chess(game.fen());
        if (!tempGame.get(square)) {
          setMoveFrom(null);
          resetHighlightSquares();
          return;
        }
      } catch (error) {
        console.error("Error checking square:", error);
        setMoveFrom(null);
        resetHighlightSquares();
        return;
      }
    }

    // Check if the clicked square has a piece that can be moved
    try {
      const tempGame = new Chess(game.fen());
      const piece = tempGame.get(square);
      const currentTurn = tempGame.turn();
      
      if (piece && piece.color === (currentTurn === 'w' ? 'w' : 'b')) {
        setMoveFrom(square);
        highlightLegalMoves(square);
      }
    } catch (error) {
      console.error("Error checking piece:", error);
    }
  };

  // Handle piece drag begin
  const onPieceDragBegin = (piece: string, square: Square) => {
    if (!playable) return false;

    try {
      // Create a proper copy
      const tempGame = new Chess(game.fen());
      
      // Only allow dragging pieces of the current turn
      const turnColor = tempGame.turn() === 'w' ? 'w' : 'b';
      const pieceColor = piece.charAt(0).toLowerCase();
      
      if (pieceColor !== turnColor) {
        return false;
      }
      
      highlightLegalMoves(square as Square);
      return true; // Allow the drag to start
    } catch (error) {
      console.error("Error in piece drag begin:", error);
      return false;
    }
  };

  // Handle piece drop
  const onPieceDrop = (sourceSquare: Square, targetSquare: Square, piece: string) => {
    if (!playable) return false;
    
    try {
      return makeMove(sourceSquare, targetSquare);
    } catch (error) {
      console.error("Error in onDrop:", error);
      return false;
    }
  };

  // Make a move
  const makeMove = (from: Square, to: Square): boolean => {
    try {
      // Create moveObj 
      const moveObj = { from, to };
      
      // Create a safe copy for the move attempt without updating state yet
      const gameCopy = new Chess(game.fen());
      const moveResult = gameCopy.move(moveObj);
      
      // If move is valid, update state and notify parent components
      if (moveResult) {
        // Update game state with the new position after the move
        setGame(gameCopy);
        
        // Get the new FEN directly from our copy that has the move applied
        const newFen = gameCopy.fen();
        
        // Notify parent components with the updated FEN and move result
        if (onFenChange) {
          onFenChange(newFen);
        }
        if (onMove) onMove(moveResult);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Invalid move:", error);
    }
    
    return false;
  };

  // Prepare customSquareStyles for the ChessboardWrapper
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  Object.entries(highlightSquares).forEach(([square, color]) => {
    customSquareStyles[square] = { backgroundColor: color };
  });

  return (
    <div className="w-full max-w-md">
      <Chessboard 
        position={game.fen()}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        onPieceDragBegin={onPieceDragBegin}
        boardOrientation={orientation}
        arePiecesDraggable={playable}
        customSquareStyles={customSquareStyles}
      />
    </div>
  );
};
