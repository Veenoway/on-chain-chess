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
  // Fonction pour sélectionner une pièce et afficher les coups possibles
  const selectPiece = useCallback(
    (piece: { pieceType: string }, square: string | null) => {
      console.log("🎯 selectPiece appelé:", {
        piece,
        square,
        gameActive: gameState.isActive,
      });

      if (!square || !gameState.isActive || gameState.gameResult.type) {
        console.log("❌ Conditions non remplies pour sélection");
        return;
      }

      const currentPlayer = gameState.players.find(
        (p: any) => p.id === currentPlayerId
      );
      if (!currentPlayer) {
        console.log("❌ Joueur actuel non trouvé");
        return;
      }

      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      console.log("🔄 Vérification du tour:", {
        gameTurn: gameState.turn,
        playerColor: currentPlayer.color,
        isMyTurn,
      });

      if (!isMyTurn) {
        console.log("❌ Ce n'est pas votre tour");
        return;
      }

      // Vérifier si c'est notre pièce
      const pieceColor = piece.pieceType.charAt(0) === "w" ? "white" : "black";
      if (pieceColor !== currentPlayer.color) {
        console.log("❌ Ce n'est pas votre pièce:", {
          pieceColor,
          playerColor: currentPlayer.color,
        });
        return;
      }

      // Sélectionner la pièce et afficher les coups possibles
      const moves = getPossibleMoves(square);
      console.log("✅ Sélection de pièce:", { square, moves });

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

  // Fonction principale pour gérer le drop des pièces
  const onPieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;

      // Vérifications de base
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

      // Vérification de paiement pour les parties avec pari
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

      // Validation du mouvement avec chess.js
      const tempGame = new Chess(gameState.fen);
      try {
        const moveResult = tempGame.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (moveResult) {
          // Jouer le son approprié
          playMoveSound(moveResult, tempGame, false);

          // Mise à jour instantanée de l'interface (optimistic update)
          setFen(tempGame.fen());

          // Mettre à jour l'historique
          const newHistory = [...moveHistory, tempGame.fen()];
          setMoveHistory(newHistory);
          setCurrentMoveIndex(newHistory.length - 1);

          // Désélectionner la pièce
          setSelectedSquare(null);
          setPossibleMoves([]);

          // Envoyer le mouvement via Multisynq
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
      console.log("🎯 onSquareClick:", {
        piece,
        square,
        selectedSquare,
        possibleMoves,
      });

      // Si une pièce est sélectionnée et on clique sur un coup possible
      if (selectedSquare && possibleMoves.includes(square)) {
        console.log("✅ Exécution du coup:", selectedSquare, "->", square);
        const args = {
          sourceSquare: selectedSquare,
          targetSquare: square,
          piece: {} as any,
        };
        onPieceDrop(args);
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (!piece) {
        // Clic sur case vide - désélectionner
        console.log("🔄 Désélection (case vide)");
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (piece) {
        // Clic sur une pièce - la sélectionner
        console.log("🎯 Sélection nouvelle pièce via onSquareClick");
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
