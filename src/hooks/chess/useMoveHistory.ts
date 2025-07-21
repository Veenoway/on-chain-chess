import { useEffect, useRef, useState } from "react";

export const useMoveHistory = (roomName: string) => {
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const moveHistoryRef = useRef<string[]>([]);
  const currentMoveIndexRef = useRef(-1);

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
    if (currentMoveIndex > 0) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      return moveHistory[newIndex];
    }
    return null;
  };

  const goToNextMove = () => {
    if (currentMoveIndex < moveHistory.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      return moveHistory[newIndex];
    }
    return null;
  };

  const goToFirstMove = () => {
    if (moveHistory.length > 0) {
      setCurrentMoveIndex(0);
      return moveHistory[0];
    }
    return null;
  };

  const goToLastMove = () => {
    if (moveHistory.length > 0) {
      const lastIndex = moveHistory.length - 1;
      setCurrentMoveIndex(lastIndex);
      return moveHistory[lastIndex];
    }
    return null;
  };

  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    currentMoveIndexRef.current = currentMoveIndex;

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
