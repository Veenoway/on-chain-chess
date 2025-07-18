"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Address, formatEther, parseEther } from "viem";
import { readContract } from "viem/actions";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

// ABI du contrat (version mise à jour pour token natif)
const CHESS_BETTING_ABI = [
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "whitePlayer", type: "address" },
      { name: "betAmount", type: "uint256" },
      { name: "roomName", type: "string" },
    ],
    name: "GameCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "blackPlayer", type: "address" },
    ],
    name: "GameJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { name: "result", type: "uint8" },
      { name: "totalPot", type: "uint256" },
    ],
    name: "GameFinished",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "WinningsClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "DrawRefundClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "gameId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "GameCancelled",
    type: "event",
  },

  // Functions
  {
    inputs: [{ name: "roomName", type: "string" }],
    name: "createGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "joinGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "roomName", type: "string" }],
    name: "joinGameByRoom",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "claimDrawRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "cancelGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "result", type: "uint8" },
    ],
    name: "finishGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // View functions
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "getGame",
    outputs: [
      {
        components: [
          { name: "gameId", type: "uint256" },
          { name: "whitePlayer", type: "address" },
          { name: "blackPlayer", type: "address" },
          { name: "betAmount", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "result", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "finishedAt", type: "uint256" },
          { name: "roomName", type: "string" },
          { name: "whiteClaimed", type: "bool" },
          { name: "blackClaimed", type: "bool" },
          { name: "feePaid", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "roomName", type: "string" }],
    name: "getGameIdByRoom",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "player", type: "address" }],
    name: "getPlayerStats",
    outputs: [
      { name: "totalGames", type: "uint256" },
      { name: "wins", type: "uint256" },
      { name: "losses", type: "uint256" },
      { name: "draws", type: "uint256" },
      { name: "totalWinnings", type: "uint256" },
      { name: "totalLosses", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "player1", type: "address" },
      { name: "player2", type: "address" },
    ],
    name: "getHeadToHeadStats",
    outputs: [
      { name: "player1Wins", type: "uint256" },
      { name: "player1Losses", type: "uint256" },
      { name: "draws", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "player", type: "address" }],
    name: "getPlayerGames",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    name: "canClaimWinnings",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    name: "canClaimDrawRefund",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "calculateWinnings",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "calculateDrawRefund",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Constantes
const CHESS_BETTING_CONTRACT_ADDRESS =
  "0xC17f273ff1E0aeb058e1c512d968c70CaAfa1Fd1";

// Types
export interface GameInfo {
  gameId: bigint;
  whitePlayer: Address;
  blackPlayer: Address;
  betAmount: bigint;
  state: number; // 0: WAITING, 1: ACTIVE, 2: FINISHED, 3: CANCELLED
  result: number; // 0: NONE, 1: WHITE_WINS, 2: BLACK_WINS, 3: DRAW
  createdAt: bigint;
  finishedAt: bigint;
  roomName: string;
  whiteClaimed: boolean;
  blackClaimed: boolean;
  feePaid: boolean;
}

export interface PlayerStats {
  totalGames: bigint;
  wins: bigint;
  losses: bigint;
  draws: bigint;
  totalWinnings: bigint;
  totalLosses: bigint;
}

export interface HeadToHeadStats {
  player1Wins: bigint;
  player1Losses: bigint;
  draws: bigint;
}

export const GameState = {
  WAITING: 0,
  ACTIVE: 1,
  FINISHED: 2,
  CANCELLED: 3,
} as const;

export const GameResult = {
  NONE: 0,
  WHITE_WINS: 1,
  BLACK_WINS: 2,
  DRAW: 3,
} as const;

