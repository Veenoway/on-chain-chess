// services/multisynqService.ts
import { Chess } from "chess.js";
import { useChessStore } from "../stores/chessStore";

export class MultisynqService {
  private static instance: MultisynqService;
  private isInitialized = false;

  static getInstance(): MultisynqService {
    if (!MultisynqService.instance) {
      MultisynqService.instance = new MultisynqService();
    }
    return MultisynqService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadMultisynqScript();
      this.setupMultisynqClasses();
      this.isInitialized = true;
      useChessStore.getState().setGameState({
        multisynqReady: true,
        connectionStatus: "Multisynq ready",
      });
    } catch (error) {
      console.error("Failed to initialize Multisynq:", error);
      useChessStore.getState().setGameState({
        connectionStatus: "Multisynq initialization failed",
      });
      throw error;
    }
  }

  private async loadMultisynqScript(): Promise<void> {
    if ((window as any).Multisynq) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
      script.async = true;

      script.onload = () => resolve(undefined);
      script.onerror = () =>
        reject(new Error("Failed to load Multisynq script"));

      document.head.appendChild(script);
    });
  }

  private setupMultisynqClasses(): void {
    const { Multisynq } = window as any;
    if (!Multisynq) throw new Error("Multisynq not available");

    // Chess Model
    class ChessModel extends Multisynq.Model {
      init() {
        const initialState = {
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
        };

        this.state = initialState;

        // Subscribe to events
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

        this.publish(this.sessionId, "game-state", this.state);
      }

      handleMove(data: {
        from: string;
        to: string;
        promotion: string;
        playerId: string;
      }) {
        const { from, to, promotion } = data;
        const chess = new Chess(this.state.fen);

        try {
          const move = chess.move({ from, to, promotion: promotion || "q" });

          if (move) {
            this.state.fen = chess.fen();
            this.state.turn = chess.turn();
            this.state.lastMoveTime = Date.now();

            // Check for game end
            if (chess.isGameOver()) {
              this.state.isActive = false;
              if (chess.isCheckmate()) {
                this.state.gameResult = {
                  type: "checkmate",
                  winner: chess.turn() === "w" ? "black" : "white",
                  message: `Checkmate! ${
                    chess.turn() === "w" ? "Black" : "White"
                  } wins`,
                };
              } else if (chess.isStalemate()) {
                this.state.gameResult = {
                  type: "stalemate",
                  winner: "draw",
                  message: "Stalemate! Draw",
                };
              } else if (chess.isDraw()) {
                this.state.gameResult = {
                  type: "draw",
                  winner: "draw",
                  message: "Draw",
                };
              }
            }

            this.publish(this.sessionId, "game-state", this.state);
          }
        } catch (error) {
          console.error("Invalid move:", error);
        }
      }

      handlePlayerJoin(data: { playerId: string; wallet: string }) {
        const { playerId, wallet } = data;

        // Check for existing player (reconnection)
        const existingPlayerIndex = this.state.players.findIndex(
          (p: any) => p.wallet === wallet
        );

        if (existingPlayerIndex >= 0) {
          // Reconnection
          this.state.players[existingPlayerIndex].connected = true;
          this.state.players[existingPlayerIndex].id = playerId;

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId,
            playerWallet: wallet,
            message: "Reconnected to the game",
            timestamp: Date.now(),
          });
        } else if (this.state.players.length < this.state.maxPlayers) {
          // New player
          const hasWhitePlayer = this.state.players.some(
            (p: any) => p.color === "white"
          );
          const color = hasWhitePlayer ? "black" : "white";

          const newPlayer = { id: playerId, wallet, color, connected: true };
          this.state.players.push(newPlayer);

          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId,
            playerWallet: wallet,
            message: `👋 Joined as ${color}`,
            timestamp: Date.now(),
          });
        }

        this.publish(this.sessionId, "game-state", this.state);
      }

      handleChatMessage(message: {
        message: string;
        playerId: string;
        playerWallet: string;
      }) {
        this.state.messages.push({
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        });
        this.publish(this.sessionId, "game-state", this.state);
      }

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

      handleUpdateTimer() {
        if (!this.state.isActive || this.state.gameResult.type) return;

        if (this.state.turn === "w") {
          this.state.whiteTime = Math.max(0, this.state.whiteTime - 1);
          if (this.state.whiteTime <= 0) {
            this.state.isActive = false;
            this.state.gameResult = {
              type: "timeout",
              winner: "black",
              message: "Time's up! Black wins",
            };
          }
        } else {
          this.state.blackTime = Math.max(0, this.state.blackTime - 1);
          if (this.state.blackTime <= 0) {
            this.state.isActive = false;
            this.state.gameResult = {
              type: "timeout",
              winner: "white",
              message: "Time's up! White wins",
            };
          }
        }

        this.state.lastMoveTime = Date.now();
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
        if (!this.state.drawOffer.offered || this.state.gameResult.type) return;

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
          message: "🏳️ Resign",
          timestamp: Date.now(),
        });

        this.state.isActive = false;
        this.state.gameResult = {
          type: "abandoned",
          winner: player.color === "white" ? "black" : "white",
          message: `${player.color === "white" ? "White" : "Black"} resigns! ${
            player.color === "white" ? "Black" : "White"
          } wins`,
        };

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
          // Start new game
          this.state.fen =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          this.state.isActive = true;
          this.state.turn = "w";
          this.state.whiteTime = this.state.gameTimeLimit;
          this.state.blackTime = this.state.gameTimeLimit;
          this.state.gameResult = { type: null };
          this.state.drawOffer = { offered: false, by: null };
          this.state.gameNumber += 1;
          this.state.lastMoveTime = Date.now();

          // Swap colors
          this.state.players.forEach((p: any) => {
            p.color = p.color === "white" ? "black" : "white";
          });
        }

        this.state.rematchOffer = { offered: false, by: null };
        this.publish(this.sessionId, "game-state", this.state);
      }
    }

    // Chess View
    class ChessView extends Multisynq.View {
      constructor(model: any) {
        super(model);
        this.subscribe(this.sessionId, "game-state", "updateGameState");
      }

      updateGameState(newState: any) {
        const store = useChessStore.getState();

        // Update the store with new state
        store.setGameState({
          fen: newState.fen,
          isActive: newState.isActive,
          turn: newState.turn,
          whiteTime: newState.whiteTime,
          blackTime: newState.blackTime,
          gameResult: newState.gameResult,
          drawOffer: newState.drawOffer,
          rematchOffer: newState.rematchOffer,
          gameNumber: newState.gameNumber,
          lastMoveTime: newState.lastMoveTime,
        });

        store.setPlayers(newState.players || []);

        // Add new messages
        if (
          newState.messages &&
          newState.messages.length > store.messages.length
        ) {
          const newMessages = newState.messages.slice(store.messages.length);
          newMessages.forEach((msg: any) => store.addMessage(msg));
        }

        // Update move history if there's a new move
        if (newState.fen && newState.fen !== store.fen) {
          const currentHistory = store.moveHistory;
          if (!currentHistory.includes(newState.fen)) {
            const newHistory = [...currentHistory, newState.fen];
            store.setMoveHistory(newHistory, newHistory.length - 1);
          }
        }
      }

      // Action methods
      makeMove(
        from: string,
        to: string,
        playerId: string,
        promotion: string = "q"
      ) {
        this.publish(this.sessionId, "move", { from, to, playerId, promotion });
      }

      joinPlayer(wallet: string, playerId: string) {
        this.publish(this.sessionId, "join-player", { wallet, playerId });
      }

      sendMessage(message: string, playerId: string, playerWallet: string) {
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
        this.publish(this.sessionId, "respond-rematch", { playerId, accepted });
      }
    }

    // Register classes
    ChessModel.register("ChessModel");

    // Store references
    (window as any).ChessModel = ChessModel;
    (window as any).ChessView = ChessView;
  }

  async createSession(roomName: string, password: string = ""): Promise<any> {
    const apiKey = process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY;

    if (!apiKey) {
      throw new Error("Multisynq API key missing");
    }

    if (!this.isInitialized) {
      throw new Error("Multisynq not initialized");
    }

    const { Multisynq } = window as any;
    if (!Multisynq) {
      throw new Error("Multisynq not available");
    }

    try {
      const session = await Multisynq.Session.join({
        apiKey,
        appId: "com.onchainchess-novee.game",
        model: (window as any).ChessModel,
        view: (window as any).ChessView,
        name: roomName,
        password: password,
      });

      return session;
    } catch (error) {
      console.error("Failed to create Multisynq session:", error);
      throw error;
    }
  }
}

export const multisynqService = MultisynqService.getInstance();
