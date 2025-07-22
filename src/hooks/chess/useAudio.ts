/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Chess } from "chess.js";
import { useCallback, useState } from "react";

export const useAudio = () => {
  const [audioCache] = useState(() => {
    const sounds = {
      move: new Audio("/move-self.mp3"),
      capture: new Audio("/capture.mp3"),
      check: new Audio("/move-check.mp3"),
      checkmate: new Audio("/game-end.mp3"),
      castle: new Audio("/castle.mp3"),
      moveOpponent: new Audio("/move-opponent.mp3"),
      promotion: new Audio("/promote.mp3"),
    };

    Object.entries(sounds).forEach(([name, audio]) => {
      audio.preload = "auto";
      audio.volume = 0.5;

      audio.addEventListener("canplaythrough", () => {
        console.log(`Audio ${name} loaded successfully`);
      });

      audio.addEventListener("error", (e) => {
        console.warn(`Failed to load audio ${name}:`, e);
      });
    });

    sounds.move.volume = 0.4;
    sounds.moveOpponent.volume = 0.3;
    sounds.checkmate.volume = 0.7;
    sounds.promotion.volume = 0.6;

    return sounds;
  });

  const playMoveSound = useCallback(
    (moveResult: any, tempGame: Chess, isOpponentMove: boolean = false) => {
      try {
        let soundToPlay: HTMLAudioElement;
        let soundName: string;

        if (tempGame.isCheckmate()) {
          soundToPlay = audioCache.checkmate;
          soundName = "checkmate";
        } else if (tempGame.inCheck()) {
          soundToPlay = audioCache.check;
          soundName = "check";
        } else if (moveResult.captured) {
          soundToPlay = audioCache.capture;
          soundName = "capture";
        } else if (moveResult.flags.includes("p")) {
          soundToPlay = audioCache.promotion;
          soundName = "promotion";
        } else if (
          moveResult.flags.includes("k") ||
          moveResult.flags.includes("q")
        ) {
          soundToPlay = audioCache.castle;
          soundName = "castle";
        } else {
          if (isOpponentMove) {
            soundToPlay = audioCache.moveOpponent;
            soundName = "move-opponent";
          } else {
            soundToPlay = audioCache.move;
            soundName = "move-self";
          }
        }

        soundToPlay.currentTime = 0;
        soundToPlay
          .play()
          .then(() => console.log(`Sound ${soundName} played successfully`))
          .catch((error) =>
            console.warn(`Failed to play sound ${soundName}:`, error)
          );
      } catch (error) {
        console.error("Error in playMoveSound:", error);
      }
    },
    [audioCache]
  );

  return { playMoveSound };
};
