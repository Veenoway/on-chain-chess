// components/chess/ChessBoard.tsx
import { GameState } from "@/types/chess";
import { useMemo } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

interface ChessBoardProps {
  fen: string;
  playerColor: "white" | "black";
  gameState: GameState;
  currentMoveIndex: number;
  moveHistoryLength: number;
  selectedSquare: string | null;
  possibleMoves: string[];
  checkmatedKingSquare: string | null;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
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

export function ChessBoard({
  fen,
  playerColor,
  gameState,
  currentMoveIndex,
  moveHistoryLength,
  selectedSquare,
  possibleMoves,
  checkmatedKingSquare,
  onPieceDrop,
  onPieceClick,
  onPieceDrag,
  onSquareClick,
}: ChessBoardProps) {
  // Calculate square styles for highlighting
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlighting for checkmate
    if (checkmatedKingSquare) {
      styles[checkmatedKingSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.3)",
        boxShadow: "inset 0 0 15px rgba(131, 110, 249, 0.6)",
      };
    }

    // Selected square - violet intense
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.6)",
        boxShadow: "inset 0 0 8px rgba(131, 110, 249, 0.8)",
      };
    }

    // Possible moves - lighter violet
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

  // Chessboard configuration
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

  // Calculate checkmate icon position
  const checkmateIconPosition = useMemo(() => {
    if (!checkmatedKingSquare) return null;

    const file = checkmatedKingSquare.charCodeAt(0) - 97; // a=0, b=1, etc.
    const rank = parseInt(checkmatedKingSquare[1]) - 1; // 1=0, 2=1, etc.

    // Use board orientation
    const isFlipped = playerColor === "black";
    const x = isFlipped ? 7 - file : file;
    const y = isFlipped ? rank : 7 - rank;

    const squareSize = 580 / 8; // 72.5px per square

    return {
      left: x * squareSize + squareSize / 2,
      top: y * squareSize + squareSize / 2,
    };
  }, [checkmatedKingSquare, playerColor]);

  return (
    <div className="relative aspect-square max-w-full w-full mx-auto">
      <Chessboard options={chessboardOptions} />

      {/* Checkmate Icon */}
      {checkmateIconPosition && checkmatedKingSquare && (
        <div
          className="absolute pointer-events-none z-1"
          style={{
            left: `${checkmateIconPosition.left}px`,
            top: `${checkmateIconPosition.top}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="relative z-[0] animate-in zoom-in-50 duration-200">
            <div className="absolute inset-0 w-10 h-10 bg-red-500 rounded-full opacity-40 animate-ping -translate-x-1/2 -translate-y-1/2 z-[0]" />
            <div className="absolute inset-0 w-8 h-8 bg-red-600 rounded-full opacity-95 -translate-x-1/2 -translate-y-1/2 z-[0]">
              <div className="relative text-xl text-white font-bold flex items-center justify-center w-8 h-8">
                ✗
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Mode Indicator */}
      {(gameState.gameResult.type ||
        (gameState.isActive && currentMoveIndex < moveHistoryLength - 1)) && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-[#252525] backdrop-blur-sm px-3 py-1 flex items-center rounded-lg border border-white/10 shadow-xl">
            <div className="bg-yellow-300 h-2.5 w-2.5 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium ml-2">
              Analysis mode
              {moveHistoryLength > 1 &&
                currentMoveIndex < moveHistoryLength - 1 && (
                  <span className="ml-2 text-yellow-300">
                    (Move {currentMoveIndex}/{moveHistoryLength - 1})
                  </span>
                )}
            </span>
          </div>
        </div>
      )}

      {/* Back to Game Button */}
      {gameState.isActive && currentMoveIndex < moveHistoryLength - 1 && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => {
              // This should be handled by parent component
              // We'll need to pass a callback for this
            }}
            className="bg-[#836EF9]/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#836EF9] text-white text-sm font-medium hover:bg-[#836EF9] transition-colors"
          >
            Back to game
          </button>
        </div>
      )}
    </div>
  );
}
