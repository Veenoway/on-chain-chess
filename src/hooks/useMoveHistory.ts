import { GameState } from "@/types/chess";
import { useEffect, useRef, useState } from "react";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface UseMoveHistoryProps {
  gameState: GameState;
  setFen: (fen: string) => void;
}

export function useMoveHistory({ gameState, setFen }: UseMoveHistoryProps) {
  const [moveHistory, setMoveHistory] = useState<string[]>([INITIAL_FEN]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  const moveHistoryRef = useRef<string[]>([INITIAL_FEN]);
  const currentMoveIndexRef = useRef(0);

  // Storage functions
  const getStorageKey = (roomName: string) => `chess_history_${roomName}`;

  const saveHistoryToStorage = (
    history: string[],
    index: number,
    roomName: string
  ) => {
    if (roomName && typeof window !== "undefined") {
      const data = {
        history,
        currentIndex: index,
        savedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(roomName), JSON.stringify(data));
      console.log("📱 History saved to localStorage:", {
        history: history.length,
        index,
        room: roomName,
      });
    }
  };

  const loadHistoryFromStorage = (roomName: string) => {
    if (!roomName || typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(getStorageKey(roomName));
      if (stored) {
        const data = JSON.parse(stored);
        console.log("📱 History loaded from localStorage:", {
          history: data.history?.length,
          index: data.currentIndex,
          room: roomName,
        });
        return data;
      }
    } catch (error) {
      console.error("Error loading localStorage:", error);
    }
    return null;
  };

  const clearHistoryFromStorage = (roomName: string) => {
    if (roomName && typeof window !== "undefined") {
      localStorage.removeItem(getStorageKey(roomName));
      console.log("🗑️ History removed from localStorage for:", roomName);
    }
  };

  // Update refs when state changes and save to localStorage
  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    currentMoveIndexRef.current = currentMoveIndex;

    // Save to localStorage if we have an active room
    if (gameState.roomName && moveHistory.length > 0) {
      saveHistoryToStorage(moveHistory, currentMoveIndex, gameState.roomName);
    }
  }, [moveHistory, currentMoveIndex, gameState.roomName]);

  // Detect new moves and add to history
  useEffect(() => {
    if (gameState.fen) {
      // If we're not at the latest move, update the displayed position
      if (
        currentMoveIndexRef.current === moveHistoryRef.current.length - 1 ||
        moveHistoryRef.current.length === 0
      ) {
        setFen(gameState.fen);
      }

      // Detect new move and add to history
      if (
        moveHistoryRef.current.length > 0 &&
        gameState.fen !==
          moveHistoryRef.current[moveHistoryRef.current.length - 1]
      ) {
        console.log("🆕 New move detected:", {
          newFen: gameState.fen,
          lastHistoryFen:
            moveHistoryRef.current[moveHistoryRef.current.length - 1],
          historyLength: moveHistoryRef.current.length,
          isActive: gameState.isActive,
          gameResult: gameState.gameResult.type,
        });

        // Add new position to history
        const newHistory = [...moveHistoryRef.current, gameState.fen];
        setMoveHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);
        setFen(gameState.fen);
      }
    }
  }, [gameState.fen, gameState.isActive, setFen]);

  // Reset history when new game starts
  useEffect(() => {
    if (gameState.isActive && gameState.fen === INITIAL_FEN) {
      console.log("Resetting history for new game");

      // Clear old history from localStorage
      if (gameState.roomName) {
        clearHistoryFromStorage(gameState.roomName);
      }

      setMoveHistory([INITIAL_FEN]);
      setCurrentMoveIndex(0);
    }
  }, [
    gameState.isActive,
    gameState.gameNumber,
    gameState.roomName,
    gameState.fen,
  ]);

  // Load history from localStorage when joining a room
  useEffect(() => {
    if (
      gameState.roomName &&
      moveHistory.length === 1 && // Only initial position
      gameState.players.length > 0
    ) {
      const savedHistory = loadHistoryFromStorage(gameState.roomName);

      if (
        savedHistory &&
        savedHistory.history &&
        savedHistory.history.length > 0
      ) {
        console.log("📥 Loading history from localStorage");
        setMoveHistory(savedHistory.history);
        setCurrentMoveIndex(savedHistory.currentIndex);
        // Display the position corresponding to saved index
        if (savedHistory.history[savedHistory.currentIndex]) {
          setFen(savedHistory.history[savedHistory.currentIndex]);
        }
      } else {
        console.log("🆔 Initializing fresh history");
        setMoveHistory([INITIAL_FEN]);
        setCurrentMoveIndex(0);
      }
    }
  }, [
    gameState.roomName,
    gameState.players.length,
    moveHistory.length,
    setFen,
  ]);

  return {
    moveHistory,
    currentMoveIndex,
    setMoveHistory,
    setCurrentMoveIndex,
    moveHistoryRef,
    currentMoveIndexRef,
  };
}
