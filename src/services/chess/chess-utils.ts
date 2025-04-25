import { Chess, Square } from "chess.js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { EVALUATION_THRESHOLDS, WIN_PROBABILITY } from "../../lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Helper function to safely mutate a Chess.js object without modifying the original
 * This prevents "read-only" errors in production builds with strict mode
 */
export function safeChessMutate<T>(chess: Chess, modify: (chessCopy: Chess) => T): T {
  // Create a deep copy by recreating from FEN
  const chessCopy = new Chess(chess.fen());
  // Apply the modification to the copy
  return modify(chessCopy);
}

// Definition of a chess position's fairness level
export interface PositionFairnessInfo {
  isLegal: boolean;
  isFair: boolean;
  evaluation: number; // In centipawns, positive means white advantage
  winChance?: {
    white: number;
    black: number;
    draw: number;
  };
  forcedMate?: number | null; // Number of moves to mate, null if no forced mate
  description: string | { // Human-readable description, either as a string (legacy) or translation object
    key: string;
    params?: Record<string, any>;
  };
  // New fields for additional stats
  materialCount?: {
    white: number;
    black: number;
    advantage: number; // Positive means white advantage
  };
  legalMovesCount?: {
    white: number;
    black: number;
    current: number; // Number of legal moves for current player
  };
  inCheck?: boolean; // Whether the current player is in check
  moveNumber?: number; // Current move number
  halfmoveClock?: number; // Halfmove clock for 50-move rule
  repetition?: number; // Number of times position has been repeated (if any)
}

// Function to calculate material count
export function calculateMaterialCount(chess: Chess): { white: number, black: number, advantage: number } {
  const pieceValues = {
    'p': 1,   // Pawn
    'n': 3,   // Knight
    'b': 3,   // Bishop
    'r': 5,   // Rook
    'q': 9,   // Queen
    'k': 0    // King (not counted in material evaluation)
  };

  let whiteMaterial = 0;
  let blackMaterial = 0;

  // Get the board representation
  const board = chess.board();

  // Calculate material for each piece
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = board[rank][file];
      if (square) {
        const { type, color } = square;
        const value = pieceValues[type as keyof typeof pieceValues];
        
        if (color === 'w') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }

  return {
    white: whiteMaterial,
    black: blackMaterial,
    advantage: whiteMaterial - blackMaterial
  };
}

// Function to calculate legal move counts for both sides
export function calculateLegalMovesCount(chess: Chess): { white: number, black: number, current: number } {
  // Save current position state
  const currentTurn = chess.turn();
  const currentMoves = chess.moves().length;
  
  // Use safeChessMutate to safely handle the turn switching without modifying original chess object
  try {
    const oppositeMoves = safeChessMutate(chess, (chessCopy) => {
      // Create a modified FEN with the opposite turn
      const fenParts = chessCopy.fen().split(' ');
      fenParts[1] = currentTurn === 'w' ? 'b' : 'w'; // Switch turn
      const modifiedFen = fenParts.join(' ');
      
      // Load the modified position
      chessCopy.load(modifiedFen);
      return chessCopy.moves().length;
    });
    
    return {
      white: currentTurn === 'w' ? currentMoves : oppositeMoves,
      black: currentTurn === 'b' ? currentMoves : oppositeMoves,
      current: currentMoves
    };
  } catch (e) {
    console.error("Error calculating opposite side's legal moves:", e);
    // Fallback if error occurs
    return {
      white: currentTurn === 'w' ? currentMoves : 0,
      black: currentTurn === 'b' ? currentMoves : 0,
      current: currentMoves
    };
  }
}

/**
 * Calculate approximate win chances based on the evaluation (Centipawns)
 * Uses a logistic model based on statistical analysis of millions of chess games
 * that more accurately reflects real-world win probabilities at various evaluation levels
 */
