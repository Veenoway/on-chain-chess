import {
  type ChatMessage,
  type GameState,
  type Player,
} from "@/models/ChessGameModel";
import { useEffect, useState } from "react";

// Hook React pour Multisynq Chess
export function useChessGameModel() {
  const [gameState, setGameState] = useState<GameState>({
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
  });

  const [connectionStatus, setConnectionStatus] = useState("Prêt à jouer");
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [multisynqSession, setMultisynqSession] = useState<any>(null);

  // Initialiser Multisynq
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Multisynq) {
      // Charger le script Multisynq
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
      script.onload = () => {
        console.log("✅ Multisynq chargé depuis CDN");
      };
      script.onerror = () => {
        console.error("❌ Erreur chargement Multisynq CDN");
      };
      document.head.appendChild(script);
    }
  }, []);

  // Créer une room Multisynq
  const createRoom = (
    roomName: string,
    roomPassword: string,
    playerWallet: string,
    gameTimeLimit: number
  ): string | null => {
    if (!window.Multisynq) {
      console.error("❌ Multisynq non disponible");
      return null;
    }

    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;
    setCurrentPlayerId(playerId);

    const newGameState = {
      ...gameState,
      roomName,
      roomPassword,
      gameTimeLimit,
      whiteTime: gameTimeLimit,
      blackTime: gameTimeLimit,
      players: [
        {
          id: playerId,
          wallet: playerWallet,
          color: "white" as const,
          connected: true,
        },
      ],
    };

    setGameState(newGameState);
    console.log("🏠 Room créée:", roomName, "par joueur:", playerId);

    return playerId;
  };

  // Rejoindre une room
  const joinRoom = (roomName: string, playerWallet: string): string | null => {
    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;
    setCurrentPlayerId(playerId);

    // Déterminer la couleur
    const existingColors = gameState.players.map((p) => p.color);
    const playerColor: "white" | "black" = existingColors.includes("white")
      ? "black"
      : "white";

    const newPlayer: Player = {
      id: playerId,
      wallet: playerWallet,
      color: playerColor,
      connected: true,
    };

    setGameState((prev) => ({
      ...prev,
      roomName,
      players: [...prev.players, newPlayer],
    }));

    console.log("🚪 Joueur rejoint:", playerId, "couleur:", playerColor);
    return playerId;
  };

  // Démarrer une session Multisynq
  const startMultisynqSession = async (
    apiKey: string,
    roomName: string,
    password: string
  ) => {
    if (!window.Multisynq) {
      throw new Error("Multisynq non disponible");
    }

    try {
      setConnectionStatus("Connexion...");

      // Créer le Model
      class ChessModel extends window.Multisynq.Model {
        init() {
          console.log("🚀 Multisynq Model initialisé");
          this.gameState = gameState;

          // S'abonner aux événements
          this.subscribe(this.sessionId, "move", (moveData: any) => {
            console.log("♟️ Mouvement reçu:", moveData);
            // Mettre à jour l'état via React
          });

          this.subscribe(this.sessionId, "join", (playerData: any) => {
            console.log("👤 Joueur rejoint:", playerData);
          });

          this.subscribe(this.sessionId, "chat", (messageData: any) => {
            console.log("💬 Message reçu:", messageData);
          });

          // Publier l'état initial
          this.publish(this.sessionId, "gameState", this.gameState);
        }

        handleMove(moveData: any) {
          console.log("🎯 Gestion mouvement:", moveData);
          this.publish(this.sessionId, "gameState", this.gameState);
        }

        handlePlayerJoin(playerData: any) {
          console.log("🎯 Gestion joueur rejoint:", playerData);
          this.publish(this.sessionId, "gameState", this.gameState);
        }
      }

      // Créer la View
      class ChessView extends window.Multisynq.View {
        constructor(model: any) {
          super(model);
          console.log("🖥️ Multisynq View créée");

          // S'abonner aux changements d'état
          this.subscribe(
            this.sessionId,
            "gameState",
            (newGameState: GameState) => {
              setGameState(newGameState);
            }
          );
        }

        // Méthodes pour envoyer des actions
        makeMove(from: string, to: string, playerId: string) {
          this.publish(this.sessionId, "move", { from, to, playerId });
        }

        sendMessage(message: string, playerId: string, playerWallet: string) {
          this.publish(this.sessionId, "chat", {
            message,
            playerId,
            playerWallet,
          });
        }

        joinPlayer(wallet: string, playerId: string) {
          this.publish(this.sessionId, "join", { wallet, playerId });
        }
      }

      // Rejoindre la session
      const session = await window.Multisynq.Session.join({
        apiKey: apiKey,
        appId: "com.onchainchess.game",
        model: ChessModel,
        view: ChessView,
        name: roomName,
        password: password,
      });

      setMultisynqSession(session);
      setConnectionStatus("Connecté");

      console.log("🎉 Session Multisynq démarrée:", session.id);

      // Créer le widget dock
      window.Multisynq.App.makeWidgetDock();

      return session;
    } catch (error) {
      console.error("❌ Erreur session Multisynq:", error);
      setConnectionStatus("Erreur de connexion");
      throw error;
    }
  };

  // Faire un mouvement
  const makeMove = (from: string, to: string): boolean => {
    if (!currentPlayerId) return false;

    // Ici on publierait via Multisynq
    console.log("♟️ Mouvement:", from, "->", to);

    // Pour l'instant, simulation locale
    return true;
  };

  // Envoyer un message
  const sendMessage = (message: string, playerWallet: string) => {
    if (!currentPlayerId) return;

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      playerId: currentPlayerId,
      playerWallet,
      message,
      timestamp: Date.now(),
    };

    setGameState((prev) => ({
      ...prev,
      messages: [...prev.messages, chatMessage],
    }));

    console.log("💬 Message envoyé:", message);
  };

  // Démarrer le jeu
  const startGame = (): boolean => {
    if (gameState.players.length < 2) return false;

    setGameState((prev) => ({ ...prev, isActive: true }));
    console.log("🚀 Jeu démarré");
    return true;
  };

  // Remettre à zéro
  const resetGame = () => {
    setGameState((prev) => ({
      ...prev,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      isActive: false,
      turn: "w",
      whiteTime: prev.gameTimeLimit,
      blackTime: prev.gameTimeLimit,
      gameResult: { type: null },
      drawOffer: { offered: false, by: null },
      gameNumber: prev.gameNumber + 1,
      players: prev.players.map((p) => ({
        ...p,
        color: p.color === "white" ? "black" : "white",
      })),
    }));

    console.log("🔄 Jeu remis à zéro");
  };

  // Abandonner
  const resign = () => {
    if (!currentPlayerId) return;

    const player = gameState.players.find((p) => p.id === currentPlayerId);
    if (!player) return;

    const winner = player.color === "white" ? "black" : "white";

    setGameState((prev) => ({
      ...prev,
      gameResult: {
        type: "abandoned",
        winner,
        message: `${player.color === "white" ? "White" : "Black"} abandoned`,
      },
      isActive: false,
      lastGameWinner: winner,
    }));
  };

  // Proposer un nul
  const offerDraw = () => {
    if (!currentPlayerId) return;

    const player = gameState.players.find((p) => p.id === currentPlayerId);
    if (!player) return;

    setGameState((prev) => ({
      ...prev,
      drawOffer: { offered: true, by: player.color },
    }));
  };

  // Accepter un nul
  const acceptDraw = () => {
    setGameState((prev) => ({
      ...prev,
      gameResult: {
        type: "draw",
        winner: "draw",
        message: "Game ended by mutual agreement",
      },
      isActive: false,
      lastGameWinner: "draw",
      drawOffer: { offered: false, by: null },
    }));
  };

  // Refuser un nul
  const declineDraw = () => {
    setGameState((prev) => ({
      ...prev,
      drawOffer: { offered: false, by: null },
    }));
  };

  // Définir le temps de jeu
  const setGameTime = (gameTimeLimit: number) => {
    setGameState((prev) => ({
      ...prev,
      gameTimeLimit,
      whiteTime: gameTimeLimit,
      blackTime: gameTimeLimit,
    }));
  };

  // Utilitaires
  const getCurrentPlayer = () => {
    return gameState.players.find((p) => p.id === currentPlayerId);
  };

  const getPlayerColor = () => {
    const player = getCurrentPlayer();
    return player ? player.color : null;
  };

  const isMyTurn = () => {
    if (!currentPlayerId) return false;
    const player = getCurrentPlayer();
    if (!player) return false;

    return (
      (gameState.turn === "w" && player.color === "white") ||
      (gameState.turn === "b" && player.color === "black")
    );
  };

  const getOpponentPlayer = () => {
    const myColor = getPlayerColor();
    return gameState.players.find((p) => p.color !== myColor);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getInviteLink = () => {
    if (!gameState.roomName) return "";
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?room=${gameState.roomName}&password=${gameState.roomPassword}`;
  };

  return {
    // État
    gameState,
    connectionStatus,
    currentPlayerId,
    multisynqSession,

    // Actions de room
    createRoom,
    joinRoom,
    startMultisynqSession,

    // Actions de jeu
    makeMove,
    startGame,
    resetGame,
    sendMessage,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    setGameTime,

    // Utilitaires
    getCurrentPlayer,
    getPlayerColor,
    isMyTurn,
    getOpponentPlayer,
    formatTime,
    getInviteLink,
  };
}
