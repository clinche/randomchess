import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Chess, Move, Square } from "chess.js";

import {
  getCastlingRights, getCenterControl, getDevelopedPieces, getEnPassantSquare,
  getGameEndReason, getKingSafety, getPawnStructure, PositionFairnessInfo
} from "@/services/chess/chess-utils";
import { evaluationToString } from "@/services/chess/position-analyzer";

interface PositionAnalysisProps {
  chess: Chess;
  fairnessInfo: PositionFairnessInfo | null;
  fen: string | null;
  moveHistory: Move[];
  gameMode: "random" | "vsBot" | "local";
}

export function PositionAnalysis({
  chess,
  fairnessInfo,
  fen,
  moveHistory,
  gameMode
}: PositionAnalysisProps) {
  // Get translation function
  const { t } = useI18n();
  
  // Helper functions
  function getLegalMovesList(chess: Chess) {
    return chess.moves();
  }

  function getLastMove(moveHistory: Move[]) {
    return moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].san : 'None';
  }

  function getCaptureCount(moveHistory: Move[]) {
    return moveHistory.filter(m => m.flags.includes('c') || m.flags.includes('e')).length;
  }

  function getCheckCount(moveHistory: Move[]) {
    return moveHistory.filter(m => m.san.includes('+') || m.san.includes('#')).length;
  }

  function getPromotionCount(moveHistory: Move[]) {
    return moveHistory.filter(m => m.flags.includes('p')).length;
  }

  function getAttackedDefendedCounts(chess: Chess) {
    // For each piece, count if it's attacked/defended
    const board = chess.board();
    let attacked = { w: 0, b: 0 }, defended = { w: 0, b: 0 };
    
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = board[r][f];
        if (sq) {
          const pos = String.fromCharCode(97 + f) + (8 - r) as Square;
          
          // Check if the piece is under attack by opponent pieces
          const attackers = chess.attackers ? 
            chess.attackers(pos, sq.color === 'w' ? 'b' : 'w') : 
            [];
            
          if (attackers && attackers.length > 0) {
            attacked[sq.color]++;
          }
          
          // Check if the piece is defended by friendly pieces
          const defenders = chess.attackers ? 
            chess.attackers(pos, sq.color) :
            [];
            
          if (defenders && defenders.length > 0) {
            defended[sq.color]++;
          }
        }
      }
    }
    
    return { attacked, defended };
  }

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-2">
        {gameMode === 'random' ? t('analysis:positionAnalysis') : t('analysis:gameInfo')}
      </h2>
      <Separator className="my-2" />

      {/* Ensure fairnessInfo exists for random, or just show basic info otherwise */}
      {(fairnessInfo && typeof fen === 'string') || gameMode !== 'random' ? (
        <div className="space-y-4">
          {/* Turn Indicator */}
          <div>
            <span className="font-medium">{t('analysis:turn')}:</span>
            <span className="ml-2 font-semibold">
              {chess.turn() === 'w' ? t('analysis:whiteToMove') : t('analysis:blackToMove')}
              {fairnessInfo?.inCheck && <span className="ml-2 text-red-500">({t('analysis:inCheck')})</span>}
            </span>
          </div>

          {/* Game State Display */}
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <span className="font-medium">{t('analysis:move')}:</span>
              <span className="ml-2">{fairnessInfo?.moveNumber || Math.floor(chess.moveNumber() / 2) + 1}</span>
            </div>
            <div>
              <span className="font-medium">{t('analysis:halfmoveClock')}:</span>
              <span className="ml-2">{fairnessInfo?.halfmoveClock || parseInt(chess.fen().split(' ')[4], 10)}</span>
            </div>
            {fairnessInfo?.repetition && fairnessInfo.repetition > 1 && (
              <div className="col-span-2">
                <span className="font-medium text-amber-600">{t('analysis:positionRepeated')} {fairnessInfo.repetition}x</span>
              </div>
            )}
          </div>

          {/* Material Count Display */}
          {fairnessInfo?.materialCount && (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('analysis:material')}:</span>
                <span className="font-mono" title="Material advantage. +ve for White, -ve for Black.">
                  {fairnessInfo.materialCount.advantage > 0 ? "+" : ""}
                  {fairnessInfo.materialCount.advantage}
                </span>
              </div>
              <div className="flex w-full mt-1 text-xs">
                <div className="flex-1 bg-white text-black px-2 py-1 border border-gray-200 rounded-l-md">
                  {t('chess:players.white')}: {fairnessInfo.materialCount.white}
                </div>
                <div className="flex-1 bg-black text-white px-2 py-1 border-t border-r border-b border-gray-200 rounded-r-md text-right">
                  {t('chess:players.black')}: {fairnessInfo.materialCount.black}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('analysis:advantageExplanation')}</p>
            </div>
          )}

          {/* Legal Moves Display */}
          {fairnessInfo?.legalMovesCount && (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('analysis:legalMoves')}:</span>
                <span className="font-mono">
                  {fairnessInfo.legalMovesCount.current} {t('analysis:available')}
                </span>
              </div>
              <div className="flex w-full mt-1 text-xs">
                <div className="flex-1 bg-white text-black px-2 py-1 border border-gray-200 rounded-l-md">
                  {t('chess:players.white')}: {fairnessInfo.legalMovesCount.white}
                </div>
                <div className="flex-1 bg-black text-white px-2 py-1 border-t border-r border-b border-gray-200 rounded-r-md text-right">
                  {t('chess:players.black')}: {fairnessInfo.legalMovesCount.black}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {fairnessInfo.legalMovesCount.white > fairnessInfo.legalMovesCount.black 
                  ? t('analysis:tacticalOptions.whiteMore') 
                  : fairnessInfo.legalMovesCount.black > fairnessInfo.legalMovesCount.white
                    ? t('analysis:tacticalOptions.blackMore')
                    : t('analysis:tacticalOptions.equal')}
              </p>
            </div>
          )}

          {/* Evaluation Display (Show only if fairnessInfo exists) */}
          {fairnessInfo && (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('analysis:evaluation')}:</span>
                <span className="font-mono" title="Stockfish evaluation (centipawns). +ve for White, -ve for Black.">
                  {evaluationToString(fairnessInfo.evaluation, fairnessInfo.forcedMate)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-1 overflow-hidden relative">
                {/* Background split for clarity */}
                <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-black/30"></div>
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-blue-500/30"></div>
                {/* Evaluation bar */}
                <div
                  className={`h-full rounded-full absolute top-0 bottom-0 transition-all duration-300 ${
                    fairnessInfo.forcedMate
                      ? fairnessInfo.forcedMate > 0 
                        ? "bg-blue-500" // White mates
                        : "bg-black"    // Black mates
                      : fairnessInfo.evaluation >= 0 
                        ? "bg-blue-500" // White advantage 
                        : "bg-black"    // Black advantage
                  }`}
                  style={{
                    // If there's a forced mate, fill the bar completely for the winning side
                    width: fairnessInfo.forcedMate
                      ? "50%" // Fill half the bar (from center)
                      // Otherwise, scale evaluation: e.g., +/- 500 centipawns (5 pawns) covers half the bar
                      : `${Math.min(50, Math.abs(fairnessInfo.evaluation) / 10)}%`,
                    left: (fairnessInfo.forcedMate && fairnessInfo.forcedMate > 0) || fairnessInfo.evaluation >= 0 
                      ? '50%' : 'auto',
                    right: (fairnessInfo.forcedMate && fairnessInfo.forcedMate < 0) || fairnessInfo.evaluation < 0 
                      ? '50%' : 'auto',
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {fairnessInfo.forcedMate
                  ? t('analysis:mateEvaluationExplanation')
                  : t('analysis:evaluationExplanation')}
              </p>
            </div>
          )}

          {/* Win Chances Display (Show only if fairnessInfo exists) */}
          {fairnessInfo?.winChance && (
            <div>
              <div className="flex items-center justify-between">
                <span>{t('analysis:winChances')}:</span>
              </div>
              <div className="flex w-full h-6 mt-1 rounded-md overflow-hidden text-xs font-medium">
                <div
                  className="bg-white text-black flex items-center justify-center transition-all duration-300"
                  style={{ width: `${fairnessInfo.winChance?.white ?? 33}%` }}
                  title={`${t('chess:players.white')}: ${fairnessInfo.winChance?.white ?? 33}%`}
                >
                  {Math.round(fairnessInfo.winChance?.white ?? 33)}%
                </div>
                <div
                  className="bg-gray-400 text-black flex items-center justify-center transition-all duration-300"
                  style={{ width: `${fairnessInfo.winChance?.draw ?? 34}%` }}
                   title={`Draw: ${fairnessInfo.winChance?.draw ?? 34}%`}
               >
                  {Math.round(fairnessInfo.winChance?.draw ?? 34)}%
                </div>
                <div
                  className="bg-black text-white flex items-center justify-center transition-all duration-300"
                  style={{ width: `${fairnessInfo.winChance?.black ?? 33}%` }}
                   title={`${t('chess:players.black')}: ${fairnessInfo.winChance?.black ?? 33}%`}
               >
                  {Math.round(fairnessInfo.winChance?.black ?? 33)}%
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('analysis:winChanceExplanation')}</p>
            </div>
          )}

          {/* Badges (Show only if fairnessInfo exists) */}
          {fairnessInfo && (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={fairnessInfo.isLegal ? "default" : "destructive"}
              >
                {fairnessInfo.isLegal ? t('analysis:badges.legal') : t('analysis:badges.illegal')}
              </Badge>
              <Badge
                variant={fairnessInfo.isFair ? "outline" : "secondary"}
              >
                {fairnessInfo.isFair ? t('analysis:badges.fair') : t('analysis:badges.unbalanced')}
              </Badge>
              {fairnessInfo.forcedMate !== null && (
                <Badge variant="destructive">
                  {t('analysis:badges.forcedMate')} ({evaluationToString(0, fairnessInfo.forcedMate)})
                </Badge>
              )}
              {chess.isGameOver() && (
                <Badge variant="destructive">
                  {t('analysis:badges.gameOver')}
                </Badge>
              )}
              {chess.isDraw() && (
                <Badge variant="secondary">
                  {t('analysis:badges.draw')}
                </Badge>
              )}
            </div>
          )}

          {/* Description (Show only if fairnessInfo exists) */}
          {fairnessInfo && (
            <div>
              <h3 className="font-semibold">{t('analysis:status')}:</h3>
              <p className="text-sm text-gray-600">
                {typeof fairnessInfo.description === 'string' ? (
                  // Handle legacy string descriptions for backward compatibility
                  fairnessInfo.description
                ) : (
                  // Handle new format with translation key and parameters
                  fairnessInfo.description && 
                  typeof fairnessInfo.description === 'object' && 
                  'key' in fairnessInfo.description ? 
                  t(
                    fairnessInfo.description.key, 
                    fairnessInfo.description.params && typeof fairnessInfo.description.params === 'object' ? 
                    Object.fromEntries(
                      Object.entries(fairnessInfo.description.params)
                        .filter(([_, value]) => typeof value === 'string')
                        .map(([key, value]) => [key, t(value)])
                    ) : 
                    {}
                  ) : 
                  t('analysis:description.unknown')
                )}
              </p>
            </div>
          )}

          {/* FEN Display */}
          <div className="mt-2">
            <h3 className="font-semibold">{t('analysis:fen')}:</h3>
            <p className="text-xs text-gray-600 break-all font-mono">
              {fen ?? t('common:loading')}
            </p>
          </div>

          {/* Move History */}
          {moveHistory.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold">{t('analysis:moveHistory')}:</h3>
              <div className="grid grid-cols-2 text-sm gap-1 mt-1">
                {moveHistory.map((move, i) => (
                  <div key={i} className={i % 2 === 0 ? "font-medium" : ""}>
                    {i % 2 === 0 && `${Math.floor(i/2) + 1}.`} {move.san}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Show skeleton or loading state while fairnessInfo is null or fen is not ready
        <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div> {/* Turn skeleton */}
            <div className="h-4 bg-gray-200 rounded w-3/4"></div> {/* Eval text skeleton */}
            <div className="h-6 bg-gray-200 rounded w-full"></div> {/* Eval bar skeleton */}
            <div className="h-4 bg-gray-200 rounded w-1/2"></div> {/* Win chance text skeleton */}
            <div className="h-8 bg-gray-200 rounded w-full"></div> {/* Win chance bar skeleton */}
        </div>
      )}

      {/* Extra Stats Section */}
      <Separator className="my-2" />
      <div className="space-y-2 text-xs">
        <div><span className="font-semibold">{t('analysis:extraStats.castlingRights')}:</span> {getCastlingRights(chess)}</div>
        <div><span className="font-semibold">{t('analysis:extraStats.enPassantSquare')}:</span> {getEnPassantSquare(chess)}</div>
        {getGameEndReason(chess) && (
          <div><span className="font-semibold">{t('analysis:extraStats.gameEndReason')}:</span> {getGameEndReason(chess)}</div>
        )}
        <div><span className="font-semibold">{t('analysis:extraStats.allLegalMoves')}:</span> {getLegalMovesList(chess).join(', ')}</div>
        <div><span className="font-semibold">{t('analysis:extraStats.lastMove')}:</span> {getLastMove(moveHistory)}</div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.captures')}:</span> {getCaptureCount(moveHistory)} | 
          <span className="font-semibold"> {t('analysis:extraStats.checks')}:</span> {getCheckCount(moveHistory)} | 
          <span className="font-semibold"> {t('analysis:extraStats.promotions')}:</span> {getPromotionCount(moveHistory)}
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.pawnStructure')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {t('analysis:extraStats.doubled')} {getPawnStructure(chess).white.doubled}, {t('analysis:extraStats.isolated')} {getPawnStructure(chess).white.isolated}, {t('analysis:extraStats.passed')} {getPawnStructure(chess).white.passed}</span>
          <span className="ml-2">{t('chess:players.black')}: {t('analysis:extraStats.doubled')} {getPawnStructure(chess).black.doubled}, {t('analysis:extraStats.isolated')} {getPawnStructure(chess).black.isolated}, {t('analysis:extraStats.passed')} {getPawnStructure(chess).black.passed}</span>
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.developedPieces')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {getDevelopedPieces(chess).w}</span>
          <span className="ml-2">{t('chess:players.black')}: {getDevelopedPieces(chess).b}</span>
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.kingSafety')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {getKingSafety(chess).white}</span>
          <span className="ml-2">{t('chess:players.black')}: {getKingSafety(chess).black}</span>
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.centerControl')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {getCenterControl(chess).white}</span>
          <span className="ml-2">{t('chess:players.black')}: {getCenterControl(chess).black}</span>
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.piecesAttacked')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {getAttackedDefendedCounts(chess).attacked.w}</span>
          <span className="ml-2">{t('chess:players.black')}: {getAttackedDefendedCounts(chess).attacked.b}</span>
        </div>
        <div>
          <span className="font-semibold">{t('analysis:extraStats.piecesDefended')}:</span>
          <span className="ml-2">{t('chess:players.white')}: {getAttackedDefendedCounts(chess).defended.w}</span>
          <span className="ml-2">{t('chess:players.black')}: {getAttackedDefendedCounts(chess).defended.b}</span>
        </div>
      </div>
    </Card>
  );
}