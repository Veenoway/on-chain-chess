// components/ChessGame/GameEndModal.tsx
"use client";
import { useChessBetting, useGameIdByRoom } from "@/hooks/useChessBetting";
import { useChessStore } from "@/stores/chessStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { formatEther } from "viem";
import { useAccount } from "wagmi";

export default function GameEndModal() {
  const { address } = useAccount();
  const {
    gameResult,
    rematchOffer,
    players,
    currentPlayerId,
    roomName,
    setGameState,
    requestRematch,
    respondRematch,
  } = useChessStore();

  const { gameInfo, isPending, isConfirming } = usePaymentStore();
  const { claimWinnings, claimDrawRefund } = useChessBetting();
  const { gameId } = useGameIdByRoom(roomName);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isWinner = gameResult.winner === currentPlayer?.color;
  const isDraw = gameResult.winner === "draw";

  const handleCloseModal = () => {
    setGameState({
      showGameEndModal: false,
      hasClosedModal: true,
    });
  };

  const handleClaimWinnings = async () => {
    if (!gameId) return;

    try {
      await claimWinnings(gameId);
      alert("Claiming your winnings...");
    } catch (error) {
      console.error("Claim failed:", error);
      alert("Failed to claim winnings. Please try again.");
    }
  };

  const handleClaimDrawRefund = async () => {
    if (!gameId) return;

    try {
      await claimDrawRefund(gameId);
      alert("Claiming your draw refund...");
    } catch (error) {
      console.error("Claim failed:", error);
      alert("Failed to claim draw refund. Please try again.");
    }
  };

  const getResultImage = () => {
    if (isDraw) {
      return "/draw.png";
    }
    return isWinner ? "/win.png" : "/lost.png";
  };

  const getResultTitle = () => {
    if (isDraw) return "Draw";
    return isWinner ? "You Win!" : "You Lost";
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1E1E1E] border border-white/10 rounded-md p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Result Image */}
          <div className="rounded-lg mb-4 pt-4 flex flex-col justify-center">
            <img
              src={getResultImage()}
              alt="game result"
              className="w-2/3 mx-auto"
            />
            <h3 className="text-white font-bold text-2xl mb-2 mt-6">
              {getResultTitle()}
            </h3>
            <p className="text-gray-400 mb-4">
              {gameResult.message || "Game Over"}
            </p>
          </div>

          <div className="space-y-4">
            {/* Rematch Offer Response */}
            {rematchOffer.offered &&
            rematchOffer.by !== currentPlayer?.color ? (
              <div className="text-center space-y-4">
                <p className="text-white/80 font-light text-lg text-center">
                  Your opponent offers you a rematch. <br />
                  Do you accept?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => respondRematch(true)}
                    className="col-span-1 px-8 py-3 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded font-bold text-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondRematch(false)}
                    className="col-span-1 px-8 py-3 bg-[#252525] hover:bg-[#353535] border border-[#836EF9] text-white rounded font-bold text-lg transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                {/* Claim Buttons */}
                {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
                  <div className="space-y-3 mb-4">
                    {/* Claim winnings if player won */}
                    {!isDraw && isWinner && (
                      <button
                        onClick={handleClaimWinnings}
                        disabled={isPending || isConfirming}
                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-bold text-lg transition-colors"
                      >
                        {isPending || isConfirming
                          ? "Processing..."
                          : `🏆 Claim Winnings (${formatEther(
                              gameInfo.betAmount * BigInt(2)
                            )} MON)`}
                      </button>
                    )}

                    {/* Claim draw refund if draw */}
                    {isDraw && (
                      <button
                        onClick={handleClaimDrawRefund}
                        disabled={isPending || isConfirming}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-bold text-lg transition-colors"
                      >
                        {isPending || isConfirming
                          ? "Processing..."
                          : `🤝 Claim Draw Refund (${formatEther(
                              gameInfo.betAmount
                            )} MON)`}
                      </button>
                    )}
                  </div>
                )}

                {/* Rematch Request */}
                <button
                  onClick={requestRematch}
                  disabled={rematchOffer.offered}
                  className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded font-bold text-lg transition-colors"
                >
                  {rematchOffer.offered ? "Rematch offer sent" : "New game"}
                </button>

                {/* Continue Analysis */}
                <button
                  onClick={handleCloseModal}
                  className="w-full px-6 py-4 bg-[#404040] hover:bg-[#4a4a4a] text-white rounded font-bold text-lg transition-colors"
                >
                  Continue analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
