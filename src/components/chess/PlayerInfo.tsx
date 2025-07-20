import { Player } from "@/types/chess";
import CapturedPieces from "./CapturedPieces";

interface PlayerInfoProps {
  player: Player | null;
  isCurrentPlayer: boolean;
  isOpponent: boolean;
  timeRemaining: number;
  playerColor: "white" | "black";
  fen: string;
  isReconnecting?: boolean;
}

export function PlayerInfo({
  player,
  isCurrentPlayer,
  isOpponent,
  timeRemaining,
  playerColor,
  fen,
  isReconnecting = false,
}: PlayerInfoProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getDisplayName = () => {
    if (!player) return "Waiting for opponent";

    const walletDisplay = `${player.wallet.slice(0, 6)}...${player.wallet.slice(
      -4
    )}`;
    return isCurrentPlayer ? `${walletDisplay} (You)` : walletDisplay;
  };

  const getConnectionStatus = () => {
    if (!player) {
      return (
        <div className="flex items-center gap-1">
          <span className="animate-[bounce_1s_infinite] text-2xl">.</span>
          <span className="animate-[bounce_1s_infinite_0.2s] text-2xl">.</span>
          <span className="animate-[bounce_1s_infinite_0.4s] text-2xl">.</span>
          Waiting for opponent
        </div>
      );
    }

    if (isCurrentPlayer && isReconnecting) {
      return (
        <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
      );
    }

    return player.connected ? (
      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
    ) : (
      <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
    );
  };

  const isLowTime = timeRemaining <= 30;

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-xl text-white flex items-center gap-2">
            {getDisplayName()}
            {getConnectionStatus()}
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

      <div
        className={`backdrop-blur-md rounded-lg px-2 py-1 border ${
          isLowTime
            ? "bg-red-500/20 border-red-500"
            : "bg-[#252525] border-white/5"
        }`}
      >
        <span
          className={`text-2xl font-bold ${
            isLowTime ? "text-red-500" : "text-white"
          }`}
        >
          {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
}

interface PlayerInfoContainerProps {
  topPlayer: Player | null;
  bottomPlayer: Player | null;
  currentPlayerId: string | null;
  topPlayerTime: number;
  bottomPlayerTime: number;
  playerColor: "white" | "black";
  fen: string;
  isReconnecting?: boolean;
}

export function PlayerInfoContainer({
  topPlayer,
  bottomPlayer,
  currentPlayerId,
  topPlayerTime,
  bottomPlayerTime,
  playerColor,
  fen,
  isReconnecting = false,
}: PlayerInfoContainerProps) {
  return (
    <div className="space-y-3">
      <PlayerInfo
        player={topPlayer}
        isCurrentPlayer={false}
        isOpponent={true}
        timeRemaining={topPlayerTime}
        playerColor={playerColor}
        fen={fen}
      />

      <PlayerInfo
        player={bottomPlayer}
        isCurrentPlayer={bottomPlayer?.id === currentPlayerId}
        isOpponent={false}
        timeRemaining={bottomPlayerTime}
        playerColor={playerColor}
        fen={fen}
        isReconnecting={isReconnecting}
      />
    </div>
  );
}
