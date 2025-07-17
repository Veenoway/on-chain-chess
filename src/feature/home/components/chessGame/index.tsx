"use client";
import { useChessGame } from "@/hooks/useChessGame";
import { useChessStore } from "@/stores/chessStore";
import ErrorBoundary from "./ErrorBoundary";
import GameScreen from "./GameScreen";
import WelcomeScreen from "./WelcomeScreen";

export default function ChessGame() {
  const { gameFlow } = useChessStore();
  const { connectionStatus } = useChessGame();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f]/100 to-[#0f0f0f]/80">
        {gameFlow === "welcome" ? <WelcomeScreen /> : <GameScreen />}

        {/* Debug info in development */}
        {process.env.NODE_ENV === "development" && (
          <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-2 rounded">
            Status: {connectionStatus}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