// Hook principal pour les paris d'échecs
export const useChessBetting = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isSuccess } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Obtenir le solde MON de l'utilisateur
  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
  });

  // États spécifiques pour le claim
  const [claimState, setClaimState] = useState<{
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: string | null;
    txHash: string | null;
  }>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    txHash: null,
  });

  // États spécifiques pour l'annulation
  const [cancelState, setCancelState] = useState<{
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: string | null;
    txHash: string | null;
  }>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    txHash: null,
  });

  // Réinitialiser l'état du claim
  const resetClaimState = useCallback(() => {
    setClaimState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      txHash: null,
    });
  }, []);

  // Réinitialiser l'état d'annulation
  const resetCancelState = useCallback(() => {
    setCancelState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      txHash: null,
    });
  }, []);

  // Refetch automatique du solde après transaction réussie
  useEffect(() => {
    if (isSuccess && hash) {
      console.log("✅ Transaction confirmée, actualisation du solde...");

      // Pour les claims
      if (claimState.isLoading) {
        setClaimState((prev) => ({
          ...prev,
          isSuccess: true,
          isLoading: false,
          txHash: hash,
        }));

        toast.success("🎉 Gains réclamés avec succès !", {
          id: "claim-process",
          duration: 6000,
        });
      }

      // Pour les annulations
      if (cancelState.isLoading) {
        setCancelState((prev) => ({
          ...prev,
          isSuccess: true,
          isLoading: false,
          txHash: hash,
        }));

        toast.success("🎉 Partie annulée et remboursement effectué !", {
          id: "cancel-process",
          duration: 6000,
        });
      }

      setTimeout(() => {
        refetchBalance();
      }, 2000);
    }
  }, [
    isSuccess,
    hash,
    refetchBalance,
    claimState.isLoading,
    cancelState.isLoading,
  ]);

  // Créer une partie avec pari en MON natif
  const createBettingGame = useCallback(
    async (betAmountMON: string, roomName: string) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        const betAmount = parseEther(betAmountMON);

        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          toast.error("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "createGame",
          args: [roomName],
          value: betAmount,
        });

        toast.success("Creating betting game...");
      } catch (error) {
        console.error("Error creating betting game:", error);
        toast.error("Failed to create betting game");
      }
    },
    [address, writeContract, balance]
  );

  // Rejoindre une partie par ID
  const joinBettingGame = useCallback(
    async (gameId: bigint, betAmount: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          toast.error("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "joinGame",
          args: [gameId],
          value: betAmount,
        });

        toast.success("Joining betting game...");
      } catch (error) {
        console.error("Error joining betting game:", error);
        toast.error("Failed to join betting game");
      }
    },
    [address, writeContract, balance]
  );

  // Rejoindre une partie par nom de room
  const joinBettingGameByRoom = useCallback(
    async (roomName: string, betAmount: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          toast.error("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "joinGameByRoom",
          args: [roomName],
          value: betAmount,
        });

        toast.success("Joining betting game...");
      } catch (error) {
        console.error("Error joining betting game by room:", error);
        toast.error("Failed to join betting game");
      }
    },
    [address, writeContract, balance]
  );

  // Terminer une partie (réservé à l'owner du contrat)
  const finishBettingGame = useCallback(
    async (gameId: bigint, result: 1 | 2 | 3) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "finishGame",
          args: [gameId, result],
        });

        const resultText =
          result === GameResult.WHITE_WINS
            ? "White wins"
            : result === GameResult.BLACK_WINS
            ? "Black wins"
            : "Draw";

        alert(`Finishing game with result: ${resultText}...`);
      } catch (error) {
        console.error("Error finishing betting game:", error);

        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage.includes("Ownable: caller is not the owner")) {
          toast.error("Only the contract owner can finish games");
        } else if (errorMessage.includes("Game is not active")) {
          toast.error("Game is not active");
        } else if (errorMessage.includes("Game has no black player")) {
          toast.error("Game has no black player");
        } else if (errorMessage.includes("Invalid result")) {
          toast.error("Invalid game result");
        } else {
          toast.error("Failed to finish betting game");
        }
      }
    },
    [address, writeContract]
  );

  // Fonction pour finaliser une partie via le relayer API
  const finishGameViaRelayer = async (
    gameId: bigint,
    result: 1 | 2 | 3
  ): Promise<boolean> => {
    try {
      console.log("🤖 Tentative de finalisation via relayer...");

      const response = await fetch("/api/finish-game-relayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: gameId.toString(),
          result: result,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(
          "✅ Partie finalisée par le relayer:",
          data.transactionHash
        );
        return true;
      } else {
        console.log("❌ Erreur relayer:", data.error);

        if (
          data.error?.includes("not the contract owner") ||
          data.error?.includes("Unauthorized") ||
          data.error?.includes("0x118cdaa7")
        ) {
          console.log(
            "🔄 Le relayer direct a échoué, fallback vers méthode manuelle"
          );
        }

        return false;
      }
    } catch (error) {
      console.error("❌ Erreur de communication avec le relayer:", error);
      return false;
    }
  };

  // Réclamer les gains
  const claimWinnings = useCallback(
    async (
      gameId: bigint,
      result: 1 | 2 | 3,
      onSuccess?: () => void,
      onError?: (error: string) => void
    ) => {
      if (!address) {
        const errorMsg = "Veuillez connecter votre portefeuille";
        toast.error(errorMsg);
        setClaimState((prev) => ({ ...prev, isError: true, error: errorMsg }));
        onError?.(errorMsg);
        return;
      }

      // Réinitialiser l'état
      setClaimState({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        txHash: null,
      });

      let finishGameTxHash: string | null = null;
      const claimTxHash: string | null = null;

      try {
        if (!publicClient) {
          const errorMsg = "Réseau non disponible";
          toast.error(errorMsg);
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        // 1. Vérifier d'abord les informations du jeu
        toast.loading("Vérification des informations de la partie...", {
          id: "claim-process",
        });

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        console.log("💰 Game info", gameInfo);

        // 2. Vérifications préliminaires
        if (!gameInfo) {
          const errorMsg = "Partie introuvable";
          toast.error(errorMsg, { id: "claim-process" });
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        // 3. Vérifier si le joueur connecté est dans la partie
        const isWhitePlayer =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
        const isBlackPlayer =
          gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

        if (!isWhitePlayer && !isBlackPlayer) {
          const errorMsg = "Vous n'êtes pas un joueur de cette partie";
          toast.error(errorMsg, { id: "claim-process" });
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        // 4. Finaliser la partie si nécessaire
        if (gameInfo.state !== GameState.FINISHED) {
          toast.loading("Étape 1/2: Finalisation automatique de la partie...", {
            id: "claim-process",
          });

          const relayerSuccess = await finishGameViaRelayer(gameId, result);

          if (relayerSuccess) {
            toast.loading("✅ Partie finalisée automatiquement !", {
              id: "claim-process",
            });
          } else {
            toast.loading(
              "⚠️ Finalisation automatique échouée. Confirmez la transaction pour payer les frais...",
              {
                id: "claim-process",
              }
            );

            try {
              await writeContract({
                address: CHESS_BETTING_CONTRACT_ADDRESS,
                abi: CHESS_BETTING_ABI,
                functionName: "finishGame",
                args: [gameId, result],
              });

              let attempts = 0;
              while (!hash && attempts < 50) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                attempts++;
              }

              if (hash) {
                finishGameTxHash = hash;
                toast.loading("Attente de confirmation de la finalisation...", {
                  id: "claim-process",
                });

                const finishReceipt =
                  await publicClient.waitForTransactionReceipt({
                    hash: hash,
                  });

                if (finishReceipt.status !== "success") {
                  throw new Error("Échec de la finalisation de la partie");
                }

                toast.loading("Partie finalisée avec succès !", {
                  id: "claim-process",
                });
              }
            } catch (finishError: unknown) {
              console.error("Error finishing game:", finishError);

              let errorMessage = "Échec de la finalisation de la partie";
              if (finishError instanceof Error) {
                const msg = finishError.message.toLowerCase();
                if (
                  msg.includes("user rejected") ||
                  msg.includes("user denied")
                ) {
                  errorMessage =
                    "Transaction de finalisation annulée par l'utilisateur";
                } else if (msg.includes("only the contract owner")) {
                  errorMessage =
                    "Seul le propriétaire du contrat peut finaliser les parties";
                } else if (msg.includes("game is not active")) {
                  errorMessage = "La partie n'est pas active";
                } else if (finishError.message) {
                  errorMessage = finishError.message;
                }
              }

              toast.error(errorMessage, {
                id: "claim-process",
                duration: 6000,
              });
              setClaimState({
                isLoading: false,
                isSuccess: false,
                isError: true,
                error: errorMessage,
                txHash: null,
              });
              onError?.(errorMessage);
              return;
            }
          }
        }

        // 5. Vérifier l'éligibilité pour le claim
        toast.loading("Vérification de l'éligibilité pour la réclamation...", {
          id: "claim-process",
        });

        const canClaim = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "canClaimWinnings",
          args: [gameId, address],
        })) as boolean;

        if (!canClaim) {
          const errorMsg = "Impossible de réclamer les gains pour le moment";
          toast.error(errorMsg, { id: "claim-process" });
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const winnings = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "calculateWinnings",
          args: [gameId],
        })) as bigint;

        // 6. Procéder au claim
        toast.loading(
          `Étape 2/2: Réclamation de ${formatEther(
            winnings
          )} MON - Confirmez la transaction...`,
          { id: "claim-process" }
        );

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "claimWinnings",
          args: [gameId],
        });

        toast.loading("Transaction envoyée, confirmation en cours...", {
          id: "claim-process",
        });
      } catch (error: unknown) {
        console.error("Error claiming winnings:", error);

        let errorMessage = "Échec de la réclamation des gains";

        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("game not finished")) {
            errorMessage = "La partie n'est pas encore terminée";
          } else if (msg.includes("not the winner")) {
            errorMessage = "Vous n'êtes pas le gagnant de cette partie";
          } else if (msg.includes("already claimed")) {
            errorMessage = "Les gains ont déjà été réclamés";
          } else if (
            msg.includes("user rejected") ||
            msg.includes("user denied")
          ) {
            errorMessage =
              "Transaction de réclamation annulée par l'utilisateur";
          } else if (msg.includes("insufficient funds")) {
            errorMessage =
              "Fonds insuffisants pour payer les frais de transaction";
          } else if (msg.includes("network")) {
            errorMessage = "Erreur de réseau, veuillez réessayer";
          } else if (error.message) {
            errorMessage = error.message;
          }
        }

        toast.error(errorMessage, { id: "claim-process", duration: 6000 });

        setClaimState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          txHash: claimTxHash || finishGameTxHash,
        });

        onError?.(errorMessage);
      }
    },
    [address, writeContract, publicClient, hash]
  );

  const claimDrawRefund = useCallback(
    async (gameId: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        if (!publicClient) {
          toast.error("Network not available");
          return;
        }

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        if (!gameInfo) {
          toast.error("Game not found");
          return;
        }

        if (gameInfo.state !== GameState.FINISHED) {
          toast.error("Game is not finished yet");
          return;
        }

        if (gameInfo.result !== GameResult.DRAW) {
          toast.error("Game did not end in a draw");
          return;
        }

        const isWhitePlayer =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
        const isBlackPlayer =
          gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

        if (!isWhitePlayer && !isBlackPlayer) {
          toast.error("You are not a player in this game");
          return;
        }

        const alreadyClaimed = isWhitePlayer
          ? gameInfo.whiteClaimed
          : gameInfo.blackClaimed;
        if (alreadyClaimed) {
          toast.error("Refund already claimed");
          return;
        }

        const canClaim = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "canClaimDrawRefund",
          args: [gameId, address],
        })) as boolean;

        if (!canClaim) {
          toast.error("Cannot claim draw refund at this time");
          return;
        }

        const refundAmount = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "calculateDrawRefund",
          args: [gameId],
        })) as bigint;

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "claimDrawRefund",
          args: [gameId],
        });

        toast.success(`Claiming ${formatEther(refundAmount)} MON refund...`);
      } catch (error: unknown) {
        console.error("Error claiming draw refund:", error);
        toast.error("Failed to claim draw refund. Please try again.");
      }
    },
    [address, writeContract, publicClient]
  );

  const cancelBettingGame = useCallback(
    async (
      gameId: bigint,
      onSuccess?: () => void,
      onError?: (error: string) => void
    ) => {
      if (!address) {
        const errorMsg = "Please connect your wallet";
        toast.error(errorMsg);
        onError?.(errorMsg);
        return;
      }

      // Réinitialiser l'état d'annulation
      setCancelState({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        txHash: null,
      });

      try {
        if (!publicClient) {
          const errorMsg = "Network not available";
          toast.error(errorMsg);
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        toast.loading("Checking game information...", {
          id: "cancel-process",
        });

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        if (!gameInfo) {
          const errorMsg = "Partie introuvable";
          toast.error(errorMsg, { id: "cancel-process" });
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const isCreator =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

        if (!isCreator) {
          const errorMsg = "Seul le créateur de la partie peut l'annuler";
          toast.error(errorMsg, { id: "cancel-process" });
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        if (gameInfo.state !== GameState.WAITING) {
          let errorMsg = "Cannot cancel this game";

          switch (gameInfo.state) {
            case GameState.ACTIVE:
              errorMsg = "Cannot cancel an active game";
              break;
            case GameState.FINISHED:
              errorMsg = "Cannot cancel a finished game";
              break;
            case GameState.CANCELLED:
              errorMsg = "This game is already cancelled";
              break;
          }

          toast.error(errorMsg, { id: "cancel-process" });
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const hasBlackPlayer =
          gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

        if (hasBlackPlayer) {
          const errorMsg =
            "Cannot cancel: an opponent has already joined the game";
          toast.error(errorMsg, { id: "cancel-process" });
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        if (gameInfo.betAmount <= BigInt(0)) {
          const errorMsg = "No amount to refund";
          toast.error(errorMsg, { id: "cancel-process" });
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const refundAmount = formatEther(gameInfo.betAmount);
        toast.loading(`Cancelling... Refunding ${refundAmount} MON`, {
          id: "cancel-process",
        });

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "cancelGame",
          args: [gameId],
        });

        toast.loading("Transaction envoyée, confirmation en cours...", {
          id: "cancel-process",
        });

        onSuccess?.();
      } catch (error: unknown) {
        console.error("Error canceling betting game:", error);

        let errorMessage = "Failed to cancel the game";

        if (error instanceof Error) {
          const msg = error.message.toLowerCase();

          if (msg.includes("game not found")) {
            errorMessage = "Game not found";
          } else if (
            msg.includes("not the creator") ||
            msg.includes("not authorized")
          ) {
            errorMessage = "Only the creator can cancel the game";
          } else if (msg.includes("game not in waiting state")) {
            errorMessage = "Cannot cancel: the game has already started";
          } else if (msg.includes("black player already joined")) {
            errorMessage = "Cannot cancel: an opponent has already joined";
          } else if (msg.includes("nothing to refund")) {
            errorMessage = "No amount to refund";
          } else if (
            msg.includes("user rejected") ||
            msg.includes("user denied")
          ) {
            errorMessage = "Transaction cancelled by the user";
          } else if (msg.includes("insufficient funds")) {
            errorMessage = "Insufficient funds to pay transaction fees";
          } else if (msg.includes("network")) {
            errorMessage = "Network error, please try again";
          } else if (error.message) {
            errorMessage = error.message;
          }
        }

        toast.error(errorMessage, { id: "cancel-process", duration: 6000 });
        setCancelState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
          txHash: null,
        });
        onError?.(errorMessage);
      }
    },
    [address, writeContract, publicClient]
  );

  return {
    createBettingGame,
    joinBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    cancelBettingGame,
    finishBettingGame,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    balance: balance?.value || BigInt(0),
    balanceFormatted: balance ? formatEther(balance.value) : "0",
    // États spécifiques au claim
    claimState,
    resetClaimState,
    // États spécifiques à l'annulation
    cancelState,
    resetCancelState,
  };
};

// Hook pour écouter les événements du contrat
export const useContractEvents = (gameId?: bigint) => {
  const { address } = useAccount();

  // Écouter les événements GameFinished
  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameFinished",
    args: gameId ? { gameId } : undefined,
    onLogs: (logs) => {
      console.log("🎯 GameFinished event detected:", logs);
    },
  });

  // Écouter les événements WinningsClaimed
  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "WinningsClaimed",
    args: address ? { player: address } : undefined,
    onLogs: (logs) => {
      console.log("💰 WinningsClaimed event detected:", logs);
    },
  });

  // Écouter les événements DrawRefundClaimed
  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "DrawRefundClaimed",
    args: address ? { player: address } : undefined,
    onLogs: (logs) => {
      console.log("🤝 DrawRefundClaimed event detected:", logs);
    },
  });

  // Écouter les événements GameJoined
  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameJoined",
    args: gameId ? { gameId } : undefined,
    onLogs: (logs) => {
      console.log("👥 GameJoined event detected:", logs);
    },
  });

  // NOUVEAU: Écouter les événements GameCancelled
  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameCancelled",
    args: address ? { player: address } : undefined,
    onLogs: (logs) => {
      console.log("❌ GameCancelled event detected:", logs);
    },
  });
};

