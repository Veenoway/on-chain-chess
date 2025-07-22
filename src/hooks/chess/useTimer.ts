/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef } from "react";

export const useTimer = (
  gameState: any,
  currentPlayerId: string | null,
  multisynqView: any,
  isReconnecting: boolean,
  bothPlayersPaid: () => boolean
) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p: any) => p.id === currentPlayerId
    );

    const isCurrentPlayerTurn =
      (gameState.turn === "w" && currentPlayer?.color === "white") ||
      (gameState.turn === "b" && currentPlayer?.color === "black");

    const shouldRunTimer =
      gameState.isActive &&
      !gameState.gameResult.type &&
      currentPlayer?.connected &&
      !isReconnecting &&
      bothPlayersPaid() &&
      isCurrentPlayerTurn;

    if (shouldRunTimer && !timerRef.current) {
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 1000);
    } else if (!shouldRunTimer && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    gameState.isActive,
    gameState.gameResult.type,
    gameState.players,
    gameState.turn,
    currentPlayerId,
    multisynqView,
    isReconnecting,
    bothPlayersPaid,
  ]);

  const getCurrentPlayerTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p: any) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.whiteTime
      : gameState.blackTime;
  };

  const getOpponentTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p: any) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.blackTime
      : gameState.whiteTime;
  };

  return {
    getCurrentPlayerTime,
    getOpponentTime,
  };
};
