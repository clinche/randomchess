import { PositionFairnessInfo } from '@/services/chess/chess-utils';
import { refreshPositionAnalysis } from '@/services/chess/position-analyzer';
import { DEFAULT_POSITION_OPTIONS, generateRandomPosition, PositionGeneratorOptions } from '@/services/chess/position-generator';
import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseChessPositionProps {
  initialFen?: string;
  analysisDepth?: number;
}

export function useChessPosition({
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  analysisDepth = 12
}: UseChessPositionProps = {}) {
  const [fen, setFen] = useState<string>(initialFen);
  const [chess, setChess] = useState<Chess>(() => new Chess(initialFen));
  const [fairnessInfo, setFairnessInfo] = useState<PositionFairnessInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Start as not loading
  const [positionsAttempted, setPositionsAttempted] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>("Ready");
  const [positionOptions, setPositionOptions] = useState<PositionGeneratorOptions>(DEFAULT_POSITION_OPTIONS);
  
  const isMounted = useRef(true);
  // Skip analysis flag to prevent redundant analysis
  const skipNextAnalysis = useRef(false);

  // Default fairness info for standard position
  const STANDARD_FAIRNESS: PositionFairnessInfo = {
    isLegal: true, isFair: true, evaluation: 0, forcedMate: null,
    description: "Standard starting position.",
    winChance: { white: 50, black: 50, draw: 0 }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initialize chess instance when fen changes
  useEffect(() => {
    try {
      console.log("[use-chess-position] FEN updated:", fen);
      const newChess = new Chess(fen);
      setChess(newChess);
      
      // Check if we should skip analysis (for positions that already have analysis)
      if (skipNextAnalysis.current) {
        console.log("[use-chess-position] Skipping redundant analysis for this FEN update");
        skipNextAnalysis.current = false; // Reset flag for future FEN changes
        return;
      }
      
      // Analyze position after setting a new FEN
      refreshPositionAnalysis(newChess, analysisDepth)
        .then(fairness => {
          if (isMounted.current) {
            console.log("[use-chess-position] Position analysis complete");
            setFairnessInfo(fairness);
          }
        })
        .catch(err => console.error("[use-chess-position] Error analyzing position:", err));
    } catch (e) {
      console.error("[use-chess-position] Invalid FEN:", fen, e);
      // Fall back to standard position on error
      resetToStartingPosition();
    }
  }, [fen, analysisDepth]);

  // Reset to standard starting position
  const resetToStartingPosition = useCallback(() => {
    console.log("[use-chess-position] Resetting to standard position");
    setIsLoading(true);
    
    // Skip analysis for standard position - we already know the fairness info
    skipNextAnalysis.current = true;
    
    // Use setTimeout to ensure state updates properly 
    setTimeout(() => {
      if (isMounted.current) {
        const standardFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        setFen(standardFen);
        setFairnessInfo(STANDARD_FAIRNESS);
        setIsLoading(false);
        console.log("[use-chess-position] Reset complete, isLoading set to false");
      }
    }, 10);
  }, []);

  // Update position options
  const updatePositionOptions = useCallback((newOptions: Partial<PositionGeneratorOptions>) => {
    setPositionOptions(currentOptions => ({
      ...currentOptions,
      ...newOptions,
      fairnessChecks: {
        ...currentOptions.fairnessChecks,
        ...(newOptions.fairnessChecks || {})
      }
    }));
  }, []);

  // Generate a random position
  const generateNewPosition = useCallback(async (customOptions?: Partial<PositionGeneratorOptions>) => {
    console.log("[use-chess-position] Starting position generation");
    setIsLoading(true);
    setGenerationStatus("Generating and analyzing position...");
    setPositionsAttempted(0);

    // Merge current options with any custom options passed during generation
    const mergedOptions = {
      ...positionOptions,
      ...(customOptions || {}),
      fairnessChecks: {
        ...positionOptions.fairnessChecks,
        ...(customOptions?.fairnessChecks || {})
      }
    };

    try {
      // Call the position generator service, passing a callback to track attempts
      const result = await generateRandomPosition(mergedOptions, () => {
        if (isMounted.current) {
          setPositionsAttempted(prev => prev + 1);
        }
      });

      // Only update state if component is still mounted
      if (isMounted.current) {
        console.log("[use-chess-position] Position generated:", result.fen);
        
        // Set skip flag because we already have analysis from position generator
        skipNextAnalysis.current = true;
        
        // Update state with the result
        setFen(result.fen);
        setFairnessInfo(result.fairness);

          setGenerationStatus("New position generated!");
      }
    } catch (error) {
      console.error("[use-chess-position] Error generating new position:", error);
      if (isMounted.current) {
        setGenerationStatus("An error occurred during generation.");
        resetToStartingPosition();
      }
    } finally {
      if (isMounted.current) {
        // Ensure loading state is updated last
        setTimeout(() => {
          if (isMounted.current) {
            setIsLoading(false);
            console.log("[use-chess-position] Generation complete, isLoading set to false");
          }
        }, 10);
      }
    }
  }, [positionOptions, resetToStartingPosition]);

  // Analyze current position
  const analyzeCurrentPosition = useCallback(async () => {
    if (!chess) return null;
    
    try {
      console.log("[use-chess-position] Analyzing current position");
      const analysis = await refreshPositionAnalysis(chess, analysisDepth);
      
      if (isMounted.current) {
        setFairnessInfo(analysis);
      }
      
      return analysis;
    } catch (error) {
      console.error("[use-chess-position] Error analyzing position:", error);
      return null;
    }
  }, [chess, analysisDepth]);

  // Update FEN from an external source (like the board UI)
  const updateFen = useCallback((newFen: string) => {
    try {
      // Validate FEN before setting
      const tempChess = new Chess();
      tempChess.load(newFen);
      console.log("[use-chess-position] Updating FEN:", newFen);
      setFen(newFen);
    } catch (error) {
      console.error("[use-chess-position] Invalid FEN provided:", newFen, error);
    }
  }, []);

  return {
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
  };
}