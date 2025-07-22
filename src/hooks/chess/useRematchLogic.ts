/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";

export const useRematchLogic = (
  gameState: any,
  gameInfo: any,
  multisynqView: any,
  currentPlayerId: string | null,
  address: string | undefined,
  setGameState: (state: any) => void,
  setShowGameEndModal: (show: boolean) => void,
  setIsRematchTransition: (transition: boolean) => void,
  setPaymentStatus: (status: any) => void,
  setHasClosedPaymentModal: (closed: boolean) => void,
  setBettingGameCreationFailed: (failed: boolean) => void,
  createBettingGame: (amount: string, roomName: string) => Promise<void>,
  setRoomBetAmount: (amount: string) => void,
  getCorrectBetAmount: () => string,
  handleCreateRoom: () => Promise<void>
) => {
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);

  const canOfferRematch = (): boolean => {
    if (gameState.rematchCreating?.inProgress) {
      return false;
    }

    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return (
        gameState.gameResult.type !== null && !gameState.rematchOffer?.offered
      );
    }

    if (gameInfo.state !== 2) {
      return false;
    }

    if (gameInfo.result === 3) {
      return gameInfo.whiteClaimed && gameInfo.blackClaimed;
    } else if (gameInfo.result === 1) {
      return gameInfo.whiteClaimed;
    } else if (gameInfo.result === 2) {
      return gameInfo.blackClaimed;
    }

    return false;
  };

  const getCorrectGameTime = (): number => {
    if (gameState.gameTimeLimit && gameState.gameTimeLimit > 0) {
      return gameState.gameTimeLimit;
    }

    return 600;
  };

  const createRematchWithPayment = async () => {
    if (isCreatingRematch) return;

    setIsCreatingRematch(true);

    if (multisynqView && currentPlayerId) {
      try {
        multisynqView.signalRematchCreating(currentPlayerId);
      } catch (error) {
        console.error("❌ [useRematchLogic] Erreur signal création:", error);
      }
    }

    try {
      const newRoomName = `rematch-${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const newRoomPassword = Math.random().toString(36).substring(2, 6);
      const correctBetAmount = getCorrectBetAmount();
      const correctGameTime = getCorrectGameTime();

      (window as any).rematchRoomDetails = {
        roomName: newRoomName,
        password: newRoomPassword,
        betAmount: correctBetAmount,
        gameTime: correctGameTime,
      };

      setShowGameEndModal(false);
      await handleCreateRoom();

      if (multisynqView && currentPlayerId && address) {
        try {
          const invitationMessage = `REMATCH_INVITATION:${newRoomName}:${newRoomPassword}:${correctBetAmount}:${correctGameTime}`;

          multisynqView.sendMessage(
            invitationMessage,
            currentPlayerId,
            address
          );
        } catch (error) {
          console.error("❌ [useRematchLogic] Erreur envoi invitation:", error);
        }
      } else {
        console.error("[useRematchLogic] Impossible d'envoyer l'invitation:", {
          multisynqView: !!multisynqView,
          currentPlayerId,
          address,
        });
      }
    } catch (error) {
      console.error(
        "[useRematchLogic] Erreur lors de la création du rematch:",
        error
      );
      setBettingGameCreationFailed(true);
    } finally {
      setIsCreatingRematch(false);
    }
  };

  const handleNewGame = () => {
    if (!canOfferRematch()) {
      console.log(
        "[useRematchLogic] Impossible d'offrir un rematch maintenant"
      );
      return;
    }

    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      createRematchWithPayment();
    } else if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      if (multisynqView && currentPlayerId) {
        multisynqView.signalRematchCreating(currentPlayerId);
        setTimeout(() => {
          multisynqView.requestRematch(currentPlayerId);
        }, 100);
      }
    }
  };

  return {
    canOfferRematch,
    createRematchWithPayment,
    handleNewGame,
    isCreatingRematch,
    getCorrectGameTime,
  };
};
