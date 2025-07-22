"use client";
import { Chess } from "chess.js";

interface CapturedPiecesProps {
  fen: string;
  playerColor: "white" | "black";
  isOpponent?: boolean;
}

export default function CapturedPieces({
  fen,
  playerColor,
  isOpponent = false,
}: CapturedPiecesProps) {
  const PIECE_VALUES: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };

  const PIECE_SYMBOLS = {
    white: {
      p: "♙",
      n: "♘",
      b: "♗",
      r: "♖",
      q: "♕",
      k: "♔",
    },
    black: {
      p: "♟",
      n: "♞",
      b: "♝",
      r: "♜",
      q: "♛",
      k: "♚",
    },
  } as const;

  interface CapturedPiece {
    type: string;
    color: "w" | "b";
  }

  const getCapturedPieces = (fen: string) => {
    const chess = new Chess(fen);
    const board = chess.board();

    const initialPieces = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    };

    const remainingPieces = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } as Record<string, number>,
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } as Record<string, number>,
    };

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          remainingPieces[piece.color][piece.type]++;
        }
      }
    }

    const capturedByWhite: CapturedPiece[] = [];
    const capturedByBlack: CapturedPiece[] = [];

    Object.entries(initialPieces.b).forEach(([type, initialCount]) => {
      const captured = initialCount - remainingPieces.b[type];
      for (let i = 0; i < captured; i++) {
        capturedByWhite.push({ type, color: "b" });
      }
    });

    Object.entries(initialPieces.w).forEach(([type, initialCount]) => {
      const captured = initialCount - remainingPieces.w[type];
      for (let i = 0; i < captured; i++) {
        capturedByBlack.push({ type, color: "w" });
      }
    });

    return { capturedByWhite, capturedByBlack };
  };

  const getMaterialAdvantage = (
    capturedByPlayer: CapturedPiece[],
    capturedByOpponent: CapturedPiece[]
  ) => {
    const playerValue = capturedByPlayer.reduce(
      (sum, piece) => sum + (PIECE_VALUES[piece.type] || 0),
      0
    );
    const opponentValue = capturedByOpponent.reduce(
      (sum, piece) => sum + (PIECE_VALUES[piece.type] || 0),
      0
    );

    return playerValue - opponentValue;
  };

  const { capturedByWhite, capturedByBlack } = getCapturedPieces(fen);

  const isPlayerWhite = playerColor === "white";
  const capturedByPlayer = isPlayerWhite ? capturedByWhite : capturedByBlack;
  const capturedByOpponent = isPlayerWhite ? capturedByBlack : capturedByWhite;

  const piecesToShow = isOpponent ? capturedByOpponent : capturedByPlayer;
  const materialAdvantage = getMaterialAdvantage(
    capturedByPlayer,
    capturedByOpponent
  );

  const displayAdvantage = isOpponent ? -materialAdvantage : materialAdvantage;

  return (
    <div className={`flex items-center justify-between`}>
      <div className="flex items-center gap-1">
        {piecesToShow.map((piece, index) => (
          <span key={index} className="text-2xl">
            {
              PIECE_SYMBOLS[piece.color === "w" ? "white" : "black"][
                piece.type as keyof typeof PIECE_SYMBOLS.white
              ]
            }
          </span>
        ))}
        {displayAdvantage > 0 && (
          <span className="text-[#836EF9] font-bold text-lg -mb-1 ml-2">
            +{displayAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}
