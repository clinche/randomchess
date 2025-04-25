import { Chess, Move } from 'chess.js';
import { useCallback, useState } from 'react';

export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'max';

interface UseStockfishOptions {
  difficulty: AiDifficulty;
}

interface StockfishAnalysis {
  bestMove: string;
  score?: number;
  mate?: number;
}

// Define difficulty depths
const DIFFICULTY_DEPTHS = {
  easy: 5,
  medium: 10,
  hard: 15,
  max: 20,
};

export function useStockfish({ difficulty = 'max' }: UseStockfishOptions = { difficulty: 'max' }) {
  const [isThinking, setIsThinking] = useState(false);

  /**
   * Get a move from the Stockfish engine
   */
  const getBotMove = useCallback(async (
    chess: Chess,
    onMove: (move: Move) => void
  ) => {
    if (chess.isGameOver()) return;
    
    setIsThinking(true);
    const depth = DIFFICULTY_DEPTHS[difficulty];
    const fen = chess.fen();
    
    try {
      // Determine if we're running on GitHub Pages
      const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
      let data: StockfishAnalysis | undefined;
      
      // First try server API if not on GitHub Pages
      if (!isGitHubPages) {
        try {
          const basePath = process.env.NODE_ENV === 'production' ? '/randomchess' : '';
          const response = await fetch(`${basePath}/api/stockfish/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen, depth, difficulty }),
          });
          
          if (response.ok) {
            data = await response.json();
          } else {
            console.warn('Server API failed, falling back to client-side Stockfish');
          }
        } catch (error) {
          console.warn('Server API error, falling back to client-side Stockfish:', error);
        }
      }
      
      // If server failed or we're on GitHub Pages, use client-side Stockfish
      if (!data) {
        console.log(`Using client-side Stockfish for bot move (difficulty: ${difficulty})`);
        // Import and use the client-side Stockfish implementation
        const { getStockfishEngine } = await import('../lib/stockfish');
        
        // Get engine with appropriate difficulty settings
        const engine = getStockfishEngine(difficulty as AiDifficulty);
        const analysis = await engine.evaluatePosition(fen, depth);
        
        if (!analysis || !analysis.bestMove) {
          throw new Error('Client-side Stockfish failed to return a valid move');
        }
        
        data = {
          bestMove: analysis.bestMove,
          score: analysis.score,
          mate: analysis.mate || 0
        };
        console.log('Client-side Stockfish analysis complete:', data);
      }
      
      // Process the move data
      if (data && data.bestMove) {
        const moveNotation = data.bestMove;
        
        // Parse the move notation (e.g. "e2e4")
        if (moveNotation.length >= 4) {
          const from = moveNotation.substring(0, 2);
          const to = moveNotation.substring(2, 4);
          // Handle promotion if present (e.g., "e7e8q")
          const promotion = moveNotation.length > 4 ? moveNotation.substring(4, 5) : undefined;
          
          // Get all possible moves from current position
          const possibleMoves = chess.moves({ verbose: true });
          
          // Check if the move is valid
          const moveResult = possibleMoves.find(m => 
            m.from === from && m.to === to && 
            (m.promotion === promotion || (!m.promotion && !promotion))
          );
          
          if (moveResult) {
            onMove(moveResult); // Pass the validated Move object to callback
          } else {
            console.error("Stockfish proposed an invalid move:", moveNotation, "on FEN:", fen);
          }
        } else {
          console.error("Stockfish returned move in unexpected format:", moveNotation);
        }
      } else {
        console.error("Could not extract best move from Stockfish response object:", data);
      }
    } catch (error) {
      console.error("Error getting bot move:", error);
    } finally {
      setIsThinking(false);
    }
  }, [difficulty]);
  
  return {
    isThinking,
    getBotMove
  };
}