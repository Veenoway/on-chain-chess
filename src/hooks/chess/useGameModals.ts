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
  } | null>(null);

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
