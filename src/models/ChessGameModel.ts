import { Chess } from "chess.js";

// Interface pour les données d'un joueur
export interface Player {
  id: string;
  wallet: string;
  color: "white" | "black";
  connected: boolean;
}

// Interface pour un message de chat
export interface ChatMessage {
  id: string;
  playerId: string;
  playerWallet: string;
  message: string;
  timestamp: number;
}

// Interface pour l'état complet du jeu
export interface GameState {
  // État du jeu d'échecs
  fen: string;
  isActive: boolean;
  turn: "w" | "b";

  // Joueurs
  players: Player[];
  maxPlayers: number;

  // Timers
  whiteTime: number;
  blackTime: number;
  gameTimeLimit: number;
  lastMoveTime: number | null;

  // Room info
  roomName: string;
  roomPassword: string;

  // Chat
  messages: ChatMessage[];

  // État de fin de partie
  gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
    message?: string;
  };

  // Proposition de nul
  drawOffer: {
    offered: boolean;
    by: "white" | "black" | null;
  };

  // Métadonnées
  gameNumber: number;
  lastGameWinner: "white" | "black" | "draw" | null;
  createdAt: number;
}

// Déclarer les types Multisynq globaux
interface MultisynqModelClass {
  new (): MultisynqModelInstance;
}

interface MultisynqViewClass {
  new (model: MultisynqModelInstance): MultisynqViewInstance;
}

interface MultisynqModelInstance {
  sessionId: string;
  subscribe: (
    sessionId: string,
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
  publish: (sessionId: string, event: string, data?: unknown) => void;
  init: () => void;
}

interface MultisynqViewInstance {
  sessionId: string;
  subscribe: (
    sessionId: string,
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
  publish: (sessionId: string, event: string, data?: unknown) => void;
}

interface MultisynqSession {
  id: string;
}

declare global {
  interface Window {
    Multisynq: {
      Model: MultisynqModelClass;
      View: MultisynqViewClass;
      Session: {
        join: (options: {
          apiKey: string;
          appId: string;
          model: MultisynqModelClass;
          view: MultisynqViewClass;
          name: string;
          password: string;
        }) => Promise<MultisynqSession>;
      };
      App: {
        autoSession: () => string;
        autoPassword: () => string;
        makeWidgetDock: () => void;
      };
    };
  }
}

// ChessGameModel - hérite de Multisynq.Model
export class ChessGameModel {
  public gameState: GameState;
  public chess: Chess;
  private sessionId: string | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private multisynqView: MultisynqViewInstance | null = null;

  // Callbacks pour communiquer avec React
  private onStateChange?: (state: GameState) => void;

  constructor() {
    this.chess = new Chess();

    // État initial du jeu
    this.gameState = {
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
      gameNumber: 1,
      lastGameWinner: null,
      createdAt: Date.now(),
    };

    console.log("🎯 ChessGameModel créé - Prêt pour Multisynq");
  }

  // Setter pour le callback de changement d'état
  setOnStateChange(callback: (state: GameState) => void) {
    this.onStateChange = callback;
  }

