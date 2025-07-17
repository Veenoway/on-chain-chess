// components/ChessGame/CapturedPieces.tsx
"use client";
import { Chess } from "chess.js";

interface CapturedPiecesProps {
  fen: string;
  playerColor: "white" | "black";
  isOpponent: boolean;
}

export default function CapturedPieces({
  fen,
  playerColor,
  isOpponent,
}: CapturedPiecesProps) {
  const getCapturedPieces = () => {
    try {
      const chess = new Chess(fen);
      const board = chess.board();

      // Count pieces on board
      const piecesOnBoard: { [key: string]: number } = {};

      board.forEach((row) => {
        row.forEach((square) => {
          if (square) {
            const key = `${square.color}_${square.type}`;
            piecesOnBoard[key] = (piecesOnBoard[key] || 0) + 1;
          }
        });
      });

      // Starting pieces count
      const startingPieces: { [key: string]: number } = {
        w_p: 8,
        w_r: 2,
        w_n: 2,
        w_b: 2,
        w_q: 1,
        w_k: 1,
        b_p: 8,
        b_r: 2,
        b_n: 2,
        b_b: 2,
        b_q: 1,
        b_k: 1,
      };

      // Calculate captured pieces
      const capturedByWhite: string[] = [];
      const capturedByBlack: string[] = [];

      Object.keys(startingPieces).forEach((pieceKey) => {
        const onBoard = piecesOnBoard[pieceKey] || 0;
        const captured = startingPieces[pieceKey] - onBoard;

        for (let i = 0; i < captured; i++) {
          if (pieceKey.startsWith("b_")) {
            capturedByWhite.push(pieceKey.split("_")[1]);
          } else {
            capturedByBlack.push(pieceKey.split("_")[1]);
          }
        }
      });

      return { capturedByWhite, capturedByBlack };
    } catch (error) {
      console.error("Error calculating captured pieces:", error);
      return { capturedByWhite: [], capturedByBlack: [] };
    }
  };

  const { capturedByWhite, capturedByBlack } = getCapturedPieces();

  // Determine which pieces to show based on perspective
  let piecesToShow: string[] = [];

  if (isOpponent) {
    // Show pieces captured BY the opponent (pieces of current player that were taken)
    piecesToShow = playerColor === "white" ? capturedByBlack : capturedByWhite;
  } else {
    // Show pieces captured BY the current player (pieces they took from opponent)
    piecesToShow = playerColor === "white" ? capturedByWhite : capturedByBlack;
  }

  const getPieceSymbol = (piece: string): string => {
    const symbols: { [key: string]: string } = {
      p: "♟", // pawn
      r: "♜", // rook
      n: "♞", // knight
      b: "♝", // bishop
      q: "♛", // queen
      k: "♚", // king (shouldn't be captured, but just in case)
    };

    return symbols[piece] || piece;
  };

  const getPieceValue = (piece: string): number => {
    const values: { [key: string]: number } = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    return values[piece] || 0;
  };

  // Sort pieces by value (lowest to highest)
  const sortedPieces = piecesToShow.sort(
    (a, b) => getPieceValue(a) - getPieceValue(b)
  );

  // Calculate material advantage
  const materialValue = sortedPieces.reduce(
    (sum, piece) => sum + getPieceValue(piece),
    0
  );

  if (sortedPieces.length === 0) {
    return <span className="text-gray-500">No captures</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-300">
        {sortedPieces.map((piece, index) => (
          <span key={index} className="text-lg">
            {getPieceSymbol(piece)}
          </span>
        ))}
      </span>
      {materialValue > 0 && (
        <span className="text-green-400 font-semibold ml-1">
          +{materialValue}
        </span>
      )}
    </div>
  );
}
