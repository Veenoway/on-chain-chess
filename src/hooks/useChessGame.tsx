// hooks/useChessGame.ts
import { useCallback, useEffect, useMemo } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { multisynqService } from "../services/multisynqService";
import { useChessStore } from "../stores/chessStore";
import {
  useBothPlayersPaid,
  useCanPlay,
  useHasBettingRequirement,
  usePaymentStore,
} from "../stores/paymentStore";

export function useChessGame() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const {
    gameFlow,
    roomName,
    roomPassword,
    currentPlayerId,
    players,
    isActive,
    gameResult,
    multisynqReady,
    multisynqView,
    connectionStatus,
    setGameState,
    setCurrentPlayer,
    startNewGame,
  } = useChessStore();

  const {
    gameInfo,
    isPending,
    isConfirming,
    updatePaymentStatus,
    setNetworkStatus,
  } = usePaymentStore();

  const hasBettingRequirement = useHasBettingRequirement();
  const bothPlayersPaid = useBothPlayersPaid();
  const canPlay = useCanPlay();

  const isWrongNetwork = useMemo(() => chainId !== 10143, [chainId]);

  // Initialize Multisynq on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !multisynqReady) {
      multisynqService.initialize().catch(console.error);
    }
  }, [multisynqReady]);

  // Update network status
  useEffect(() => {
    setNetworkStatus(isWrongNetwork);
  }, [isWrongNetwork, setNetworkStatus]);

  // Update payment status when game info changes
  useEffect(() => {
    updatePaymentStatus();
  }, [gameInfo, updatePaymentStatus]);

  // Auto-start game when both players have paid
  useEffect(() => {
    if (
      hasBettingRequirement &&
      bothPlayersPaid &&
      players.length >= 2 &&
      !isActive &&
      !gameResult.type &&
      multisynqView
    ) {
      console.log("🚀 Auto-starting game - both players paid");
      multisynqView.startGame();
    }
  }, [
    hasBettingRequirement,
    bothPlayersPaid,
    players.length,
    isActive,
    gameResult.type,
    multisynqView,
  ]);

  // Auto-start game for non-betting games
  useEffect(() => {
    if (
      !hasBettingRequirement &&
      players.length >= 2 &&
      !isActive &&
      !gameResult.type &&
      multisynqView
    ) {
      console.log("🎲 Auto-starting game - no betting required");
      multisynqView.startGame();
    }
  }, [
    hasBettingRequirement,
    players.length,
    isActive,
    gameResult.type,
    multisynqView,
  ]);

  // Generate stable player ID
  const generatePlayerId = useCallback(() => {
    if (!address) return null;
    return `player_${address.slice(-8)}_${Date.now().toString(36)}`;
  }, [address]);

  // Create room
  const createRoom = useCallback(
    async (gameTime: number, betAmount?: string) => {
      if (!isConnected || !address || !multisynqReady) {
        throw new Error("Prerequisites not met");
      }

      if (isWrongNetwork) {
        await switchChain({ chainId: 10143 });
        return; // Will retry after network switch
      }

      const roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password = Math.random().toString(36).substring(2, 6);
      const playerId = generatePlayerId();

      if (!playerId) throw new Error("Failed to generate player ID");

      setGameState({ connectionStatus: "Creating room..." });

      try {
        const session = await multisynqService.createSession(
          roomName,
          password
        );

        setGameState({
          multisynqSession: session,
          multisynqView: session.view,
          roomName,
          roomPassword: password,
          gameTimeLimit: gameTime,
          whiteTime: gameTime,
          blackTime: gameTime,
          gameFlow: "game",
          connectionStatus: `✅ Room created: ${roomName}`,
        });

        setCurrentPlayer(playerId, "white"); // Creator is always white

        // Join as player
        session.view.joinPlayer(address, playerId);
        session.view.setGameTime(gameTime);

        // Update URL
        const newUrl = `${window.location.pathname}?room=${roomName}&password=${password}`;
        window.history.pushState({}, "", newUrl);

        return { roomName, password };
      } catch (error) {
        setGameState({ connectionStatus: "❌ Failed to create room" });
        throw error;
      }
    },
    [
      isConnected,
      address,
      multisynqReady,
      isWrongNetwork,
      switchChain,
      generatePlayerId,
      setGameState,
      setCurrentPlayer,
    ]
  );

  // Join room
  const joinRoom = useCallback(
    async (roomCode: string) => {
      if (!isConnected || !address || !multisynqReady) {
        throw new Error("Prerequisites not met");
      }

      if (isWrongNetwork) {
        await switchChain({ chainId: 10143 });
        return; // Will retry after network switch
      }

      const [roomName, password = ""] = roomCode.includes(":")
        ? roomCode.split(":")
        : [roomCode, ""];

      const playerId = generatePlayerId();
      if (!playerId) throw new Error("Failed to generate player ID");

      setGameState({ connectionStatus: "Joining room..." });

      try {
        const session = await multisynqService.createSession(
          roomName,
          password
        );

        setGameState({
          multisynqSession: session,
          multisynqView: session.view,
          roomName,
          roomPassword: password,
          gameFlow: "game",
          connectionStatus: `✅ Connected to: ${roomName}`,
        });

        setCurrentPlayer(playerId, "black"); // Joiner is typically black

        // Join as player
        session.view.joinPlayer(address, playerId);

        // Update URL
        const newUrl = password
          ? `${window.location.pathname}?room=${roomName}&password=${password}`
          : `${window.location.pathname}?room=${roomName}`;
        window.history.pushState({}, "", newUrl);

        return { roomName, password };
      } catch (error) {
        setGameState({ connectionStatus: "❌ Room not found" });
        throw error;
      }
    },
    [
      isConnected,
      address,
      multisynqReady,
      isWrongNetwork,
      switchChain,
      generatePlayerId,
      setGameState,
      setCurrentPlayer,
    ]
  );

  // Auto-join from URL
  useEffect(() => {
    if (!multisynqReady || !isConnected || !address || gameFlow !== "welcome") {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get("room");
    const passwordFromUrl = urlParams.get("password");

    if (roomFromUrl) {
      const roomCode = passwordFromUrl
        ? `${roomFromUrl}:${passwordFromUrl}`
        : roomFromUrl;
      joinRoom(roomCode).catch(console.error);
    }
  }, [multisynqReady, isConnected, address, gameFlow, joinRoom]);

  return {
    // State
    gameFlow,
    connectionStatus,
    canPlay,
    hasBettingRequirement,
    bothPlayersPaid,
    isWrongNetwork,
    isPending,
    isConfirming,

    // Actions
    createRoom,
    joinRoom,
    switchChain: () => switchChain({ chainId: 10143 }),
  };
}