// Hook pour lire les informations d'une partie
export const useGameInfo = (gameId?: bigint) => {
  const {
    data: gameInfo,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "getGame",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId && gameId > 0,
      refetchInterval: 5000,
      staleTime: 2000,
    },
  }) as { data: GameInfo | undefined; isLoading: boolean; refetch: () => void };

  return { gameInfo, isLoading, refetch };
};

// Hook pour obtenir l'ID de partie par nom de room
export const useGameIdByRoom = (roomName?: string) => {
  const {
    data: gameId,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "getGameIdByRoom",
    args: roomName ? [roomName] : undefined,
    query: {
      enabled: !!roomName,
      refetchInterval: 3000,
      staleTime: 1000,
    },
  }) as { data: bigint | undefined; isLoading: boolean; refetch: () => void };

  return { gameId, isLoading, refetch };
};

// Hook pour les statistiques d'un joueur
export const usePlayerStats = (playerAddress?: Address) => {
  const {
    data: rawStats,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "getPlayerStats",
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress,
      refetchInterval: 10000,
      staleTime: 5000,
    },
  });

  const playerStats: PlayerStats | undefined = rawStats
    ? {
        totalGames: rawStats[0],
        wins: rawStats[1],
        losses: rawStats[2],
        draws: rawStats[3],
        totalWinnings: rawStats[4],
        totalLosses: rawStats[5],
      }
    : undefined;

  return { playerStats, isLoading, refetch };
};

