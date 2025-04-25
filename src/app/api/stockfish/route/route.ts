import { Chess, validateFen } from 'chess.js';
import { spawn } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { CENTIPAWNS_TO_PAWNS, ENGINE_STRENGTH, PIECE_VALUES, STOCKFISH_ANALYSIS } from '../../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { fen, depth = STOCKFISH_ANALYSIS.DEFAULT_DEPTH, multiPv = STOCKFISH_ANALYSIS.DEFAULT_MULTI_PV, difficulty = 'medium' } = await req.json();
    
    // Log request to help debug API calls
    console.log(`Stockfish API called with FEN: ${fen.substring(0, 30)}... at depth ${depth} (difficulty: ${difficulty})`);
    
    // Validate FEN
    let chess;
    try {
      chess = new Chess(fen);
      if (!validateFen(fen).ok) {
        console.error('Invalid FEN position received:', fen);
        return NextResponse.json(
          { error: 'Invalid FEN position' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error validating FEN:', error, fen);
      return NextResponse.json(
        { error: 'Invalid FEN position' },
        { status: 400 }
      );
    }

    // Try multiple times if needed
    let lastError = null;
    for (let attempt = 0; attempt <= STOCKFISH_ANALYSIS.MAX_RETRIES; attempt++) {
      try {
        // Run Stockfish analysis with timeout
        const analysis = await Promise.race([
          analyzePosition(fen, depth, multiPv, difficulty),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Analysis timeout')), STOCKFISH_ANALYSIS.ANALYSIS_TIMEOUT)
          )
        ]);
        
        // If successful, return the result
        console.log(`Stockfish analysis successful after ${attempt} retries`);
        return NextResponse.json(analysis);
      } catch (error) {
        console.error(`Stockfish analysis error (attempt ${attempt}):`, error);
        lastError = error;
        
        // Wait briefly before retrying
        if (attempt < STOCKFISH_ANALYSIS.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // All attempts failed, return a basic fallback result
    console.error('All Stockfish analysis attempts failed:', lastError);
    
    // Use chess.js for a basic material evaluation as fallback
    const evaluation = estimateEvaluation(chess);
    
    return NextResponse.json({
      score: evaluation / CENTIPAWNS_TO_PAWNS, // Convert to pawns
      mate: null,
      bestMove: null,
      lines: [],
      depth,
      fen,
      error: 'Analysis failed after multiple attempts, providing estimated evaluation only'
    });
  } catch (error) {
    console.error('Stockfish API general error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze position' },
      { status: 500 }
    );
  }
}

// Simple material-based evaluation for fallback
function estimateEvaluation(chess: Chess): number {
  // Use the centralized piece values
  const pieceValues = {
    p: PIECE_VALUES.PAWN,
    n: PIECE_VALUES.KNIGHT,
    b: PIECE_VALUES.BISHOP,
    r: PIECE_VALUES.ROOK,
    q: PIECE_VALUES.QUEEN,
    k: PIECE_VALUES.KING
  };
  
  let evaluation = 0;
  const board = chess.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      
      const value = pieceValues[piece.type];
      evaluation += piece.color === 'w' ? value : -value;
    }
  }
  
  return evaluation;
}

async function analyzePosition(
  fen: string, 
  depth: number, 
  multiPv: number, 
  difficulty: string = 'medium'
) {
  return new Promise((resolve, reject) => {
    try {
      // Start Stockfish process with sufficient error handling
      const stockfish = spawn('stockfish', [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let bestMove = '';
      let score = 0;
      let mate: number | null = null;
      const lines: { moves: string[]; score: number; mate: number | null }[] = [];
      
      // Set a timeout for the stockfish process
      const timeout = setTimeout(() => {
        console.warn('Stockfish process timeout');
        try {
          stockfish.stdin.write('quit\n');
          stockfish.kill();
        } catch (e) {
          console.error('Error killing stockfish on timeout:', e);
        }
        reject(new Error('Stockfish process timeout'));
      }, STOCKFISH_ANALYSIS.ANALYSIS_TIMEOUT - 1000);

      stockfish.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Extract evaluation information
        if (text.includes('score cp')) {
          const match = text.match(/score cp (-?\d+)/);
          if (match) {
            score = parseInt(match[1]) / CENTIPAWNS_TO_PAWNS; // Convert centipawns to pawns using constant
          }
        }
        
        // Extract mate information
        if (text.includes('score mate')) {
          const match = text.match(/score mate (-?\d+)/);
          if (match) {
            mate = parseInt(match[1]);
          }
        }
        
        // Extract best move
        if (text.includes('bestmove')) {
          const match = text.match(/bestmove ([a-h][1-8][a-h][1-8][qrbnQRBN]?)/);
          if (match) {
            bestMove = match[1];
            
            // Clear timeout as we got a result
            clearTimeout(timeout);
            
            try {
              // Resolve with the analysis result and clean up the process
              stockfish.stdin.write('quit\n');
              stockfish.kill();
            } catch (e) {
              console.error('Error cleaning up stockfish after bestmove:', e);
            }
            
            resolve({
              bestMove,
              score,
              mate,
              lines,
              depth,
              fen
            });
          }
        }
        
        // Extract PV lines for multipv
        if (text.includes('multipv') && text.includes('pv')) {
          const pvMatch = text.match(/multipv (\d+) .*pv ([a-h][1-8][a-h][1-8][qrbnQRBN]? ?.*)/);
          if (pvMatch) {
            const pvIndex = parseInt(pvMatch[1]) - 1;
            const moves = pvMatch[2].trim().split(' ');
            
            // Extract score for this line
            let lineScore = 0;
            let lineMate = null;
            
            const cpMatch = text.match(/score cp (-?\d+)/);
            if (cpMatch) {
              lineScore = parseInt(cpMatch[1]) / CENTIPAWNS_TO_PAWNS; // Use constant
            }
            
            const mateMatch = text.match(/score mate (-?\d+)/);
            if (mateMatch) {
              lineMate = parseInt(mateMatch[1]);
            }
            
            lines[pvIndex] = {
              moves: moves,
              score: lineScore,
              mate: lineMate
            };
          }
        }
      });

      stockfish.stderr.on('data', (data) => {
        console.error(`Stockfish error: ${data}`);
      });

      stockfish.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Stockfish process error:', error);
        reject(error);
      });

      stockfish.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          reject(`Stockfish process exited with code ${code}`);
          return;
        }
        
        // If we haven't already resolved, do it now
        resolve({
          bestMove,
          score,
          mate,
          lines,
          depth,
          fen
        });
      });

      // Initialize engine with UCI mode
      stockfish.stdin.write('uci\n');
      
      // Get engine strength settings for the requested difficulty
      const engineSettings = ENGINE_STRENGTH[difficulty as keyof typeof ENGINE_STRENGTH] || ENGINE_STRENGTH.medium;
      
      // Apply strength settings
      stockfish.stdin.write(`setoption name Skill Level value ${engineSettings.skillLevel}\n`);
      stockfish.stdin.write(`setoption name UCI_LimitStrength value ${engineSettings.limitStrength}\n`);
      
      if (engineSettings.limitStrength) {
        stockfish.stdin.write(`setoption name UCI_Elo value ${engineSettings.elo}\n`);
      }
      
      // Send commands to Stockfish
      stockfish.stdin.write(`position fen ${fen}\n`);
      stockfish.stdin.write(`setoption name MultiPV value ${multiPv}\n`);
      stockfish.stdin.write(`go depth ${depth}\n`);
    } catch (error) {
      reject(error);
    }
  });
}