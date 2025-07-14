"use client";
import { WalletConnection } from "@/components/connect-wallet";
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useAccount } from "wagmi";

interface Player {
  id: string;
  wallet: string;
  color: "white" | "black";
  connected: boolean;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerWallet: string;
  message: string;
  timestamp: number;
}

interface GameState {
  fen: string;
  isActive: boolean;
  turn: "w" | "b";
  players: Player[];
  maxPlayers: number;
  whiteTime: number;
  blackTime: number;
  gameTimeLimit: number;
  lastMoveTime: number | null;
  roomName: string;
  roomPassword: string;
  messages: ChatMessage[];
  gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
    message?: string;
  };
  drawOffer: {
    offered: boolean;
    by: "white" | "black" | null;
  };
  gameNumber: number;
  lastGameWinner: "white" | "black" | "draw" | null;
  createdAt: number;
}

// Variables globales pour partager l'état avec Multisynq
let globalGameState: GameState;
let globalSetGameState: (state: GameState) => void;

export default function ChessMultisynqApp() {
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

  const [gameFlow, setGameFlow] = useState<"welcome" | "lobby" | "game">(
    "welcome"
  );
  const [roomInput, setRoomInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [newMessage, setNewMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Prêt à jouer");
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [multisynqSession, setMultisynqSession] = useState<any>(null);
  const [multisynqView, setMultisynqView] = useState<any>(null);
  const [multisynqReady, setMultisynqReady] = useState(false);
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");

  const { address, isConnected } = useAccount();
  const gameRef = useRef(new Chess());

  // Synchroniser gameRef avec l'état
  useEffect(() => {
    if (gameState.fen) {
      gameRef.current.load(gameState.fen);
      setFen(gameState.fen);
    }
  }, [gameState.fen]);

  // Synchroniser la couleur du joueur
  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (currentPlayer) {
      setPlayerColor(currentPlayer.color === "black" ? "black" : "white");
    }
  }, [gameState.players, currentPlayerId]);

  // Auto-join depuis l'URL au démarrage
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
      console.log("🔗 Auto-join depuis URL:", { roomFromUrl, passwordFromUrl });
      handleAutoJoinRoom(roomFromUrl, passwordFromUrl || "");
    }
  }, [multisynqReady, isConnected, address, gameFlow]);

  const handleAutoJoinRoom = async (roomName: string, password: string) => {
    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connexion automatique...");

    try {
      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      // Joindre en tant que joueur
      session.view.joinPlayer(address!, playerId);

      // Attendre un peu pour la synchronisation puis mettre à jour l'état local
      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
        }));
      }, 500);

      setGameFlow("game");
      setConnectionStatus(`✅ Connecté à: ${roomName}`);
    } catch (error) {
      console.error("❌ Erreur auto-join:", error);
      setConnectionStatus("❌ Room introuvable");
      // Retourner à l'accueil si échec
      window.history.pushState({}, "", window.location.pathname);
    }
  };

  // Synchroniser les variables globales
  useEffect(() => {
    globalGameState = gameState;
    globalSetGameState = setGameState;
  }, [gameState]);

  // Charger et initialiser Multisynq
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeMultisynq = async () => {
      // Vérifier si Multisynq est déjà chargé
      if ((window as any).Multisynq) {
        console.log("✅ Multisynq déjà présent");
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
            console.log("✅ Multisynq chargé depuis CDN");
            resolve();
          };
          script.onerror = () => {
            console.error("❌ Erreur chargement Multisynq CDN");
            reject(new Error("Failed to load Multisynq"));
          };
          document.head.appendChild(script);
        });

        // Attendre que Multisynq soit disponible
        await waitForMultisynqAvailable();
        setupMultisynqClasses();
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation Multisynq:", error);
        setConnectionStatus("❌ Erreur chargement Multisynq");
      }
    };

    initializeMultisynq();
  }, []);

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

  const setupMultisynqClasses = () => {
    const { Multisynq } = window as any;
    if (!Multisynq) {
      console.error("❌ Multisynq not available");
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
            gameNumber: 1,
            lastGameWinner: null,
            createdAt: Date.now(),
          };

          // S'abonner aux événements - SANS bind() ni fonctions fléchées
          this.subscribe(this.sessionId, "move", "handleMove");
          this.subscribe(this.sessionId, "join-player", "handlePlayerJoin");
          this.subscribe(this.sessionId, "chat-message", "handleChatMessage");
          this.subscribe(this.sessionId, "start-game", "handleStartGame");
          this.subscribe(this.sessionId, "reset-game", "handleResetGame");

          // Publier l'état initial
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleMove(data) {
          console.log("🏃 Traitement mouvement:", data);
          const { from, to, promotion, playerId } = data;

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

              // Vérifier fin de partie
              if (chess.isGameOver()) {
                this.state.isActive = false;
                if (chess.isCheckmate()) {
                  this.state.gameResult = {
                    type: "checkmate",
                    winner: chess.turn() === "w" ? "black" : "white",
                    message: `Échec et mat ! ${
                      chess.turn() === "w" ? "Noirs" : "Blancs"
                    } gagnent`,
                  };
                } else if (chess.isStalemate()) {
                  this.state.gameResult = {
                    type: "stalemate",
                    winner: "draw",
                    message: "Pat ! Match nul",
                  };
                } else if (chess.isDraw()) {
                  this.state.gameResult = {
                    type: "draw",
                    winner: "draw",
                    message: "Match nul",
                  };
                }
              }

              this.publish(this.sessionId, "game-state", this.state);
            }
          } catch (error) {
            console.error("❌ Mouvement invalide:", error);
          }
        }

        handlePlayerJoin(data) {
          console.log("👤 Joueur rejoint:", data);
          console.log("👥 Joueurs actuels:", this.state.players);

          const { playerId, wallet } = data;

          // Vérifier si le joueur existe déjà
          const existingPlayerIndex = this.state.players.findIndex(
            (p) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // Mettre à jour le joueur existant
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId;
            console.log("✅ Joueur existant reconnecté");
          } else if (this.state.players.length < this.state.maxPlayers) {
            // Assigner une couleur disponible
            const hasWhitePlayer = this.state.players.some(
              (p) => p.color === "white"
            );
            const color = hasWhitePlayer ? "black" : "white";

            const newPlayer = {
              id: playerId,
              wallet,
              color,
              connected: true,
            };

            this.state.players.push(newPlayer);
            console.log("✅ Nouveau joueur ajouté:", newPlayer);
          } else {
            console.warn("⚠️ Room pleine, impossible d'ajouter le joueur");
            return; // Ne pas publier si room pleine
          }

          console.log("📊 État final des joueurs:", this.state.players);
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message) {
          console.log("💬 Message chat:", message);
          this.state.messages.push({
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          });
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleStartGame() {
          console.log("🚀 Démarrage de la partie");
          if (this.state.players.length >= 2) {
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();
            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        handleResetGame() {
          console.log("🔄 Reset de la partie");
          this.state.fen =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          this.state.isActive = false;
          this.state.turn = "w";
          this.state.whiteTime = this.state.gameTimeLimit;
          this.state.blackTime = this.state.gameTimeLimit;
          this.state.gameResult = { type: null };
          this.state.drawOffer = { offered: false, by: null };
          this.state.gameNumber += 1;
          this.publish(this.sessionId, "game-state", this.state);
        }
      }

      // Définir la vue Chess
      class ChessView extends Multisynq.View {
        constructor(model) {
          super(model);
          console.log("👁️ Initialisation ChessView");

          // S'abonner aux mises à jour d'état - SANS bind()
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState) {
          console.log("🔄 Mise à jour état jeu:", newState);
          if (globalSetGameState) {
            // Forcer la mise à jour avec toutes les propriétés
            globalSetGameState((prevState) => ({
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
            }));
          }
        }

        // Méthodes pour envoyer des actions
        makeMove(from, to, playerId, promotion) {
          console.log("📤 Envoi mouvement:", { from, to, playerId });
          this.publish(this.sessionId, "move", {
            from,
            to,
            playerId,
            promotion: promotion || "q",
          });
        }

        joinPlayer(wallet, playerId) {
          console.log("📤 Envoi join player:", { wallet, playerId });
          this.publish(this.sessionId, "join-player", { wallet, playerId });
        }

        sendMessage(message, playerId, playerWallet) {
          console.log("📤 Envoi message:", { message, playerId });
          this.publish(this.sessionId, "chat-message", {
            message,
            playerId,
            playerWallet,
          });
        }

        startGame() {
          console.log("📤 Envoi start game");
          this.publish(this.sessionId, "start-game", {});
        }

        resetGame() {
          console.log("📤 Envoi reset game");
          this.publish(this.sessionId, "reset-game", {});
        }
      }

      // Enregistrer les classes avec Multisynq selon la documentation officielle
      ChessModel.register("ChessModel");
      // Les vues n'ont pas besoin d'être enregistrées

      // Stocker les références pour l'utilisation locale
      (window as any).ChessModel = ChessModel;
      (window as any).ChessView = ChessView;

      setMultisynqReady(true);
      setConnectionStatus("✅ Multisynq prêt");
      console.log("✅ Classes Multisynq configurées et enregistrées");
    } catch (error) {
      console.error("❌ Erreur lors de la configuration des classes:", error);
      setConnectionStatus("❌ Erreur configuration Multisynq");
    }
  };

  // Créer une session Multisynq
  const createMultisynqSession = async (
    roomName: string,
    password: string = ""
  ) => {
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
      console.log("🚀 Création session Multisynq:", { roomName, password });

      const session = await Multisynq.Session.join({
        apiKey,
        appId: "com.onchainchess-novee.game",
        model: ChessModel, // Passer la classe directement
        view: ChessView, // Passer la classe directement
        name: roomName,
        password: password,
      });

      console.log("✅ Session créée:", session);
      return session;
    } catch (error) {
      console.error("❌ Erreur création session:", error);
      throw error;
    }
  };

  // Créer une nouvelle room
  const handleCreateRoom = async () => {
    if (!isConnected || !address || !multisynqReady) return;

    setIsCreatingRoom(true);
    setConnectionStatus("Création de la room...");

    try {
      const roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password = Math.random().toString(36).substring(2, 6);
      const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;

      setCurrentPlayerId(playerId);

      // Créer la session
      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      // Joindre en tant que premier joueur
      session.view.joinPlayer(address, playerId);

      // Mettre à jour l'état local immédiatement
      setGameState((prev) => ({
        ...prev,
        roomName,
        roomPassword: password,
        gameTimeLimit: selectedGameTime,
        whiteTime: selectedGameTime,
        blackTime: selectedGameTime,
      }));

      // Créer le widget de partage
      if ((window as any).Multisynq?.App?.makeWidgetDock) {
        (window as any).Multisynq.App.makeWidgetDock();
      }

      // Mettre à jour l'URL
      const newUrl = `${window.location.pathname}?room=${roomName}&password=${password}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`✅ Room créée: ${roomName}`);
    } catch (error) {
      console.error("❌ Erreur création room:", error);
      setConnectionStatus("❌ Erreur création room");
      alert("Impossible de créer la room. Vérifiez votre clé API Multisynq.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Rejoindre une room existante
  const handleJoinRoom = async () => {
    if (!isConnected || !roomInput.trim() || !address || !multisynqReady)
      return;

    // Analyser l'input - peut être juste le room name ou room:password
    const input = roomInput.trim();
    let roomName: string;
    let password: string = "";

    if (input.includes(":")) {
      const parts = input.split(":");
      roomName = parts[0];
      password = parts[1] || "";
    } else {
      roomName = input;
    }

    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connexion à la room...");

    try {
      // Tenter de rejoindre la session
      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      // Joindre en tant que joueur
      session.view.joinPlayer(address, playerId);

      // Attendre un peu pour la synchronisation puis mettre à jour l'état local
      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
        }));
      }, 500);

      // Mettre à jour l'URL
      const newUrl = password
        ? `${window.location.pathname}?room=${roomName}&password=${password}`
        : `${window.location.pathname}?room=${roomName}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`✅ Connecté à: ${roomName}`);
    } catch (error) {
      console.error("❌ Erreur rejoindre room:", error);
      setConnectionStatus("❌ Room introuvable");
      alert(
        `Impossible de rejoindre la room "${roomName}". Vérifiez le code${
          password ? " et le mot de passe" : ""
        }.`
      );
    }
  };

  // Gérer les mouvements d'échecs
  const onPieceDrop = (args: PieceDropHandlerArgs): boolean => {
    const { sourceSquare, targetSquare } = args;
    if (!targetSquare || !currentPlayerId || !multisynqView) return false;

    // Vérifier si c'est le tour du joueur
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return false;

    const currentTurn = gameState.turn;
    if (
      (currentTurn === "w" && currentPlayer.color !== "white") ||
      (currentTurn === "b" && currentPlayer.color !== "black")
    ) {
      console.warn("❌ Ce n'est pas votre tour !");
      return false;
    }

    // Vérifier le mouvement localement avant de l'envoyer
    const tempGame = new Chess(gameState.fen);
    try {
      const moveResult = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
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
      console.warn("❌ Mouvement invalide:", error);
    }

    return false;
  };

  // Envoyer un message de chat
  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentPlayerId || !address || !multisynqView)
      return;

    multisynqView.sendMessage(newMessage, currentPlayerId, address);
    setNewMessage("");
  };

  // Démarrer la partie
  const handleStartGame = () => {
    if (!multisynqView) return;
    multisynqView.startGame();
  };

  // Nouvelle partie
  const handleNewGame = () => {
    if (!multisynqView) return;
    multisynqView.resetGame();
  };

  // Déterminer l'orientation de l'échiquier
  const getBoardOrientation = (): "white" | "black" => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    return currentPlayer?.color === "black" ? "black" : "white";
  };

  // Calcul du temps restant
  const getCurrentPlayerTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.whiteTime
      : gameState.blackTime;
  };

  const getOpponentTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.blackTime
      : gameState.whiteTime;
  };

  const chessboardOptions = {
    position: fen, // useState
    onPieceDrop: onPieceDrop,
    boardOrientation: playerColor, // useState
    arePiecesDraggable: gameState.isActive, // useState
    boardWidth: 480,
    animationDuration: 200,
    showBoardNotation: true,
    // + styles personnalisés
  };

  // Interface d'accueil
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              ♔ Chess Multi
            </h1>
            <p className="text-blue-200">
              Jeu d'échecs en temps réel avec Multisynq
            </p>
          </div>

          <div className="space-y-6">
            <WalletConnection />

            {isConnected && (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">
                      Temps de jeu (secondes)
                    </label>
                    <select
                      value={selectedGameTime}
                      onChange={(e) =>
                        setSelectedGameTime(Number(e.target.value))
                      }
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400"
                    >
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                      <option value={900}>15 minutes</option>
                      <option value={1800}>30 minutes</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCreateRoom}
                    disabled={isCreatingRoom || !multisynqReady}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                  >
                    {isCreatingRoom
                      ? "Création..."
                      : !multisynqReady
                      ? "Chargement Multisynq..."
                      : "🎮 Créer une nouvelle partie"}
                  </button>

                  <div className="text-center text-blue-200">ou</div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Code room ou room:password"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-400"
                    />
                    <p className="text-xs text-blue-300">
                      Format: "chess-abc123" ou "chess-abc123:motdepasse"
                    </p>
                    <button
                      onClick={handleJoinRoom}
                      disabled={!roomInput.trim() || !multisynqReady}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                    >
                      {!multisynqReady
                        ? "Chargement..."
                        : "🚪 Rejoindre une partie"}
                    </button>
                  </div>
                </div>

                <div className="text-center text-sm text-blue-300">
                  Status: {connectionStatus}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Interface de jeu
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">♔ Chess Multi</h1>
            <p className="text-blue-200">Room: {gameState.roomName}</p>
            {gameState.roomPassword && (
              <p className="text-xs text-gray-400">
                Lien de partage: {window.location.origin}
                {window.location.pathname}?room={gameState.roomName}&password=
                {gameState.roomPassword}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGameFlow("welcome")}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              🏠 Accueil
            </button>
            <button
              onClick={handleNewGame}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              🔄 Nouvelle partie
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel de gauche - Infos joueurs */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3">
                👥 Joueurs ({gameState.players.length}/{gameState.maxPlayers})
              </h3>

              {/* Debug info */}
              {process.env.NODE_ENV === "development" && (
                <div className="mb-2 p-2 bg-gray-800 rounded text-xs text-gray-300">
                  Debug:{" "}
                  {JSON.stringify(
                    gameState.players.map((p) => ({
                      id: p.id.slice(-4),
                      wallet: p.wallet.slice(-4),
                      color: p.color,
                    }))
                  )}
                </div>
              )}

              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-lg border ${
                      player.id === currentPlayerId
                        ? "bg-blue-500/20 border-blue-400"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">
                          {player.color === "white" ? "⚪" : "⚫"}
                          {player.wallet.slice(0, 6)}...
                          {player.wallet.slice(-4)}
                          {player.id === currentPlayerId && " (Vous)"}
                        </div>
                        <div className="text-sm text-gray-300">
                          {player.connected ? "🟢 En ligne" : "🔴 Hors ligne"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {gameState.players.length < 2 && (
                  <div className="p-3 bg-yellow-500/20 border border-yellow-400 rounded-lg">
                    <p className="text-yellow-200 text-sm">
                      En attente d'un adversaire... ({gameState.players.length}
                      /2)
                    </p>
                    <p className="text-yellow-100 text-xs mt-1">
                      Partagez ce lien pour inviter quelqu'un !
                    </p>
                  </div>
                )}
              </div>

              {gameState.players.length >= 2 && !gameState.isActive && (
                <button
                  onClick={handleStartGame}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  🚀 Démarrer la partie
                </button>
              )}
            </div>

            {/* Timer */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3">
                ⏱️ Temps
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Vous:</span>
                  <span className="text-white font-mono">
                    {Math.floor(getCurrentPlayerTime() / 60)}:
                    {(getCurrentPlayerTime() % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Adversaire:</span>
                  <span className="text-white font-mono">
                    {Math.floor(getOpponentTime() / 60)}:
                    {(getOpponentTime() % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel central - Échiquier */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="aspect-square max-w-full mx-auto">
                <Chessboard options={chessboardOptions} />
              </div>

              {/* Status du jeu */}
              <div className="mt-4 text-center">
                {gameState.gameResult.type ? (
                  <div className="p-3 bg-yellow-500/20 border border-yellow-400 rounded-lg">
                    <p className="text-yellow-200 font-semibold">
                      {gameState.gameResult.message || "Partie terminée"}
                    </p>
                  </div>
                ) : gameState.isActive ? (
                  <div className="p-3 bg-green-500/20 border border-green-400 rounded-lg">
                    <p className="text-green-200">
                      {gameState.turn === "w"
                        ? "⚪ Trait aux blancs"
                        : "⚫ Trait aux noirs"}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-500/20 border border-blue-400 rounded-lg">
                    <p className="text-blue-200">
                      En attente du début de partie
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel de droite - Chat */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-white mb-3">💬 Chat</h3>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-96 mb-4">
                {gameState.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg ${
                      msg.playerId === currentPlayerId
                        ? "bg-blue-500/20 border border-blue-400 ml-2"
                        : "bg-white/5 border border-white/10 mr-2"
                    }`}
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {msg.playerWallet.slice(0, 6)}...
                      {msg.playerWallet.slice(-4)}
                    </div>
                    <div className="text-white text-sm">{msg.message}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Tapez votre message..."
                  className="flex-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  📤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
