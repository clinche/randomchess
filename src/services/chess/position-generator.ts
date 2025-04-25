import { EVALUATION_THRESHOLDS } from "@/lib/constants";
import { Chess, Square } from "chess.js";
import { PositionFairnessInfo, calculateLegalMovesCount, calculateWinChances, generatePositionDescription } from "./chess-utils";
import { refreshPositionAnalysis } from "./position-analyzer";

// Helper to get a random element from an array
const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Constants for chess board ranks and files
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * Default options for position generation and evaluation
 */
export const DEFAULT_POSITION_OPTIONS = {
  maxEvaluation: EVALUATION_THRESHOLDS.SLIGHT_ADVANTAGE, // Max centipawn evaluation difference for fairness (±1.5 pawns)
  stockfishDepth: 15, // Depth for Stockfish analysis
  fairnessChecks: {
    kingsNotInCheck: true,           // Check that kings are not in check at start
    bishopsOnDifferentColors: true,  // Bishops of same color should be on different colored squares
    noStalemate: true,               // Both sides should have legal moves
    evaluationWithinRange: true      // Position evaluation should be within maxEvaluation range
  }
};

// Complete options type including fairness checks
export interface PositionGeneratorOptions {
  maxEvaluation: number;
  stockfishDepth: number;
  fairnessChecks: {
    kingsNotInCheck: boolean;
    bishopsOnDifferentColors: boolean;
    noStalemate: boolean;
    evaluationWithinRange: boolean;
  };
}

/** Helper: Determine if a square is light or dark colored 
 * Returns true for light squares, false for dark squares
 */
function isLightSquare(square: Square): boolean {
  const fileIndex = FILES.indexOf(square.charAt(0));
  const rankIndex = RANKS.indexOf(square.charAt(1));
  // A square is light if the sum of its file and rank indices is even
  return (fileIndex + rankIndex) % 2 === 0;
}

// Helper to get a random square based on allowed ranks
const getRandomSquare = (allowedRanks: number[]): Square => {
  const file = getRandomElement(FILES);
  const rank = getRandomElement(allowedRanks.map(r => RANKS[r]));
  return `${file}${rank}` as Square;
};

/**
 * Helper: Place a specific number of pieces of a given type/color 
 * Returns true if placement is successful and position is legal, false otherwise
 */
function placePieces(
  chess: Chess,
  pieceOrList: { type: string, color: string } | { type: string, color: string }[],
  count: number,
  allowedRanks: number[],
  options?: PositionGeneratorOptions
): boolean {
  const piecesToPlace = Array.isArray(pieceOrList) ? pieceOrList : Array(count).fill(pieceOrList);

  for (const piece of piecesToPlace) {
    let placed = false;
    let placementAttempts = 0;
    while (!placed && placementAttempts < 100) { // Limit attempts per piece
      placementAttempts++;
      const square = getRandomSquare(allowedRanks);
      if (!chess.get(square)) {
        chess.put(piece, square);
        placed = true;
      }
    }
    if (!placed) {
      console.warn(`Could not place piece ${piece.color}${piece.type} on ranks ${allowedRanks.join(',')}`);
      return false;
    }
  }
  
  // Early legality checks after pieces are placed (if options are provided)
  if (options) {
    // Kings in check check
    if (options.fairnessChecks.kingsNotInCheck && 
       (isKingInCheck(chess, 'w') || isKingInCheck(chess, 'b'))) {
      return false; // King starts in check - invalid
    }
    
    // Bishops on same colored squares check
    if (options.fairnessChecks.bishopsOnDifferentColors && hasBishopsOnSameColoredSquares(chess)) {
      return false; // Invalid position: bishops of the same color on same colored squares
    }
    
    // Stalemate check - ensure both sides have legal moves
    if (options.fairnessChecks.noStalemate) {
      const legalMoves = calculateLegalMovesCount(chess);
      if (legalMoves.white === 0 || legalMoves.black === 0) {
        return false; // Skip positions where either side has no legal moves (stalemate)
      }
    }
  }
  
  return true; // All pieces placed successfully and position is legal
}

/** Helper: Check if kings are adjacent */
function areKingsAdjacent(k1: Square, k2: Square): boolean {
  const file1 = k1.charCodeAt(0);
  const rank1 = parseInt(k1[1], 10);
  const file2 = k2.charCodeAt(0);
  const rank2 = parseInt(k2[1], 10);
  return Math.abs(file1 - file2) <= 1 && Math.abs(rank1 - rank2) <= 1;
}