  // Créer le Model Multisynq
  createMultisynqModel(): MultisynqModelClass | null {
    if (typeof window === "undefined" || !window.Multisynq) {
      console.error("❌ Multisynq non disponible");
      return null;
    }

    const gameModelInstance = this;

    // Créer une classe qui hérite de Multisynq.Model
    class ChessMultisynqModel extends window.Multisynq.Model {
      init() {
        console.log("🚀 Multisynq Model initialisé");

        // État initial
        this.gameState = { ...gameModelInstance.gameState };
        this.chess = new Chess();

        // S'abonner aux événements des vues
        this.subscribe(
          this.sessionId,
          "joinPlayer",
          this.handleJoinPlayer.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "makeMove",
          this.handleMakeMove.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "sendMessage",
          this.handleSendMessage.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "startGame",
          this.handleStartGame.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "resetGame",
          this.handleResetGame.bind(this)
        );
        this.subscribe(this.sessionId, "resign", this.handleResign.bind(this));
        this.subscribe(
          this.sessionId,
          "offerDraw",
          this.handleOfferDraw.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "acceptDraw",
          this.handleAcceptDraw.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "declineDraw",
          this.handleDeclineDraw.bind(this)
        );
        this.subscribe(
          this.sessionId,
          "setGameTime",
          this.handleSetGameTime.bind(this)
        );

        // Publier l'état initial
        this.publishGameState();
      }

      // Publier l'état du jeu vers toutes les vues
      publishGameState() {
        this.publish(this.sessionId, "gameStateChanged", this.gameState);
        // Synchroniser avec l'instance locale
        gameModelInstance.gameState = { ...this.gameState };
        if (gameModelInstance.onStateChange) {
          gameModelInstance.onStateChange(gameModelInstance.gameState);
        }
      }

      // Gérer l'ajout d'un joueur
      handleJoinPlayer(data: { wallet: string; playerId: string }) {
        console.log("👤 Joueur rejoint:", data);

        // Vérifier si le joueur existe déjà
        const existingPlayer = this.gameState.players.find(
          (p: Player) => p.wallet === data.wallet
        );
        if (existingPlayer) {
          existingPlayer.connected = true;
          this.publishGameState();
          return;
        }

        // Vérifier s'il y a de la place
        if (this.gameState.players.length >= this.gameState.maxPlayers) {
          console.warn("⚠️ Room pleine");
          return;
        }

        // Déterminer la couleur
        const existingColors = this.gameState.players.map(
          (p: Player) => p.color
        );
        const playerColor: "white" | "black" = existingColors.includes("white")
          ? "black"
          : "white";

        // Ajouter le nouveau joueur
        const newPlayer: Player = {
          id: data.playerId,
          wallet: data.wallet,
          color: playerColor,
          connected: true,
        };

        this.gameState.players.push(newPlayer);
        this.publishGameState();
      }

      // Gérer un mouvement
      handleMakeMove(data: {
        from: string;
        to: string;
        playerId: string;
        promotion?: string;
      }) {
        console.log("♟️ Mouvement reçu:", data);

        const player = this.gameState.players.find(
          (p: Player) => p.id === data.playerId
        );
        if (!player) return;

        // Vérifier le tour
        const currentTurn = this.gameState.turn;
        if (
          (currentTurn === "w" && player.color !== "white") ||
          (currentTurn === "b" && player.color !== "black")
        ) {
          console.warn("❌ Ce n'est pas le tour de ce joueur");
          return;
        }

        // Valider et exécuter le mouvement
        try {
          const moveResult = this.chess.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || "q",
          });

          if (!moveResult) {
            console.warn("❌ Mouvement invalide");
            return;
          }

          // Mettre à jour l'état
          this.gameState.fen = this.chess.fen();
          this.gameState.turn = this.chess.turn();
          this.gameState.lastMoveTime = Date.now();

          // Vérifier fin de partie
          this.checkGameEnd();

          this.publishGameState();
        } catch (error) {
          console.error("❌ Erreur mouvement:", error);
        }
      }

      // Gérer un message de chat
      handleSendMessage(data: {
        message: string;
        playerId: string;
        playerWallet: string;
      }) {
        const chatMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: data.playerId,
          playerWallet: data.playerWallet,
          message: data.message,
          timestamp: Date.now(),
        };

        this.gameState.messages.push(chatMessage);
        this.publishGameState();
      }

      // Gérer le démarrage du jeu
      handleStartGame() {
        if (this.gameState.players.length < 2) return;

        this.gameState.isActive = true;
        this.publishGameState();
      }

      // Gérer la remise à zéro
      handleResetGame() {
        this.chess.reset();

        // Échanger les couleurs
        this.gameState.players.forEach((player: Player) => {
          player.color = player.color === "white" ? "black" : "white";
        });

        this.gameState.fen = this.chess.fen();
        this.gameState.isActive = false;
        this.gameState.turn = "w";
        this.gameState.whiteTime = this.gameState.gameTimeLimit;
        this.gameState.blackTime = this.gameState.gameTimeLimit;
        this.gameState.lastMoveTime = null;
        this.gameState.gameResult = { type: null };
        this.gameState.drawOffer = { offered: false, by: null };
        this.gameState.gameNumber++;

        this.publishGameState();
      }

      // Gérer l'abandon
      handleResign(data: { playerId: string }) {
        const player = this.gameState.players.find(
          (p: Player) => p.id === data.playerId
        );
        if (!player) return;

        const winner = player.color === "white" ? "black" : "white";

        this.gameState.gameResult = {
          type: "abandoned",
          winner,
          message: `${
            player.color === "white" ? "White" : "Black"
          } abandoned the game`,
        };

        this.gameState.isActive = false;
        this.gameState.lastGameWinner = winner;

        this.publishGameState();
      }

