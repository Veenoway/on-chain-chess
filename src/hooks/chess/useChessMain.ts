/* eslint-disable @typescript-eslint/no-explicit-any */
import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

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

export const useChessMain = () => {
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
  } = useGameModals(gameState.gameResult, gameState.roomName);

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
    setSelectedGameTime,
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
      handleCreateRoom
    );

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

  const setupMultisynqClasses = () => {
    const { Multisynq } = window as any;
    if (!Multisynq) {
      console.error("Multisynq not available");
      return;
    }

    try {
      class ChessModel extends Multisynq.Model {
        timerInterval: any = null;

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
            rematchCreating: { inProgress: false, by: null },
            gameNumber: 1,
            lastGameWinner: null,
            createdAt: Date.now(),
            rematchAccepted: false,
          };

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
            "rematch-creating",
            "handleRematchCreating"
          );
          this.subscribe(
            this.sessionId,
            "reset-rematch-accepted",
            "handleResetRematchAccepted"
          );

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleSetGameTime(data: { gameTime: number }) {
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRematchCreating(data: { playerId: string }) {
          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.rematchCreating = {
            inProgress: true,
            by: player.color as "white" | "black",
          };

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Creating rematch...",
            timestamp: Date.now(),
          });

          // ✅ SÉCURITÉ: Auto-reset après 30 secondes en cas de problème
          setTimeout(() => {
            if (this.state.rematchCreating?.inProgress) {
              console.log(
                "⚠️ [ChessModel] Auto-reset rematchCreating après timeout"
              );
              this.state.rematchCreating = { inProgress: false, by: null };
              this.publish(this.sessionId, "game-state", this.state);
            }
          }, 30000);

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRequestRematch(data: { playerId: string }) {
          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Request rematch",
            timestamp: Date.now(),
          });

          this.state.rematchOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRespondRematch(data: { playerId: string; accepted: boolean }) {
          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept rematch" : "Decline rematch",
            timestamp: Date.now(),
          });

          if (data.accepted) {
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

            this.state.players.forEach((p: any) => {
              p.color = p.color === "white" ? "black" : "white";
            });

            this.state.rematchAccepted = true;
          }

          this.state.rematchOffer = { offered: false, by: null };
          this.state.rematchCreating = { inProgress: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResetRematchAccepted() {
          this.state.rematchAccepted = false;
          this.publish(this.sessionId, "game-state", this.state);
        }

        startTimer() {
          if (this.timerInterval) {
            this.stopTimer();
          }

          this.timerInterval = setInterval(() => {
            if (!this.state.isActive || this.state.gameResult.type) {
              this.stopTimer();
              return;
            }

            let needsUpdate = false;
            let timeExpired = false;

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
                timeExpired = true;
                needsUpdate = true;
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
                timeExpired = true;
                needsUpdate = true;
              }
            }

            if (needsUpdate) {
              this.state.lastMoveTime = Date.now();
              this.publish(this.sessionId, "game-state", this.state);

              if (timeExpired && (window as any).finishGameOnContract) {
                setTimeout(() => {
                  (window as any).finishGameOnContract(this.state.gameResult);
                }, 1000);
              }
            }

            if (!this.state.isActive || this.state.gameResult.type) {
              this.stopTimer();
            }
          }, 1000);
        }

        stopTimer() {
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
          }
        }

        handleMove(data: {
          from: any;
          to: any;
          promotion: any;
          playerId: any;
        }) {
          const { from, to, promotion } = data;

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

              this.publish(this.sessionId, "game-state", this.state);

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
          } catch {}
        }

        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) {
            return;
          }

          let needsUpdate = false;

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

        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          const { playerId, wallet } = data;

          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId;

            const reconnectionMessage = this.state.gameResult?.type
              ? "Reconnected - game finished"
              : this.state.isActive
              ? "Reconnected - game in progress"
              : "Reconnected to the game";

            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: reconnectionMessage,
              timestamp: Date.now(),
            });

            this.publish(this.sessionId, "game-state", this.state);
            return;
          } else if (this.state.players.length < this.state.maxPlayers) {
            const color = this.state.players.length === 0 ? "white" : "black";

            const newPlayer = {
              id: playerId,
              wallet,
              color,
              connected: true,
            };

            this.state.players.push(newPlayer);

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
            return;
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
          if (message.message.startsWith("REMATCH_INVITATION:")) {
            try {
              const parts = message.message.split(":");
              const [, roomName, password, betAmount, gameTime] = parts;

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

              const eventDetail = {
                from: message.playerWallet,
                senderId: message.playerId,
                roomName: roomName,
                password: password,
                betAmount: betAmount,
                gameTime: gameTime || "600",
              };

              window.dispatchEvent(
                new CustomEvent("rematchInvitation", {
                  detail: eventDetail,
                })
              );
            } catch (error) {
              console.error(
                " [ChessView] Error processing rematch invitation:",
                error
              );
            }
          } else {
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

        handleStartGame() {
          if (this.state.players.length >= 2) {
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();
            this.state.drawOffer = { offered: false, by: null };
            this.state.rematchOffer = { offered: false, by: null };
            this.state.rematchCreating = { inProgress: false, by: null };

            this.state.whiteTime = this.state.gameTimeLimit;
            this.state.blackTime = this.state.gameTimeLimit;

            if (
              (window as any).globalSetMoveHistory &&
              (window as any).globalSetCurrentMoveIndex
            ) {
              const initialFen =
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
              (window as any).globalSetMoveHistory([initialFen]);
              (window as any).globalSetCurrentMoveIndex(0);
            }

            this.publish(this.sessionId, "game-state", this.state);
            this.startTimer();
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
          this.state.rematchCreating = { inProgress: false, by: null };
          this.state.gameNumber += 1;
          this.state.lastMoveTime = null;
          this.publish(this.sessionId, "game-state", this.state);
          this.stopTimer();
        }

        handleOfferDraw(data: { playerId: string }) {
          if (!this.state.isActive || this.state.gameResult.type) {
            return;
          }

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) {
            return;
          }

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
          if (!this.state.drawOffer.offered || this.state.gameResult.type) {
            return;
          }

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) {
            return;
          }

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
          } else {
          }

          this.state.drawOffer = { offered: false, by: null };

          this.publish(this.sessionId, "game-state", this.state);
          this.stopTimer();
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
          this.stopTimer();
        }
      }

      class ChessView extends Multisynq.View {
        constructor(model: any) {
          super(model);
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
          if (typeof (window as any).globalSetGameState === "function") {
            (window as any).globalSetGameState((prevState: any) => {
              const hasNewMove = newState.fen !== prevState.fen && newState.fen;
              const isOpponentMove =
                hasNewMove &&
                newState.lastMoveTime &&
                newState.lastMoveTime !== prevState.lastMoveTime;

              if (hasNewMove && (window as any).globalSetFen) {
                (window as any).globalSetFen(newState.fen);

                if (
                  (window as any).globalSetMoveHistory &&
                  (window as any).globalSetCurrentMoveIndex
                ) {
                  const currentHistory = (window as any).globalGetMoveHistory
                    ? (window as any).globalGetMoveHistory()
                    : [];

                  if (!currentHistory.includes(newState.fen)) {
                    const newHistory = [...currentHistory, newState.fen];
                    (window as any).globalSetMoveHistory(newHistory);
                    (window as any).globalSetCurrentMoveIndex(
                      newHistory.length - 1
                    );
                  }
                }
              }

              if (
                isOpponentMove &&
                (window as any).globalPlayOpponentMoveSound
              ) {
                setTimeout(() => {
                  const chess = new Chess(prevState.fen);
                  try {
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
                whiteTime: newState.whiteTime,
                blackTime: newState.blackTime,
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
                drawOffer: newState.drawOffer || prevState.drawOffer,
                rematchOffer: newState.rematchOffer || prevState.rematchOffer,
                gameResult: newState.gameResult || prevState.gameResult,
              };
            });
          }
        }

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
          this.publish(this.sessionId, "request-rematch", { playerId });
        }

        signalRematchCreating(playerId: string) {
          this.publish(this.sessionId, "rematch-creating", { playerId });
        }

        respondRematch(playerId: string, accepted: boolean) {
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
      setConnectionStatus("Multisynq ready");
    } catch (error) {
      console.error("Error configuring classes:", error);
      setConnectionStatus("Error configuring Multisynq");
    }
  };

  useEffect(() => {}, [hasClosedPaymentModal]);

  useEffect(() => {
    (window as any).globalSetGameState = setGameState;
    (window as any).finishGameOnContract = finishGameOnContract;
  }, [setGameState, finishGameOnContract]);

  useEffect(() => {
    const isRematchRoom =
      gameState.roomName && gameState.roomName.startsWith("rematch-");

    if (
      gameState.gameResult.type &&
      !hasClosedPaymentModal &&
      gameState.isActive &&
      gameState.players &&
      gameState.players.length === 2 &&
      !isRematchRoom
    ) {
      setHasClosedPaymentModal(true);
    }
  }, [
    gameState.gameResult.type,
    gameState.isActive,
    gameState.players,
    gameState.roomName,
    hasClosedPaymentModal,
    setHasClosedPaymentModal,
  ]);

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
    setMoveHistory([
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ]);
    setCurrentMoveIndex(0);
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

    if (currentPlayerInGame) {
      return;
    }

    if (!multisynqView || !currentPlayerId || !address || gameFlow !== "game") {
      return;
    }

    if (gameId === undefined) {
      return;
    }

    const hasBetting = hasBettingRequirement();
    const bothPaid = bothPlayersPaid();

    if (gameState.roomName && gameState.roomName.startsWith("rematch-")) {
      setHasClosedPaymentModal(false);
      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });

      resetClaimState();

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

      setMoveHistory([initialFen]);
      setCurrentMoveIndex(0);

      setFen(initialFen);
    }

    if (!hasBetting || bothPaid) {
      multisynqView.joinPlayer(address, currentPlayerId);
      return;
    }

    if (gameState.roomName && gameState.roomName.startsWith("rematch-")) {
      return;
    }

    if (hasBetting && paymentStatus.currentPlayerPaid) {
      multisynqView.joinPlayer(address, currentPlayerId);

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
      if (!gameInfo) {
        return;
      }

      const hasBetting = gameInfo?.betAmount && gameInfo.betAmount > BigInt(0);
      const whitePlayerPaid =
        gameInfo?.whitePlayer !== "0x0000000000000000000000000000000000000000";
      const blackPlayerPaid =
        gameInfo?.blackPlayer !== "0x0000000000000000000000000000000000000000";
      const bothPaid = whitePlayerPaid && blackPlayerPaid;
      const isRematchRoom =
        gameState.roomName && gameState.roomName.startsWith("rematch-");

      const shouldStart = isRematchRoom
        ? hasBetting && bothPaid
        : (!hasBetting || bothPaid) &&
          gameState.players.every((p: any) => p.connected);

      if (shouldStart) {
        setTimeout(() => {
          if (multisynqView && !gameState.isActive) {
            multisynqView.startGame();

            const message = "Game started - both players have paid!";

            setTimeout(() => {
              if (
                multisynqView &&
                currentPlayerId &&
                address &&
                !gameState.isActive
              ) {
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
    gameInfo?.betAmount,
    gameInfo?.whitePlayer,
    gameInfo?.blackPlayer,
    gameInfo?.state,
  ]);

  useEffect(() => {
    if (!gameId || !gameInfo || !hasBettingRequirement()) return;

    if (gameInfo.state === 0 && gameState.players.length >= 2) {
      const interval = setInterval(() => {
        refetchAll();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [
    gameId,
    gameInfo?.state,
    gameState.players.length,
    hasBettingRequirement,
    refetchAll,
  ]);

  useEffect(() => {
    if (gameInfo && address) {
      const isWhitePlayer =
        gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
      const isBlackPlayer =
        gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

      const whitePlayerPaid =
        gameInfo.whitePlayer !== "0x0000000000000000000000000000000000000000";

      const blackPlayerPaid =
        gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

      const currentPlayerPaid = isWhitePlayer || isBlackPlayer;

      setPaymentStatus((prev) => {
        if (
          prev.whitePlayerPaid !== whitePlayerPaid ||
          prev.blackPlayerPaid !== blackPlayerPaid ||
          prev.currentPlayerPaid !== currentPlayerPaid
        ) {
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

  useEffect(() => {
    const hasBetting = gameInfo?.betAmount && gameInfo.betAmount > BigInt(0);
    const whitePlayerPaid =
      gameInfo?.whitePlayer !== "0x0000000000000000000000000000000000000000";
    const blackPlayerPaid =
      gameInfo?.blackPlayer !== "0x0000000000000000000000000000000000000000";
    const bothPaid = whitePlayerPaid && blackPlayerPaid;

    if (gameId && gameInfo && hasBetting && !bothPaid && gameFlow === "game") {
      const interval = setInterval(() => {
        refetchAll();
      }, 3000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [
    gameId,
    gameInfo?.state,
    gameInfo?.betAmount,
    gameInfo?.whitePlayer,
    gameInfo?.blackPlayer,
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
      const shouldShowBettingPopup =
        isBettingEnabled && parseFloat(betAmount) > 0 && !bothPlayersPaid();

      if (!shouldShowBettingPopup) {
        setTimeout(() => {
          setGameFlow("game");
          setConnectionStatus(`Connected to: ${gameState.roomName}`);
        }, 1000);
      } else {
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
    if (gameState.roomName && gameState.roomName.startsWith("rematch-")) {
      const initialFen =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

      setFen(initialFen);
      setMoveHistory([initialFen]);
      setCurrentMoveIndex(0);

      resetClaimState();
    }
  }, [
    gameState.roomName,
    setFen,
    setMoveHistory,
    setCurrentMoveIndex,
    resetClaimState,
  ]);

  useEffect(() => {
    (window as any).globalSetGameState = setGameState;
    (window as any).finishGameOnContract = finishGameOnContract;

    (window as any).globalSetFen = setFen;
    (window as any).globalSetMoveHistory = setMoveHistory;
    (window as any).globalSetCurrentMoveIndex = setCurrentMoveIndex;
    (window as any).globalGetMoveHistory = () => moveHistory;

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
    moveHistory,
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
    rematchCreating: gameState.rematchCreating,

    // Utility
    shouldDisableNavigationButtons,
    handleBackHome,
    copied,
    setCopied,
    menuActive,
    setMenuActive,

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
