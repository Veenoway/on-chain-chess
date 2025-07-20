import React, { useMemo } from "react";
import { Chessboard } from "react-chessboard";

interface ChessBoardProps {
  fen: string;
  playerColor: "white" | "black";
  gameState: {
    isActive: boolean;
    gameResult: { type: string | null };
  };
  selectedSquare: string | null;
  possibleMoves: string[];
  checkmatedKingSquare: string | null;
  checkmateIconPosition: { left: number; top: number } | null;
  onPieceDrop: (args: {
    sourceSquare: string;
    targetSquare: string | null;
    piece: unknown;
  }) => boolean;
  onPieceClick: (args: {
    piece: { pieceType: string };
    square: string | null;
  }) => void;
  onPieceDrag: (args: {
    piece: { pieceType: string };
    square: string | null;
  }) => void;
  onSquareClick: (args: {
    piece: { pieceType: string } | null;
    square: string;
  }) => void;
}

export default function ChessBoard({
  fen,
  playerColor,
  gameState,
  selectedSquare,
  possibleMoves,
  checkmatedKingSquare,
  checkmateIconPosition,
  onPieceDrop,
  onPieceClick,
  onPieceDrag,
  onSquareClick,
}: ChessBoardProps) {
  // Styles pour l'échiquier (coups possibles + checkmate)
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlighting pour checkmate
    if (checkmatedKingSquare) {
      styles[checkmatedKingSquare] = {
        backgroundColor: "rgba(255, 0, 0, 0.4)",
        boxShadow: "inset 0 0 15px rgba(255, 0, 0, 0.7)",
      };
    }

    // Case sélectionnée - violet intense
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.6)",
        boxShadow: "inset 0 0 8px rgba(131, 110, 249, 0.8)",
      };
    }

    // Coups possibles - violet plus clair
    possibleMoves.forEach((square) => {
      if (square !== selectedSquare) {
        styles[square] = {
          backgroundColor: "rgba(131, 110, 249, 0.3)",
          boxShadow: "inset 0 0 5px rgba(131, 110, 249, 0.5)",
        };
      }
    });

    return styles;
  }, [selectedSquare, possibleMoves, checkmatedKingSquare]);

  // Configuration de l'échiquier avec les nouvelles APIs
  const chessboardOptions = useMemo(
    () => ({
      position: fen,
      onPieceDrop: onPieceDrop,
      onPieceClick: onPieceClick,
      onPieceDrag: onPieceDrag,
      onSquareClick: onSquareClick,
      boardOrientation: playerColor,
      arePiecesDraggable: gameState.isActive,
      boardWidth: 580,
      animationDuration: 50,
      squareStyles: squareStyles,
    }),
    [
      fen,
      onPieceDrop,
      onPieceClick,
      onPieceDrag,
      onSquareClick,
      playerColor,
      gameState.isActive,
      squareStyles,
    ]
  );

  return (
    <div className="relative aspect-square max-w-full w-full mx-auto">
      <Chessboard options={chessboardOptions} />

      {/* Icône de checkmate */}
      {checkmateIconPosition && checkmatedKingSquare && (
        <div
          className="absolute pointer-events-none z-1"
          style={{
            left: `${checkmateIconPosition.left}px`,
            top: `${checkmateIconPosition.top}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-16 h-16 relative animate-pulse">
            <div className="absolute inset-0 bg-red-500 rounded-full opacity-30 animate-ping"></div>
            <div className="absolute inset-2 bg-red-600 rounded-full flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white animate-bounce"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