// Hook pour les statistiques head-to-head
export const useHeadToHeadStats = (player1?: Address, player2?: Address) => {
  const {
    data: rawStats,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "getHeadToHeadStats",
    args: player1 && player2 ? [player1, player2] : undefined,
    query: {
      enabled: !!(player1 && player2),
      refetchInterval: 10000,
      staleTime: 5000,
    },
  });

  const headToHeadStats: HeadToHeadStats | undefined = rawStats
    ? {
        player1Wins: rawStats[0],
        player1Losses: rawStats[1],
        draws: rawStats[2],
      }
    : undefined;

  return { headToHeadStats, isLoading, refetch };
};

// Hook pour vérifier si on peut réclamer des gains
export const useCanClaimWinnings = (
  gameId?: bigint,
  playerAddress?: Address
) => {
  const {
    data: canClaim,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "canClaimWinnings",
    args: gameId && playerAddress ? [gameId, playerAddress] : undefined,
    query: {
      enabled: !!(gameId && playerAddress),
      refetchInterval: 3000,
      staleTime: 1000,
    },
  }) as { data: boolean | undefined; isLoading: boolean; refetch: () => void };

  return { canClaim, isLoading, refetch };
};

export const useCanClaimDrawRefund = (
  gameId?: bigint,
  playerAddress?: Address
) => {
  const {
    data: canClaim,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "canClaimDrawRefund",
    args: gameId && playerAddress ? [gameId, playerAddress] : undefined,
    query: {
      enabled: !!(gameId && playerAddress),
      refetchInterval: 3000,
      staleTime: 1000,
    },
  }) as { data: boolean | undefined; isLoading: boolean; refetch: () => void };

  return { canClaim, isLoading, refetch };
};

