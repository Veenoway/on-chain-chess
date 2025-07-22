/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";

export const useGameModals = (gameResult: any, roomName?: string) => {
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [hasClosedModal, setHasClosedModal] = useState(false);
  const [hasClosedPaymentModal, setHasClosedPaymentModal] = useState(false);
  const [isRematchTransition, setIsRematchTransition] = useState(false);
  const [rematchInvitation, setRematchInvitation] = useState<{
    from: string;
    roomName: string;
    password: string;
    betAmount?: string;
    gameTime?: string;
  } | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (isInitialLoad && gameResult.type) {
      setTimeout(() => {
        setShowGameEndModal(true);
        setHasClosedModal(false);
      }, 2000);

      setIsInitialLoad(false);
    } else if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [gameResult.type, isInitialLoad, roomName]);

  useEffect(() => {
    const handleRematchInvitation = (event: CustomEvent) => {
      const { from, roomName, password, betAmount, gameTime } = event.detail;

      setRematchInvitation({
        from,
        roomName,
        password: password || "",
        betAmount: betAmount || undefined,
        gameTime: gameTime || undefined,
      });

      setTimeout(() => {
        setRematchInvitation(null);
      }, 60000);
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
  }, []);

  useEffect(() => {
    const isRematchRoom = roomName && roomName.startsWith("rematch-");

    if (
      gameResult.type &&
      !showGameEndModal &&
      !hasClosedModal &&
      !isInitialLoad
    ) {
      const timer = setTimeout(() => {
        setShowGameEndModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (!gameResult.type && showGameEndModal && !rematchInvitation) {
      setShowGameEndModal(false);
      setHasClosedModal(false);
    } else if (isRematchRoom && showGameEndModal && !gameResult.type) {
      setShowGameEndModal(false);
      setHasClosedModal(false);
    }
  }, [
    gameResult.type,
    showGameEndModal,
    hasClosedModal,
    rematchInvitation,
    roomName,
    isInitialLoad,
  ]);

  const handleCloseGameEndModal = () => {
    setShowGameEndModal(false);
    setHasClosedModal(true);
  };

  const resetModals = () => {
    setShowGameEndModal(false);
    setHasClosedModal(false);
    setHasClosedPaymentModal(false);
    setIsRematchTransition(false);
    setRematchInvitation(null);
    setIsInitialLoad(true);
  };

  return {
    showGameEndModal,
    setShowGameEndModal,
    hasClosedModal,
    setHasClosedModal,
    hasClosedPaymentModal,
    setHasClosedPaymentModal,
    isRematchTransition,
    setIsRematchTransition,
    rematchInvitation,
    setRematchInvitation,
    handleCloseGameEndModal,
    resetModals,
  };
};
