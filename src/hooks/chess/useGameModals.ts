/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";

export const useGameModals = (gameResult: any) => {
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [hasClosedModal, setHasClosedModal] = useState(false);
  const [hasClosedPaymentModal, setHasClosedPaymentModal] = useState(false);
  const [isRematchTransition, setIsRematchTransition] = useState(false);
  const [rematchInvitation, setRematchInvitation] = useState<{
    from: string;
    roomName: string;
    password: string;
    betAmount?: string;
  } | null>(null);

  // ✅ NOUVEAU: Écouter les événements rematchInvitation
  useEffect(() => {
    const handleRematchInvitation = (event: CustomEvent) => {
      const { from, roomName, password, betAmount } = event.detail;

      console.log("📨 [useGameModals] Invitation de rematch reçue:", {
        from,
        roomName,
        password,
        betAmount,
      });

      // Stocker l'invitation pour affichage
      setRematchInvitation({
        from,
        roomName,
        password: password || "",
        betAmount: betAmount || undefined,
      });

      // Auto-clear après 60 secondes
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

  // Auto-open game end modal
  useEffect(() => {
    if (gameResult.type && !showGameEndModal && !hasClosedModal) {
      const timer = setTimeout(() => {
        setShowGameEndModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (!gameResult.type && showGameEndModal) {
      setShowGameEndModal(false);
      setHasClosedModal(false);
    }
  }, [gameResult.type, showGameEndModal, hasClosedModal]);

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