// Hook pour calculer les gains potentiels
export const useCalculateWinnings = (gameId?: bigint) => {
  const {
    data: winnings,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "calculateWinnings",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
      staleTime: 2000,
    },
  }) as { data: bigint | undefined; isLoading: boolean; refetch: () => void };

  return {
    winnings,
    winningsFormatted: winnings ? formatEther(winnings) : "0",
    isLoading,
    refetch,
  };
};

// Hook pour calculer le remboursement en cas de match nul
export const useCalculateDrawRefund = (gameId?: bigint) => {
  const {
    data: refundAmount,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "calculateDrawRefund",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
      staleTime: 2000,
    },
  }) as { data: bigint | undefined; isLoading: boolean; refetch: () => void };

  return {
    refundAmount,
    refundFormatted: refundAmount ? formatEther(refundAmount) : "0",
    isLoading,
    refetch,
  };
};

// Hook pour les parties d'un joueur
export const usePlayerGames = (playerAddress?: Address) => {
  const {
    data: gameIds,
    isLoading,
    refetch,
  } = useReadContract({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    functionName: "getPlayerGames",
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress,
      refetchInterval: 10000,
      staleTime: 5000,
    },
  }) as { data: bigint[] | undefined; isLoading: boolean; refetch: () => void };

  return { gameIds, isLoading, refetch };
};

