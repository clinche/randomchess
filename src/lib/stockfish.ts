// Stockfish browser integration
import { CENTIPAWNS_TO_PAWNS, ENGINE_STRENGTH } from './constants';

interface StockfishMessage {
  type: string;
  [key: string]: any;
}

interface StockfishAnalysis {
  score?: number;
  mate?: number | null;
  bestMove?: string;
  pv?: string[];
  depth?: number;
  multipv?: any[];
}

type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'max';

class StockfishEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private resolvers: Map<string, (value: any) => void> = new Map();
  private analysisCallback: ((analysis: StockfishAnalysis) => void) | null = null;
  private useWasmStockfish = true;
  private currentDifficulty: DifficultyLevel = 'medium';
  
  constructor(difficulty: DifficultyLevel = 'medium') {
    this.currentDifficulty = difficulty;
    
    if (typeof window !== 'undefined') {
      try {
        // Check if SharedArrayBuffer is supported directly
        const isSharedArrayBufferAvailable = typeof SharedArrayBuffer !== 'undefined';
        
        if (isSharedArrayBufferAvailable) {
          console.log('SharedArrayBuffer is available, using WASM Stockfish');
          this.useWasmStockfish = true;
        } else {
          console.log('SharedArrayBuffer not available yet, checking if service worker is active');
          
          // Check if we have an active service worker which might be setting the headers
          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            console.log('Service worker is active, SharedArrayBuffer should be available after reload');
            this.useWasmStockfish = true;
          } else {
            console.log('Service worker not active or not supported, falling back to non-WASM Stockfish');
            this.useWasmStockfish = false;
          }
        }

        // Get the base path for assets based on deployment environment
        const basePath = 
          process.env.NODE_ENV === 'production' ? '/randomchess' : '';
          
        try {
          // Create the appropriate worker using the correct path for the environment
          if (this.useWasmStockfish) {
            console.log('Creating WASM Stockfish worker');
            this.worker = new Worker(`${basePath}/stockfish.js`);
          } else {
            console.log('Creating non-WASM Stockfish worker');
            this.worker = new Worker(`${basePath}/stockfish-nnue.js`);
          }
          
          this.setupWorker();
        } catch (workerError) {
          console.error('Failed to initialize Stockfish worker:', workerError);
          
          // If WASM worker fails, try the non-WASM version
          if (this.useWasmStockfish) {
            try {
              console.log('Falling back to non-WASM version after error');
              this.worker = new Worker(`${basePath}/stockfish-nnue.js`);
              this.useWasmStockfish = false;
              this.setupWorker();
            } catch (fallbackError) {
              console.error('Failed to initialize fallback Stockfish worker:', fallbackError);
            }
          }
        }
      } catch (e) {
        console.error('Failed to initialize Stockfish engine:', e);
      }
    }
  }

  private setupWorker() {
    if (!this.worker) return;
    
    // Store accumulated analysis data between engine outputs
    let currentAnalysis: StockfishAnalysis = {};
    
    this.worker.onmessage = (e) => {
      const line = e.data;
      console.log('[Stockfish]', line); // Add logging to debug engine output
      
      // Ready confirmation
      if (line === 'readyok') {
        this.isReady = true;
        if (this.resolvers.has('ready')) {
          const resolve = this.resolvers.get('ready');
          if (resolve) resolve(true);
          this.resolvers.delete('ready');
        }
        return;
      }
      
      // Parse score
      if (line.includes('score cp')) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
          // Use centralized constant for converting centipawns to pawns
          currentAnalysis.score = parseInt(match[1], 10) / CENTIPAWNS_TO_PAWNS;
          console.log('[Stockfish Analysis] Score:', currentAnalysis.score);
        }
      }
      
      // Parse mate
      if (line.includes('score mate')) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          currentAnalysis.mate = parseInt(match[1], 10);
          console.log('[Stockfish Analysis] Mate in:', currentAnalysis.mate);
        }
      }
      
      // Parse best move
      if (line.includes('bestmove')) {
        const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbnQRBN]?)/);
        if (match && match[1]) {
          currentAnalysis.bestMove = match[1];
          console.log('[Stockfish Analysis] Best move:', currentAnalysis.bestMove);
          
          // When we get a bestmove response, resolve with the complete accumulated analysis
          if (this.resolvers.has('bestmove')) {
            const resolve = this.resolvers.get('bestmove');
            if (resolve) {
              console.log('[Stockfish] Resolving with complete analysis:', currentAnalysis);
              resolve({...currentAnalysis}); // Clone to avoid reference issues
            }
            this.resolvers.delete('bestmove');
            currentAnalysis = {}; // Reset for next analysis
          }
        }
      }
      
      // Parse principal variation
      if (line.includes('pv')) {
        const match = line.match(/pv (.+)/);
        if (match && match[1]) {
          currentAnalysis.pv = match[1].split(' ');
        }
      }
      
      // Parse depth
      if (line.includes('depth')) {
        const match = line.match(/depth (\d+)/);
        if (match && match[1]) {
          currentAnalysis.depth = parseInt(match[1], 10);
        }
      }
      
      // Check for info strings that contain score and depth together
      if (line.startsWith('info') && line.includes('depth') && (line.includes('score cp') || line.includes('score mate'))) {
        // Send analysis update if we have a callback and there's meaningful data
        if (this.analysisCallback && (currentAnalysis.score !== undefined || currentAnalysis.mate !== undefined)) {
          this.analysisCallback({...currentAnalysis}); // Clone to avoid reference issues
        }
      }
    };
    
    // Initialize the engine with UCI mode and standard settings
    this.worker.postMessage('uci');
    this.worker.postMessage('setoption name UCI_AnalyseMode value true'); // Enable analysis mode
    this.worker.postMessage('setoption name Threads value 4'); // Use multiple threads if available
    
    // Apply strength settings based on difficulty level from constants
    this.applyDifficultySettings(this.currentDifficulty);
    
    this.worker.postMessage('isready');
  }

  // Apply difficulty settings from constants
  public applyDifficultySettings(difficulty: DifficultyLevel) {
    if (!this.worker) return;
    
    this.currentDifficulty = difficulty;
    const settings = ENGINE_STRENGTH[difficulty];
    
    // Set skill level (0-20)
    this.worker.postMessage(`setoption name Skill Level value ${settings.skillLevel}`);
    
    // Set ELO limitation
    this.worker.postMessage(`setoption name UCI_LimitStrength value ${settings.limitStrength}`);
    
    // Set ELO rating if limit is enabled
    if (settings.limitStrength) {
      this.worker.postMessage(`setoption name UCI_Elo value ${settings.elo}`);
    }
    
    console.log(`[Stockfish] Applied ${difficulty} difficulty settings:`, settings);
  }

  public async waitReady(): Promise<boolean> {
    if (this.isReady) return Promise.resolve(true);
    
    return new Promise((resolve) => {
      this.resolvers.set('ready', resolve);
      if (this.worker) this.worker.postMessage('isready');
    });
  }

  public async evaluatePosition(fen: string, depth = 15, multiPV = 1): Promise<StockfishAnalysis> {
    if (!this.worker) {
      return Promise.reject(new Error('Stockfish worker not initialized'));
    }
    
    await this.waitReady();
    
    this.worker.postMessage(`position fen ${fen}`);
    if (multiPV > 1) {
      this.worker.postMessage(`setoption name MultiPV value ${multiPV}`);
    }
    this.worker.postMessage(`go depth ${depth}`);
    
    return new Promise((resolve) => {
      this.resolvers.set('bestmove', resolve);
    });
  }

  public setAnalysisCallback(callback: (analysis: StockfishAnalysis) => void): void {
    this.analysisCallback = callback;
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance for use throughout the app
let stockfishInstance: StockfishEngine | null = null;

export function getStockfishEngine(difficulty?: DifficultyLevel): StockfishEngine {
  if (!stockfishInstance) {
    stockfishInstance = new StockfishEngine(difficulty);
  } else if (difficulty) {
    // Update existing instance with new difficulty
    stockfishInstance.applyDifficultySettings(difficulty);
  }
  return stockfishInstance;
}

// Helper function to evaluate positions using either server-side or browser-side stockfish
export async function evaluateChessPosition(
  fen: string, 
  depth = 15, 
  useServer = true,
  difficulty: DifficultyLevel = 'max'
): Promise<StockfishAnalysis> {
  // Make sure we're working with a mutable copy of the FEN string
  const fenCopy = String(fen);
  console.debug('[DEBUG][stockfish.ts] evaluateChessPosition fenCopy:', { fenCopy, isFrozen: Object.isFrozen(fenCopy) });
  
  // Determine if we're running on GitHub Pages
  const isGitHubPages = typeof window !== 'undefined' && 
    window.location.hostname.includes('github.io');
  
  // Only try server-side analysis if not on GitHub Pages and useServer is true
  if (useServer && !isGitHubPages) {
    try {
      // Get the base path for API requests based on deployment environment
      const basePath = process.env.NODE_ENV === 'production' ? '/randomchess' : '';
      
      const response = await fetch(`${basePath}/api/stockfish/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fen: fenCopy, 
          depth,
          difficulty  // Pass difficulty to server API
        }),
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        console.warn('Server-side stockfish analysis failed with status:', response.status);
        // Fall back to browser-side stockfish
      }
    } catch (error) {
      console.error('Server-side stockfish analysis failed, falling back to browser:', error);
    }
  }
  
  // Always fall back to browser-side stockfish on GitHub Pages
  // or if server-side analysis fails
  try {
    console.log('Using browser-side Stockfish for analysis');
    const engine = getStockfishEngine(difficulty);
    
    // Make sure we wait for a complete analysis with score information
    const analysis = await engine.evaluatePosition(fenCopy, depth);
    
    // Ensure we have a complete analysis object
    if (analysis.score === undefined && analysis.mate === undefined) {
      console.warn('Stockfish analysis missing score information, running deeper analysis');
      // If analysis is incomplete, try a slightly deeper analysis to ensure results
      return await engine.evaluatePosition(fenCopy, depth + 2);
    }
    
    console.log('Browser Stockfish analysis complete:', analysis);
    return analysis;
  } catch (error) {
    console.error('Browser-side stockfish analysis failed:', error);
    
    // Return a basic analysis if all methods fail
    return {
      score: 0,
      mate: null,
      bestMove: undefined,
      depth: depth
    };
  }
}