      // Gérer la proposition de nul
      handleOfferDraw(data: { playerId: string }) {
        const player = this.gameState.players.find(
          (p: Player) => p.id === data.playerId
        );
        if (!player) return;

        this.gameState.drawOffer = { offered: true, by: player.color };
        this.publishGameState();
      }

      // Gérer l'acceptation du nul
      handleAcceptDraw() {
        this.gameState.gameResult = {
          type: "draw",
          winner: "draw",
          message: "Game ended by mutual agreement",
        };
        this.gameState.isActive = false;
        this.gameState.lastGameWinner = "draw";
        this.gameState.drawOffer = { offered: false, by: null };

        this.publishGameState();
      }

      // Gérer le refus du nul
      handleDeclineDraw() {
        this.gameState.drawOffer = { offered: false, by: null };
        this.publishGameState();
      }

      // Gérer la définition du temps
      handleSetGameTime(data: { gameTimeLimit: number }) {
        this.gameState.gameTimeLimit = data.gameTimeLimit;
        this.gameState.whiteTime = data.gameTimeLimit;
        this.gameState.blackTime = data.gameTimeLimit;

        this.publishGameState();
      }

      // Vérifier la fin de partie
      checkGameEnd() {
        if (this.chess.isGameOver()) {
          this.gameState.isActive = false;

          if (this.chess.isCheckmate()) {
            const winner = this.chess.turn() === "w" ? "black" : "white";
            this.gameState.gameResult = {
              type: "checkmate",
              winner,
              message: `Checkmate! ${
                winner === "white" ? "White" : "Black"
              } wins!`,
            };
            this.gameState.lastGameWinner = winner;
          } else if (this.chess.isDraw()) {
            this.gameState.gameResult = {
              type: "draw",
              winner: "draw",
              message: "Game ended in a draw",
            };
            this.gameState.lastGameWinner = "draw";
          } else if (this.chess.isStalemate()) {
            this.gameState.gameResult = {
              type: "stalemate",
              winner: "draw",
              message: "Game ended by stalemate",
            };
            this.gameState.lastGameWinner = "draw";
          }
        }
      }
    }

