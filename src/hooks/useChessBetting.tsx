"use client";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { Address, formatEther, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Obtenir le solde MON de l'utilisateur
  const { data: balance } = useBalance({
    address,
  });

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

  // Réclamer les gains
  const claimWinnings = useCallback(
    async (gameId: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "claimWinnings",
          args: [gameId],
        });

        toast.success("Claiming winnings...");
      } catch (error) {
        console.error("Error claiming winnings:", error);
        toast.error("Failed to claim winnings");
      }
    },
    [address, writeContract]
  );

  // Réclamer le remboursement en cas de match nul
  const claimDrawRefund = useCallback(
    async (gameId: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "claimDrawRefund",
          args: [gameId],
        });

        toast.success("Claiming draw refund...");
      } catch (error) {
        console.error("Error claiming draw refund:", error);
        toast.error("Failed to claim draw refund");
      }
    },
    [address, writeContract]
  );

  // Annuler une partie
  const cancelBettingGame = useCallback(
    async (gameId: bigint) => {
      if (!address) {
        toast.error("Please connect your wallet");
        return;
      }

      try {
        await writeContract({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "cancelGame",
          args: [gameId],
        });

        toast.success("Canceling betting game...");
      } catch (error) {
        console.error("Error canceling betting game:", error);
        toast.error("Failed to cancel betting game");
      }
    },
    [address, writeContract]
  );

  return {
    createBettingGame,
    joinBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    cancelBettingGame,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
    balance: balance?.value || BigInt(0),
    balanceFormatted: balance ? formatEther(balance.value) : "0",
  };
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
    },
  }) as { data: boolean | undefined; isLoading: boolean; refetch: () => void };

  return { canClaim, isLoading, refetch };
};

// Hook pour vérifier si on peut réclamer un remboursement de match nul
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
    },
  }) as { data: bigint[] | undefined; isLoading: boolean; refetch: () => void };

  return { gameIds, isLoading, refetch };
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
  const { winnings, winningsFormatted } = useCalculateWinnings(gameId);
  const { refundAmount, refundFormatted } = useCalculateDrawRefund(gameId);

  const refetchAll = useCallback(() => {
    refetchGame();
    refetchCanClaimWin();
    refetchCanClaimDraw();
  }, [refetchGame, refetchCanClaimWin, refetchCanClaimDraw]);

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