export function calculateWinChances(evaluation: number, forcedMate: number | null = null): { white: number, black: number, draw: number } {
  // Handle forced mate scenarios - this takes precedence over evaluation
  if (forcedMate !== null) {
    return forcedMate > 0
      ? { white: 100, black: 0, draw: 0 } // White wins with mate
      : { white: 0, black: 100, draw: 0 }; // Black wins with mate
  }
  
  // For positions with extremely high evaluation, assign high probability to the winning side
  if (Math.abs(evaluation) > EVALUATION_THRESHOLDS.MATE_THRESHOLD) { // Extremely winning position (20+ pawns or mate)
    return evaluation > 0 
      ? { white: 98, black: 0, draw: 2 } 
      : { white: 0, black: 98, draw: 2 };
  }
  
  // Using the formula from statistical analysis:
  // winning_chances = 50 + 50 * (2 / (1 + exp(-0.004 * centipawns)) - 1)
  // This gives a proper symmetrical S-curve where:
  // - At 0 centipawns: exactly 50% for each side
  // - Positive values favor white, negative values favor black
  
  const centipawns = evaluation;
  const winningChances = 50 + 50 * (2 / (1 + Math.exp(-WIN_PROBABILITY.SIGMOID_FACTOR * centipawns)) - 1);
  
  // Calculate draw chance - highest at evaluation 0, decreases as advantage increases
  // Uses a bell curve centered at 0
  const drawChance = Math.max(0, Math.min(WIN_PROBABILITY.MAX_DRAW_PROB, 
    WIN_PROBABILITY.MAX_DRAW_PROB * Math.exp(-Math.pow(centipawns / WIN_PROBABILITY.DRAW_THRESHOLD, 2))));
  
  // Calculate win probabilities ensuring they are properly balanced and sum to 100%
  let whiteWinProb, blackWinProb;
  
  if (centipawns >= 0) {
    // White has advantage or equal position
    whiteWinProb = (winningChances - drawChance / 2) / 100;
    blackWinProb = (100 - winningChances - drawChance / 2) / 100;
  } else {
    // Black has advantage
    blackWinProb = (100 - winningChances - drawChance / 2) / 100;
    whiteWinProb = (winningChances - drawChance / 2) / 100;
  }
  
  // Ensure probabilities don't go negative
  whiteWinProb = Math.max(0, whiteWinProb);
  blackWinProb = Math.max(0, blackWinProb);
  
  // Convert to percentages and round to integers
  return {
    white: Math.round(whiteWinProb * 100),
    black: Math.round(blackWinProb * 100),
    draw: Math.round(drawChance)
  };
}

/**
 * Generate a human-readable description of the position's fairness
 * This version returns a translation key with color-neutral parameters
 */
export function generatePositionDescription(isLegal: boolean, isFair: boolean, evaluation: number, forcedMate: number | null = null): {
  key: string;
  params?: Record<string, any>;
} {
  if (!isLegal) {
    return { key: 'analysis:description.illegal' };
  }
  
  if (forcedMate !== null) {
    // Use a color-neutral identifier that will be translated in the component
    const sideKey = forcedMate > 0 ? "chess:players.white" : "chess:players.black";
    return {
      key: 'analysis:description.mateIn',
      params: {
        ['moves']: Math.abs(forcedMate),
        ['side']: sideKey
      }
    };
  }
  
  let descriptionKey: string;
  let params: Record<string, string> = {};
  
  if (Math.abs(evaluation) < EVALUATION_THRESHOLDS.BALANCED) {
    descriptionKey = 'analysis:description.balanced';
  } else if (Math.abs(evaluation) < EVALUATION_THRESHOLDS.SLIGHT_ADVANTAGE) {
    // Use a color-neutral identifier that will be translated in the component
    descriptionKey = 'analysis:description.slightAdvantage';
    params.side = evaluation > 0 ? "chess:players.white" : "chess:players.black";
  } else if (Math.abs(evaluation) < EVALUATION_THRESHOLDS.ADVANTAGE) {
    descriptionKey = 'analysis:description.advantage';
    params.side = evaluation > 0 ? "chess:players.white" : "chess:players.black";
  } else if (Math.abs(evaluation) < EVALUATION_THRESHOLDS.WINNING) {
    descriptionKey = 'analysis:description.winning';
    params.side = evaluation > 0 ? "chess:players.white" : "chess:players.black";
  } else {
    descriptionKey = 'analysis:description.decisive';
    params.side = evaluation > 0 ? "chess:players.white" : "chess:players.black";
  }
  
  return { key: descriptionKey, params };
}

