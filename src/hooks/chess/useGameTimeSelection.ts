import { useState } from "react";

const STORAGE_KEY = "chess-selected-game-time";
const DEFAULT_TIME = 180;

export const useGameTimeSelection = () => {
  const [selectedGameTime, setSelectedGameTimeState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return DEFAULT_TIME;
  });

  const setSelectedGameTime = (time: number) => {
    setSelectedGameTimeState(time);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, time.toString());
    }
  };

  const getStoredGameTime = (): number => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return DEFAULT_TIME;
  };

  return {
    selectedGameTime,
    setSelectedGameTime,
    getStoredGameTime,
  };
};
