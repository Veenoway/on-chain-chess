/* eslint-disable @typescript-eslint/no-explicit-any */
import { GameState } from "@/types/chess";
import { MultisynqView } from "@/types/multisynq";
import { Chess } from "chess.js";
import { useCallback, useMemo, useState } from "react";
import { type PieceDropHandlerArgs } from "react-chessboard";
import { GameInfo } from "./useChessBetting";

interface UseChessBoardProps {
  gameState: GameState;
  gameInfo: GameInfo | null;
  currentPlayerId: string | null;
  address: string | null;
  multisynqView: MultisynqView | null;
  fen: string;
  setFen: (fen: string) => void;
  moveHistory: string[];
  setMoveHistory: (history: string[]) => void;
  currentMoveIndex: number;
  setCurrentMoveIndex: (index: number) => void;
}

export function useChessBoard({
  gameState,
  gameInfo,
  currentPlayerId,
  address,
  multisynqView,
  fen,
  setFen,
  moveHistory,
  setMoveHistory,
  currentMoveIndex,
  setCurrentMoveIndex,
}: UseChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  // Calculate possible moves for a square
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

  // Get checkmated king position
  const checkmatedKingSquare = useMemo(() => {
    if (gameState.gameResult.type === "checkmate") {
      try {
        const chess = new Chess(fen);
        if (chess.isCheckmate()) {
          const board = chess.board();
          const checkmatedColor = chess.turn(); // Color that can't move = loser

          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const piece = board[row][col];
              if (
                piece &&
                piece.type === "k" &&
                piece.color === checkmatedColor
              ) {
                const file = String.fromCharCode(97 + col); // a-h
                const rank = (8 - row).toString(); // 1-8
                return file + rank;
              }
            }
          }
        }
      } catch (error) {
        console.log("Error detecting checkmated king:", error);
      }
    }
    return null;
  }, [fen, gameState.gameResult.type]);

  // Select piece and show possible moves
  const selectPiece = useCallback(
    (piece: { pieceType: string }, square: string | null) => {
      if (!square || !gameState.isActive || gameState.gameResult.type) return;

      const currentPlayer = gameState.players.find(
        (p) => p.id === currentPlayerId
      );
      if (!currentPlayer) return;

      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) return;

      // Check if it's our piece
      const pieceColor = piece.pieceType.charAt(0) === "w" ? "white" : "black";
      if (pieceColor !== currentPlayer.color) return;

      // Select piece and show possible moves
      setSelectedSquare(square);
      setPossibleMoves(getPossibleMoves(square));
    },
    [
      gameState.isActive,
      gameState.gameResult.type,
      gameState.turn,
      gameState.players,
      currentPlayerId,
      getPossibleMoves,
    ]
  );

  // Handle piece drop
  const onPieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;

      // Quick validations first
      if (!targetSquare || !currentPlayerId || !multisynqView) return false;
      if (
        gameState.gameResult.type ||
        currentMoveIndex < moveHistory.length - 1
      )
        return false;
      if (!gameState.isActive) return false;

      const currentPlayer = gameState.players.find(
        (p) => p.id === currentPlayerId
      );
      if (!currentPlayer) return false;

      // Check turn
      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) return false;

      // Check payment if betting
      if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
        const isPlayerInContract =
          (currentPlayer.color === "white" &&
            gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase()) ||
          (currentPlayer.color === "black" &&
            gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase());

        if (!isPlayerInContract && gameInfo.state !== 1) {
          return false;
        }
      }

      // Validate move
      const tempGame = new Chess(gameState.fen);
      try {
        const moveResult = tempGame.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (moveResult) {
          // Optimistic update
          setFen(tempGame.fen());

          // Update history immediately
          const newHistory = [...moveHistory, tempGame.fen()];
          setMoveHistory(newHistory);
          setCurrentMoveIndex(newHistory.length - 1);

          // Clear selection
          setSelectedSquare(null);
          setPossibleMoves([]);

          // Send move
          multisynqView.makeMove(
            sourceSquare,
            targetSquare,
            currentPlayerId,
            "q"
          );
          return true;
        }
      } catch {
        // Invalid move
      }

      return false;
    },
    [
      currentPlayerId,
      multisynqView,
      gameState.gameResult.type,
      gameState.isActive,
      gameState.turn,
      gameState.players,
      gameState.fen,
      currentMoveIndex,
      moveHistory,
      gameInfo?.betAmount,
      gameInfo?.whitePlayer,
      gameInfo?.blackPlayer,
      gameInfo?.state,
      address,
    ]
  );

  return {
    selectedSquare,
    possibleMoves,
    checkmatedKingSquare,
    selectPiece,
    onPieceDrop,
  };
}
