import { Chess } from "chess.js";
import { CENTIPAWNS_TO_PAWNS, EVALUATION_THRESHOLDS } from "../../lib/constants";
import type { PositionFairnessInfo } from "./chess-utils";
import { calculateLegalMovesCount, calculateMaterialCount, calculateWinChances, generatePositionDescription, safeChessMutate } from "./chess-utils";

/**
 * Refresh position analysis after a move
 */
export async function refreshPositionAnalysis(
  chess: Chess,
  depth: number = 12
): Promise<PositionFairnessInfo> {
  // Import evaluateChessPosition dynamically to avoid circular dependencies
  const { evaluateChessPosition } = await import('../../lib/stockfish');

  try {
    // Get current FEN using safeChessMutate to avoid any mutation issues
    const fen = safeChessMutate(chess, chessCopy => chessCopy.fen());

    // Run stockfish analysis
    const analysis = await evaluateChessPosition(fen, depth, false);

    // Calculate evaluation and other stats
    // Use constant for conversion
    const evaluation = analysis.score !== undefined ? analysis.score * CENTIPAWNS_TO_PAWNS : 0;
    const forcedMate = analysis.mate ?? null;
    // Use centralized threshold for fairness
    const isFair = forcedMate === null && Math.abs(evaluation) <= EVALUATION_THRESHOLDS.SLIGHT_ADVANTAGE;

    // Calculate material and legal moves
    const materialCount = calculateMaterialCount(chess);
    const legalMovesCount = calculateLegalMovesCount(chess);

    // Get game state information safely
    const inCheck = safeChessMutate(chess, chessCopy => chessCopy.inCheck());
    // Use FEN's move number field (6th field, index 5)
    const fenParts = fen.split(' ');
    const moveNumber = parseInt(fenParts[5], 10) || 1;
    // Extract halfmove clock from FEN - it's the 5th field (index 4)
    const halfmoveClock = parseInt(fenParts[4], 10) || 0;

    // Repetition detection using chess.js
    let repetition: number | undefined = undefined;
    if (typeof chess.isThreefoldRepetition === 'function' && chess.isThreefoldRepetition()) {
      repetition = 3;
    }

    // Build the fairness info object
    const fairnessInfo: PositionFairnessInfo = {
      isLegal: true, // It's a legal position if we got here
      isFair,
      evaluation,
      forcedMate,
      winChance: calculateWinChances(evaluation, forcedMate),
      description: generatePositionDescription(true, isFair, evaluation, forcedMate),
      materialCount,
      legalMovesCount,
      inCheck,
      moveNumber,
      halfmoveClock,
      repetition
    };

    return fairnessInfo;
  } catch (error) {
    console.error("Error refreshing position analysis:", error);
    // Return minimal info on error, but include all fields for type safety
    return {
      isLegal: false,
      isFair: false,
      evaluation: 0,
      forcedMate: null,
      description: "Error analyzing position.",
      winChance: { white: 33, black: 33, draw: 34 },
      materialCount: undefined,
      legalMovesCount: undefined,
      inCheck: undefined,
      moveNumber: undefined,
      halfmoveClock: undefined,
      repetition: undefined
    };
  }
}

/**
 * Convert evaluation from centipawns to a displayable string
 */
export function evaluationToString(evaluation: number, forcedMate: number | null = null): string {
  if (forcedMate !== null) {
    return forcedMate > 0
      ? `#${forcedMate}`
      : `#-${Math.abs(forcedMate)}`;
  }

  const absEval = Math.abs(evaluation) / 100;
  if (evaluation === 0) {
    return "0.00";
  } else {
    return (evaluation > 0 ? "+" : "-") + absEval.toFixed(2);
  }
}