/** Helper: Check if a king is currently in check */
function isKingInCheck(chess: Chess, color: 'w' | 'b'): boolean {
  // Use safeChessMutate to safely check if king is in check without modifying original chess object
  try {
    return safeChessMutate(chess, (chessCopy) => {
      const opponentColor = color === 'w' ? 'b' : 'w';
      
      // Create a modified FEN with the opponent's turn
      const fenParts = chessCopy.fen().split(' ');
      fenParts[1] = opponentColor; // Set turn to opponent
      const tempFen = fenParts.join(' ');
      
      // Load the modified position
      chessCopy.load(tempFen);
      return chessCopy.inCheck();
    });
  } catch (e) {
    console.warn("Error checking king in check:", e);
    return true; // Assume check if FEN is invalid
  }
}

/** Helper: Check if bishops of the same color are on squares of the same color */
function hasBishopsOnSameColoredSquares(chess: Chess): boolean {
  // Get the board representation
  const board = chess.board();
  
  // Arrays to store square colors of white and black bishops
  const whiteBishopSquares: boolean[] = []; // true for light squares, false for dark squares
  const blackBishopSquares: boolean[] = []; // true for light squares, false for dark squares
  
  // Find all bishops
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === 'b') {
        // Convert rank/file to square notation (e.g., 'a1')
        const squareStr = `${FILES[file]}${RANKS[rank]}` as Square;
        const isLight = isLightSquare(squareStr);
        
        if (piece.color === 'w') {
          whiteBishopSquares.push(isLight);
        } else {
          blackBishopSquares.push(isLight);
        }
      }
    }
  }
  
  // Check if there are multiple bishops of the same color on the same colored squares
  // For white bishops
  if (whiteBishopSquares.length >= 2) {
    const onLightSquare = whiteBishopSquares.filter(isLight => isLight).length;
    const onDarkSquare = whiteBishopSquares.length - onLightSquare;
    if (onLightSquare >= 2 || onDarkSquare >= 2) {
      return true;
    }
  }
  
  // For black bishops
  if (blackBishopSquares.length >= 2) {
    const onLightSquare = blackBishopSquares.filter(isLight => isLight).length;
    const onDarkSquare = blackBishopSquares.length - onLightSquare;
    if (onLightSquare >= 2 || onDarkSquare >= 2) {
      return true;
    }
  }
  
  return false;
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

/**
 * Generates a random, legal, and fair chess position.
 */
