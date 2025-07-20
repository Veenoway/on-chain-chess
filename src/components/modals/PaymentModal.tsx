import { GameInfo } from "@/types/betting";
import { PaymentStatus } from "@/types/chess";
import { formatEther } from "viem";

interface PaymentModalProps {
  isOpen: boolean;
  paymentStatus: PaymentStatus;
  gameInfo: GameInfo | null;
  betAmount: string;
  isWrongNetwork: boolean;
  isPending: boolean;
  isConfirming: boolean;
  canCancel: boolean;
  cancelState: { isLoading: boolean };
  onBetAndPlay: () => Promise<void>;
  onCancel: () => void;
  onSwitchNetwork: () => Promise<void>;
}

export function PaymentModal({
  isOpen,
  paymentStatus,
  gameInfo,
  betAmount,
  isWrongNetwork,
  isPending,
  isConfirming,
  canCancel,
  cancelState,
  onBetAndPlay,
  onCancel,
  onSwitchNetwork,
}: PaymentModalProps) {
  if (!isOpen) return null;

  const getBetAmount = () => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      return formatEther(gameInfo.betAmount);
    }
    return betAmount;
  };

  const getPotentialWinnings = () => {
    const amount = getBetAmount();
    return gameInfo?.betAmount
      ? formatEther(gameInfo.betAmount * BigInt(2))
      : (parseFloat(amount) * 2).toString();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-6">Payment Status</h3>

          {/* Betting Information */}
          <div className="mb-6">
            <div className="flex justify-between text-white text-base mb-2">
              <span className="text-gray-300">Bet amount:</span>
              <span className="font-bold text-white text-base">
                {getBetAmount()} MON
              </span>
            </div>
            <div className="flex justify-between text-base text-white mb-4">
              <span className="text-gray-300">Potential winnings:</span>
              <span className="font-bold text-green-400">
                {getPotentialWinnings()} MON
              </span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="rounded-lg mb-4">
            <div className="space-y-3">
              <PaymentStatusRow
                label="White Player (Creator):"
                address={gameInfo?.whitePlayer}
                paid={paymentStatus.whitePlayerPaid}
              />
              <PaymentStatusRow
                label="Black Player (Joiner):"
                address={gameInfo?.blackPlayer}
                paid={paymentStatus.blackPlayerPaid}
              />
            </div>
          </div>

          {/* Action Buttons */}
          {!paymentStatus.currentPlayerPaid ? (
            <button
              onClick={async () => {
                if (isWrongNetwork) {
                  await onSwitchNetwork();
                  return;
                }
                await onBetAndPlay();
              }}
              disabled={isPending || isConfirming}
              className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center"
            >
              {isPending || isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2.5" />
                  {isPending ? "Signing..." : "Confirming..."}
                </>
              ) : isWrongNetwork ? (
                "Switch to Monad & Pay"
              ) : (
                "Bet & Play"
              )}
            </button>
          ) : (
            canCancel && (
              <button
                onClick={onCancel}
                className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center"
                disabled={cancelState.isLoading}
              >
                {cancelState.isLoading
                  ? "Cancelling..."
                  : "Cancel & Get Refund"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

interface PaymentStatusRowProps {
  label: string;
  address?: string;
  paid: boolean;
}

function PaymentStatusRow({ label, address, paid }: PaymentStatusRowProps) {
  const formatAddress = (addr?: string) => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") {
      return "Waiting for player...";
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-[#252525] rounded-lg">
      <div className="flex flex-col items-start">
        <span className="text-white font-medium">{label}</span>
        <span className="text-gray-400 text-sm">{formatAddress(address)}</span>
      </div>
      <span
        className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-medium ${
          paid
            ? "bg-[#836EF9] text-white border border-white/10"
            : "bg-[#2c2c2c] text-white border border-white/10"
        }`}
      >
        {!paid && (
          <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
        )}
        {paid ? "READY" : "PENDING"}
      </span>
    </div>
  );
}
