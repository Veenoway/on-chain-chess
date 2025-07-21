/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { RematchInvitation } from "@/types/chess";
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
  handleCreateRoom: () => Promise<void>
) => {
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);
  const [rematchInvitation, setRematchInvitation] =
    useState<RematchInvitation | null>(null);

  const router = useRouter();

  const canOfferRematch = (): boolean => {
    // Pour les jeux sans pari, on peut proposer un rematch dès que la partie est terminée
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return (
        gameState.gameResult.type !== null && !gameState.rematchOffer?.offered
      );
    }

    // Pour les jeux avec pari, il faut que le jeu soit terminé (state 2)
    if (gameInfo.state !== 2) {
      return false;
    }

    // Et que les gains aient été réclamés selon le résultat
    if (gameInfo.result === 3) {
      // Draw
      return gameInfo.whiteClaimed && gameInfo.blackClaimed;
    } else if (gameInfo.result === 1) {
      // White wins
      return gameInfo.whiteClaimed;
    } else if (gameInfo.result === 2) {
      // Black wins
      return gameInfo.blackClaimed;
    }

    return false;
  };

  const createRematchWithPayment = async () => {
    if (isCreatingRematch) return;

    setIsCreatingRematch(true);
    console.log("🔄 Création d'un rematch avec nouvelle room...");

    try {
      // 1. Générer les détails de la nouvelle room
      const newRoomName = `rematch-${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const newRoomPassword = Math.random().toString(36).substring(2, 6);
      const correctBetAmount = getCorrectBetAmount();

      console.log("📋 Détails du rematch:", {
        newRoomName,
        newRoomPassword,
        betAmount: correctBetAmount,
      });

      // 2. Envoyer l'invitation dans la room actuelle AVANT de changer de room
      let invitationSent = false;
      if (multisynqView && currentPlayerId && address) {
        try {
          const invitationMessage = `REMATCH_INVITATION:${newRoomName}:${newRoomPassword}:${correctBetAmount}`;

          console.log(
            "📨 Envoi de l'invitation de rematch:",
            invitationMessage
          );

          multisynqView.sendMessage(
            invitationMessage,
            currentPlayerId,
            address
          );

          invitationSent = true;
          console.log("✅ Invitation envoyée avec succès");
        } catch (error) {
          console.error("❌ Erreur envoi invitation:", error);
        }
      }

      // 3. Fermer la modal de fin de jeu
      setShowGameEndModal(false);

      // 4. Stocker les détails pour handleCreateRoom
      (window as any).rematchRoomDetails = {
        roomName: newRoomName,
        password: newRoomPassword,
        betAmount: correctBetAmount,
        invitationSent,
      };

      // 5. Créer la nouvelle room immédiatement (avec un petit délai si invitation envoyée)
      if (invitationSent) {
        console.log("⏳ Attente puis création de la nouvelle room...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("🏗️ Création de la nouvelle room et contrat...");
      await handleCreateRoom();

      console.log("✅ Rematch créé avec succès !");
    } catch (error) {
      console.error("❌ Erreur lors de la création du rematch:", error);
      setBettingGameCreationFailed(true);
    } finally {
      setIsCreatingRematch(false);
    }
  };

  const handleNewGame = () => {
    console.log("🎮 Demande de nouvelle partie:", {
      hasBetting: gameInfo?.betAmount && gameInfo.betAmount > BigInt(0),
      canOffer: canOfferRematch(),
      gameState: gameInfo?.state,
    });

    if (
      gameInfo?.betAmount &&
      gameInfo.betAmount > BigInt(0) &&
      canOfferRematch()
    ) {
      console.log("💰 Création d'un rematch avec pari");
      createRematchWithPayment();
    } else if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      // Jeu sans pari - utiliser l'ancien système de rematch
      console.log("🎯 Demande de rematch classique");
      if (multisynqView && currentPlayerId) {
        multisynqView.requestRematch(currentPlayerId);
      }
    } else {
      // Retour à l'accueil si conditions non remplies
      console.log("🏠 Retour à l'accueil");
      router.push("/");
    }
  };

  // Écouter les invitations de rematch
  useEffect(() => {
    const handleRematchInvitation = (event: CustomEvent) => {
      const { from, senderId, roomName, password, betAmount } = event.detail;

      console.log("📨 Invitation de rematch reçue:", {
        from,
        senderId,
        roomName,
        password,
        betAmount,
      });

      // Ne pas traiter sa propre invitation
      if (senderId === currentPlayerId) {
        console.log("🚫 Ignorer sa propre invitation");
        return;
      }

      // Stocker l'invitation pour affichage
      setRematchInvitation({
        from,
        roomName,
        password: password || "",
        betAmount: betAmount || undefined,
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