export async function generateRandomPosition(
  options: Partial<PositionGeneratorOptions> = DEFAULT_POSITION_OPTIONS, 
  onAttempt?: () => void
): Promise<{ fen: string, fairness: PositionFairnessInfo }> {
  // Merge default options with provided options
  const mergedOptions: PositionGeneratorOptions = {
    ...DEFAULT_POSITION_OPTIONS,
    ...options,
    fairnessChecks: {
      ...DEFAULT_POSITION_OPTIONS.fairnessChecks,
      ...options.fairnessChecks
    }
  };
  
  // Dynamically import the evaluateChessPosition function to avoid circular dependencies
  const { evaluateChessPosition } = await import('../../lib/stockfish');
  let attempts = 0;
  console.log("Generating random position with options:", mergedOptions);

  while (true) {
    attempts++;
    // Call the onAttempt callback to increment the counter on each attempt
    if (onAttempt) onAttempt();
    
    // Create a fresh Chess instance for this attempt
    const chess = new Chess();
    chess.clear(); // Start with an empty board

    try {
      // We're using a fresh chess instance here, so direct mutation during position
      // generation is safe. The key is to avoid mutating any objects that could be frozen.

      // 1. Place Kings (ensure separation)
      let whiteKingSquare: Square;
      let blackKingSquare: Square;
      do {
        whiteKingSquare = getRandomSquare([0, 1, 2]); // Ranks 1-3 for white king
        blackKingSquare = getRandomSquare([5, 6, 7]); // Ranks 6-8 for black king
      } while (areKingsAdjacent(whiteKingSquare, blackKingSquare));
      chess.put({ type: 'k', color: 'w' }, whiteKingSquare);
      chess.put({ type: 'k', color: 'b' }, blackKingSquare);

      // 2. Place Pawns (8 each, respecting ranks)
      // No checks on pawns yet as kings might be in check until all pieces are placed
      if (!placePieces(chess, { type: 'p', color: 'w' }, 8, [1, 2, 3])) {
        continue; // Couldn't place all pawns, try a new position
      }
      
      if (!placePieces(chess, { type: 'p', color: 'b' }, 8, [4, 5, 6])) {
        continue; // Couldn't place all pawns, try a new position
      }

      // 3. Place Major/Minor Pieces (respecting sides)
      const whitePieces = [
        { type: 'q', color: 'w' }, { type: 'r', color: 'w' }, { type: 'r', color: 'w' },
        { type: 'b', color: 'w' }, { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'n', color: 'w' },
      ];
      const blackPieces = [
        { type: 'q', color: 'b' }, { type: 'r', color: 'b' }, { type: 'r', color: 'b' },
        { type: 'b', color: 'b' }, { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'n', color: 'b' },
      ];
      
      // Now apply legality checks after placing all remaining pieces
      if (!placePieces(chess, whitePieces, whitePieces.length, [0, 1, 2, 3], mergedOptions)) {
        continue; // Position failed legality checks, try a new one
      }
      
      if (!placePieces(chess, blackPieces, blackPieces.length, [4, 5, 6, 7], mergedOptions)) {
        continue; // Position failed legality checks, try a new one
      }

      // These checks are now done inside placePieces
      // 4. Basic Legality Checks (before Stockfish)
      // Only apply checks that the user has enabled
      
      // // Kings in check check (already checked in placePieces)
      // if (mergedOptions.fairnessChecks.kingsNotInCheck && 
      //    (isKingInCheck(chess, 'w') || isKingInCheck(chess, 'b'))) {
      //   continue; // King starts in check - invalid
      // }
      
      // // Bishops on same colored squares check (already checked in placePieces)
      // if (mergedOptions.fairnessChecks.bishopsOnDifferentColors && hasBishopsOnSameColoredSquares(chess)) {
      //   continue; // Invalid position: bishops of the same color on same colored squares
      // }
      
      // // Stalemate check - ensure both sides have legal moves (already checked in placePieces)
      // if (mergedOptions.fairnessChecks.noStalemate) {
      //   const legalMoves = calculateLegalMovesCount(chess);
      //   if (legalMoves.white === 0 || legalMoves.black === 0) {
      //     continue; // Skip positions where either side has no legal moves (stalemate)
      //   }
      // }

      // 5. Generate FEN and check if it's valid for chess.js
      // Set turn to a placeholder for now, we'll determine the actual turn later after evaluation
      let fen = safeChessMutate(chess, chessCopy => {
        // Initially set white to move, this will be updated after evaluation
        const fenParts = chessCopy.fen().split(' ');
        fenParts[1] = 'w'; // Temporary, will be updated based on evaluation
        fenParts[2] = '-'; // Clear castling
        fenParts[3] = '-'; // Clear en passant
        return fenParts.join(' ');
      });

      // 6. Load the final FEN to ensure chess.js validity
      try {
        // Use safeChessMutate to load the FEN safely
        const validFen = safeChessMutate(chess, chessCopy => {
          chessCopy.load(fen);
          return chessCopy.fen(); // Return the normalized FEN
        });
        fen = validFen; // Use the normalized FEN
      } catch (e) {
        console.warn("Generated FEN invalid for chess.js:", fen, e);
        continue; // Invalid FEN according to chess.js
      }

      // 7. Stockfish Analysis
      const analysis = await refreshPositionAnalysis(new Chess(fen), mergedOptions.stockfishDepth); // Use server if possible

      if (analysis.forcedMate === null && analysis.isFair) {
        // Determine who should move first - the disadvantaged side gets the first move
        const whiteToMove = analysis.evaluation <= 0; // If evaluation is negative or zero, white begins
        
        // Update the FEN with the correct turn
        fen = fen.replace(/ w | b /, whiteToMove ? " w " : " b ");
        
        // Found a legal and fair position!
        const fairness: PositionFairnessInfo = {
          isLegal: true, // Passed checks
          isFair: true,
          evaluation: analysis.evaluation,
          forcedMate: null,
          winChance: calculateWinChances(analysis.evaluation), // Calculate based on final eval
          description: generatePositionDescription(true, true, analysis.evaluation, null),
        };
        console.log(`Generated valid position after ${attempts} attempts. FEN: ${fen}`);
        return { fen, fairness };
      }
      // If not fair or has mate, the loop continues

    } catch (error) {
      // Catch errors during placement or analysis
      console.error(`Error during generation attempt ${attempts}:`, error);
      // Continue to next attempt
    }
  }
}