// NOUVEAU: Hook pour vérifier si une partie peut être annulée
export const useCanCancelGame = (gameId?: bigint) => {
  const { address } = useAccount();
  const { gameInfo } = useGameInfo(gameId);

  const canCancel = useMemo(() => {
    if (!gameInfo || !address || !gameId) return false;

    // Seulement le créateur (white player) peut annuler
    const isCreator =
      gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

    // Le jeu doit être en état WAITING
    const isWaitingState = gameInfo.state === GameState.WAITING;

    // Il doit y avoir un pari
    const hasBetting = gameInfo.betAmount > BigInt(0);

    // Il ne doit pas y avoir de deuxième joueur
    const noBlackPlayer =
      gameInfo.blackPlayer === "0x0000000000000000000000000000000000000000";

    return isCreator && isWaitingState && hasBetting && noBlackPlayer;
  }, [gameInfo, address, gameId]);

  const cancelInfo = useMemo(() => {
    if (!gameInfo || !canCancel) return null;

    return {
      refundAmount: gameInfo.betAmount,
      refundFormatted: formatEther(gameInfo.betAmount),
      roomName: gameInfo.roomName,
    };
  }, [gameInfo, canCancel]);

  const reasonCannotCancel = useMemo(() => {
    if (!gameInfo || !address) return "Informations missing";
    if (canCancel) return null;

    const isCreator =
      gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

    if (!isCreator) return "Only the creator can cancel";

    if (gameInfo.state !== GameState.WAITING) {
      switch (gameInfo.state) {
        case GameState.ACTIVE:
          return "Game in progress";
        case GameState.FINISHED:
          return "Game finished";
        case GameState.CANCELLED:
          return "Already cancelled";
        default:
          return "Invalid state";
      }
    }

    const hasBlackPlayer =
      gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

    if (hasBlackPlayer) return "An opponent has already joined";

    if (gameInfo.betAmount <= BigInt(0)) return "No bet to refund";

    return "Cancellation impossible";
  }, [gameInfo, address, canCancel]);

  return {
    canCancel,
    cancelInfo,
    reasonCannotCancel,
  };
};

