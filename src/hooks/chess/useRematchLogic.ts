/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  handleCreateRoom: () => Promise<void>,
  isBettingEnabled: boolean
) => {
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);
  const [rematchInvitation, setRematchInvitation] = useState<{
    from: string;
    roomName: string;
    password: string;
  } | null>(null);

  const router = useRouter();

  const canOfferRematch = (): boolean => {
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

  const createRematchWithPayment = async () => {
    if (isCreatingRematch) return;

    setIsCreatingRematch(true);

    try {
      const newRoomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const newRoomPassword = Math.random().toString(36).substring(2, 6);
      const correctBetAmount = getCorrectBetAmount();

      if (multisynqView && currentPlayerId && address) {
        multisynqView.sendMessage(
          `REMATCH_INVITATION:${newRoomName}:${newRoomPassword}:${correctBetAmount}`,
          currentPlayerId,
          address
        );
      }

      setShowGameEndModal(false);

      (window as any).rematchRoomDetails = {
        roomName: newRoomName,
        password: newRoomPassword,
      };

      await handleCreateRoom();
    } catch {
    } finally {
      setIsCreatingRematch(false);
    }
  };

  const handleNewGame = () => {
    if (
      gameInfo?.betAmount &&
      gameInfo.betAmount > BigInt(0) &&
      canOfferRematch()
    ) {
      createRematchWithPayment();
    } else {
      router.push("/");
    }
  };

  // Handle rematch with betting
  useEffect(() => {
    if (
      gameState.rematchAccepted &&
      isBettingEnabled &&
      parseFloat(getCorrectBetAmount()) > 0
    ) {
      setIsRematchTransition(true);

      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });

      setHasClosedPaymentModal(false);
      setBettingGameCreationFailed(false);

      const createRematchBettingGame = async () => {
        try {
          const rematchRoomName = `${gameState.roomName}_rematch_${gameState.gameNumber}`;
          const correctBetAmount = getCorrectBetAmount();

          await createBettingGame(correctBetAmount, rematchRoomName);
          setRoomBetAmount(correctBetAmount);

          setGameState((prev: any) => ({
            ...prev,
            roomName: rematchRoomName,
          }));

          const newUrl = gameState.roomPassword
            ? `${window.location.pathname}?room=${rematchRoomName}&password=${gameState.roomPassword}`
            : `${window.location.pathname}?room=${rematchRoomName}`;
          window.history.pushState({}, "", newUrl);

          if (multisynqView) {
            multisynqView.sendMessage(
              "New betting contract created for rematch!",
              currentPlayerId,
              address
            );
          }
        } catch {
          setBettingGameCreationFailed(true);
        }
      };

      setTimeout(() => {
        createRematchBettingGame();
      }, 1000);

      if (
        multisynqView &&
        typeof multisynqView.resetRematchAccepted === "function"
      ) {
        setTimeout(() => {
          multisynqView.resetRematchAccepted();
        }, 2000);
      }
    }
  }, [
    gameState.rematchAccepted,
    isBettingEnabled,
    gameState.gameNumber,
    gameState.roomName,
  ]);

  // Listen for rematch invitations
  useEffect(() => {
    const handleRematchInvitation = (event: CustomEvent) => {
      const { from, senderId, roomName, password } = event.detail;

      if (senderId === currentPlayerId) {
        return;
      }

      setRematchInvitation({
        from,
        roomName,
        password: password || "",
      });
    };

    window.addEventListener(
      "rematchInvitation",
      handleRematchInvitation as unknown as EventListener
    );

    return () => {
      window.removeEventListener(
        "rematchInvitation",
        handleRematchInvitation as unknown as EventListener
      );
    };
  }, [currentPlayerId]);

  return {
    canOfferRematch,
    createRematchWithPayment,
    handleNewGame,
    isCreatingRematch,
    rematchInvitation,
    setRematchInvitation,
  };
};
