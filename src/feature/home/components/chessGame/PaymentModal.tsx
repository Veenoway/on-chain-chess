// components/ChessGame/PaymentModal.tsx
"use client";
import { useChessBetting } from "@/hooks/useChessBetting";
import { useChessStore } from "@/stores/chessStore";
import {
  useHasBettingRequirement,
  usePaymentStore,
} from "@/stores/paymentStore";
import { useEffect } from "react";
import { formatEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";

export default function PaymentModal() {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const { addToast } = useToast();

  const {
    gameInfo,
    whitePlayerPaid,
    blackPlayerPaid,
    currentPlayerPaid,
    isPending,
    isConfirming,
    isConfirmed,
    isWrongNetwork,
  } = usePaymentStore();

  const { roomName, players, currentPlayerId } = useChessStore();
  const { joinBettingGameByRoom, balanceFormatted } = useChessBetting();
  const hasBettingRequirement = useHasBettingRequirement();

  // Don't show modal if no betting requirement
  if (
    !hasBettingRequirement ||
    !gameInfo?.betAmount ||
    gameInfo.betAmount <= BigInt(0)
  ) {
    return null;
  }

  // Don't show modal if current player has already paid
  if (currentPlayerPaid) {
    return null;
  }

  // Show success toast when payment is confirmed
  useEffect(() => {
    if (isConfirmed) {
      addToast({
        type: "success",
        message: "Payment confirmed! You can now play.",
        duration: 5000,
      });
    }
  }, [isConfirmed, addToast]);

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: 10143 });
      addToast({
        type: "success",
        message: "Successfully switched to Monad Testnet",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to switch network:", error);
      addToast({
        type: "error",
        message:
          "Failed to switch network. Please switch manually in your wallet.",
        duration: 5000,
      });
    }
  };

  const handlePayment = async () => {
    if (isWrongNetwork) {
      await handleSwitchNetwork();
      return;
    }

    if (!roomName) {
      addToast({
        type: "error",
        message: "Missing room information. Please try again.",
        duration: 3000,
      });
      return;
    }

    try {
      await joinBettingGameByRoom(roomName);
      addToast({
        type: "success",
        message: "Payment transaction sent! Waiting for confirmation...",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("❌ Payment failed:", error);

      const errorMessage = error?.message?.includes("insufficient funds")
        ? "Insufficient funds for this transaction"
        : error?.message?.includes("rejected")
        ? "Transaction was rejected"
        : "Payment failed. Please try again.";

      addToast({
        type: "error",
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const playerColor = currentPlayer?.color;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/90 backdrop-blur-sm">
      <div className="bg-[#1E1E1E] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-[#836EF9]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-2">
              Payment Required
            </h3>
            <p className="text-gray-400">
              This is a betting game. Both players must pay to participate.
            </p>
          </div>

          <div className="bg-[#252525] rounded-lg p-6 mb-6">
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-1">Bet Amount</p>
              <p className="text-white text-2xl font-bold">
                <span className="text-[#836EF9]">
                  {formatEther(gameInfo.betAmount)} MON
                </span>
              </p>
            </div>

            <PaymentStatus
              whitePlayerPaid={whitePlayerPaid}
              blackPlayerPaid={blackPlayerPaid}
              currentPlayerColor={playerColor}
            />

            {/* User balance */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Your balance:</span>
                <span className="text-white font-medium">
                  {balanceFormatted} MON
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isWrongNetwork ? (
              <NetworkError chainId={chainId} onSwitch={handleSwitchNetwork} />
            ) : (
              <div className="space-y-3">
                <p className="text-white/80 text-center">
                  You must pay the betting amount to play this game.
                </p>

                {/* Payment status indicator */}
                {(isPending || isConfirming) && (
                  <div className="bg-blue-500/20 border border-blue-400 rounded-lg p-3">
                    <div className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-blue-300 text-sm">
                        {isPending
                          ? "Please confirm in your wallet..."
                          : "Confirming transaction..."}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handlePayment}
                  disabled={isPending || isConfirming}
                  loading={isPending || isConfirming}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {isPending
                    ? "Signing..."
                    : isConfirming
                    ? "Confirming..."
                    : "Pay to Play"}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Winner takes all • Draw = refund for both players
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PaymentStatusProps {
  whitePlayerPaid: boolean;
  blackPlayerPaid: boolean;
  currentPlayerColor?: "white" | "black";
}

function PaymentStatus({
  whitePlayerPaid,
  blackPlayerPaid,
  currentPlayerColor,
}: PaymentStatusProps) {
  return (
    <div className="space-y-3">
      <PaymentStatusRow
        label="White Player"
        paid={whitePlayerPaid}
        isCurrentPlayer={currentPlayerColor === "white"}
      />
      <PaymentStatusRow
        label="Black Player"
        paid={blackPlayerPaid}
        isCurrentPlayer={currentPlayerColor === "black"}
      />
    </div>
  );
}

interface PaymentStatusRowProps {
  label: string;
  paid: boolean;
  isCurrentPlayer: boolean;
}

function PaymentStatusRow({
  label,
  paid,
  isCurrentPlayer,
}: PaymentStatusRowProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
      <span className="text-white text-sm">
        {label} {isCurrentPlayer && "(You)"}
      </span>
      <PaymentStatusBadge paid={paid} />
    </div>
  );
}

function PaymentStatusBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        paid
          ? "bg-green-500/20 text-green-300 border border-green-500/30"
          : "bg-red-500/20 text-red-300 border border-red-500/30"
      }`}
    >
      {paid ? "✅ PAID" : "❌ PENDING"}
    </span>
  );
}

interface NetworkErrorProps {
  chainId?: number;
  onSwitch: () => void;
}

function NetworkError({ chainId, onSwitch }: NetworkErrorProps) {
  return (
    <div className="bg-red-500/20 border border-red-400 rounded-lg p-4">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
          <span className="text-red-400 text-xl">⚠️</span>
        </div>
        <div>
          <h4 className="text-red-300 font-bold text-lg mb-2">Wrong Network</h4>
          <p className="text-red-200 text-sm mb-2">
            Please switch to <strong>Monad Testnet</strong> to make payments
          </p>
          <p className="text-red-300 text-xs">
            Required: Chain ID 10143 • Current: {chainId}
          </p>
        </div>
        <Button
          onClick={onSwitch}
          variant="danger"
          size="md"
          className="w-full"
        >
          🔄 Switch to Monad Testnet
        </Button>
      </div>
    </div>
  );
}
function useToast(): { addToast: any } {
  throw new Error("Function not implemented.");
}
