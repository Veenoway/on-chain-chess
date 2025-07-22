import { useEffect, useRef, useState } from "react";

export const useMoveHistory = (roomName: string) => {
  const [moveHistory, setMoveHistory] = useState<string[]>([
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const moveHistoryRef = useRef<string[]>([
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ]);
  const currentMoveIndexRef = useRef(0);

  const getStorageKey = (roomName: string) => `chess_history_${roomName}`;

  const saveHistoryToStorage = (
    history: string[],
    index: number,
    roomName: string
  ) => {
    if (roomName) {
      const data = { history, currentIndex: index, savedAt: Date.now() };
      localStorage.setItem(getStorageKey(roomName), JSON.stringify(data));
    }
  };

  const loadHistoryFromStorage = (roomName: string) => {
    if (!roomName) return null;
    try {
      const stored = localStorage.getItem(getStorageKey(roomName));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  };

  const clearHistoryFromStorage = (roomName: string) => {
    if (roomName) {
      localStorage.removeItem(getStorageKey(roomName));
    }
  };

  const resetHistory = () => {
    if (roomName) {
      clearHistoryFromStorage(roomName);
    }
    setMoveHistory([
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ]);
    setCurrentMoveIndex(0);
  };

  const goToPreviousMove = () => {
    console.log("📋 [useMoveHistory] goToPreviousMove:", {
      currentMoveIndex,
      moveHistoryLength: moveHistory.length,
    });
    if (currentMoveIndex > 0) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      console.log("📋 [useMoveHistory] Aller au coup précédent:", newIndex);
      return moveHistory[newIndex];
    }
    return null;
  };

  const goToNextMove = () => {
    console.log("📋 [useMoveHistory] goToNextMove:", {
      currentMoveIndex,
      moveHistoryLength: moveHistory.length,
    });
    if (currentMoveIndex < moveHistory.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      console.log("📋 [useMoveHistory] Aller au coup suivant:", newIndex);
      return moveHistory[newIndex];
    }
    return null;
  };

  const goToFirstMove = () => {
    console.log("📋 [useMoveHistory] goToFirstMove:", {
      currentMoveIndex,
      moveHistoryLength: moveHistory.length,
    });
    if (moveHistory.length > 0) {
      setCurrentMoveIndex(0);
      console.log("📋 [useMoveHistory] Aller au premier coup");
      return moveHistory[0];
    }
    return null;
  };

  const goToLastMove = () => {
    console.log("📋 [useMoveHistory] goToLastMove:", {
      currentMoveIndex,
      moveHistoryLength: moveHistory.length,
    });
    if (moveHistory.length > 0) {
      const lastIndex = moveHistory.length - 1;
      setCurrentMoveIndex(lastIndex);
      console.log("📋 [useMoveHistory] Aller au dernier coup:", lastIndex);
      return moveHistory[lastIndex];
    }
    return null;
  };

  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    currentMoveIndexRef.current = currentMoveIndex;

    console.log("📋 [useMoveHistory] Historique mis à jour:", {
      moveHistoryLength: moveHistory.length,
      currentMoveIndex,
      roomName,
    });

    if (roomName && moveHistory.length > 0) {
      saveHistoryToStorage(moveHistory, currentMoveIndex, roomName);
    }
  }, [moveHistory, currentMoveIndex, roomName]);

  return {
    moveHistory,
    setMoveHistory,
    currentMoveIndex,
    setCurrentMoveIndex,
    moveHistoryRef,
    currentMoveIndexRef,
    resetHistory,
    loadHistoryFromStorage,
    goToPreviousMove,
    goToNextMove,
    goToFirstMove,
    goToLastMove,
  };
};
