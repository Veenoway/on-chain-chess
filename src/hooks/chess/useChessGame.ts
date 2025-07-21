/* eslint-disable @typescript-eslint/no-explicit-any */
import { Chess } from "chess.js";
import { useCallback, useMemo, useRef, useState } from "react";

export const useChessGame = () => {
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const gameRef = useRef(new Chess());

  const getPossibleMoves = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(fen);
        const moves = chess.moves({ square: square as any, verbose: true });
        return moves.map((move: any) => move.to);
      } catch {
        return [];
      }
    },
    [fen]
  );

  const getCheckmatedKingSquare = useMemo(() => {
    try {
      const chess = new Chess(fen);
      if (chess.isCheckmate()) {
        const board = chess.board();
        const checkmatedColor = chess.turn();

        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (
              piece &&
              piece.type === "k" &&
              piece.color === checkmatedColor
            ) {
              const file = String.fromCharCode(97 + col);
              const rank = (8 - row).toString();
              return file + rank;
            }
          }
        }
      }
    } catch {}
    return null;
  }, [fen]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (getCheckmatedKingSquare) {
      styles[getCheckmatedKingSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.3)",
        boxShadow: "inset 0 0 15px rgba(131, 110, 249, 0.6)",
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.6)",
        boxShadow: "inset 0 0 8px rgba(131, 110, 249, 0.8)",
      };
    }

    possibleMoves.forEach((square) => {
      if (square !== selectedSquare) {
        styles[square] = {
          backgroundColor: "rgba(131, 110, 249, 0.3)",
          boxShadow: "inset 0 0 5px rgba(131, 110, 249, 0.5)",
        };
      }
    });

    return styles;
  }, [selectedSquare, possibleMoves, getCheckmatedKingSquare]);

  return {
    fen,
    setFen,
    playerColor,
    setPlayerColor,
    selectedSquare,
    setSelectedSquare,
    possibleMoves,
    setPossibleMoves,
    gameRef,
    getPossibleMoves,
    getCheckmatedKingSquare,
    squareStyles,
  };
};
