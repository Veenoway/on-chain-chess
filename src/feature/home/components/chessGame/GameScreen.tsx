// components/ChessGame/GameScreen.tsx
"use client";
import { useGameTimer, useMoveNavigation } from "@/hooks/useChessGame";
import { useChessStore } from "@/stores/chessStore";
import {
  useCanPlay,
  useHasBettingRequirement,
  usePaymentStore,
} from "@/stores/paymentStore";
import { Chess } from "chess.js";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import ChatPanel from "./ChatPanel";
import GameControls from "./GameControls";
import GameEndModal from "./GameEndModal";
import PaymentModal from "./PaymentModal";
import PlayerInfo from "./PlayerInfo";

export default function GameScreen() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const {
    fen,
    roomName,
    roomPassword,
    players,
    currentPlayerId,
    playerColor,
    isActive,
    gameResult,
    showGameEndModal,
    makeMove,
  } = useChessStore();

  const { gameInfo } = usePaymentStore();
  const hasBettingRequirement = useHasBettingRequirement();
  const canPlay = useCanPlay();

  // Custom pieces configuration
  const customPieces = {
    wK: () => (
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    ),
    bK: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/king.png" alt="king" className="h-[85px] mx-auto" />
      </div>
    ),
    wQ: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <circle cx="6" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="14" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="22.5" cy="8" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="31" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="39" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <path
          d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-2.5-14.5L22.5 24l-2.5-14.5L14 25 6.5 13.5 9 26z"
          stroke="black"
          strokeWidth="1.5"
        />
        <path
          d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
          stroke="black"
          strokeWidth="1.5"
        />
      </svg>
    ),
    bQ: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/queen.png" alt="queen" className="h-[85px] mx-auto" />
      </div>
    ),
    wR: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M34 14l-3 3H14l-3-3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M31 17v12.5H14V17"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
          fill="none"
        />
        <path
          d="M11 14h23"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
      </svg>
    ),
    bR: () => <img src="/rook.png" alt="rook" className="h-[85px] mx-auto" />,
    wB: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <g
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        </g>
      </svg>
    ),
    bB: () => (
      <img src="/bishop.png" alt="bishop" className="h-[85px] mx-auto" />
    ),
    wN: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bN: () => (
      <img src="/cavalier.png" alt="cavalier" className="h-[85px] mx-auto" />
    ),
    wP: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bP: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/pawn.png" alt="pawn" className="h-[70px] mx-auto" />
      </div>
    ),
  } as const;

  const { isInAnalysisMode } = useMoveNavigation();

  // Use timer hook
  useGameTimer();

  const onPieceDrop = (args: PieceDropHandlerArgs): boolean => {
    const { sourceSquare, targetSquare } = args;
    if (!targetSquare || !currentPlayerId || !canPlay) return false;

    // Prevent moves in analysis mode
    if (isInAnalysisMode) {
      console.warn("Cannot move pieces while in analysis mode!");
      return false;
    }

    // Prevent moves if game is not active
    if (!isActive || gameResult.type) return false;

    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer) return false;

    // Check if it's player's turn
    const currentTurn = fen.split(" ")[1];
    if (
      (currentTurn === "w" && currentPlayer.color !== "white") ||
      (currentTurn === "b" && currentPlayer.color !== "black")
    ) {
      console.warn("It's not your turn!");
      return false;
    }

    // Validate move
    const tempGame = new Chess(fen);
    try {
      const moveResult = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
        makeMove(sourceSquare, targetSquare, "q");
        return true;
      }
    } catch (error) {
      console.warn("Invalid move:", error);
    }

    return false;
  };

  const chessboardOptions = {
    position: fen,
    onPieceDrop,
    boardOrientation: playerColor,
    arePiecesDraggable: isActive && canPlay && !isInAnalysisMode,
    boardWidth: 580,
    animationDuration: 200,
    customPieces,
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${
      window.location.pathname
    }?room=${roomName}${roomPassword ? `&password=${roomPassword}` : ""}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f]/100 to-[#0f0f0f]/80 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 my-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-bold text-white mb-2.5">
                Monad Chess
              </h1>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={copyRoomLink}
                className="px-2 py-1 text-sm flex items-center gap-2 bg-[#836EF9]/20 hover:bg-[#836EF9]/30 border border-[#836EF9]/40 text-[#836EF9] rounded transition-colors"
              >
                Copy Link
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5" />
                )}
              </button>
              <p className="text-white text-base ml-2.5">Room: {roomName}</p>

              {/* Betting info */}
              {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-400 rounded">
                  <span className="text-green-300 text-sm font-medium">
                    💰 Bet: {formatEther(gameInfo.betAmount)} MON
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-4">
            <div className="relative">
              {/* Opponent info */}
              <PlayerInfo isOpponent={true} />

              {/* Chessboard container */}
              <div className="relative aspect-square max-w-full w-full mx-auto">
                <Chessboard {...chessboardOptions} />

                {/* Payment modal overlay */}
                {hasBettingRequirement && !canPlay && <PaymentModal />}

                {/* Analysis mode indicator */}
                {isInAnalysisMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <div className="bg-[#252525] backdrop-blur-sm px-3 py-1 flex items-center rounded border border-white/10 shadow-xl">
                      <div className="bg-yellow-300 h-2.5 w-2.5 rounded-full animate-pulse" />
                      <span className="text-white text-sm font-medium ml-2">
                        Analysis mode
                      </span>
                    </div>
                  </div>
                )}

                {/* Game end modal */}
                {showGameEndModal && <GameEndModal />}
              </div>

              {/* Current player info */}
              <PlayerInfo isOpponent={false} />
            </div>
          </div>

          {/* Chat and controls panel */}
          <div className="lg:col-span-2">
            <div className="flex flex-col h-[800px]">
              <ChatPanel />
              <GameControls />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
