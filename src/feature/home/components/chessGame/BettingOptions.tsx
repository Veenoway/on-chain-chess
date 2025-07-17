import { useChessStore } from "@/stores/chessStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { useAccount } from "wagmi";

export default function BettingOptions() {
  const { isConnected } = useAccount();
  const { isBettingEnabled, betAmount, setGameState } = useChessStore();

  const { balanceFormatted, isPending, isConfirming, isConfirmed } =
    usePaymentStore();

  return (
    <div className="bg-[#252525] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">💰 Betting Options</h3>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isBettingEnabled}
            onChange={(e) =>
              setGameState({ isBettingEnabled: e.target.checked })
            }
            disabled={!isConnected}
            className="sr-only"
          />
          <div
            className={`w-12 h-6 rounded-full transition-colors ${
              isBettingEnabled && isConnected ? "bg-[#836EF9]" : "bg-gray-600"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
                isBettingEnabled && isConnected
                  ? "translate-x-6 ml-1"
                  : "translate-x-0 ml-0.5"
              }`}
            ></div>
          </div>
          <span className="ml-3 text-white">Enable betting</span>
        </label>
      </div>

      {isBettingEnabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Bet Amount (MON)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={betAmount}
              onChange={(e) => setGameState({ betAmount: e.target.value })}
              disabled={!isConnected}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-white/10 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent disabled:opacity-50"
            />
          </div>

          {isConnected && (
            <div className="text-sm text-gray-400">
              Balance: {balanceFormatted} MON
              {(isPending || isConfirming) && (
                <span className="ml-2 text-yellow-400">
                  {isPending ? "Signing..." : "Confirming..."}
                </span>
              )}
              {isConfirmed && (
                <span className="ml-2 text-green-400">✓ Confirmed</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
