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

    // ✅ CORRIGÉ: Seul le joueur dont c'est le tour doit déclencher le timer
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
      console.log(
        "⏰ [useTimer] Démarrage du timer pour joueur:",
        currentPlayerId,
        "couleur:",
        currentPlayer?.color,
        "tour:",
        gameState.turn
      );
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          console.log("⏰ [useTimer] Mise à jour du timer");
          multisynqView.updateTimer();
        }
      }, 1000);
    } else if (!shouldRunTimer && timerRef.current) {
      console.log(
        "⏰ [useTimer] Arrêt du timer pour joueur:",
        currentPlayerId,
        "couleur:",
        currentPlayer?.color,
        "tour:",
        gameState.turn
      );
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
    gameState.turn, // ✅ AJOUTÉ: Réagir aux changements de tour
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
