"use client";
import { GameState } from "@/types/chess";
import { useState } from "react";

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    isActive: false,
    turn: "w",
    players: [],
    maxPlayers: 2,
    whiteTime: 600,
    blackTime: 600,
    gameTimeLimit: 600,
    lastMoveTime: null,
    roomName: "",
    roomPassword: "",
    messages: [],
    gameResult: { type: null },
    drawOffer: { offered: false, by: null },
    rematchOffer: { offered: false, by: null },
    gameNumber: 1,
    lastGameWinner: null,
    createdAt: Date.now(),
  });

  const [gameFlow, setGameFlow] = useState<"welcome" | "lobby" | "game">(
    "welcome"
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastKnownGameState, setLastKnownGameState] =
    useState<GameState | null>(null);

  const resetGameState = () => {
    setGameState({
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      isActive: false,
      turn: "w",
      players: [],
      maxPlayers: 2,
      whiteTime: 600,
      blackTime: 600,
      gameTimeLimit: 600,
      lastMoveTime: null,
      roomName: "",
      roomPassword: "",
      messages: [],
      gameResult: { type: null },
      drawOffer: { offered: false, by: null },
      rematchOffer: { offered: false, by: null },
      gameNumber: 1,
      lastGameWinner: null,
      createdAt: Date.now(),
    });
    setGameFlow("welcome");
    setIsReconnecting(false);
    setLastKnownGameState(null);
  };

  return {
    gameState,
    setGameState,
    gameFlow,
    setGameFlow,
    isReconnecting,
    setIsReconnecting,
    lastKnownGameState,
    setLastKnownGameState,
    resetGameState,
  };
};
