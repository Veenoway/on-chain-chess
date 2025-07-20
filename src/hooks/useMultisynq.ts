/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/multisynq/useMultisynq.ts
import { GameState } from "@/types/chess";
import { MultisynqSession, MultisynqView } from "@/types/multisynq";
import { Chess } from "chess.js";
import { useCallback, useEffect, useState } from "react";

// Variables globales pour partager l'état avec Multisynq
let globalSetGameState: (state: GameState) => void;

interface UseMultisynqProps {
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

export function useMultisynq({ setGameState }: UseMultisynqProps) {
  const [multisynqReady, setMultisynqReady] = useState(false);
  const [multisynqView, setMultisynqView] = useState<MultisynqView | null>(
    null
  );
  const [multisynqSession, setMultisynqSession] =
    useState<MultisynqSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Prêt à jouer");

  // Synchroniser les variables globales
  useEffect(() => {
    globalSetGameState = setGameState;
    // Rendre finishGameOnContract accessible globalement
    (window as any).finishGameOnContract = finishGameOnContract;
  }, [setGameState]);

  // Fonction pour finaliser une partie avec pari sur le contrat
  const finishGameOnContract = async (gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
  }) => {
    console.log("💰 Finishing game on contract:", gameResult);
    // Cette fonction sera appelée par la logique Multisynq
  };

