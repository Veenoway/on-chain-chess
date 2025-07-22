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
  } | null>(null);
  // ✅ AJOUTÉ: Track si c'est le premier chargement pour détecter un refresh
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ✅ NOUVEAU: Détecter une partie terminée lors du chargement initial (après refresh)
  useEffect(() => {
    if (isInitialLoad && gameResult.type) {
      console.log(
        "🔄 [useGameModals] Détection d'une partie terminée après refresh:",
        {
          gameResultType: gameResult.type,
          roomName,
        }
      );

      // Attendre un peu pour que tout soit initialisé
      setTimeout(() => {
        console.log(
          "📖 [useGameModals] Restauration de la popup de fin de partie"
        );
        setShowGameEndModal(true);
        setHasClosedModal(false); // S'assurer que la modal peut s'ouvrir
      }, 2000); // Délai plus long pour la restauration après refresh

      setIsInitialLoad(false);
    } else if (isInitialLoad) {
      // Pas de partie terminée au chargement initial
      setIsInitialLoad(false);
    }
  }, [gameResult.type, isInitialLoad, roomName]);

  // ✅ NOUVEAU: Écouter les événements rematchInvitation
  useEffect(() => {
    console.log(
      "🔧 [useGameModals] Installation du listener rematchInvitation"
    );

    const handleRematchInvitation = (event: CustomEvent) => {
      console.log("📨 [useGameModals] Événement rematchInvitation reçu!");
      console.log("📋 [useGameModals] Event detail:", event.detail);

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

      console.log("✅ [useGameModals] State rematchInvitation mis à jour");

      // Auto-clear après 60 secondes
      setTimeout(() => {
        console.log(
          "⏰ [useGameModals] Auto-clear rematchInvitation après 60s"
        );
        setRematchInvitation(null);
      }, 60000);
    };

    window.addEventListener(
      "rematchInvitation",
      handleRematchInvitation as unknown as EventListener
    );

    console.log("✅ [useGameModals] Listener rematchInvitation installé");

    return () => {
      console.log(
        "🧹 [useGameModals] Suppression du listener rematchInvitation"
      );
      window.removeEventListener(
        "rematchInvitation",
        handleRematchInvitation as unknown as EventListener
      );
    };
  }, []);

  // Auto-open game end modal
  useEffect(() => {
    const isRematchRoom = roomName && roomName.startsWith("rematch-");

    console.log("🔍 [useGameModals] Auto-open endGame modal check:", {
      gameResultType: gameResult.type,
      showGameEndModal,
      hasClosedModal,
      isRematchRoom,
      roomName,
      isInitialLoad,
    });

    // ✅ MODIFIÉ: Permettre l'ouverture si le jeu se termine vraiment (même dans rematch)
    // et ne pas l'empêcher si c'est un chargement initial après refresh
    if (
      gameResult.type &&
      !showGameEndModal &&
      !hasClosedModal &&
      !isInitialLoad
    ) {
      console.log("�� [useGameModals] Ouverture automatique du modal endGame");
      const timer = setTimeout(() => {
        setShowGameEndModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (!gameResult.type && showGameEndModal && !rematchInvitation) {
      // ✅ FIXÉ: Ne pas fermer automatiquement s'il y a une invitation de rematch en cours
      console.log(
        "🔒 [useGameModals] Fermeture automatique du modal bloquée - invitation de rematch en cours"
      );
      setShowGameEndModal(false);
      setHasClosedModal(false);
    } else if (isRematchRoom && showGameEndModal && !gameResult.type) {
      // ✅ MODIFIÉ: Fermer seulement si room de rematch ET pas de résultat de jeu
      console.log(
        "🔒 [useGameModals] Fermeture forcée du modal endGame - room de rematch sans résultat"
      );
      setShowGameEndModal(false);
      setHasClosedModal(false);
    }
  }, [
    gameResult.type,
    showGameEndModal,
    hasClosedModal,
    rematchInvitation,
    roomName,
    isInitialLoad, // ✅ AJOUTÉ: Prendre en compte l'état de chargement initial
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
    // ✅ AJOUTÉ: Réinitialiser aussi le flag de chargement initial
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
