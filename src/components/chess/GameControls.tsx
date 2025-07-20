import { GameInfo } from "@/types/betting";
import { GameState } from "@/types/chess";

interface GameControlsProps {
  gameState: GameState;
  gameInfo: GameInfo | null;
  playerColor: "white" | "black";
  address: string | null;
  currentPlayerId: string | null;
  moveHistory: string[];
  currentMoveIndex: number;
  onOfferDraw: () => void;
  onRespondDraw: (accepted: boolean) => void;
  onResign: () => void;
  onRematchResponse: (accepted: boolean) => void;
  onNewGame: () => void;
  onNavigateToMove: (direction: "first" | "prev" | "next" | "last") => void;
}

export function GameControls({
  gameState,
  gameInfo,
  playerColor,
  address,
  currentPlayerId,
  moveHistory,
  currentMoveIndex,
  onOfferDraw,
  onRespondDraw,
  onResign,
  onRematchResponse,
  onNewGame,
  onNavigateToMove,
}: GameControlsProps) {
  const canPlayerAct = () => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return true; // No betting, anyone can act
    }

    // With betting, only players who have paid can act
    const isWhitePlayer =
      gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase();
    const isBlackPlayer =
      gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase();

    return (
      (playerColor === "white" && isWhitePlayer) ||
      (playerColor === "black" && isBlackPlayer)
    );
  };

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-[#1E1E1E] border border-white/5 rounded-lg">
        {gameState.isActive ? (
          <ActiveGameControls
            gameState={gameState}
            currentPlayer={currentPlayer}
            canPlayerAct={canPlayerAct()}
            onOfferDraw={onOfferDraw}
            onRespondDraw={onRespondDraw}
            onResign={onResign}
          />
        ) : gameState.gameResult.type ? (
          <FinishedGameControls
            gameState={gameState}
            currentPlayer={currentPlayer}
            onRematchResponse={onRematchResponse}
            onNewGame={onNewGame}
          />
        ) : (
          <WaitingGameControls gameState={gameState} />
        )}

        <MoveNavigation
          moveHistory={moveHistory}
          currentMoveIndex={currentMoveIndex}
          onNavigateToMove={onNavigateToMove}
        />
      </div>
    </div>
  );
}

interface ActiveGameControlsProps {
  gameState: GameState;
  currentPlayer: any;
  canPlayerAct: boolean;
  onOfferDraw: () => void;
  onRespondDraw: (accepted: boolean) => void;
  onResign: () => void;
}

function ActiveGameControls({
  gameState,
  currentPlayer,
  canPlayerAct,
  onOfferDraw,
  onRespondDraw,
  onResign,
}: ActiveGameControlsProps) {
  // Check if opponent offered draw
  const opponentOfferedDraw =
    gameState.drawOffer.offered &&
    gameState.drawOffer.by !== currentPlayer?.color;

  if (opponentOfferedDraw) {
    return (
      <div className="space-y-3">
        <p className="text-white text-sm text-center mb-3">
          Your opponent offers a draw
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onRespondDraw(true)}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-base transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onRespondDraw(false)}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOfferDraw}
          disabled={gameState.drawOffer.offered || !canPlayerAct}
          className="px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
        >
          {gameState.drawOffer.offered ? "Draw offer sent" : "Offer draw"}
        </button>
        <button
          onClick={onResign}
          disabled={!canPlayerAct}
          className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#836EF9] text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Resign
        </button>
      </div>
    </div>
  );
}

interface FinishedGameControlsProps {
  gameState: GameState;
  currentPlayer: any;
  onRematchResponse: (accepted: boolean) => void;
  onNewGame: () => void;
}

function FinishedGameControls({
  gameState,
  currentPlayer,
  onRematchResponse,
  onNewGame,
}: FinishedGameControlsProps) {
  const opponentOfferedRematch =
    gameState.rematchOffer?.offered &&
    gameState.rematchOffer?.by !== currentPlayer?.color;

  return (
    <div className="space-y-3">
      <div className="text-center mb-3">
        <p className="text-white font-semibold text-lg mb-1">
          {gameState.gameResult.message || "Game Over"}
        </p>
        <p className="text-gray-400 text-sm">Game #{gameState.gameNumber}</p>
      </div>

      {opponentOfferedRematch ? (
        <div>
          <p className="text-white text-sm text-center mb-2">
            Your opponent offers you a rematch
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRematchResponse(true)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onRematchResponse(false)}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={onNewGame}
            disabled={gameState.rematchOffer?.offered}
            className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            {gameState.rematchOffer?.offered
              ? "Waiting for opponent"
              : "New game"}
          </button>
        </div>
      )}
    </div>
  );
}

interface WaitingGameControlsProps {
  gameState: GameState;
}

function WaitingGameControls({ gameState }: WaitingGameControlsProps) {
  return (
    <div className="text-center py-2">
      <p className="text-[#a494fb]">
        {gameState.players.length >= 2
          ? "Starting game..."
          : "Waiting for second player"}
      </p>
    </div>
  );
}

interface MoveNavigationProps {
  moveHistory: string[];
  currentMoveIndex: number;
  onNavigateToMove: (direction: "first" | "prev" | "next" | "last") => void;
}

function MoveNavigation({
  moveHistory,
  currentMoveIndex,
  onNavigateToMove,
}: MoveNavigationProps) {
  return (
    <div className="pt-3 border-t border-white/10">
      <p className="text-gray-400 text-xs mb-2 text-center">
        Navigation: Move {currentMoveIndex}/{moveHistory.length - 1}
      </p>
      <div className="grid grid-cols-4 gap-1">
        <button
          onClick={() => onNavigateToMove("first")}
          disabled={currentMoveIndex === 0}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
        >
          ⏮
        </button>
        <button
          onClick={() => onNavigateToMove("prev")}
          disabled={currentMoveIndex === 0}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
        >
          ◀
        </button>
        <button
          onClick={() => onNavigateToMove("next")}
          disabled={currentMoveIndex === moveHistory.length - 1}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
        >
          ▶
        </button>
        <button
          onClick={() => onNavigateToMove("last")}
          disabled={currentMoveIndex === moveHistory.length - 1}
          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
