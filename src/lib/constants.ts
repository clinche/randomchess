/**
 * Chess position evaluation constants
 * These values are used to evaluate chess positions and determine fairness
 */

// Conversion factor from centipawns to pawns
export const CENTIPAWNS_TO_PAWNS = 100;

// Position evaluation thresholds in centipawns
export const EVALUATION_THRESHOLDS = {
  BALANCED: 25,           // Position is considered balanced
  SLIGHT_ADVANTAGE: 50,   // Position gives a slight advantage
  ADVANTAGE: 100,         // Position gives a clear advantage
  WINNING: 300,           // Position is likely winning
  DECISIVE: 1000,         // Position is decisively winning
  MATE_THRESHOLD: 2000    // Extremely winning position (effectively mate)
};

// Win probability model parameters based on the mathematical relationship W = (1 + 10^(P/K))^(-1)
// where W is win probability, P is pawn advantage, K is a constant
export const WIN_PROBABILITY = {
  // Formula parameters according to updated model: W = 50 + 50 * (2 / (1 + exp(-0.004 * centipawns)) - 1)
  SIGMOID_FACTOR: 0.004,  // Coefficient in the exponent (-0.004 * centipawns)
  DRAW_THRESHOLD: 350,    // Scale factor for draw probability calculation
  MAX_DRAW_PROB: 30       // Maximum draw probability in percentage
};

// Piece values in centipawns (traditional chess values)
export const PIECE_VALUES = {
  PAWN: 100,    // 1 pawn = 100 centipawns
  KNIGHT: 320,  // 3.2 pawns
  BISHOP: 330,  // 3.3 pawns
  ROOK: 500,    // 5 pawns
  QUEEN: 900,   // 9 pawns
  KING: 0       // King has no material value in evaluation
};

// Stockfish engine strength settings by difficulty level
export const ENGINE_STRENGTH = {
  easy: {
    skillLevel: 5,        // Lower skill level for easier play (0-20)
    limitStrength: true,  // Enable ELO rating limitation
    elo: 1200             // Approximate beginner club player
  },
  medium: {
    skillLevel: 10,       // Medium skill level
    limitStrength: true,
    elo: 1500             // Approximate intermediate club player
  },
  hard: {
    skillLevel: 15,       // Higher skill level
    limitStrength: true,
    elo: 1800             // Approximate strong club player
  },
  max: {
    skillLevel: 20,       // Maximum skill level
    limitStrength: false, // No ELO limitation
    elo: 3000             // Only used if limitStrength is true
  }
};

// Stockfish analysis settings
export const STOCKFISH_ANALYSIS = {
  DEFAULT_DEPTH: 15,      // Default depth for Stockfish analysis
  DEFAULT_MULTI_PV: 3,    // Default number of principal variations
  ANALYSIS_TIMEOUT: 10000, // 10 seconds timeout for analysis
  MAX_RETRIES: 2          // Number of retries for stockfish analysis
};