// Hook for game timer management
export function useGameTimer() {
  const { isActive, gameResult, players, currentPlayerId, multisynqView } =
    useChessStore();

  const bothPlayersPaid = useBothPlayersPaid();

  useEffect(() => {
    const isFirstPlayer =
      players.length > 0 && players[0].id === currentPlayerId;

    if (
      isActive &&
      !gameResult.type &&
      isFirstPlayer &&
      bothPlayersPaid &&
      multisynqView
    ) {
      const interval = setInterval(() => {
        multisynqView.updateTimer();
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [
    isActive,
    gameResult.type,
    players,
    currentPlayerId,
    bothPlayersPaid,
    multisynqView,
  ]);
}

// Hook for move history navigation
export function useMoveNavigation() {
  const {
    moveHistory,
    currentMoveIndex,
    nextMove,
    previousMove,
    goToMove,
    setGameState,
  } = useChessStore();

  const goToFirst = useCallback(() => {
    goToMove(0);
    setGameState({ showGameEndModal: false, hasClosedModal: true });
  }, [goToMove, setGameState]);

  const goToLast = useCallback(() => {
    goToMove(moveHistory.length - 1);
    setGameState({ showGameEndModal: false, hasClosedModal: true });
  }, [goToMove, moveHistory.length, setGameState]);

  const goNext = useCallback(() => {
    nextMove();
    setGameState({ showGameEndModal: false, hasClosedModal: true });
  }, [nextMove, setGameState]);

  const goPrevious = useCallback(() => {
    previousMove();
    setGameState({ showGameEndModal: false, hasClosedModal: true });
  }, [previousMove, setGameState]);

  const isAtStart = currentMoveIndex === 0;
  const isAtEnd = currentMoveIndex === moveHistory.length - 1;
  const isInAnalysisMode = !isAtEnd;

  return {
    currentMoveIndex,
    totalMoves: moveHistory.length - 1,
    isAtStart,
    isAtEnd,
    isInAnalysisMode,
    goToFirst,
    goToLast,
    goNext,
    goPrevious,
  };
}

// Hook for chat functionality
export function useChat() {
  const { messages, multisynqView, currentPlayerId, addMessage } =
    useChessStore();

  const { address } = useAccount();
  const canPlay = useCanPlay();

  const sendMessage = useCallback(
    (message: string) => {
      if (
        !message.trim() ||
        !multisynqView ||
        !currentPlayerId ||
        !address ||
        !canPlay
      ) {
        return false;
      }

      multisynqView.sendMessage(message, currentPlayerId, address);
      return true;
    },
    [multisynqView, currentPlayerId, address, canPlay]
  );

  return {
    messages,
    sendMessage,
    canSendMessage: canPlay && !!multisynqView && !!currentPlayerId,
  };
}
