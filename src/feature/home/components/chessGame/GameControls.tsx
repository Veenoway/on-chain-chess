"use client";
import { useMoveNavigation } from "@/hooks/useChessGame";
import { useChessStore } from "@/stores/chessStore";
import { useCanPlay } from "@/stores/paymentStore";

export default function GameControls() {
  const {
    isActive,
    gameResult,
    drawOffer,
    rematchOffer,
    players,
    currentPlayerId,
    gameNumber,
    offerDraw,
    respondDraw,
    resign,
    requestRematch,
    respondRematch,
  } = useChessStore();

  const canPlay = useCanPlay();
  const {
    currentMoveIndex,
    totalMoves,
    isAtStart,
    isAtEnd,
    goToFirst,
    goToLast,
    goNext,
    goPrevious,
  } = useMoveNavigation();

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isPlayerInGame = !!currentPlayer;

  return (
    <div className="space-y-3">
      <div className="p-3 bg-[#1E1E1E] border border-white/10 rounded">
        {isActive ? (
          // ========== ACTIVE GAME ==========
          <div className="space-y-3">
            {drawOffer.offered && drawOffer.by !== currentPlayer?.color ? (
              // Respond to draw offer
              <DrawOfferResponse
                onAccept={() => respondDraw(true)}
                onDecline={() => respondDraw(false)}
              />
            ) : (
              // Normal game controls
              <ActiveGameControls
                canOfferDraw={!drawOffer.offered && canPlay && isPlayerInGame}
                canResign={canPlay && isPlayerInGame}
                onOfferDraw={offerDraw}
                onResign={resign}
                drawOfferSent={drawOffer.offered}
              />
            )}

            <MoveNavigation
              currentMove={currentMoveIndex}
              totalMoves={totalMoves}
              isAtStart={isAtStart}
              isAtEnd={isAtEnd}
              onFirst={goToFirst}
              onPrevious={goPrevious}
              onNext={goNext}
              onLast={goToLast}
            />
          </div>
        ) : gameResult.type ? (
          // ========== GAME ENDED ==========
          <div className="space-y-3">
            <GameEndInfo gameResult={gameResult} gameNumber={gameNumber} />

            {rematchOffer.offered &&
            rematchOffer.by !== currentPlayer?.color ? (
              // Respond to rematch offer
              <RematchOfferResponse
                onAccept={() => respondRematch(true)}
                onDecline={() => respondRematch(false)}
              />
            ) : (
              // Request rematch
              <button
                onClick={requestRematch}
                disabled={rematchOffer.offered || !isPlayerInGame}
                className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
              >
                {rematchOffer.offered ? "Rematch offer sent" : "New game"}
              </button>
            )}

            <MoveNavigation
              currentMove={currentMoveIndex}
              totalMoves={totalMoves}
              isAtStart={isAtStart}
              isAtEnd={isAtEnd}
              onFirst={goToFirst}
              onPrevious={goPrevious}
              onNext={goNext}
              onLast={goToLast}
            />
          </div>
        ) : (
          // ========== WAITING FOR GAME ==========
          <div className="text-center py-2">
            <p className="text-[#a494fb]">
              {players.length >= 2
                ? "Starting game..."
                : "Waiting for second player"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface DrawOfferResponseProps {
  onAccept: () => void;
  onDecline: () => void;
}

function DrawOfferResponse({ onAccept, onDecline }: DrawOfferResponseProps) {
  return (
    <div>
      <p className="text-white text-sm text-center mb-3">
        Your opponent offers a draw
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAccept}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

interface ActiveGameControlsProps {
  canOfferDraw: boolean;
  canResign: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  drawOfferSent: boolean;
}

function ActiveGameControls({
  canOfferDraw,
  canResign,
  onOfferDraw,
  onResign,
  drawOfferSent,
}: ActiveGameControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onOfferDraw}
        disabled={!canOfferDraw}
        className="px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
      >
        {drawOfferSent ? "Draw offer sent" : "Offer draw"}
      </button>
      <button
        onClick={onResign}
        disabled={!canResign}
        className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#836EF9] text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Resign
      </button>
    </div>
  );
}

interface GameEndInfoProps {
  gameResult: {
    type: string | null;
    winner?: string;
    message?: string;
  };
  gameNumber: number;
}

function GameEndInfo({ gameResult, gameNumber }: GameEndInfoProps) {
  return (
    <div className="text-center mb-3">
      <p className="text-white font-semibold text-lg mb-1">
        {gameResult.message || "Game Over"}
      </p>
      <p className="text-gray-400 text-sm">Game #{gameNumber}</p>
    </div>
  );
}

interface RematchOfferResponseProps {
  onAccept: () => void;
  onDecline: () => void;
}

function RematchOfferResponse({
  onAccept,
  onDecline,
}: RematchOfferResponseProps) {
  return (
    <div>
      <p className="text-white text-sm text-center mb-2">
        Your opponent offers you a rematch
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAccept}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

interface MoveNavigationProps {
  currentMove: number;
  totalMoves: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}

function MoveNavigation({
  currentMove,
  totalMoves,
  isAtStart,
  isAtEnd,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: MoveNavigationProps) {
  return (
    <div className="pt-3 border-t border-white/10">
      <p className="text-gray-400 text-xs mb-2 text-center">
        Navigation: Move {currentMove}/{totalMoves}
      </p>
      <div className="grid grid-cols-4 gap-1">
        <button
          onClick={onFirst}
          disabled={isAtStart}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          title="First move"
        >
          ⏮
        </button>
        <button
          onClick={onPrevious}
          disabled={isAtStart}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          title="Previous move"
        >
          ◀
        </button>
        <button
          onClick={onNext}
          disabled={isAtEnd}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          title="Next move"
        >
          ▶
        </button>
        <button
          onClick={onLast}
          disabled={isAtEnd}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          title="Last move"
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