    return ChessMultisynqModel;
  }

  // Créer la View Multisynq
  createMultisynqView(): MultisynqViewClass | null {
    if (typeof window === "undefined" || !window.Multisynq) {
      console.error("❌ Multisynq non disponible");
      return null;
    }

    const gameModelInstance = this;

    class ChessMultisynqView extends window.Multisynq.View {
      constructor(model: MultisynqModelInstance) {
        super(model);

        // S'abonner aux changements d'état
        this.subscribe(
          this.sessionId,
          "gameStateChanged",
          this.updateGameState.bind(this)
        );

        console.log("🖥️ Multisynq View créée");
      }

      // Mettre à jour l'état local
      updateGameState(gameState: GameState) {
        gameModelInstance.gameState = { ...gameState };
        if (gameModelInstance.chess.fen() !== gameState.fen) {
          try {
            gameModelInstance.chess.load(gameState.fen);
          } catch (error) {
            console.error("❌ Erreur chargement FEN:", error);
          }
        }

        // Notifier React
        if (gameModelInstance.onStateChange) {
          gameModelInstance.onStateChange(gameModelInstance.gameState);
        }
      }

      // Méthodes pour envoyer des événements au Model
      joinPlayer(wallet: string, playerId: string) {
        this.publish(this.sessionId, "joinPlayer", { wallet, playerId });
      }

      makeMove(from: string, to: string, playerId: string, promotion?: string) {
        this.publish(this.sessionId, "makeMove", {
          from,
          to,
          playerId,
          promotion,
        });
      }

      sendMessage(message: string, playerId: string, playerWallet: string) {
        this.publish(this.sessionId, "sendMessage", {
          message,
          playerId,
          playerWallet,
        });
      }

      startGame() {
        this.publish(this.sessionId, "startGame");
      }

      resetGame() {
        this.publish(this.sessionId, "resetGame");
      }

      resign(playerId: string) {
        this.publish(this.sessionId, "resign", { playerId });
      }

      offerDraw(playerId: string) {
        this.publish(this.sessionId, "offerDraw", { playerId });
      }

      acceptDraw() {
        this.publish(this.sessionId, "acceptDraw");
      }

      declineDraw() {
        this.publish(this.sessionId, "declineDraw");
      }

      setGameTime(gameTimeLimit: number) {
        this.publish(this.sessionId, "setGameTime", { gameTimeLimit });
      }
    }

    return ChessMultisynqView;
  }

  // Démarrer la session Multisynq
  async startMultisynqSession(
    apiKey: string,
    roomName: string,
    password: string
  ): Promise<MultisynqSession> {
    if (typeof window === "undefined" || !window.Multisynq) {
      throw new Error("Multisynq non disponible - incluez le script CDN");
    }

    const ModelClass = this.createMultisynqModel();
    const ViewClass = this.createMultisynqView();

    if (!ModelClass || !ViewClass) {
      throw new Error("Erreur création des classes Multisynq");
    }

    try {
      const session = await window.Multisynq.Session.join({
        apiKey: apiKey,
        appId: "com.onchainchess-novee.game",
        model: ModelClass,
        view: ViewClass,
        name: roomName,
        password: password,
      });

      this.sessionId = session.id;
      this.gameState.roomName = roomName;
      this.gameState.roomPassword = password;

      console.log("🎉 Session Multisynq démarrée:", session.id);

      // Créer le widget dock pour le partage
      window.Multisynq.App.makeWidgetDock();

      return session;
    } catch (error) {
      console.error("❌ Erreur démarrage session Multisynq:", error);
      throw error;
    }
  }

  // Méthodes publiques pour interagir avec Multisynq
  public joinAsPlayer(wallet: string, playerId: string) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as {
          joinPlayer: (wallet: string, playerId: string) => void;
        }
      ).joinPlayer(wallet, playerId);
    }
  }

  public makeMove(
    from: string,
    to: string,
    playerId: string,
    promotion?: string
  ) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as {
          makeMove: (
            from: string,
            to: string,
            playerId: string,
            promotion?: string
          ) => void;
        }
      ).makeMove(from, to, playerId, promotion);
    }
  }

  public sendMessage(message: string, playerId: string, playerWallet: string) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as {
          sendMessage: (
            message: string,
            playerId: string,
            playerWallet: string
          ) => void;
        }
      ).sendMessage(message, playerId, playerWallet);
    }
  }

  public startGame() {
    if (this.multisynqView) {
      (this.multisynqView as unknown as { startGame: () => void }).startGame();
    }
  }

  public resetGame() {
    if (this.multisynqView) {
      (this.multisynqView as unknown as { resetGame: () => void }).resetGame();
    }
  }

  public resign(playerId: string) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as { resign: (playerId: string) => void }
      ).resign(playerId);
    }
  }

  public offerDraw(playerId: string) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as {
          offerDraw: (playerId: string) => void;
        }
      ).offerDraw(playerId);
    }
  }

  public acceptDraw() {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as { acceptDraw: () => void }
      ).acceptDraw();
    }
  }

  public declineDraw() {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as { declineDraw: () => void }
      ).declineDraw();
    }
  }

  public setGameTime(gameTimeLimit: number) {
    if (this.multisynqView) {
      (
        this.multisynqView as unknown as {
          setGameTime: (gameTimeLimit: number) => void;
        }
      ).setGameTime(gameTimeLimit);
    }
  }

  // Méthodes utilitaires
  public getPlayerByWallet(wallet: string): Player | undefined {
    return this.gameState.players.find((p) => p.wallet === wallet);
  }

  public getPlayerColor(playerId: string): "white" | "black" | null {
    const player = this.gameState.players.find((p) => p.id === playerId);
    return player ? player.color : null;
  }

  public isPlayerTurn(playerId: string): boolean {
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (!player) return false;

    const currentTurn = this.gameState.turn;
    return (
      (currentTurn === "w" && player.color === "white") ||
      (currentTurn === "b" && player.color === "black")
    );
  }

  public getRoomInfo() {
    return {
      name: this.gameState.roomName,
      password: this.gameState.roomPassword,
      players: this.gameState.players.length,
      maxPlayers: this.gameState.maxPlayers,
    };
  }

  public dispose() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    console.log("🧹 ChessGameModel nettoyé");
  }
}
