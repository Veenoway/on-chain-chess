// components/ChessGame/PlayerInfo.tsx
"use client";
import { useChessStore } from "@/stores/chessStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { useAccount } from "wagmi";
import CapturedPieces from "../../chessboard";

interface PlayerInfoProps {
  isOpponent: boolean;
}

export default function PlayerInfo({ isOpponent }: PlayerInfoProps) {
  const { address } = useAccount();
  const {
    players,
    currentPlayerId,
    playerColor,
    whiteTime,
    blackTime,
    fen,
    isReconnecting,
  } = useChessStore();

  const { gameInfo } = usePaymentStore();

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const opponentPlayer = players.find((p) => p.id !== currentPlayerId);

  const player = isOpponent ? opponentPlayer : currentPlayer;
  const displayTime = isOpponent ? getOpponentTime() : getCurrentPlayerTime();

  function getCurrentPlayerTime(): number {
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white" ? whiteTime : blackTime;
  }

  function getOpponentTime(): number {
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white" ? blackTime : whiteTime;
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const hasPlayerPaid = (playerColor: "white" | "black") => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return true; // No betting requirement
    }

    if (playerColor === "white") {
      return (
        gameInfo.whitePlayer.toLowerCase() !==
        "0x0000000000000000000000000000000000000000"
      );
    } else {
      return (
        gameInfo.blackPlayer.toLowerCase() !==
        "0x0000000000000000000000000000000000000000"
      );
    }
  };

  if (!player && isOpponent) {
    return (
      <div
        className={`flex justify-between items-center ${
          isOpponent ? "mb-3" : "mt-3"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-white flex items-center gap-1">
              <span className="animate-[bounce_1s_infinite] text-2xl">.</span>
              <span className="animate-[bounce_1s_infinite_0.2s] text-2xl">
                .
              </span>
              <span className="animate-[bounce_1s_infinite_0.4s] text-2xl">
                .
              </span>
              Waiting for opponent
            </div>
            <div className="text-sm text-gray-300">Offline</div>
          </div>
        </div>
        <div className="backdrop-blur-md rounded px-2 py-1 border bg-white/10 border-white/20">
          <span className="text-2xl font-bold text-white">
            {formatTime(600)} {/* Default time */}
          </span>
        </div>
      </div>
    );
  }

  if (!player) return null;

  const isCurrentUser = player.wallet === address;
  const isLowTime = displayTime <= 30;

  return (
    <div
      className={`flex justify-between items-center ${
        isOpponent ? "mb-3" : "mt-3"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-xl text-white flex items-center gap-2">
            {formatWallet(player.wallet)}
            {isCurrentUser && " (You)"}

            {/* Connection indicator */}
            {player.connected && !isReconnecting ? (
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            ) : (
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
            )}

            {/* Payment indicator */}
            {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  hasPlayerPaid(player.color)
                    ? "bg-green-500/20 text-green-300 border border-green-400"
                    : "bg-red-500/20 text-red-300 border border-red-400"
                }`}
              >
                {hasPlayerPaid(player.color) ? "💰 PAID" : "❌ NOT PAID"}
              </span>
            )}
          </div>

          <div className="text-sm text-gray-300">
            <CapturedPieces
              fen={fen}
              playerColor={playerColor}
              isOpponent={isOpponent}
            />
          </div>
        </div>
      </div>

      {/* Timer */}
      <div
        className={`backdrop-blur-md rounded px-2 py-1 border ${
          isLowTime
            ? "bg-red-500/20 border-red-400"
            : "bg-white/10 border-white/20"
        }`}
      >
        <span
          className={`text-2xl font-bold ${
            isLowTime ? "text-red-300" : "text-white"
          }`}
        >
          {formatTime(displayTime)}
        </span>
      </div>
    </div>
  );
}
