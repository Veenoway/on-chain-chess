/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useCallback } from "react";

export const useGameControls = (
  multisynqView: any,
  currentPlayerId: string | null
) => {
  const handleOfferDraw = useCallback(() => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.offerDraw === "function") {
      multisynqView.offerDraw(currentPlayerId);
    } else {
      console.error("offerDraw n'est pas une fonction:", multisynqView);
    }
  }, [multisynqView, currentPlayerId]);

  const handleRespondDraw = useCallback(
    (accepted: boolean) => {
      if (!multisynqView || !currentPlayerId) {
        console.error("multisynqView ou currentPlayerId manquant");
        return;
      }

      if (typeof multisynqView.respondDraw === "function") {
        multisynqView.respondDraw(currentPlayerId, accepted);
      } else {
        console.error("Respond draw n'est pas une fonction:", multisynqView);
      }
    },
    [multisynqView, currentPlayerId]
  );

  const handleResign = useCallback(() => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.resign === "function") {
      multisynqView.resign(currentPlayerId);
    } else {
      console.error("resign n'est pas une fonction:", multisynqView);
    }
  }, [multisynqView, currentPlayerId]);

  const handleRematchResponse = useCallback(
    (accepted: boolean) => {
      if (!multisynqView || !currentPlayerId) {
        return;
      }

      if (typeof multisynqView.respondRematch === "function") {
        multisynqView.respondRematch(currentPlayerId, accepted);
      } else {
        console.error("respondRematch n'est pas une fonction:", multisynqView);
      }
    },
    [multisynqView, currentPlayerId]
  );

  const handleSendMessage = useCallback(
    (message: string, address: string) => {
      if (!message.trim() || !currentPlayerId || !address || !multisynqView)
        return;

      multisynqView.sendMessage(message, currentPlayerId, address);
    },
    [multisynqView, currentPlayerId]
  );

  return {
    handleOfferDraw,
    handleRespondDraw,
    handleResign,
    handleRematchResponse,
    handleSendMessage,
  };
};
