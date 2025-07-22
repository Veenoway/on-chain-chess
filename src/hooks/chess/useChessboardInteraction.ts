/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Chess } from "chess.js";
import { useCallback } from "react";

export interface PieceDropHandlerArgs {
  sourceSquare: string;
  targetSquare: string;
  piece: any;
}

export const useChessboardInteraction = (
  gameState: any,
  currentPlayerId: string | null,
  multisynqView: any,
  currentMoveIndex: number,
  moveHistory: string[],
  gameInfo: any,
  address: string | undefined,
  playMoveSound: (
    moveResult: any,
    tempGame: Chess,
    isOpponentMove: boolean
  ) => void,
  fen: string,
  setFen: (fen: string) => void,
  setMoveHistory: (history: string[]) => void,
  setCurrentMoveIndex: (index: number) => void,
  selectedSquare: string | null,
  setSelectedSquare: (square: string | null) => void,
  possibleMoves: string[],
  setPossibleMoves: (moves: string[]) => void,
  getPossibleMoves: (square: string) => string[]
) => {
  const selectPiece = useCallback(
    (piece: { pieceType: string }, square: string | null) => {
      if (!square || !gameState.isActive || gameState.gameResult.type) {
        return;
      }

      const currentPlayer = gameState.players.find(
        (p: any) => p.id === currentPlayerId
      );
      if (!currentPlayer) {
        return;
      }

      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) {
        return;
      }

      const pieceColor = piece.pieceType.charAt(0) === "w" ? "white" : "black";
      if (pieceColor !== currentPlayer.color) {
        return;
      }

      const moves = getPossibleMoves(square);

      setSelectedSquare(square);
      setPossibleMoves(moves);
    },
    [
      gameState.isActive,
      gameState.gameResult.type,
      gameState.turn,
      gameState.players,
      currentPlayerId,
      getPossibleMoves,
      setSelectedSquare,
      setPossibleMoves,
    ]
  );

  const onPieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;

      if (!targetSquare || !currentPlayerId || !multisynqView) return false;
      if (
        gameState.gameResult.type ||
        currentMoveIndex < moveHistory.length - 1
      )
        return false;
      if (!gameState.isActive) return false;

      const currentPlayer = gameState.players.find(
        (p: any) => p.id === currentPlayerId
      );
      if (!currentPlayer) return false;

      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) return false;

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

      const tempGame = new Chess(gameState.fen);
      try {
        const moveResult = tempGame.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (moveResult) {
          playMoveSound(moveResult, tempGame, false);

          setFen(tempGame.fen());

          const newHistory = [...moveHistory, tempGame.fen()];
          setMoveHistory(newHistory);
          setCurrentMoveIndex(newHistory.length - 1);

          setSelectedSquare(null);
          setPossibleMoves([]);

          multisynqView.makeMove(
            sourceSquare,
            targetSquare,
            currentPlayerId,
            "q"
          );
          return true;
        }
      } catch (error) {
        console.warn("Invalid move:", error);
      }

      return false;
    },
    [
      currentPlayerId,
      multisynqView,
      gameState,
      currentMoveIndex,
      moveHistory,
      gameInfo,
      address,
      playMoveSound,
      setFen,
      setMoveHistory,
      setCurrentMoveIndex,
      setSelectedSquare,
      setPossibleMoves,
    ]
  );

  const onPieceClick = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string };
      square: string | null;
    }) => {
      selectPiece(piece, square);
    },
    [selectPiece]
  );

  const onPieceDrag = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string };
      square: string | null;
    }) => {
      selectPiece(piece, square);
    },
    [selectPiece]
  );

  const onSquareClick = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string } | null;
      square: string;
    }) => {
      if (selectedSquare && possibleMoves.includes(square)) {
        const args = {
          sourceSquare: selectedSquare,
          targetSquare: square,
          piece: {} as any,
        };
        onPieceDrop(args);
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (!piece) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (piece) {
        selectPiece(piece, square);
      }
    },
    [
      selectedSquare,
      possibleMoves,
      onPieceDrop,
      setSelectedSquare,
      setPossibleMoves,
    ]
  );

  return {
    onPieceDrop,
    onPieceClick,
    onPieceDrag,
    onSquareClick,
    selectPiece,
  };
};