  // Attendre que Multisynq soit disponible
  const waitForMultisynqAvailable = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout: Multisynq not available"));
      }, 10000);

      const checkAvailability = () => {
        if ((window as any).Multisynq) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkAvailability, 100);
        }
      };

      checkAvailability();
    });
  };

  // Configuration des classes Multisynq
  const setupMultisynqClasses = useCallback(() => {
    const { Multisynq } = window as any;
    if (!Multisynq) {
      console.error("Multisynq not available");
      return;
    }

    try {
      console.log("🧩 Configuration des classes Multisynq");

      // Définir le modèle Chess
      class ChessModel extends Multisynq.Model {
        init() {
          console.log("🎯 Initialisation ChessModel");
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

          // S'abonner aux événements
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

          // Publier l'état initial
          this.publish(this.sessionId, "game-state", this.state);
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

              // Publication immédiate de l'état après chaque coup
              this.publish(this.sessionId, "game-state", this.state);

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
                  // Finaliser sur le contrat si pari activé
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
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
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
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
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
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

        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          console.log("👤 Joueur rejoint:", data);
          const { playerId, wallet } = data;

          // Vérifier si le joueur existe déjà par son wallet (reconnexion)
          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // Mettre à jour le joueur existant avec le nouveau playerId
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId;
            console.log("Joueur existant reconnecté avec nouveau ID");

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
          if (this.state.players.length < this.state.maxPlayers) {
            // Le PREMIER joueur est TOUJOURS blanc, le DEUXIÈME est TOUJOURS noir
            const color = this.state.players.length === 0 ? "white" : "black";

            const newPlayer = {
              id: playerId,
              wallet,
              color,
              connected: true,
            };

            this.state.players.push(newPlayer);
            console.log("Nouveau joueur ajouté:", newPlayer);

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
            console.warn("⚠️ Room pleine, impossible d'ajouter le joueur");
            return;
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
          console.log("💬 Message chat:", message);

          // Vérifier si c'est une invitation de rematch
          if (message.message.startsWith("REMATCH_INVITATION:")) {
            try {
              const [, roomName, password, betAmount] =
                message.message.split(":");

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

              // Déclencher la popup pour l'autre joueur
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
            } catch (error) {
              console.error("Erreur traitement invitation rematch:", error);
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

        handleStartGame() {
          console.log("🚀 Démarrage de la partie");
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
          console.log("Reset de la partie");
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

        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) return;

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
              // @ts-ignore
              if (globalSetGameState && (window as any).finishGameOnContract) {
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
              // @ts-ignore
              if (globalSetGameState && (window as any).finishGameOnContract) {
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
            // @ts-ignore
            if (globalSetGameState && (window as any).finishGameOnContract) {
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
          // @ts-ignore
          if (globalSetGameState && (window as any).finishGameOnContract) {
            setTimeout(
              () => (window as any).finishGameOnContract(this.state.gameResult),
              1000
            );
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleSetGameTime(data: { gameTime: number }) {
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
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

            // Inverser les couleurs pour la revanche
            this.state.players.forEach((p: any) => {
              p.color = p.color === "white" ? "black" : "white";
            });

            this.state.rematchAccepted = true;
          }

          this.state.rematchOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResetRematchAccepted() {
          this.state.rematchAccepted = false;
          this.publish(this.sessionId, "game-state", this.state);
        }
      }

      // Définir la vue Chess
      class ChessView extends Multisynq.View {
        constructor(model: any) {
          super(model);
          console.log("👁️ Initialisation ChessView");
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
          console.log("Mise à jour état jeu:", {
            players: newState.players?.length || 0,
            isActive: newState.isActive,
            turn: newState.turn,
            gameResult: newState.gameResult?.type,
          });

          if (globalSetGameState) {
            // @ts-ignore
            globalSetGameState((prevState: GameState) => {
              return {
                ...prevState,
                ...newState,
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

      // Enregistrer les classes avec Multisynq
      ChessModel.register("ChessModel");

      // Stocker les références pour l'utilisation locale
      (window as any).ChessModel = ChessModel;
      (window as any).ChessView = ChessView;

      setMultisynqReady(true);
      setConnectionStatus("Multisynq prêt");
      console.log("Classes Multisynq configurées et enregistrées");
    } catch (error) {
      console.error("Erreur lors de la configuration des classes:", error);
      setConnectionStatus("Erreur configuration Multisynq");
    }
  }, []);

  // Créer une session Multisynq
  const createMultisynqSession = useCallback(
    async (roomName: string, password: string = "") => {
      const apiKey = process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY;

      if (!apiKey) {
        throw new Error("Clé API Multisynq manquante");
      }

      if (!multisynqReady) {
        throw new Error("Multisynq n'est pas prêt");
      }

      const { Multisynq } = window as any;
      if (!Multisynq) {
        throw new Error("Multisynq non disponible");
      }

      try {
        // Fermer l'ancienne session si elle existe
        if (multisynqView && multisynqSession) {
          console.log("Fermeture de l'ancienne session Multisynq");
          try {
            if (multisynqSession.close) {
              multisynqSession.close();
            }
          } catch (error) {
            console.warn(
              "Erreur lors de la fermeture de l'ancienne session:",
              error
            );
          }
          setMultisynqSession(null);
          setMultisynqView(null);
        }

        console.log("🚀 Création nouvelle session Multisynq:", {
          roomName,
          password,
        });

        const session = await Multisynq.Session.join({
          apiKey,
          appId: "com.onchainchess-novee.game",
          model: (window as any).ChessModel,
          view: (window as any).ChessView,
          name: roomName,
          password: password,
        });

        console.log("Nouvelle session créée:", session);
        setMultisynqSession(session);
        setMultisynqView(session.view);
        return session;
      } catch (error) {
        console.error("Erreur création session:", error);
        throw error;
      }
    },
    [multisynqReady, multisynqView, multisynqSession]
  );

  // Charger et initialiser Multisynq
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeMultisynq = async () => {
      // Vérifier si Multisynq est déjà chargé
      if ((window as any).Multisynq) {
        console.log("Multisynq déjà présent");
        setupMultisynqClasses();
        return;
      }

      console.log("📦 Chargement Multisynq depuis CDN...");

      try {
        // Charger le script Multisynq
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log("Multisynq chargé depuis CDN");
            resolve();
          };
          script.onerror = () => {
            console.error("Erreur chargement Multisynq CDN");
            reject(new Error("Failed to load Multisynq"));
          };
          document.head.appendChild(script);
        });

        // Attendre que Multisynq soit disponible
        await waitForMultisynqAvailable();
        setupMultisynqClasses();
      } catch (error) {
        console.error("Erreur lors de l'initialisation Multisynq:", error);
        setConnectionStatus("Erreur chargement Multisynq");
      }
    };

    initializeMultisynq();
  }, [setupMultisynqClasses]);

  return {
    multisynqReady,
    multisynqView,
    multisynqSession,
    connectionStatus,
    setMultisynqView,
    setMultisynqSession,
    createMultisynqSession,
    setupMultisynqClasses,
  };
}