/**
 * Chess board analysis helper functions for UI display
 */

export function getCastlingRights(chess: Chess): string {
  const fenParts = chess.fen().split(' ');
  const castling = fenParts[2];
  return castling === '-' ? 'None' : castling;
}

export function getEnPassantSquare(chess: Chess): string {
  const fenParts = chess.fen().split(' ');
  return fenParts[3] === '-' ? 'None' : fenParts[3];
}

export function getGameEndReason(chess: Chess): string | null {
  if (chess.isCheckmate()) return 'Checkmate';
  if (chess.isStalemate()) return 'Stalemate';
  if (chess.isInsufficientMaterial()) return 'Insufficient Material';
  if (chess.isThreefoldRepetition && chess.isThreefoldRepetition()) return 'Threefold Repetition';
  if (chess.isDraw()) return 'Draw (50-move rule or repetition)';
  return null;
}

export function getPawnStructure(chess: Chess) {
  // Returns {doubled, isolated, passed} for each color
  const board = chess.board();
  const pawns: { [color: string]: string[] } = { w: [], b: [] };
  
  // Constants for chess board ranks and files
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.type === 'p') {
        pawns[sq.color].push(String.fromCharCode(97 + f) + (8 - r));
      }
    }
  }
  function analyze(color: 'w' | 'b') {
    const files = pawns[color].map(sq => sq[0]);
    const doubled = files.filter((f, i, arr) => arr.indexOf(f) !== i).filter((v, i, arr) => arr.indexOf(v) === i).length;
    const allFiles = ['a','b','c','d','e','f','g','h'];
    const isolated = files.filter(f => {
      const idx = allFiles.indexOf(f);
      return (idx === 0 || !files.includes(allFiles[idx-1])) && (idx === 7 || !files.includes(allFiles[idx+1]));
    }).length;
    // Passed pawns: no enemy pawns on same or adjacent files ahead
    const enemy = color === 'w' ? 'b' : 'w';
    const enemyPawns = pawns[enemy];
    const passed = pawns[color].filter(sq => {
      const fileIdx = allFiles.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10);
      return !enemyPawns.some(ep => {
        const epFileIdx = allFiles.indexOf(ep[0]);
        const epRank = parseInt(ep[1], 10);
        if (Math.abs(epFileIdx - fileIdx) > 1) return false;
        return color === 'w' ? epRank > rank : epRank < rank;
      });
    }).length;
    return { doubled, isolated, passed };
  }
  return { white: analyze('w'), black: analyze('b') };
}

export function getDevelopedPieces(chess: Chess) {
  // Developed = not on original square (except pawns)
  const board = chess.board();
  const origSquares = {
    w: { n: ['b1','g1'], b: ['c1','f1'], r: ['a1','h1'], q: ['d1'], k: ['e1'] },
    b: { n: ['b8','g8'], b: ['c8','f8'], r: ['a8','h8'], q: ['d8'], k: ['e8'] }
  };
  const dev = { w: 0, b: 0 };
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.type !== 'p') {
        const pos = String.fromCharCode(97 + f) + (8 - r);
        if (!origSquares[sq.color][sq.type]?.includes(pos)) dev[sq.color]++;
      }
    }
  }
  return dev;
}

export function getKingSafety(chess: Chess) {
  // King castled = not on e1/e8 and on g/h or c/b files
  const board = chess.board();
  let w = 'center', b = 'center';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.type === 'k') {
        const pos = String.fromCharCode(97 + f) + (8 - r);
        if (sq.color === 'w') w = (pos === 'g1' || pos === 'c1') ? 'castled' : (pos === 'e1' ? 'center' : 'moved');
        if (sq.color === 'b') b = (pos === 'g8' || pos === 'c8') ? 'castled' : (pos === 'e8' ? 'center' : 'moved');
      }
    }
  }
  return { white: w, black: b };
}

export function getCenterControl(chess: Chess) {
  // Center squares: d4, d5, e4, e5
  const center = ['d4','d5','e4','e5'];
  const board = chess.board();
  let w = 0, b = 0;
  for (const sq of center) {
    const piece = chess.get(sq as Square);
    if (piece) {
      if (piece.color === 'w') w++;
      else b++;
    }
  }
  return { white: w, black: b };
}