import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMatchmaking } from "@/hooks/chess/useMatchmaking";
import { MatchFound, MatchmakingCriteria } from "@/types/matchmaking";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface MatchmakingScreenProps {
  onMatchFound: (match: MatchFound) => void;
  onCancel: () => void;
}

export function MatchmakingScreen({
  onMatchFound,
  onCancel,
}: MatchmakingScreenProps) {
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [betAmount, setBetAmount] = useState("1");
  const [isBettingEnabled, setIsBettingEnabled] = useState(false);

  const { address } = useAccount();

  const {
    status,
    queueStatus,
    matchFound,
    error,
    globalStats,
    joinQueue,
    leaveQueue,
    acceptMatch,
    isSearching,
    isInQueue,
    hasMatchFound,
  } = useMatchmaking();

  const handleStartSearch = async () => {
    const criteria: MatchmakingCriteria = {
      gameTime: selectedGameTime,
      betAmount: isBettingEnabled ? betAmount : "0",
      preferredColor: "random",
    };

    await joinQueue(criteria);
  };

  useEffect(() => {
    if (hasMatchFound && matchFound) {
      setTimeout(() => {
        const match = acceptMatch();
        if (match) {
          onMatchFound(match);
        }
      }, 2000);
    }
  }, [hasMatchFound, matchFound, acceptMatch, onMatchFound]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] pt-[50px] sm:pt-[100px] lg:pt-[200px] flex justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-5">
          <h1 className="text-4xl uppercase md:leading-[80px] md:text-6xl font-bold text-white mb-3">
            Matchmaking
          </h1>
          <p className="text-white/80 text-sm md:text-lg mb-4 md:max-w-[90%] mx-auto">
            Find a match, bet and win crypto while playing chess.
          </p>

          <div
            className={`mt-8 border rounded-lg p-3 w-full flex justify-center ${
              globalStats.queueCapacity.isFull
                ? "bg-red-500/20 border-red-500/30"
                : "bg-[#1E1E1E] border-white/5"
            }`}
          >
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    globalStats.queueCapacity.isFull
                      ? "bg-red-500"
                      : "bg-green-500"
                  }`}
                ></div>
                <span className="text-gray-300 text-sm md:text-base">
                  {globalStats.queueCapacity.current}/
                  {globalStats.queueCapacity.max} players
                </span>
              </div>
              {!globalStats.queueCapacity.isFull && (
                <>
                  <div className="text-gray-500 text-sm md:text-base">•</div>
                  <div className="text-gray-300 text-sm md:text-base">
                    Wait time: ~{" "}
                    {Math.floor(globalStats.estimatedWaitTime / 60)}min
                  </div>
                </>
              )}
              {globalStats.queueCapacity.isFull && (
                <>
                  <div className="text-gray-500 text-sm md:text-base">•</div>
                  <div className="text-red-400 text-sm md:text-base">
                    Queue full
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* hasMatchFound && matchFound */}
        {hasMatchFound && matchFound ? (
          <div className="bg-[#1E1E1E] border border-white/5 rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-[#836EF9] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Match found !
              </h2>
              <p className="text-white/80 font-light">
                Automatic connection in 2 seconds...
              </p>
            </div>

            <div className="bg-[#252525] border border-white/5 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2 text-sm md:text-base">
                <span className="text-white/80 font-light">Game time:</span>
                <span className="text-white">
                  {formatTime(matchFound?.gameTime || 0)}
                </span>
              </div>
              {parseFloat(matchFound?.betAmount || "0") > 0 && (
                <div className="flex justify-between items-center mb-2 text-sm md:text-base">
                  <span className="text-white/80 font-light">Bet:</span>
                  <span className="text-white">
                    {matchFound?.betAmount} MON
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm md:text-base">
                <span className="text-white/80 font-light">Your color:</span>
                <span className="text-white">
                  {matchFound?.whitePlayer.address
                    .toLowerCase()
                    .includes(address?.toLowerCase() || "")
                    ? "White"
                    : "Black"}
                </span>
              </div>
            </div>

            <div className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] text-white font-medium py-4 px-6 rounded-lg text-lg text-center">
              Connecting...
            </div>
          </div>
        ) : isSearching || isInQueue ? (
          <div className="bg-[#1E1E1E] border border-white/5 rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg
                  className="w-16 h-16 text-white animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Searching for a match...
              </h2>
            </div>

            <div className="bg-[#252525] rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/80 font-light">
                  Position in queue:
                </span>
                <span className="text-white">
                  {queueStatus?.queuePosition ? queueStatus.queuePosition : 1}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/80 font-light">
                  Players in queue:
                </span>
                <span className="text-white">
                  {queueStatus?.totalInQueue || 0}
                </span>
              </div>
              {queueStatus?.estimatedWaitTime && (
                <div className="flex justify-between items-center">
                  <span className="text-white/80 font-light">
                    Estimated wait time:
                  </span>
                  <span className="text-white">
                    {formatWaitTime(queueStatus?.estimatedWaitTime || 0)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={leaveQueue}
              className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] text-white font-medium py-4 px-6 rounded-lg text-lg transition-all"
            >
              Cancel search
            </button>
          </div>
        ) : (
          <div className="bg-[#1E1E1E] border border-white/5 rounded-lg p-8">
            <div className="">
              <div>
                <label className="block text-lg md:text-xl font-medium text-white mb-3">
                  Game time
                </label>
                <Select
                  value={selectedGameTime.toString()}
                  onValueChange={(value) =>
                    setSelectedGameTime(parseInt(value))
                  }
                >
                  <SelectTrigger className="w-full p-4 bg-[#252525] h-12 border border-white/5 text-white rounded-lg text-lg mb-6">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#252525] border border-white/10">
                    <SelectItem
                      value="180"
                      className="text-white hover:bg-white/10 h-10 text-sm md:text-base"
                    >
                      3 minutes
                    </SelectItem>
                    <SelectItem
                      value="300"
                      className="text-white hover:bg-white/10 h-10 text-sm md:text-base"
                    >
                      5 minutes
                    </SelectItem>
                    <SelectItem
                      value="600"
                      className="text-white hover:bg-white/10 h-10 text-sm md:text-base"
                    >
                      10 minutes
                    </SelectItem>
                    <SelectItem
                      value="900"
                      className="text-white hover:bg-white/10 h-10 text-sm md:text-base"
                    >
                      15 minutes
                    </SelectItem>
                    <SelectItem
                      value="1800"
                      className="text-white hover:bg-white/10 h-10 text-sm md:text-base"
                    >
                      30 minutes
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-lg md:text-xl font-medium text-white">
                    Betting enabled
                  </label>
                  <button
                    onClick={() => setIsBettingEnabled(!isBettingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isBettingEnabled ? "bg-[#836EF9]" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isBettingEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {isBettingEnabled && (
                  <div>
                    <label className="block text-sm font-light text-white/80 mb-2">
                      Bet amount (MON)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="^[0-9]*\.?[0-9]*$"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="w-full px-4 py-2 h-12 bg-[#252525] border border-white/5 text-white rounded-lg text-lg focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                      placeholder="1.0"
                    />
                  </div>
                )}
              </div>
              {globalStats.queueCapacity.isFull && !error && (
                <div className="bg-[#252525] border border-red-500/50 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-red-500 text-lg md:text-xl font-normal mb-1">
                      Queue is full
                    </p>
                    <p className="text-white/80 font-light text-xs md:text-sm">
                      {globalStats.queueCapacity.current}/
                      {globalStats.queueCapacity.max} players connected.
                      <br /> Please try again in a moment.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-4 mt-4">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-[#252525] border border-white/5 hover:bg-[#353535] text-white font-medium py-4 px-6 rounded-lg text-lg transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleStartSearch}
                  disabled={
                    status === "searching" || globalStats.queueCapacity.isFull
                  }
                  className="flex-1 bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-gray-500 disabled:to-gray-500 text-white font-medium py-4 px-6 rounded-lg text-lg transition-all"
                >
                  {globalStats.queueCapacity.isFull ? "Queue full" : "Search"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
