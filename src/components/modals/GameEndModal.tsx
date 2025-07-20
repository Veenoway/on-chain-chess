import { GameInfo } from "@/types/betting";
import { GameState, RematchInvitation } from "@/types/chess";
import { formatEther } from "viem";

interface GameEndModalProps {
  isOpen: boolean;
  gameState: GameState;
  gameInfo: GameInfo | null;
  currentPlayerId: string | null;
  address: string | null;
  rematchInvitation: RematchInvitation | null;
  canCurrentPlayerClaim: () => boolean;
  canOfferRematch: () => boolean;
  shouldDisableNavigationButtons: () => boolean;
  getAvailableAmount: () => string;
  isFinalizingGame: boolean;
  claimState: {
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
  };
  isPending: boolean;
  isConfirming: boolean;
  onClaimWinnings: () => Promise<void>;
  onClaimDrawRefund: () => Promise<void>;
  onNewGame: () => void;
  onClose: () => void;
  onRematchResponse: (accepted: boolean) => void;
  onAcceptRematchInvitation: () => void;
  onDeclineRematchInvitation: () => void;
}

export function GameEndModal({
  isOpen,
  gameState,
  gameInfo,
  currentPlayerId,
  address,
  rematchInvitation,
  canCurrentPlayerClaim,
  canOfferRematch,
  shouldDisableNavigationButtons,
  getAvailableAmount,
  isFinalizingGame,
  claimState,
  isPending,
  isConfirming,
  onClaimWinnings,
  onClaimDrawRefund,
  onNewGame,
  onClose,
  onRematchResponse,
  onAcceptRematchInvitation,
  onDeclineRematchInvitation,
}: GameEndModalProps) {
  if (!isOpen) return null;

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
  const isDraw = gameState.gameResult.winner === "draw";

  const getGameResultText = () => {
    if (isDraw) return "Draw";

    // const opponentPlayer = gameState.players.find(
    //   (p) => p.id !== currentPlayerId
    // );
    const didCurrentPlayerWin =
      gameState.gameResult.winner === currentPlayer?.color;

    return didCurrentPlayerWin ? "You Won" : "You Lost";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Game Result */}
          <div className="rounded-lg flex flex-col justify-center mb-6">
            <p className="text-white font-bold text-4xl mb-2">
              {getGameResultText()}
            </p>
            {gameState.gameResult.message && (
              <p className="text-gray-400 text-sm">
                {gameState.gameResult.message}
              </p>
            )}
          </div>

          {/* Prize Pool Status (if betting enabled) */}
          {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
            <PrizePoolStatus
              gameInfo={gameInfo}
              isFinalizingGame={isFinalizingGame}
            />
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {gameState.rematchOffer?.offered &&
            gameState.rematchOffer?.by !== currentPlayer?.color ? (
              <RematchOfferResponse onResponse={onRematchResponse} />
            ) : rematchInvitation && rematchInvitation.from !== address ? (
              <RematchInvitationResponse
                onAccept={onAcceptRematchInvitation}
                onDecline={onDeclineRematchInvitation}
              />
            ) : (
              <MainActionButtons
                gameState={gameState}
                gameInfo={gameInfo}
                canCurrentPlayerClaim={canCurrentPlayerClaim}
                canOfferRematch={canOfferRematch} // AJOUTÉ: Passer la fonction en props
                shouldDisableNavigationButtons={shouldDisableNavigationButtons}
                getAvailableAmount={getAvailableAmount}
                claimState={claimState}
                isPending={isPending}
                isConfirming={isConfirming}
                onClaimWinnings={onClaimWinnings}
                onClaimDrawRefund={onClaimDrawRefund}
                onNewGame={onNewGame}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PrizePoolStatusProps {
  gameInfo: GameInfo;
  isFinalizingGame: boolean;
}

function PrizePoolStatus({ gameInfo, isFinalizingGame }: PrizePoolStatusProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-semibold">Prize Pool Status</h4>
        <span className="text-green-400 font-bold">
          {formatEther(gameInfo.betAmount * BigInt(2))} MON
        </span>
      </div>

      <div className="space-y-2">
        <PlayerClaimStatus
          label="White Player"
          address={gameInfo.whitePlayer}
          claimed={gameInfo.whiteClaimed}
          canClaim={gameInfo.result === 3 || gameInfo.result === 1}
          isWinner={gameInfo.result === 1}
          isFinalizingGame={isFinalizingGame}
        />
        <PlayerClaimStatus
          label="Black Player"
          address={gameInfo.blackPlayer}
          claimed={gameInfo.blackClaimed}
          canClaim={gameInfo.result === 3 || gameInfo.result === 2}
          isWinner={gameInfo.result === 2}
          isFinalizingGame={isFinalizingGame}
        />
      </div>
    </div>
  );
}

interface PlayerClaimStatusProps {
  label: string;
  address: string;
  claimed: boolean;
  canClaim: boolean;
  isWinner: boolean;
  isFinalizingGame: boolean;
}

function PlayerClaimStatus({
  label,
  address,
  claimed,
  canClaim,
  isWinner,
  isFinalizingGame,
}: PlayerClaimStatusProps) {
  const getStatusText = () => {
    if (claimed) return "Claimed";
    if (canClaim) {
      if (isWinner) return "Winner - can claim";
      return "Can claim"; // Draw case
    }
    return "Lost - no claim";
  };

  const getStatusColor = () => {
    if (claimed) return "bg-[#836EF9] text-white";
    if (canClaim) return "bg-yellow-500/20 text-yellow-400";
    return "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            label.includes("White")
              ? "bg-white"
              : "bg-black border border-white"
          }`}
        ></div>
        <span className="text-white text-sm">
          {label}: {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
      <span
        className={`px-2 py-1 rounded-lg text-xs flex items-center justify-center gap-2 font-medium ${getStatusColor()}`}
      >
        {isFinalizingGame && (
          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-yellow-400" />
        )}
        {getStatusText()}
      </span>
    </div>
  );
}

interface RematchOfferResponseProps {
  onResponse: (accepted: boolean) => void;
}

function RematchOfferResponse({ onResponse }: RematchOfferResponseProps) {
  return (
    <div className="text-center space-y-4">
      <p className="text-white/80 font-light text-base text-center">
        Your opponent offers you a rematch
      </p>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onResponse(true)}
          className="col-span-1 px-8 py-2 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-bold text-lg transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onResponse(false)}
          className="col-span-1 px-8 py-2 bg-[#252525] hover:bg-[#252525] border border-[#836EF9] text-white rounded-lg font-bold text-lg transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

interface RematchInvitationResponseProps {
  onAccept: () => void;
  onDecline: () => void;
}

function RematchInvitationResponse({
  onAccept,
  onDecline,
}: RematchInvitationResponseProps) {
  return (
    <div className="space-y-3 mb-3">
      <p className="text-center text-base text-white">
        Your opponent offers you a rematch. <br />
        Do you want to accept?
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAccept}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-base transition-colors"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-base transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

interface MainActionButtonsProps {
  gameState: GameState;
  gameInfo: GameInfo | null;
  canCurrentPlayerClaim: () => boolean;
  canOfferRematch: () => boolean; // AJOUTÉ: Définir le prop manquant
  shouldDisableNavigationButtons: () => boolean;
  getAvailableAmount: () => string;
  claimState: {
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
  };
  isPending: boolean;
  isConfirming: boolean;
  onClaimWinnings: () => Promise<void>;
  onClaimDrawRefund: () => Promise<void>;
  onNewGame: () => void;
  onClose: () => void;
}

function MainActionButtons({
  gameState,
  gameInfo,
  canCurrentPlayerClaim,
  canOfferRematch, // AJOUTÉ: Recevoir la fonction en paramètre
  shouldDisableNavigationButtons,
  getAvailableAmount,
  claimState,
  isPending,
  isConfirming,
  onClaimWinnings,
  onClaimDrawRefund,
  onNewGame,
  onClose,
}: MainActionButtonsProps) {
  const isDraw = gameState.gameResult.winner === "draw";

  return (
    <div className="text-center space-y-3">
      {/* Claim Buttons */}
      <div className="space-y-3">
        {/* Claim winnings for win/loss */}
        {!isDraw && (
          <button
            onClick={onClaimWinnings}
            disabled={
              !canCurrentPlayerClaim() ||
              claimState.isLoading ||
              isPending ||
              isConfirming ||
              ((gameInfo &&
                gameInfo.state === 2 &&
                claimState.isSuccess) as boolean)
            }
            className={`w-full px-6 py-4 ${
              claimState.isSuccess
                ? "bg-[#252525] border border-[#836EF9] text-[#836EF9]"
                : claimState.isError
                ? "bg-[#252525] border border-[#eb3f3f] text-[#eb3f3f]"
                : gameInfo && gameInfo.state !== 2
                ? "bg-[#252525] border border-white/5 text-white"
                : "bg-[#836EF9] hover:bg-[#836EF9]/80"
            } disabled:bg-[#252525] text-white rounded-lg border border-white/5 font-bold text-lg transition-colors`}
          >
            {!canCurrentPlayerClaim() ? (
              "No winnings to claim"
            ) : gameInfo && gameInfo.state !== 2 ? (
              <div className="flex items-center justify-center gap-2">
                Waiting for game finalization...
              </div>
            ) : isPending || isConfirming || claimState.isLoading ? (
              "Confirming transaction..."
            ) : claimState.isError ? (
              "Try again"
            ) : claimState.isSuccess ? (
              "Successfully claimed"
            ) : (
              `Claim ${
                gameInfo?.betAmount
                  ? formatEther(gameInfo.betAmount * BigInt(2))
                  : "0"
              } MON`
            )}
          </button>
        )}

        {/* Claim draw refund */}
        {isDraw && (
          <button
            onClick={onClaimDrawRefund}
            disabled={
              !canCurrentPlayerClaim() ||
              getAvailableAmount() <= "0" ||
              isPending ||
              isConfirming ||
              ((gameInfo &&
                gameInfo.state === 2 &&
                claimState.isSuccess) as boolean)
            }
            className={`w-full px-6 py-4 ${
              gameInfo && gameInfo.state !== 2
                ? "bg-[#252525] border border-white/5 text-white"
                : "bg-[#836EF9] hover:bg-[#937EF9]"
            } disabled:bg-[#252525] text-white rounded-lg font-bold text-base transition-colors`}
          >
            {!canCurrentPlayerClaim() ? (
              "No refund available"
            ) : getAvailableAmount() <= "0" ? (
              "Already claimed"
            ) : gameInfo && gameInfo.state !== 2 ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
                Waiting for game finalization...
              </div>
            ) : isPending || isConfirming ? (
              "Confirming..."
            ) : (
              "Claim Refund"
            )}
          </button>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onNewGame}
          disabled={
            gameState.rematchOffer?.offered || shouldDisableNavigationButtons()
          }
          className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-bold text-base transition-colors"
        >
          {shouldDisableNavigationButtons()
            ? gameInfo && gameInfo.state !== 2
              ? "Finalizing..."
              : gameInfo?.betAmount &&
                gameInfo.betAmount > BigInt(0) &&
                canOfferRematch() // MAINTENANT ça fonctionne car la fonction est passée en props
              ? "Rematch"
              : "New game"
            : gameState.rematchOffer?.offered
            ? "Waiting for opponent"
            : gameInfo?.betAmount &&
              gameInfo.betAmount > BigInt(0) &&
              canOfferRematch() // MAINTENANT ça fonctionne car la fonction est passée en props
            ? "Rematch"
            : "New game"}
        </button>

        <button
          onClick={onClose}
          disabled={shouldDisableNavigationButtons()}
          className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-bold text-base transition-colors"
        >
          {shouldDisableNavigationButtons()
            ? gameInfo && gameInfo.state !== 2
              ? "Finalizing..."
              : "Analysis"
            : "Analysis"}
        </button>
      </div>
    </div>
  );
}
