/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useChessGameMain.ts - VERSION MISE À JOUR
import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

// Import all our custom hooks
import { useAudio } from "./useAudio";
import { useBettingGame } from "./useBettingGame";
import { useChessboardInteraction } from "./useChessboardInteraction";
import { useChessGame } from "./useChessGame";
import { useGameControls } from "./useGameControls";
import { useGameModals } from "./useGameModals";
import { useGameState } from "./useGameState";
import { useMoveHistory } from "./useMoveHistory";
import { useRematchLogic } from "./useRematchLogic";
import { useRoomManagement } from "./useRoomManagement";
import { useTimer } from "./useTimer";

// 🎯 AJOUT: Import vos hooks de betting existants
import {
  useCanCancelGame,
  useChessBetting,
  useCompleteGameInfo,
  useContractEvents,
  useGameIdByRoom,
} from "@/hooks/useChessBetting";
import { formatEther } from "viem";
import { useContractIntegration } from "./useContractInteraction";
import { useMultisynq } from "./useMultiSynq";

export const useChessGameMain = () => {
  // Basic state hooks
  const {
    gameState,
    setGameState,
    gameFlow,
    setGameFlow,
    isReconnecting,
    setIsReconnecting,
    setLastKnownGameState,
    resetGameState,
  } = useGameState();

  const {
    setMultisynqSession,
    multisynqView,
    setMultisynqView,
    multisynqReady,
    setMultisynqReady,
    connectionStatus,
    setConnectionStatus,
    createMultisynqSession,
    closeSession,
    waitForMultisynqAvailable,
  } = useMultisynq();

  const {
    fen,
    setFen,
    playerColor,
    setPlayerColor,
    selectedSquare,
    setSelectedSquare,
    possibleMoves,
    setPossibleMoves,
    getPossibleMoves,
    getCheckmatedKingSquare,
    squareStyles,
  } = useChessGame();

  const {
    moveHistory,
    setMoveHistory,
    currentMoveIndex,
    setCurrentMoveIndex,
    goToPreviousMove,
    goToNextMove,
    goToFirstMove,
    goToLastMove,
  } = useMoveHistory(gameState.roomName);

  const { playMoveSound } = useAudio();

  // Additional state
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [menuActive, setMenuActive] = useState("create");
  const [copied, setCopied] = useState(false);

  const { address, isConnected, chainId } = useAccount();

  const {
    createBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    finishBettingGame,
    isPending,
    isConfirming,
    isSuccess,
    balanceFormatted,
    claimState,
    resetClaimState,
    cancelBettingGame,
    cancelState,
  } = useChessBetting();

  const { gameId } = useGameIdByRoom(gameState.roomName);
  const { gameInfo, refetchAll } = useCompleteGameInfo(gameId);
  const { canCancel } = useCanCancelGame(gameId);

  useContractEvents(gameId);

  const {
    betAmount,
    setBetAmount,
    isBettingEnabled,
    setIsBettingEnabled,
    setRoomBetAmount,
    bettingGameCreationFailed,
    setBettingGameCreationFailed,
    paymentStatus,
    setPaymentStatus,
    isFinalizingGame,
    setIsFinalizingGame,
    hasBettingRequirement,
    bothPlayersPaid,
    getCorrectBetAmount,
    canCurrentPlayerClaim,
    getAvailableAmount,
  } = useBettingGame(gameInfo, address);

  const {
    showGameEndModal,
    setShowGameEndModal,
    hasClosedModal,
    setHasClosedModal,
    hasClosedPaymentModal,
    setHasClosedPaymentModal,
    isRematchTransition,
    setIsRematchTransition,
    rematchInvitation,
    setRematchInvitation,
    handleCloseGameEndModal,
    resetModals,
  } = useGameModals(gameState.gameResult);

  const { getCurrentPlayerTime, getOpponentTime } = useTimer(
    gameState,
    currentPlayerId,
    multisynqView,
    isReconnecting,
    bothPlayersPaid
  );

  const {
    handleOfferDraw,
    handleRespondDraw,
    handleResign,
    handleRematchResponse,
    handleSendMessage,
  } = useGameControls(multisynqView, currentPlayerId);

  const { onPieceDrop, onPieceClick, onPieceDrag, onSquareClick } =
    useChessboardInteraction(
      gameState,
      currentPlayerId,
      multisynqView,
      currentMoveIndex,
      moveHistory,
      gameInfo,
      address,
      playMoveSound,
      fen,
      setFen,
      setMoveHistory,
      setCurrentMoveIndex,
      selectedSquare,
      setSelectedSquare,
      possibleMoves,
      setPossibleMoves,
      getPossibleMoves
    );

  const {
    roomInput,
    setRoomInput,
    isCreatingRoom,
    isCreatingRematch,
    isWrongNetwork,
    handleCreateRoom,
    handleJoinRoom,
    handleAutoJoinRoom,
  } = useRoomManagement(
    multisynqReady,
    createMultisynqSession,
    setCurrentPlayerId,
    setMultisynqSession,
    setMultisynqView,
    setGameState,
    setGameFlow as any,
    setConnectionStatus,
    setHasClosedPaymentModal,
    selectedGameTime,
    isBettingEnabled,
    betAmount,
    createBettingGame,
    setRoomBetAmount,
    setBettingGameCreationFailed
  );

  const { finishGameOnContract } = useContractIntegration(
    gameId,
    gameInfo,
    gameState,
    multisynqView,
    currentPlayerId,
    address,
    refetchAll,
    isSuccess,
    finishBettingGame,
    setIsFinalizingGame
  );

  const { canOfferRematch, createRematchWithPayment, handleNewGame } =
    useRematchLogic(
      gameState,
      gameInfo,
      multisynqView,
      currentPlayerId,
      address,
      setGameState,
      setShowGameEndModal,
      setIsRematchTransition,
      setPaymentStatus,
      setHasClosedPaymentModal,
      setBettingGameCreationFailed,
      createBettingGame,
      setRoomBetAmount,
      getCorrectBetAmount,
      handleCreateRoom,
      setFen,
      setMoveHistory,
      setCurrentMoveIndex
    );

  // Initialize Multisynq
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeMultisynq = async () => {
      if ((window as any).Multisynq) {
        setupMultisynqClasses();
        return;
      }

      try {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Multisynq"));
          document.head.appendChild(script);
        });

        await waitForMultisynqAvailable();
        setupMultisynqClasses();
      } catch {
        setConnectionStatus("Erreur chargement Multisynq");
      }
    };

    initializeMultisynq();
  }, []);

  // Setup Multisynq classes
  const setupMultisynqClasses = () => {
    const { Multisynq } = window as any;
    if (!Multisynq) {
      console.error("Multisynq not available");
      return;
    }

    try {
      // Define the Chess Model
      // Dans useChessGameMain.ts, remplacez la définition de ChessModel par cette version complète :

      class ChessModel extends Multisynq.Model {
        init() {
          this.state = {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            isActive: false,
            turn: "w",
            players: [],
            maxPlayers: 2,
            whiteTime: 600,
            blackTime: 600,
            gameTimeLimit: 600,
            lastMoveTime: null,
            roomName: "",
            roomPassword: "",
            messages: [],
            gameResult: { type: null },
            drawOffer: { offered: false, by: null },
            rematchOffer: { offered: false, by: null },
            gameNumber: 1,
            lastGameWinner: null,
            createdAt: Date.now(),
            rematchAccepted: false,
          };

          // Subscribe to all events
          this.subscribe(this.sessionId, "move", "handleMove");
          this.subscribe(this.sessionId, "join-player", "handlePlayerJoin");
          this.subscribe(this.sessionId, "chat-message", "handleChatMessage");
          this.subscribe(this.sessionId, "start-game", "handleStartGame");
          this.subscribe(this.sessionId, "reset-game", "handleResetGame");
          this.subscribe(this.sessionId, "update-timer", "handleUpdateTimer");
          this.subscribe(this.sessionId, "offer-draw", "handleOfferDraw");
          this.subscribe(this.sessionId, "respond-draw", "handleRespondDraw");
          this.subscribe(this.sessionId, "resign", "handleResign");
          this.subscribe(this.sessionId, "set-game-time", "handleSetGameTime");
          this.subscribe(
            this.sessionId,
            "request-rematch",
            "handleRequestRematch"
          );
          this.subscribe(
            this.sessionId,
            "respond-rematch",
            "handleRespondRematch"
          );
          this.subscribe(
            this.sessionId,
            "reset-rematch-accepted",
            "handleResetRematchAccepted"
          );

          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODE MANQUANTE: Gestion du temps de jeu
        handleSetGameTime(data: { gameTime: number }) {
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODE MANQUANTE: Demande de revanche
        handleRequestRematch(data: { playerId: string }) {
          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Request rematch",
            timestamp: Date.now(),
          });

          // Marquer qu'une revanche est demandée
          this.state.rematchOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODE MANQUANTE: Réponse à la revanche
        handleRespondRematch(data: { playerId: string; accepted: boolean }) {
          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept rematch" : "Decline rematch",
            timestamp: Date.now(),
          });

          if (data.accepted) {
            // Revanche acceptée - réinitialiser la partie
            this.state.fen =
              "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
            this.state.isActive = false; // Ne pas démarrer automatiquement
            this.state.turn = "w";
            this.state.whiteTime = this.state.gameTimeLimit;
            this.state.blackTime = this.state.gameTimeLimit;
            this.state.gameResult = { type: null };
            this.state.drawOffer = { offered: false, by: null };
            this.state.gameNumber += 1;
            this.state.lastMoveTime = null;

            // Inverser les couleurs pour la revanche
            this.state.players.forEach((p: any) => {
              p.color = p.color === "white" ? "black" : "white";
            });

            // Marquer qu'une revanche a été acceptée
            this.state.rematchAccepted = true;
          }

          // Réinitialiser l'offre de revanche
          this.state.rematchOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODE MANQUANTE: Reset du flag rematch accepté
        handleResetRematchAccepted() {
          this.state.rematchAccepted = false;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleMove(data: {
          from: any;
          to: any;
          promotion: any;
          playerId: any;
        }) {
          const { from, to, promotion } = data;
          console.log("🎯 Multisynq handleMove reçu:", {
            from,
            to,
            promotion,
            playerId: data.playerId,
          });

          const chess = new Chess(this.state.fen);

          try {
            const move = chess.move({
              from,
              to,
              promotion: promotion || "q",
            });

            if (move) {
              this.state.fen = chess.fen();
              this.state.turn = chess.turn();
              this.state.lastMoveTime = Date.now();

              console.log("✅ Coup validé dans Multisynq:", {
                newFen: this.state.fen,
                newTurn: this.state.turn,
                timestamp: this.state.lastMoveTime,
              });

              // ✅ NOUVEAU: Publication immédiate pour synchronisation rapide
              this.publish(this.sessionId, "game-state", this.state);
              console.log("📡 État publié immédiatement");

              // NOUVEAU: Jouer le son pour l'adversaire
              if (
                (window as any).globalPlayOpponentMoveSound &&
                typeof (window as any).globalPlayOpponentMoveSound ===
                  "function"
              ) {
                setTimeout(() => {
                  (window as any).globalPlayOpponentMoveSound({
                    from,
                    to,
                    promotion,
                  });
                }, 100);
              }

              // Vérifier fin de partie
              if (chess.isGameOver()) {
                this.state.isActive = false;
                if (chess.isCheckmate()) {
                  this.state.gameResult = {
                    type: "checkmate",
                    winner: chess.turn() === "w" ? "black" : "white",
                    message: `Checkmate ! ${
                      chess.turn() === "w" ? "Black" : "White"
                    } win`,
                  };
                  if ((window as any).finishGameOnContract) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                } else if (chess.isStalemate()) {
                  this.state.gameResult = {
                    type: "stalemate",
                    winner: "draw",
                    message: "Pat ! Draw",
                  };
                  if ((window as any).finishGameOnContract) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                } else if (chess.isDraw()) {
                  this.state.gameResult = {
                    type: "draw",
                    winner: "draw",
                    message: "Draw",
                  };
                  if ((window as any).finishGameOnContract) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                }

                this.publish(this.sessionId, "game-state", this.state);
              }
            }
          } catch {
            // Ignorer les erreurs de mouvement
          }
        }

        // MÉTHODE MANQUANTE: Timer complet
        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) return;

          let needsUpdate = false;

          // Décrémenter exactement 1 seconde pour le joueur actuel
          if (this.state.turn === "w") {
            const previousTime = this.state.whiteTime;
            this.state.whiteTime = Math.max(0, this.state.whiteTime - 1);
            needsUpdate = this.state.whiteTime !== previousTime;

            if (this.state.whiteTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "black",
                message: "Time's up! Black wins",
              };
              this.state.lastGameWinner = "black";
              needsUpdate = true;
              if ((window as any).finishGameOnContract) {
                setTimeout(
                  () =>
                    (window as any).finishGameOnContract(this.state.gameResult),
                  1000
                );
              }
            }
          } else {
            const previousTime = this.state.blackTime;
            this.state.blackTime = Math.max(0, this.state.blackTime - 1);
            needsUpdate = this.state.blackTime !== previousTime;

            if (this.state.blackTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "white",
                message: "Time's up! White wins",
              };
              this.state.lastGameWinner = "white";
              needsUpdate = true;
              if ((window as any).finishGameOnContract) {
                setTimeout(
                  () =>
                    (window as any).finishGameOnContract(this.state.gameResult),
                  1000
                );
              }
            }
          }

          if (needsUpdate) {
            this.state.lastMoveTime = Date.now();
            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        // MÉTHODE MANQUANTE: Gestion complète de la jointure des joueurs
        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          const { playerId, wallet } = data;

          // Vérifier si le joueur existe déjà par son wallet (reconnexion)
          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // Mettre à jour le joueur existant avec le nouveau playerId
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId;

            // Ajouter un message de reconnexion
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: "Reconnected to the game",
              timestamp: Date.now(),
            });

            this.publish(this.sessionId, "game-state", this.state);
            return;
          }

          // Si ce n'est pas une reconnexion et qu'il y a de la place
          else if (this.state.players.length < this.state.maxPlayers) {
            // Le PREMIER joueur est TOUJOURS blanc, le DEUXIÈME est TOUJOURS noir
            const color = this.state.players.length === 0 ? "white" : "black";

            const newPlayer = {
              id: playerId,
              wallet,
              color,
              connected: true,
            };

            this.state.players.push(newPlayer);

            // Ajouter un message de bienvenue
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: `Joined as ${color}`,
              timestamp: Date.now(),
            });
          } else {
            console.warn("Room pleine, impossible d'ajouter le joueur");
            return;
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODE: Gestion complète du chat avec invitations
        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
          console.log("💬 Message chat reçu:", message);

          if (message.message.startsWith("REMATCH_INVITATION:")) {
            try {
              const [, roomName, password, betAmount] =
                message.message.split(":");

              console.log("🎯 Invitation de rematch détectée:", {
                roomName,
                password,
                betAmount,
                from: message.playerWallet,
                senderId: message.playerId,
              });

              // Ajouter un message visible dans le chat
              this.state.messages.push({
                ...message,
                id: `msg_${Date.now()}_${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                message: `${message.playerWallet.slice(
                  0,
                  6
                )}...${message.playerWallet.slice(-4)} offers a rematch!`,
                timestamp: Date.now(),
              });

              // ✅ Déclencher l'événement pour afficher la popup
              console.log("📨 Déclenchement de l'événement rematchInvitation");
              window.dispatchEvent(
                new CustomEvent("rematchInvitation", {
                  detail: {
                    from: message.playerWallet,
                    senderId: message.playerId,
                    roomName: roomName,
                    password: password,
                    betAmount: betAmount,
                  },
                })
              );

              console.log(
                "✅ Événement rematchInvitation déclenché avec succès"
              );
            } catch (error) {
              console.error("❌ Erreur traitement invitation rematch:", error);
            }
          } else {
            // Message de chat normal
            this.state.messages.push({
              ...message,
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              timestamp: Date.now(),
            });
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        // MÉTHODES MANQUANTES: Toutes les autres méthodes
        handleStartGame() {
          if (this.state.players.length >= 2) {
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();
            this.state.drawOffer = { offered: false, by: null };
            this.state.rematchOffer = { offered: false, by: null };
            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        handleResetGame() {
          this.state.fen =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          this.state.isActive = false;
          this.state.turn = "w";
          this.state.whiteTime = this.state.gameTimeLimit;
          this.state.blackTime = this.state.gameTimeLimit;
          this.state.gameResult = { type: null };
          this.state.drawOffer = { offered: false, by: null };
          this.state.gameNumber += 1;
          this.state.lastMoveTime = null;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleOfferDraw(data: { playerId: string }) {
          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.drawOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Offer draw",
            timestamp: Date.now(),
          });

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRespondDraw(data: { playerId: string; accepted: boolean }) {
          if (!this.state.drawOffer.offered || this.state.gameResult.type)
            return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept draw" : "Decline draw offer",
            timestamp: Date.now(),
          });

          if (data.accepted) {
            this.state.isActive = false;
            this.state.gameResult = {
              type: "draw",
              winner: "draw",
              message: "Draw accepted",
            };
            this.state.lastGameWinner = "draw";
            if ((window as any).finishGameOnContract) {
              setTimeout(
                () =>
                  (window as any).finishGameOnContract(this.state.gameResult),
                1000
              );
            }
          }

          this.state.drawOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResign(data: { playerId: string }) {
          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Resign",
            timestamp: Date.now(),
          });

          this.state.isActive = false;
          this.state.gameResult = {
            type: "abandoned",
            winner: player.color === "white" ? "black" : "white",
            message: `${
              player.color === "white" ? "White" : "Black"
            } resign ! ${player.color === "white" ? "Black" : "White"} win`,
          };
          this.state.lastGameWinner =
            player.color === "white" ? "black" : "white";

          if ((window as any).finishGameOnContract) {
            setTimeout(
              () => (window as any).finishGameOnContract(this.state.gameResult),
              1000
            );
          }

          this.publish(this.sessionId, "game-state", this.state);
        }
      }

      // Define the Chess View
      // Dans useChessGameMain.ts, remplacez la définition de ChessView par cette version complète :

      class ChessView extends Multisynq.View {
        constructor(model: any) {
          super(model);
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
          console.log("🔄 Multisynq updateGameState reçu:", {
            newFen: newState.fen,
            newTurn: newState.turn,
            timestamp: newState.lastMoveTime,
          });

          if (typeof (window as any).globalSetGameState === "function") {
            (window as any).globalSetGameState((prevState: any) => {
              // NOUVEAU: Détecter un nouveau coup adverse pour jouer le son
              const hasNewMove = newState.fen !== prevState.fen && newState.fen;
              const isOpponentMove =
                hasNewMove &&
                newState.lastMoveTime &&
                newState.lastMoveTime !== prevState.lastMoveTime;

              // ✅ NOUVEAU: Mettre à jour immédiatement le FEN local
              if (hasNewMove && (window as any).globalSetFen) {
                console.log("🎯 Mise à jour immédiate du FEN:", newState.fen);
                (window as any).globalSetFen(newState.fen);

                // Mettre à jour l'historique des coups
                if (
                  (window as any).globalSetMoveHistory &&
                  (window as any).globalSetCurrentMoveIndex
                ) {
                  const currentHistory = prevState.moveHistory || [];
                  if (!currentHistory.includes(newState.fen)) {
                    const newHistory = [...currentHistory, newState.fen];
                    (window as any).globalSetMoveHistory(newHistory);
                    (window as any).globalSetCurrentMoveIndex(
                      newHistory.length - 1
                    );
                    console.log(
                      "📋 Historique mis à jour:",
                      newHistory.length,
                      "coups"
                    );
                  }
                }
              }

              // Si c'est un nouveau coup et que ce n'est pas nous qui l'avons fait
              if (
                isOpponentMove &&
                (window as any).globalPlayOpponentMoveSound
              ) {
                // Jouer le son avec un délai pour éviter les conflits
                setTimeout(() => {
                  const chess = new Chess(prevState.fen);
                  try {
                    // Trouver le coup joué en comparant les positions
                    const moves = chess.moves({ verbose: true });
                    for (const move of moves) {
                      const testGame = new Chess(prevState.fen);
                      testGame.move(move);
                      if (testGame.fen() === newState.fen) {
                        (window as any).globalPlayOpponentMoveSound({
                          from: move.from,
                          to: move.to,
                          promotion: move.promotion,
                        });
                        break;
                      }
                    }
                  } catch (error) {
                    console.error("Error detecting opponent move:", error);
                  }
                }, 50);
              }

              return {
                ...prevState,
                ...newState,
                // S'assurer que les propriétés importantes sont bien mises à jour
                players: newState.players || [],
                messages: newState.messages || [],
                fen: newState.fen || prevState.fen,
                isActive:
                  newState.isActive !== undefined
                    ? newState.isActive
                    : prevState.isActive,
                turn: newState.turn || prevState.turn,
                roomName: newState.roomName || prevState.roomName,
                roomPassword: newState.roomPassword || prevState.roomPassword,
                // Préserver les offres en cours
                drawOffer: newState.drawOffer || prevState.drawOffer,
                rematchOffer: newState.rematchOffer || prevState.rematchOffer,
                gameResult: newState.gameResult || prevState.gameResult,
              };
            });
          }
        }

        // Méthodes pour envoyer des actions
        makeMove(from: any, to: any, playerId: any, promotion: any) {
          this.publish(this.sessionId, "move", {
            from,
            to,
            playerId,
            promotion: promotion || "q",
          });
        }

        joinPlayer(wallet: any, playerId: any) {
          this.publish(this.sessionId, "join-player", { wallet, playerId });
        }

        sendMessage(message: any, playerId: any, playerWallet: any) {
          this.publish(this.sessionId, "chat-message", {
            message,
            playerId,
            playerWallet,
          });
        }

        startGame() {
          this.publish(this.sessionId, "start-game", {});
        }

        resetGame() {
          this.publish(this.sessionId, "reset-game", {});
        }

        updateTimer() {
          this.publish(this.sessionId, "update-timer", {});
        }

        offerDraw(playerId: string) {
          this.publish(this.sessionId, "offer-draw", { playerId });
        }

        respondDraw(playerId: string, accepted: boolean) {
          this.publish(this.sessionId, "respond-draw", { playerId, accepted });
        }

        resign(playerId: string) {
          this.publish(this.sessionId, "resign", { playerId });
        }

        setGameTime(gameTime: number) {
          this.publish(this.sessionId, "set-game-time", { gameTime });
        }

        requestRematch(playerId: string) {
          console.log("🔄 Demande de rematch classique:", { playerId });
          this.publish(this.sessionId, "request-rematch", { playerId });
        }

        respondRematch(playerId: string, accepted: boolean) {
          console.log("🔄 Réponse au rematch classique:", {
            playerId,
            accepted,
          });
          this.publish(this.sessionId, "respond-rematch", {
            playerId,
            accepted,
          });
        }

        resetRematchAccepted() {
          this.publish(this.sessionId, "reset-rematch-accepted", {});
        }
      }

      ChessModel.register("ChessModel");
      (window as any).ChessModel = ChessModel;
      (window as any).ChessView = ChessView;

      setMultisynqReady(true);
      setConnectionStatus("Multisynq prêt");
    } catch (error) {
      console.error("Erreur lors de la configuration des classes:", error);
      setConnectionStatus("Erreur configuration Multisynq");
    }
  };

  // Global function setup
  useEffect(() => {
    (window as any).globalSetGameState = setGameState;
    (window as any).finishGameOnContract = finishGameOnContract;
  }, [setGameState, finishGameOnContract]);

  // AJOUT: Fermer automatiquement la modal quand le jeu se termine
  useEffect(() => {
    if (gameState.gameResult.type && !hasClosedPaymentModal) {
      setHasClosedPaymentModal(true);
    }
  }, [
    gameState.gameResult.type,
    hasClosedPaymentModal,
    setHasClosedPaymentModal,
  ]);

  useEffect(() => {
    if (gameState.isActive && !hasClosedPaymentModal) {
      setHasClosedPaymentModal(true);
    }
  }, [gameState.isActive, hasClosedPaymentModal, setHasClosedPaymentModal]);

  // Auto-join from URL
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !multisynqReady ||
      !isConnected ||
      !address
    )
      return;

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get("room");
    const passwordFromUrl = urlParams.get("password");

    if (roomFromUrl && gameFlow === "welcome") {
      handleAutoJoinRoom(roomFromUrl, passwordFromUrl || "");
    }
  }, [multisynqReady, isConnected, address, gameFlow]);

  // Player color and reconnection logic
  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p: any) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      setPlayerColor(currentPlayer.color === "black" ? "black" : "white");

      if (isReconnecting) {
        setIsReconnecting(false);
      }
    } else if (
      gameState.players.length > 0 &&
      currentPlayerId &&
      !isReconnecting
    ) {
      const hasActiveGame = gameState.isActive || gameState.gameResult.type;
      if (hasActiveGame) {
        setIsReconnecting(true);

        setTimeout(() => {
          if (multisynqView && address && currentPlayerId) {
            multisynqView.joinPlayer(address, currentPlayerId);
          }
        }, 1000);
      }
    }

    setLastKnownGameState(gameState);
  }, [
    gameState.players,
    currentPlayerId,
    isReconnecting,
    gameState.isActive,
    gameState.gameResult.type,
    address,
    multisynqView,
  ]);

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

  // Utility functions
  const getSquarePosition = (square: string) => {
    if (!square) return null;

    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]) - 1;

    const isFlipped = playerColor === "black";
    const x = isFlipped ? 7 - file : file;
    const y = isFlipped ? rank : 7 - rank;

    const squareSize = 580 / 8;

    return {
      left: x * squareSize + squareSize / 2,
      top: y * squareSize + squareSize / 2,
    };
  };

  const shouldDisableNavigationButtons = (): boolean => {
    if (!showGameEndModal) return false;
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) return false;
    if (gameState.gameResult.winner === "draw") return false;

    if (
      gameState.gameResult.winner === "white" ||
      gameState.gameResult.winner === "black"
    ) {
      if (gameInfo?.state !== 2) {
        return true;
      }

      if (gameInfo?.result === 1 && !gameInfo?.whiteClaimed) {
        return true;
      }
      if (gameInfo?.result === 2 && !gameInfo?.blackClaimed) {
        return true;
      }
    }

    return false;
  };

  const handleBackHome = () => {
    closeSession();
    resetGameState();
    resetModals();
    setCurrentPlayerId(null);
    setNewMessage("");
    setMoveHistory([]);
    setCurrentMoveIndex(-1);
    setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    window.history.pushState({}, "", window.location.pathname);
    setConnectionStatus("Ready to play");
  };

  const handleSendMessageWrapper = (message: string) => {
    if (address) {
      handleSendMessage(message, address);
      setNewMessage("");
    }
  };

  // Navigation functions that update FEN
  const goToPreviousMoveWithFen = () => {
    const newFen = goToPreviousMove();
    if (newFen) {
      setFen(newFen);
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const goToNextMoveWithFen = () => {
    const newFen = goToNextMove();
    if (newFen) {
      setFen(newFen);
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const goToFirstMoveWithFen = () => {
    const newFen = goToFirstMove();
    if (newFen) {
      setFen(newFen);
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const goToLastMoveWithFen = () => {
    const newFen = goToLastMove();
    if (newFen) {
      setFen(newFen);
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  useEffect(() => {
    const currentPlayerInGame = gameState.players.find(
      (p: any) => p.id === currentPlayerId
    );

    if (
      !currentPlayerInGame &&
      multisynqView &&
      currentPlayerId &&
      address &&
      gameFlow === "game"
    ) {
      // Attendre que les infos du contrat se chargent
      if (gameId === undefined) {
        return;
      }

      const hasBetting = hasBettingRequirement();

      // ✅ NOUVEAU: Réinitialiser les modals et états pour une nouvelle room
      if (gameState.roomName && gameState.roomName.startsWith("rematch-")) {
        console.log(
          "🔄 Nouvelle room de rematch détectée, réinitialisation complète des états"
        );

        // Réinitialiser les modals
        setHasClosedPaymentModal(false);
        setPaymentStatus({
          whitePlayerPaid: false,
          blackPlayerPaid: false,
          currentPlayerPaid: false,
        });

        const initialFen =
          "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        setGameState((prev: any) => ({
          ...prev,
          fen: initialFen,
          gameResult: { type: null },
          isActive: false,
          turn: "w",
          drawOffer: { offered: false, by: null },
          rematchOffer: { offered: false, by: null },
          lastMoveTime: null,
        }));

        // Réinitialiser l'historique des coups
        setMoveHistory([initialFen]);
        setCurrentMoveIndex(0);

        console.log("✅ État du jeu complètement réinitialisé pour le rematch");
      }

      // Joindre immédiatement si pas de betting OU si les deux ont payé
      if (!hasBetting || bothPlayersPaid()) {
        multisynqView.joinPlayer(address, currentPlayerId);
        return;
      }

      // Cas: Betting requis ET joueur a payé - joindre
      if (hasBetting && paymentStatus.currentPlayerPaid) {
        multisynqView.joinPlayer(address, currentPlayerId);

        // Message de confirmation
        setTimeout(() => {
          if (multisynqView && currentPlayerId && address) {
            multisynqView.sendMessage(
              `Player paid and joined the betting game!`,
              currentPlayerId,
              address
            );
          }
        }, 500);
      }
    }
  }, [
    gameState.players,
    gameState.roomName,
    multisynqView,
    currentPlayerId,
    address,
    gameFlow,
    gameId,
    paymentStatus.currentPlayerPaid,
    paymentStatus.whitePlayerPaid,
    paymentStatus.blackPlayerPaid,
    hasBettingRequirement,
    bothPlayersPaid,
    setHasClosedPaymentModal,
    setPaymentStatus,
  ]);

  useEffect(() => {
    if (
      gameState.players.length >= 2 &&
      !gameState.isActive &&
      !gameState.gameResult.type &&
      multisynqView &&
      currentPlayerId &&
      address
    ) {
      const hasBetting = hasBettingRequirement();
      const bothPaid = bothPlayersPaid();

      const shouldStart =
        (!hasBetting || bothPaid) &&
        gameState.players.every((p: any) => p.connected);

      if (shouldStart) {
        setTimeout(() => {
          if (multisynqView) {
            multisynqView.startGame();

            const message = "Game started - both players have paid!";

            setTimeout(() => {
              if (multisynqView && currentPlayerId && address) {
                multisynqView.sendMessage(message, currentPlayerId, address);
              }
            }, 500);
          }
        }, 1000);
      }
    }
  }, [
    gameState.players.length,
    gameState.isActive,
    gameState.gameResult.type,
    multisynqView,
    currentPlayerId,
    address,
    paymentStatus.whitePlayerPaid,
    paymentStatus.blackPlayerPaid,
    gameInfo?.state,
    hasBettingRequirement,
    bothPlayersPaid,
  ]);

  useEffect(() => {
    if (!gameId || !gameInfo || !hasBettingRequirement()) return;

    // Si le contrat existe mais n'est pas encore ACTIVE et qu'il y a 2 joueurs
    if (gameInfo.state === 0 && gameState.players.length >= 2) {
      // WAITING state

      const interval = setInterval(() => {
        refetchAll();
        // updatePaymentStatus(); // Si vous avez cette fonction
      }, 2000); // Refresh toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [
    gameId,
    gameInfo?.state,
    gameState.players.length,
    hasBettingRequirement,
    refetchAll,
  ]);

  // ✅ NOUVEAU: Synchronisation automatique du paymentStatus avec le contrat
  useEffect(() => {
    if (gameInfo && address) {
      const isWhitePlayer =
        gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
      const isBlackPlayer =
        gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

      // Le joueur blanc a payé si son adresse n'est pas nulle
      const whitePlayerPaid =
        gameInfo.whitePlayer !== "0x0000000000000000000000000000000000000000";

      // Le joueur noir a payé si son adresse n'est pas nulle
      const blackPlayerPaid =
        gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

      // Le joueur courant a payé s'il est l'un des deux joueurs dans le contrat
      const currentPlayerPaid = isWhitePlayer || isBlackPlayer;

      // ✅ Mise à jour du status si nécessaire
      setPaymentStatus((prev) => {
        if (
          prev.whitePlayerPaid !== whitePlayerPaid ||
          prev.blackPlayerPaid !== blackPlayerPaid ||
          prev.currentPlayerPaid !== currentPlayerPaid
        ) {
          console.log("🔄 [useChessMain] Synchronisation du paymentStatus:", {
            whitePlayerPaid,
            blackPlayerPaid,
            currentPlayerPaid,
            gameState: gameInfo.state,
          });
          return {
            whitePlayerPaid,
            blackPlayerPaid,
            currentPlayerPaid,
          };
        }
        return prev;
      });
    }
  }, [gameInfo, address, setPaymentStatus]);

  // ✅ NOUVEAU: Polling pour synchroniser en temps réel quand on attend des paiements
  useEffect(() => {
    if (
      gameId &&
      gameInfo &&
      hasBettingRequirement() &&
      !bothPlayersPaid() &&
      gameFlow === "game"
    ) {
      console.log("🔄 Démarrage du polling pour synchroniser les paiements");

      const interval = setInterval(() => {
        console.log("📡 Polling des données de paiement...");
        refetchAll();
      }, 3000); // Poll toutes les 3 secondes

      return () => {
        console.log("🛑 Arrêt du polling des paiements");
        clearInterval(interval);
      };
    }
  }, [
    gameId,
    gameInfo?.state,
    hasBettingRequirement,
    bothPlayersPaid,
    gameFlow,
    refetchAll,
  ]);

  useEffect(() => {
    if (
      multisynqView &&
      currentPlayerId &&
      gameState.roomName &&
      gameFlow === "welcome"
    ) {
      // Ne pas auto-transitioner si la popup de pari doit s'afficher
      const shouldShowBettingPopup =
        isBettingEnabled && parseFloat(betAmount) > 0 && !bothPlayersPaid();

      if (!shouldShowBettingPopup) {
        setTimeout(() => {
          setGameFlow("game");
          setConnectionStatus(`Connected to: ${gameState.roomName}`);
        }, 1000);
      } else {
        // Transition immédiate pour afficher la popup
        setGameFlow("game");
        setConnectionStatus(`Connected to: ${gameState.roomName}`);
      }
    }
  }, [
    multisynqView,
    currentPlayerId,
    gameState.roomName,
    gameFlow,
    isBettingEnabled,
    betAmount,
    bothPlayersPaid,
    setGameFlow,
    setConnectionStatus,
  ]);

  useEffect(() => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      const currentBetAmount = formatEther(gameInfo.betAmount);
      if (currentBetAmount !== betAmount) {
        setBetAmount(currentBetAmount);
      }
    }
  }, [gameInfo?.betAmount, gameId, betAmount, setBetAmount]);

  useEffect(() => {
    (window as any).globalSetGameState = setGameState;
    (window as any).finishGameOnContract = finishGameOnContract;

    (window as any).globalSetFen = setFen;
    (window as any).globalSetMoveHistory = setMoveHistory;
    (window as any).globalSetCurrentMoveIndex = setCurrentMoveIndex;

    (window as any).globalPlayOpponentMoveSound = (moveData: any) => {
      const tempGame = new Chess(fen);
      try {
        const moveResult = tempGame.move({
          from: moveData.from,
          to: moveData.to,
          promotion: moveData.promotion || "q",
        });

        if (moveResult) {
          playMoveSound(moveResult, tempGame, true);
        }
      } catch (error) {
        console.error("Error processing opponent move:", error);
      }
    };
  }, [
    setGameState,
    finishGameOnContract,
    fen,
    playMoveSound,
    setFen,
    setMoveHistory,
    setCurrentMoveIndex,
  ]);

  return {
    // Game state
    gameState,
    setGameState,
    gameFlow,
    setGameFlow,
    isReconnecting,
    currentPlayerId,
    playerColor,
    connectionStatus,

    // Chessboard
    chessboardOptions,
    fen,
    selectedSquare,
    possibleMoves,
    getCheckmatedKingSquare,
    getSquarePosition,

    // Move history
    moveHistory,
    currentMoveIndex,
    goToPreviousMoveWithFen,
    goToNextMoveWithFen,
    goToFirstMoveWithFen,
    goToLastMoveWithFen,

    // Game controls
    handleOfferDraw,
    handleRespondDraw,
    handleResign,
    handleRematchResponse,
    handleSendMessageWrapper,

    // Room management
    roomInput,
    setRoomInput,
    isCreatingRoom,
    handleCreateRoom,
    handleJoinRoom,
    isWrongNetwork,
    multisynqReady,
    handleAutoJoinRoom,

    // Betting
    betAmount,
    setBetAmount,
    isBettingEnabled,
    setIsBettingEnabled,
    selectedGameTime,
    setSelectedGameTime,
    bettingGameCreationFailed,
    paymentStatus,
    isFinalizingGame,
    hasBettingRequirement,
    bothPlayersPaid,
    getCorrectBetAmount,
    canCurrentPlayerClaim,
    getAvailableAmount,

    // Modals
    showGameEndModal,
    setShowGameEndModal,
    hasClosedModal,
    hasClosedPaymentModal,
    setHasClosedPaymentModal,
    isRematchTransition,
    rematchInvitation,
    setRematchInvitation,
    handleCloseGameEndModal,

    // Chat
    newMessage,
    setNewMessage,

    // Timer
    getCurrentPlayerTime,
    getOpponentTime,

    // Rematch
    canOfferRematch,
    createRematchWithPayment,
    handleNewGame,
    isCreatingRematch,

    // Utility
    shouldDisableNavigationButtons,
    handleBackHome,
    copied,
    setCopied,
    menuActive,
    setMenuActive,

    // 🎯 AJOUT: Contract data et betting hooks
    gameId,
    gameInfo,
    isPending,
    isConfirming,
    isSuccess,
    balanceFormatted,
    claimState,
    resetClaimState,
    cancelState,
    canCancel,
    createBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    cancelBettingGame,
    finishBettingGame,
    refetchAll,
    setRoomBetAmount,
    setBettingGameCreationFailed,
    multisynqView,
    setPaymentStatus,

    // Account
    address,
    isConnected,
    chainId,
  };
};
