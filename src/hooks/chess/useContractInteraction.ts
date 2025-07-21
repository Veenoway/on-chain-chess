/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";

export const useContractIntegration = (
  gameId: bigint | undefined,
  gameInfo: any,
  gameState: any,
  multisynqView: any,
  currentPlayerId: string | null,
  address: string | undefined,
  refetchAll: () => void,
  isSuccess: boolean,
  finishBettingGame: (gameId: bigint, result: 1 | 2 | 3) => Promise<void>,
  setIsFinalizingGame: (finalizing: boolean) => void
) => {
  const [lastClaimState, setLastClaimState] = useState<{
    whiteClaimed: boolean;
    blackClaimed: boolean;
  }>({ whiteClaimed: false, blackClaimed: false });

  // Monitor claims and notify in chat
  useEffect(() => {
    if (!gameInfo || !multisynqView || !currentPlayerId || !address) return;

    const whiteJustClaimed =
      gameInfo.whiteClaimed && !lastClaimState.whiteClaimed;
    const blackJustClaimed =
      gameInfo.blackClaimed && !lastClaimState.blackClaimed;

    if (whiteJustClaimed || blackJustClaimed) {
      setTimeout(() => {
        if (whiteJustClaimed) {
          const isCurrentPlayer =
            gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase();

          if (isCurrentPlayer) {
            multisynqView.sendMessage(
              `I just claimed!`,
              currentPlayerId,
              address
            );
          }
        }

        if (blackJustClaimed) {
          const isCurrentPlayer =
            gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase();

          if (isCurrentPlayer) {
            multisynqView.sendMessage(
              `I just claimed!`,
              currentPlayerId,
              address
            );
          }
        }
      }, 1000);

      setLastClaimState({
        whiteClaimed: gameInfo.whiteClaimed,
        blackClaimed: gameInfo.blackClaimed,
      });
    } else if (
      gameInfo.whiteClaimed !== lastClaimState.whiteClaimed ||
      gameInfo.blackClaimed !== lastClaimState.blackClaimed
    ) {
      setLastClaimState({
        whiteClaimed: gameInfo.whiteClaimed,
        blackClaimed: gameInfo.blackClaimed,
      });
    }
  }, [
    gameInfo?.whiteClaimed,
    gameInfo?.blackClaimed,
    gameInfo?.whitePlayer,
    gameInfo?.blackPlayer,
    multisynqView,
    currentPlayerId,
    address,
    lastClaimState,
  ]);

  // Auto-refetch after successful transactions
  useEffect(() => {
    if (isSuccess && gameId) {
      setTimeout(() => {
        refetchAll();
      }, 3000);
    }
  }, [isSuccess, gameId, refetchAll]);

  const finishGameViaRelayer = async (
    gameId: bigint,
    result: 1 | 2 | 3
  ): Promise<boolean> => {
    try {
      setIsFinalizingGame(true);

      const response = await fetch("/api/finish-game-relayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: gameId.toString(),
          result: result,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTimeout(() => setIsFinalizingGame(false), 2000);
        return true;
      } else {
        return false;
      }
    } catch {
      setTimeout(() => setIsFinalizingGame(false), 3000);
      return false;
    }
  };

  const finishGameOnContract = async (gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
  }) => {
    if (!gameId || !gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return;
    }

    if (gameInfo.state === 2) {
      return;
    }

    try {
      let contractResult: 1 | 2 | 3;

      if (gameResult.winner === "draw") {
        contractResult = 3;
      } else if (
        gameResult.winner === "white" ||
        gameResult.winner === "black"
      ) {
        const winnerColor = gameResult.winner;
        const winnerPlayer = gameState.players.find(
          (p: any) => p.color === winnerColor
        );

        if (!winnerPlayer) {
          console.error("Impossible de trouver le joueur gagnant");
          return;
        }

        const isWinnerWhiteInContract =
          gameInfo?.whitePlayer?.toLowerCase() ===
          winnerPlayer.wallet.toLowerCase();
        const isWinnerBlackInContract =
          gameInfo?.blackPlayer?.toLowerCase() ===
          winnerPlayer.wallet.toLowerCase();

        if (isWinnerWhiteInContract) {
          contractResult = 1;
        } else if (isWinnerBlackInContract) {
          contractResult = 2;
        } else {
          return;
        }
      } else {
        contractResult = 3;
      }

      const relayerSuccess = await finishGameViaRelayer(gameId, contractResult);

      if (!relayerSuccess) {
        try {
          await finishBettingGame(gameId, contractResult);
          setTimeout(() => setIsFinalizingGame(false), 2000);
        } catch {
          setTimeout(() => setIsFinalizingGame(false), 3000);
        }
      }
    } catch {
      setTimeout(() => setIsFinalizingGame(false), 3000);
    }
  };

  return {
    finishGameOnContract,
    finishGameViaRelayer,
  };
};
