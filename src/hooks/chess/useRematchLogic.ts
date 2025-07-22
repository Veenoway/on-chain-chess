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
  // ✅ SUPPRIMÉ: rematchInvitation local (conflit avec useGameModals)

  const canOfferRematch = (): boolean => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return (
        gameState.gameResult.type !== null && !gameState.rematchOffer?.offered
      );
    }

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

  // ✅ À CHANGER : Créer la room IMMÉDIATEMENT
  const createRematchWithPayment = async () => {
    if (isCreatingRematch) return;

    setIsCreatingRematch(true);
    console.log(
      "🔄 [useRematchLogic] Création immédiate d'une nouvelle room pour rematch..."
    );

    try {
      // 1. Générer les détails de la nouvelle room
      const newRoomName = `rematch-${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const newRoomPassword = Math.random().toString(36).substring(2, 6);
      const correctBetAmount = getCorrectBetAmount();

      console.log("📋 [useRematchLogic] Détails du rematch:", {
        newRoomName,
        newRoomPassword,
        betAmount: correctBetAmount,
      });

      // 2. Stocker les détails pour handleCreateRoom
      (window as any).rematchRoomDetails = {
        roomName: newRoomName,
        password: newRoomPassword,
        betAmount: correctBetAmount,
      };

      // 3. Fermer le modal et créer la room IMMÉDIATEMENT
      setShowGameEndModal(false);
      console.log("🏗️ [useRematchLogic] Création immédiate de la room...");
      await handleCreateRoom();
      console.log("✅ [useRematchLogic] Room créée avec succès!");

      // 4. PUIS envoyer l'invitation avec les détails de la room créée
      if (multisynqView && currentPlayerId && address) {
        try {
          const invitationMessage = `REMATCH_INVITATION:${newRoomName}:${newRoomPassword}:${correctBetAmount}`;

          console.log(
            "📨 [useRematchLogic] Envoi de l'invitation après création de room:"
          );
          console.log("   - Message:", invitationMessage);

          multisynqView.sendMessage(
            invitationMessage,
            currentPlayerId,
            address
          );

          console.log("✅ [useRematchLogic] Invitation envoyée avec succès");
        } catch (error) {
          console.error("❌ [useRematchLogic] Erreur envoi invitation:", error);
        }
      } else {
        console.error(
          "❌ [useRematchLogic] Impossible d'envoyer l'invitation:",
          {
            multisynqView: !!multisynqView,
            currentPlayerId,
            address,
          }
        );
      }

      console.log(
        "✅ [useRematchLogic] Rematch flow complété - User A dans nouvelle room avec popup paiement"
      );
    } catch (error) {
      console.error(
        "❌ [useRematchLogic] Erreur lors de la création du rematch:",
        error
      );
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
      // router.push("/"); // Removed as per edit hint
    }
  };

  // Écouter les invitations de rematch
  // Removed useEffect for rematchInvitation events

  return {
    canOfferRematch,
    createRematchWithPayment,
    handleNewGame,
    isCreatingRematch,
    // Removed rematchInvitation and setRematchInvitation from return
  };
};
