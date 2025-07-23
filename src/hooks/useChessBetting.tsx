"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatEther, parseEther } from "viem";
import { readContract, waitForTransactionReceipt } from "viem/actions";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

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

export const useChessBetting = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isSuccess } =
    useWaitForTransactionReceipt({
      hash,
    });

  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
  });

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

  const resetClaimState = useCallback(() => {
    setClaimState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      txHash: null,
    });
  }, []);

  const resetCancelState = useCallback(() => {
    setCancelState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      txHash: null,
    });
  }, []);

  useEffect(() => {
    if (isSuccess && hash) {
      if (claimState.isLoading) {
        setClaimState((prev) => ({
          ...prev,
          isSuccess: true,
          isLoading: false,
          txHash: hash,
        }));
      }

      if (cancelState.isLoading) {
        setCancelState((prev) => ({
          ...prev,
          isSuccess: true,
          isLoading: false,
          txHash: hash,
        }));
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
        return;
      }

      try {
        const betAmount = parseEther(betAmountMON);

        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          console.log("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "createGame",
          args: [roomName],
          value: betAmount,
        });

        console.log("Creating betting game...");
      } catch (error) {
        console.error("Error creating betting game:", error);
        console.log("Failed to create betting game");
      }
    },
    [address, writeContract, balance]
  );

  // Rejoindre une partie par ID
  const joinBettingGame = useCallback(
    async (gameId: bigint, betAmount: bigint) => {
      if (!address) {
        return;
      }

      try {
        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          console.log("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "joinGame",
          args: [gameId],
          value: betAmount,
        });

        console.log("Joining betting game...");
      } catch (error) {
        console.error("Error joining betting game:", error);
        console.log("Failed to join betting game");
      }
    },
    [address, writeContract, balance]
  );

  // Rejoindre une partie par nom de room
  const joinBettingGameByRoom = useCallback(
    async (roomName: string, betAmount: bigint) => {
      if (!address) {
        return;
      }

      try {
        // Vérifier le solde
        if (balance && betAmount > balance.value) {
          console.log("Insufficient MON balance");
          return;
        }

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "joinGameByRoom",
          args: [roomName],
          value: betAmount,
        });

        console.log("Joining betting game...");
      } catch (error) {
        console.error("Error joining betting game by room:", error);
        console.log("Failed to join betting game");
      }
    },
    [address, writeContract, balance]
  );

  const finishBettingGame = useCallback(
    async (gameId: bigint, result: 1 | 2 | 3) => {
      if (!address) {
        return;
      }

      try {
        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "finishGame",
          args: [gameId, result],
        });
      } catch {}
    },
    [address, writeContract]
  );

  const finishGameViaRelayer = async (
    gameId: bigint,
    result: 1 | 2 | 3
  ): Promise<boolean> => {
    try {
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
        return true;
      } else {
        if (
          data.error?.includes("not the contract owner") ||
          data.error?.includes("Unauthorized") ||
          data.error?.includes("0x118cdaa7")
        ) {
        }

        return false;
      }
    } catch {
      return false;
    }
  };

  const claimWinnings = useCallback(
    async (
      gameId: bigint,
      result: 1 | 2 | 3,
      onSuccess?: () => void,
      onError?: (error: string) => void
    ) => {
      if (!address) {
        const errorMsg = "Veuillez connecter votre portefeuille";
        console.log(errorMsg);
        setClaimState((prev) => ({ ...prev, isError: true, error: errorMsg }));
        onError?.(errorMsg);
        return;
      }

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
          console.log(errorMsg);
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        if (!gameInfo) {
          const errorMsg = "Partie introuvable";
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const isWhitePlayer =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
        const isBlackPlayer =
          gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

        if (!isWhitePlayer && !isBlackPlayer) {
          const errorMsg = "Vous n'êtes pas un joueur de cette partie";
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        if (gameInfo.state !== GameState.FINISHED) {
          const relayerSuccess = await finishGameViaRelayer(gameId, result);

          if (relayerSuccess) {
          } else {
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
                const finishReceipt =
                  await publicClient.waitForTransactionReceipt({
                    hash: hash,
                  });

                if (finishReceipt.status !== "success") {
                  throw new Error("Échec de la finalisation de la partie");
                }
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

        const canClaim = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "canClaimWinnings",
          args: [gameId, address],
        })) as boolean;

        if (!canClaim) {
          const errorMsg = "Impossible de réclamer les gains pour le moment";
          setClaimState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "calculateWinnings",
          args: [gameId],
        })) as bigint;

        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "claimWinnings",
          args: [gameId],
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
        return;
      }

      try {
        if (!publicClient) {
          console.log("Network not available");
          return;
        }

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        if (!gameInfo) {
          console.log("Game not found");
          return;
        }

        if (gameInfo.state !== GameState.FINISHED) {
          console.log("Game is not finished yet");
          return;
        }

        if (gameInfo.result !== GameResult.DRAW) {
          console.log("Game did not end in a draw");
          return;
        }

        const isWhitePlayer =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
        const isBlackPlayer =
          gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

        if (!isWhitePlayer && !isBlackPlayer) {
          console.log("You are not a player in this game");
          return;
        }

        const alreadyClaimed = isWhitePlayer
          ? gameInfo.whiteClaimed
          : gameInfo.blackClaimed;
        if (alreadyClaimed) {
          console.log("Refund already claimed");
          return;
        }

        const canClaim = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "canClaimDrawRefund",
          args: [gameId, address],
        })) as boolean;

        if (!canClaim) {
          console.log("Cannot claim draw refund at this time");
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

        console.log(`Claiming ${formatEther(refundAmount)} MON refund...`);
      } catch (error: unknown) {
        console.error("Error claiming draw refund:", error);
        console.log("Failed to claim draw refund. Please try again.");
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
        console.log(errorMsg);
        onError?.(errorMsg);
        return;
      }

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
          console.log(errorMsg);
          setCancelState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          return;
        }

        const gameInfo = (await readContract(publicClient, {
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "getGame",
          args: [gameId],
        })) as GameInfo;

        if (!gameInfo) {
          const errorMsg = "Game not found";
          setCancelState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: errorMsg,
            txHash: null,
          });
          onError?.(errorMsg);
          return;
        }

        const isCreator =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

        if (!isCreator) {
          const errorMsg = "Only the creator can cancel the game";
          setCancelState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: errorMsg,
            txHash: null,
          });
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

          setCancelState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: errorMsg,
            txHash: null,
          });
          onError?.(errorMsg);
          return;
        }

        const hasBlackPlayer =
          gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

        if (hasBlackPlayer) {
          const errorMsg =
            "Cannot cancel: an opponent has already joined the game";
          setCancelState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: errorMsg,
            txHash: null,
          });
          onError?.(errorMsg);
          return;
        }

        if (gameInfo.betAmount <= BigInt(0)) {
          const errorMsg = "No amount to refund";
          setCancelState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: errorMsg,
            txHash: null,
          });
          onError?.(errorMsg);
          return;
        }

        const result = await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "cancelGame",
          args: [gameId],
        });

        const txHash = (result as unknown as { hash: `0x${string}` }).hash;

        setCancelState((prev) => ({
          ...prev,
          txHash,
        }));

        await waitForTransactionReceipt(publicClient, {
          hash: txHash,
        });

        setCancelState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          txHash,
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
            msg.includes("user denied") ||
            msg.includes("user cancelled")
          ) {
            errorMessage = "Transaction cancelled by user";
          } else if (msg.includes("insufficient funds")) {
            errorMessage = "Insufficient funds for transaction fees";
          } else if (msg.includes("network")) {
            errorMessage = "Network error, please try again";
          } else if (msg.includes("timeout")) {
            errorMessage = "Transaction timeout, please try again";
          } else if (error.message) {
            errorMessage = error.message;
          }
        }

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
    finishGameViaRelayer,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    balance: balance?.value || BigInt(0),
    balanceFormatted: balance ? formatEther(balance.value) : "0",
    claimState,
    resetClaimState,
    cancelState,
    resetCancelState,
  };
};

export const useContractEvents = (gameId?: bigint) => {
  const { address } = useAccount();

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameFinished",
    args: gameId ? { gameId } : undefined,
  });

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameCreated",
  });

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameJoined",
    args: gameId ? { gameId } : undefined,
  });

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "WinningsClaimed",
    args: address ? { player: address } : undefined,
  });

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "DrawRefundClaimed",
    args: address ? { player: address } : undefined,
  });

  useWatchContractEvent({
    address: CHESS_BETTING_CONTRACT_ADDRESS,
    abi: CHESS_BETTING_ABI,
    eventName: "GameCancelled",
    args: address ? { player: address } : undefined,
  });
};

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

export const useCanCancelGame = (gameId?: bigint) => {
  const { address } = useAccount();
  const { gameInfo } = useGameInfo(gameId);

  const canCancel = useMemo(() => {
    if (!gameInfo || !address || !gameId) return false;

    const isCreator =
      gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();

    const isWaitingState = gameInfo.state === GameState.WAITING;

    const hasBetting = gameInfo.betAmount > BigInt(0);

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

  useContractEvents(gameId);

  const refetchAll = useCallback(() => {
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