// Hook combiné pour une partie complète avec toutes les infos
export const useCompleteGameInfo = (gameId?: bigint) => {
  const { address } = useAccount();
  const {
    gameInfo,
    isLoading: gameLoading,
    refetch: refetchGame,
  } = useGameInfo(gameId);
  const { canClaim: canClaimWin, refetch: refetchCanClaimWin } =
    useCanClaimWinnings(gameId, address);
  const { canClaim: canClaimDraw, refetch: refetchCanClaimDraw } =
    useCanClaimDrawRefund(gameId, address);
  const {
    winnings,
    winningsFormatted,
    refetch: refetchWinnings,
  } = useCalculateWinnings(gameId);
  const {
    refundAmount,
    refundFormatted,
    refetch: refetchRefund,
  } = useCalculateDrawRefund(gameId);

  // Écouter les événements du contrat pour ce gameId
  useContractEvents(gameId);

  const refetchAll = useCallback(() => {
    console.log("🔄 Refetching all game data...");
    refetchGame();
    refetchCanClaimWin();
    refetchCanClaimDraw();
    refetchWinnings();
    refetchRefund();
  }, [
    refetchGame,
    refetchCanClaimWin,
    refetchCanClaimDraw,
    refetchWinnings,
    refetchRefund,
  ]);

  const isPlayerInGame =
    gameInfo &&
    address &&
    (gameInfo.whitePlayer.toLowerCase() === address.toLowerCase() ||
      gameInfo.blackPlayer.toLowerCase() === address.toLowerCase());

  const playerColor =
    gameInfo && address
      ? gameInfo.whitePlayer.toLowerCase() === address.toLowerCase()
        ? "white"
        : "black"
      : null;

  const isGameCreator =
    gameInfo &&
    address &&
    gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

  const gameStateText = gameInfo
    ? gameInfo.state === GameState.WAITING
      ? "Waiting for opponent"
      : gameInfo.state === GameState.ACTIVE
      ? "Game in progress"
      : gameInfo.state === GameState.FINISHED
      ? "Game finished"
      : "Game cancelled"
    : "";

  const gameResultText = gameInfo
    ? gameInfo.result === GameResult.WHITE_WINS
      ? "White wins"
      : gameInfo.result === GameResult.BLACK_WINS
      ? "Black wins"
      : gameInfo.result === GameResult.DRAW
      ? "Draw"
      : ""
    : "";

  return {
    gameInfo,
    canClaimWin,
    canClaimDraw,
    winnings,
    winningsFormatted,
    refundAmount,
    refundFormatted,
    isPlayerInGame,
    playerColor,
    isGameCreator,
    gameStateText,
    gameResultText,
    isLoading: gameLoading,
    refetchAll,
  };
};

// Utilitaires
export const formatMON = (amount: bigint | string | number): string => {
  if (typeof amount === "bigint") {
    return formatEther(amount);
  }
  if (typeof amount === "string") {
    return formatEther(parseEther(amount));
  }
  return formatEther(parseEther(amount.toString()));
};

export const parseMON = (amount: string): bigint => {
  return parseEther(amount);
};

// Fonctions utilitaires pour les résultats de partie
export const finishGameWithResult = {
  whiteWins: (
    gameId: bigint,
    finishGame: (gameId: bigint, result: 1 | 2 | 3) => Promise<void>
  ) => finishGame(gameId, GameResult.WHITE_WINS as 1),
  blackWins: (
    gameId: bigint,
    finishGame: (gameId: bigint, result: 1 | 2 | 3) => Promise<void>
  ) => finishGame(gameId, GameResult.BLACK_WINS as 2),
  draw: (
    gameId: bigint,
    finishGame: (gameId: bigint, result: 1 | 2 | 3) => Promise<void>
  ) => finishGame(gameId, GameResult.DRAW as 3),
};
