/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-direct-mutation-state */
"use client";
import { WalletConnection } from "@/components/connect-wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chess } from "chess.js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useAccount } from "wagmi";
import CapturedPieces from "./chessboard";

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
  rematchOffer?: {
    // NOUVEAU
    offered: boolean;
    by: "white" | "black" | null;
  };
  gameNumber: number;
  lastGameWinner: "white" | "black" | "draw" | null;
  createdAt: number;
}

// Variables globales pour partager l'état avec Multisynq
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
    rematchOffer: { offered: false, by: null },
    gameNumber: 1,
    lastGameWinner: null,
    createdAt: Date.now(),
  });
  const router = useRouter();
  const [gameFlow, setGameFlow] = useState<"welcome" | "lobby" | "game">(
    "welcome"
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [, setLastKnownGameState] = useState<GameState | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [newMessage, setNewMessage] = useState("");
  const [, setConnectionStatus] = useState("Prêt à jouer");

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [, setMultisynqSession] = useState<any>(null);
  const [multisynqView, setMultisynqView] = useState<any>(null);
  const [multisynqReady, setMultisynqReady] = useState(false);
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const moveHistoryRef = useRef<string[]>([]);
  const currentMoveIndexRef = useRef(-1);

  const { address, isConnected, chainId } = useAccount();
  const isWrongNetwork = chainId !== 10143;
  console.log("chainId", chainId, isWrongNetwork);
  const gameRef = useRef(new Chess());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer fonctionnel - seul le premier joueur gère le timer
  useEffect(() => {
    const isFirstPlayer =
      gameState.players.length > 0 &&
      gameState.players[0].id === currentPlayerId;

    if (gameState.isActive && !gameState.gameResult.type && isFirstPlayer) {
      // Démarrer le timer (seulement pour le premier joueur)
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 1000);
      console.log("Timer démarré par le premier joueur");
    } else {
      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    gameState.isActive,
    gameState.gameResult.type,
    gameState.players,
    currentPlayerId,
    multisynqView,
  ]);

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      setPlayerColor(currentPlayer.color === "black" ? "black" : "white");

      // Si on était en train de se reconnecter, maintenant c'est réussi
      if (isReconnecting) {
        setIsReconnecting(false);
        console.log("✅ Reconnexion réussie! Joueur retrouvé:", {
          id: currentPlayer.id,
          color: currentPlayer.color,
          wallet:
            currentPlayer.wallet.slice(0, 6) +
            "..." +
            currentPlayer.wallet.slice(-4),
        });
      }
    } else if (
      gameState.players.length > 0 &&
      currentPlayerId &&
      !isReconnecting
    ) {
      // Si on a un ID mais qu'on ne trouve pas le joueur dans une partie active
      const hasActiveGame = gameState.isActive || gameState.gameResult.type;
      if (hasActiveGame) {
        console.log(
          "⚠️ Joueur non trouvé dans la partie active, tentative de reconnexion..."
        );
        setIsReconnecting(true);

        // Tenter une reconnexion automatique
        setTimeout(() => {
          if (multisynqView && address && currentPlayerId) {
            console.log("🔄 Tentative de reconnexion automatique...");
            multisynqView.joinPlayer(address, currentPlayerId);
          }
        }, 1000);
      }
    }

    // Sauvegarder l'état pour comparaison future
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

  // Mettre à jour les refs quand l'état change
  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    currentMoveIndexRef.current = currentMoveIndex;
  }, [moveHistory, currentMoveIndex]);

  // Synchroniser gameRef avec l'état
  useEffect(() => {
    if (gameState.fen) {
      gameRef.current.load(gameState.fen);

      // Si on n'est pas en mode navigation, mettre à jour la position affichée
      if (
        currentMoveIndexRef.current === moveHistoryRef.current.length - 1 ||
        moveHistoryRef.current.length === 0
      ) {
        setFen(gameState.fen);
      }

      // Détecter un nouveau coup et l'ajouter à l'historique
      if (
        gameState.isActive &&
        moveHistoryRef.current.length > 0 &&
        gameState.fen !==
          moveHistoryRef.current[moveHistoryRef.current.length - 1]
      ) {
        console.log("🆕 Nouveau coup détecté:", {
          nouveauFen: gameState.fen,
          dernierFenHistorique:
            moveHistoryRef.current[moveHistoryRef.current.length - 1],
          tailleHistorique: moveHistoryRef.current.length,
        });

        // Ajouter la nouvelle position à l'historique
        const newHistory = [...moveHistoryRef.current, gameState.fen];
        setMoveHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);
        setFen(gameState.fen);
      }
    }
  }, [gameState.fen, gameState.isActive]);

  // Ouvrir le modal quand la partie se termine
  useEffect(() => {
    if (gameState.gameResult.type && !showGameEndModal) {
      setShowGameEndModal(true);
    } else if (!gameState.gameResult.type && showGameEndModal) {
      setShowGameEndModal(false);
    }
  }, [gameState.gameResult.type, showGameEndModal]);

  // Réinitialiser l'historique quand une nouvelle partie commence
  useEffect(() => {
    if (
      gameState.isActive &&
      gameState.fen ===
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    ) {
      console.log("🔄 Réinitialisation de l'historique pour nouvelle partie");
      setMoveHistory([
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ]);
      setCurrentMoveIndex(0);
    }
  }, [gameState.isActive, gameState.gameNumber]);

  // Initialiser l'historique quand on rejoint une partie pour la première fois
  useEffect(() => {
    if (moveHistory.length === 0 && gameState.players.length > 0) {
      console.log("🆔 Initialisation de l'historique initial");
      setMoveHistory([
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ]);
      setCurrentMoveIndex(0);
    }
  }, [gameState.players.length, moveHistory.length]);

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    const isFirstPlayer =
      gameState.players.length > 0 &&
      gameState.players[0].id === currentPlayerId;

    // CORRECTION: Seulement démarrer le timer si le joueur est connecté et trouvé
    if (
      gameState.isActive &&
      !gameState.gameResult.type &&
      isFirstPlayer &&
      currentPlayer?.connected &&
      !isReconnecting
    ) {
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 1000);
      console.log("⏰ Timer démarré par le premier joueur connecté");
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    gameState.isActive,
    gameState.gameResult.type,
    gameState.players,
    currentPlayerId,
    multisynqView,
    isReconnecting,
  ]);

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
    // CORRECTION: Utiliser un ID basé sur l'adresse wallet pour la persistance
    const playerId = `player_${address?.slice(-8)}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connexion automatique...");

    try {
      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      console.log(
        "🔍 Méthodes disponibles (auto-join):",
        Object.getOwnPropertyNames(session.view)
      );

      // Joindre en tant que joueur
      session.view.joinPlayer(address!, playerId);

      // CORRECTION: Réduire le délai et forcer la synchronisation
      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
        }));

        // Forcer une synchronisation d'état après reconnexion
        console.log("🔄 Demande de synchronisation d'état après reconnexion");
      }, 200); // Réduit de 500ms à 200ms

      setGameFlow("game");
      setConnectionStatus(`✅ Connecté à: ${roomName}`);
    } catch (error) {
      console.error("❌ Erreur auto-join:", error);
      setConnectionStatus("❌ Room introuvable");
      window.history.pushState({}, "", window.location.pathname);
    }
  };

  // Synchroniser les variables globales
  useEffect(() => {
    globalSetGameState = setGameState;
  }, [gameState]);

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

  const handleRequestRematch = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.requestRematch === "function") {
      multisynqView.requestRematch(currentPlayerId);
      console.log("Demande de revanche envoyée");
    } else {
      console.error("requestRematch n'est pas une fonction:", multisynqView);
      alert("Erreur: Fonction de demande de revanche non disponible.");
    }
  };

  const handleRespondRematch = (accepted: boolean) => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.respondRematch === "function") {
      multisynqView.respondRematch(currentPlayerId, accepted);
      console.log(
        `Réponse revanche envoyée: ${accepted ? "accepté" : "refusé"}`
      );
    } else {
      console.error("respondRematch n'est pas une fonction:", multisynqView);
      alert("Erreur: Fonction de réponse revanche non disponible.");
    }
  };

  const setupMultisynqClasses = () => {
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
          };

          // S'abonner aux événements - SANS bind() ni fonctions fléchées
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
          // Publier l'état initial
          this.publish(this.sessionId, "game-state", this.state);
        }

        // Ajoutez ces nouvelles méthodes dans ChessModel :
        handleSetGameTime(data: { gameTime: number }) {
          console.log("Réglage du temps de jeu:", data);
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRequestRematch(data: { playerId: string }) {
          console.log("Demande de revanche:", data);

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

        handleRespondRematch(data: { playerId: string; accepted: boolean }) {
          console.log("Réponse revanche:", data);

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
            this.state.isActive = true;
            this.state.turn = "w";
            this.state.whiteTime = this.state.gameTimeLimit;
            this.state.blackTime = this.state.gameTimeLimit;
            this.state.gameResult = { type: null };
            this.state.drawOffer = { offered: false, by: null };
            this.state.gameNumber += 1;
            this.state.lastMoveTime = Date.now();

            // Inverser les couleurs pour la revanche
            this.state.players.forEach((p: any) => {
              p.color = p.color === "white" ? "black" : "white";
            });
          }

          // Réinitialiser l'offre de revanche
          this.state.rematchOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleMove(data: {
          from: any;
          to: any;
          promotion: any;
          playerId: any;
        }) {
          console.log("🏃 Traitement mouvement:", data);
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
                } else if (chess.isStalemate()) {
                  this.state.gameResult = {
                    type: "stalemate",
                    winner: "draw",
                    message: "Pat ! Draw",
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
            console.error("Mouvement invalide:", error);
          }
        }

        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) return;

          // Décrémenter exactement 1 seconde pour le joueur actuel
          if (this.state.turn === "w") {
            this.state.whiteTime = Math.max(0, this.state.whiteTime - 1);

            if (this.state.whiteTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "black",
                message: "Time's up! Black wins",
              };
              this.state.lastGameWinner = "black";
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
              this.state.lastGameWinner = "white";
            }
          }

          // Mettre à jour le timestamp
          this.state.lastMoveTime = Date.now();
          this.publish(this.sessionId, "game-state", this.state);
        }

        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          console.log("👤 Joueur rejoint:", data);
          console.log("👥 Joueurs actuels:", this.state.players);

          const { playerId, wallet } = data;

          // CORRECTION: Vérifier si le joueur existe déjà par son wallet (reconnexion)
          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // CORRECTION: Mettre à jour le joueur existant avec le nouveau playerId
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId; // Nouveau ID après refresh
            console.log("✅ Joueur existant reconnecté avec nouveau ID:", {
              wallet: wallet.slice(0, 6) + "..." + wallet.slice(-4),
              oldId: "refresh",
              newId: playerId,
              color: this.state.players[existingPlayerIndex].color,
            });

            // Ajouter un message de reconnexion dans le chat
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: "🔄 Reconnected to the game",
              timestamp: Date.now(),
            });

            console.log(
              "📊 État final des joueurs (reconnexion):",
              this.state.players
            );
            this.publish(this.sessionId, "game-state", this.state);
            return; // IMPORTANT: Sortir ici pour éviter de traiter comme un nouveau joueur
          }

          // Si ce n'est pas une reconnexion et qu'il y a de la place
          else if (this.state.players.length < this.state.maxPlayers) {
            // CORRECTION: Assigner une couleur disponible de manière déterministe
            const hasWhitePlayer = this.state.players.some(
              (p: { color: string }) => p.color === "white"
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

            // Ajouter un message de bienvenue
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: `👋 Joined as ${color}`,
              timestamp: Date.now(),
            });
          } else {
            console.warn("⚠️ Room pleine, impossible d'ajouter le joueur");
            return; // Ne pas publier si room pleine
          }

          // Démarrer automatiquement la partie si 2 joueurs sont présents ET qu'aucune partie n'est en cours
          if (
            this.state.players.length >= 2 &&
            !this.state.isActive &&
            !this.state.gameResult.type
          ) {
            console.log("🚀 Démarrage automatique de la partie");
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();

            // Utiliser le gameTimeLimit au lieu de valeurs fixes
            this.state.whiteTime = this.state.gameTimeLimit;
            this.state.blackTime = this.state.gameTimeLimit;
            console.log(
              `⏰ Timer initialisé à ${this.state.gameTimeLimit} secondes`
            );
          }

          console.log("📊 État final des joueurs:", this.state.players);
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
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

        handleOfferDraw(data: { playerId: string }) {
          console.log("Draw offer:", data);

          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.drawOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          // Ajouter un message dans le chat
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
          console.log("Respond draw:", data);

          if (!this.state.drawOffer.offered || this.state.gameResult.type)
            return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept draw" : "Decline draw offer",
            timestamp: Date.now(),
          });

          if (data.accepted) {
            // Match nul accepté
            this.state.isActive = false;
            this.state.gameResult = {
              type: "draw",
              winner: "draw",
              message: "Draw accepted",
            };
            this.state.lastGameWinner = "draw";
          }

          // Réinitialiser l'offre
          this.state.drawOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResign(data: { playerId: string }) {
          console.log("🏳️ Resign:", data);

          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
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
            message: `${
              player.color === "white" ? "White" : "Black"
            } resign ! ${player.color === "white" ? "Black" : "White"} win`,
          };
          this.state.lastGameWinner =
            player.color === "white" ? "black" : "white";

          this.publish(this.sessionId, "game-state", this.state);
        }
      }

      // Définir la vue Chess - CORRECTION IMPORTANTE ICI
      class ChessView extends Multisynq.View {
        constructor(model: any) {
          super(model);
          console.log("👁️ Initialisation ChessView");

          // S'abonner aux mises à jour d'état - SANS bind()
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
          console.log("🔄 Mise à jour état jeu:", {
            players: newState.players?.length || 0,
            isActive: newState.isActive,
            turn: newState.turn,
            gameResult: newState.gameResult?.type,
          });

          if (globalSetGameState) {
            // @ts-ignore
            globalSetGameState((prevState: GameState) => {
              // NOUVEAU: Vérifier si c'est une vraie mise à jour
              const hasRealChanges =
                JSON.stringify(newState.players) !==
                  JSON.stringify(prevState.players) ||
                newState.isActive !== prevState.isActive ||
                newState.fen !== prevState.fen ||
                newState.turn !== prevState.turn;

              if (hasRealChanges) {
                console.log("✅ Changements détectés, mise à jour de l'état");
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
                // NOUVEAU: Préserver les offres en cours
                drawOffer: newState.drawOffer || prevState.drawOffer,
                rematchOffer: newState.rematchOffer || prevState.rematchOffer,
                gameResult: newState.gameResult || prevState.gameResult,
              };
            });
          }
        }

        // Méthodes pour envoyer des actions
        makeMove(from: any, to: any, playerId: any, promotion: any) {
          console.log("📤 Envoi mouvement:", { from, to, playerId });
          this.publish(this.sessionId, "move", {
            from,
            to,
            playerId,
            promotion: promotion || "q",
          });
        }

        joinPlayer(wallet: any, playerId: any) {
          console.log("📤 Envoi join player:", { wallet, playerId });
          this.publish(this.sessionId, "join-player", { wallet, playerId });
        }

        sendMessage(message: any, playerId: any, playerWallet: any) {
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

        updateTimer() {
          console.log("📤 Envoi update timer");
          this.publish(this.sessionId, "update-timer", {});
        }

        // CORRECTION: Méthodes correctement définies dans la classe
        offerDraw(playerId: string) {
          console.log("📤 Envoi offer draw:", playerId);
          this.publish(this.sessionId, "offer-draw", { playerId });
        }

        respondDraw(playerId: string, accepted: boolean) {
          console.log("📤 Envoi respond draw:", { playerId, accepted });
          this.publish(this.sessionId, "respond-draw", { playerId, accepted });
        }

        resign(playerId: string) {
          console.log("📤 Envoi resign:", playerId);
          this.publish(this.sessionId, "resign", { playerId });
        }

        setGameTime(gameTime: number) {
          console.log("📤 Envoi réglage temps:", gameTime);
          this.publish(this.sessionId, "set-game-time", { gameTime });
        }

        requestRematch(playerId: string) {
          console.log("📤 Envoi demande revanche:", playerId);
          this.publish(this.sessionId, "request-rematch", { playerId });
        }

        respondRematch(playerId: string, accepted: boolean) {
          console.log("📤 Envoi réponse revanche:", { playerId, accepted });
          this.publish(this.sessionId, "respond-rematch", {
            playerId,
            accepted,
          });
        }
      }

      // Enregistrer les classes avec Multisynq selon la documentation officielle
      ChessModel.register("ChessModel");

      // Stocker les références pour l'utilisation locale
      (window as any).ChessModel = ChessModel;
      (window as any).ChessView = ChessView;

      setMultisynqReady(true);
      setConnectionStatus("Multisynq prêt");
      console.log("Classes Multisynq configurées et enregistrées");

      // Vérifier que les méthodes sont présentes dans la classe
      console.log(
        "🔍 Méthodes ChessView:",
        Object.getOwnPropertyNames(ChessView.prototype)
      );
    } catch (error) {
      console.error("Erreur lors de la configuration des classes:", error);
      setConnectionStatus("Erreur configuration Multisynq");
    }
  };

  // CORRECTION IMPORTANTE: Modifiez aussi les handlers dans votre composant principal
  const handleOfferDraw = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    console.log("🔍 Vérification des méthodes disponibles:", {
      offerDraw: typeof multisynqView.offerDraw,
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(multisynqView)),
    });

    if (typeof multisynqView.offerDraw === "function") {
      multisynqView.offerDraw(currentPlayerId);
      console.log("Offre de match nul envoyée");
    } else {
      console.error("offerDraw n'est pas une fonction:", multisynqView);
      alert(
        "Erreur: Fonction d'offre de match nul non disponible. Veuillez recharger la page."
      );
    }
  };

  const handleRespondDraw = (accepted: boolean) => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.respondDraw === "function") {
      multisynqView.respondDraw(currentPlayerId, accepted);
      console.log(`Respond draw: ${accepted ? "accepté" : "refusé"}`);
    } else {
      console.error("Respond draw n'est pas une fonction:", multisynqView);
      alert(
        "Erreur: Fonction de réponse au draw non disponible. Veuillez recharger la page."
      );
    }
  };

  const handleResign = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (confirm("Êtes-vous sûr de vouloir abandonner ?")) {
      if (typeof multisynqView.resign === "function") {
        multisynqView.resign(currentPlayerId);
        console.log("Abandon envoyé");
      } else {
        console.error("resign n'est pas une fonction:", multisynqView);
        alert(
          "Erreur: Fonction d'abandon non disponible. Veuillez recharger la page."
        );
      }
    }
  };

  const handleCloseGameEndModal = () => {
    setShowGameEndModal(false);
    // Ne pas appeler handleRespondDraw(false) pour permettre les revanches ultérieures
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
        model: (window as any).ChessModel,
        view: (window as any).ChessView,
        name: roomName,
        password: password,
      });

      console.log("Session créée:", session);
      return session;
    } catch (error) {
      console.error("Erreur création session:", error);
      throw error;
    }
  };

  // Créer une nouvelle room
  const handleCreateRoom = async () => {
    if (!isConnected || !address || !multisynqReady) return;

    setIsCreatingRoom(true);
    setConnectionStatus("Creating room...");

    try {
      const roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password = Math.random().toString(36).substring(2, 6);
      // CORRECTION: ID plus prévisible pour la reconnexion
      const playerId = `player_${address.slice(-8)}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      setCurrentPlayerId(playerId);

      const session = await createMultisynqSession(roomName, password);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      session.view.joinPlayer(address, playerId);

      // Envoyer le temps de jeu choisi
      setTimeout(() => {
        session.view.setGameTime(selectedGameTime);
      }, 100);

      setGameState((prev) => ({
        ...prev,
        roomName,
        roomPassword: password,
        gameTimeLimit: selectedGameTime,
        whiteTime: selectedGameTime,
        blackTime: selectedGameTime,
      }));

      if ((window as any).Multisynq?.App?.makeWidgetDock) {
        (window as any).Multisynq.App.makeWidgetDock();
      }

      const newUrl = `${window.location.pathname}?room=${roomName}&password=${password}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`✅ Room created: ${roomName}`);
    } catch (error) {
      console.error("❌ Error creating room:", error);
      setConnectionStatus("❌ Error creating room");
      alert("Impossible to create the room. Check your Multisynq API key.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!isConnected || !roomInput.trim() || !address || !multisynqReady)
      return;

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

    // CORRECTION: ID plus prévisible pour la reconnexion
    const playerId = `player_${address.slice(-8)}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connecting to room...");

    try {
      const session = await createMultisynqSession(roomName, password);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      console.log(
        "🔍 Méthodes disponibles (join):",
        Object.getOwnPropertyNames(session.view)
      );

      session.view.joinPlayer(address, playerId);

      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
        }));
      }, 200); // Réduit de 500ms à 200ms

      const newUrl = password
        ? `${window.location.pathname}?room=${roomName}&password=${password}`
        : `${window.location.pathname}?room=${roomName}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`✅ Connected to: ${roomName}`);
    } catch (error) {
      console.error("❌ Error joining room:", error);
      setConnectionStatus("❌ Room not found");
      alert(
        `Impossible to join the room "${roomName}". Check the code${
          password ? " and the password" : ""
        }.`
      );
    }
  };

  console.log("🎮 Game State Debug:", {
    players: gameState.players.map((p) => ({
      id: p.id.slice(-4),
      wallet: p.wallet.slice(-4),
      color: p.color,
      connected: p.connected,
    })),
    currentPlayerId: currentPlayerId?.slice(-4),
    playerColor,
    isActive: gameState.isActive,
  });

  const onPieceDrop = (args: PieceDropHandlerArgs): boolean => {
    const { sourceSquare, targetSquare } = args;
    if (!targetSquare || !currentPlayerId || !multisynqView) return false;

    // Empêcher les mouvements si la partie est terminée ou si on n'est pas à la position actuelle
    if (
      gameState.gameResult.type ||
      currentMoveIndex < moveHistory.length - 1
    ) {
      console.warn("Cannot move pieces in analysis mode or finished game!");
      return false;
    }

    // Empêcher les mouvements si la partie n'est pas active
    if (!gameState.isActive) return false;

    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return false;

    const currentTurn = gameState.turn;
    if (
      (currentTurn === "w" && currentPlayer.color !== "white") ||
      (currentTurn === "b" && currentPlayer.color !== "black")
    ) {
      console.warn("It's not your turn!");
      return false;
    }

    const tempGame = new Chess(gameState.fen);
    try {
      const moveResult = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
        multisynqView.makeMove(
          sourceSquare,
          targetSquare,
          currentPlayerId,
          "q"
        );
        return true;
      }
    } catch (error) {
      console.warn("Mouvement invalide:", error);
    }

    return false;
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentPlayerId || !address || !multisynqView)
      return;

    multisynqView.sendMessage(newMessage, currentPlayerId, address);
    setNewMessage("");
  };

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

  // Fonctions de navigation dans l'historique
  const goToPreviousMove = () => {
    if (currentMoveIndex > 0) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      setFen(moveHistory[newIndex]);
    }
  };

  const goToNextMove = () => {
    if (currentMoveIndex < moveHistory.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      setFen(moveHistory[newIndex]);
    }
  };

  const goToFirstMove = () => {
    if (moveHistory.length > 0) {
      setCurrentMoveIndex(0);
      setFen(moveHistory[0]);
    }
  };

  const goToLastMove = () => {
    if (moveHistory.length > 0) {
      const lastIndex = moveHistory.length - 1;
      setCurrentMoveIndex(lastIndex);
      setFen(moveHistory[lastIndex]);
    }
  };
  const customPieces = {
    wK: () => (
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    ),
    bK: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/king.png" alt="king" className="h-[85px] mx-auto" />
      </div>
    ),
    // Dames
    wQ: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <circle cx="6" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="14" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="22.5" cy="8" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="31" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="39" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <path
          d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-2.5-14.5L22.5 24l-2.5-14.5L14 25 6.5 13.5 9 26z"
          stroke="black"
          strokeWidth="1.5"
        />
        <path
          d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
          stroke="black"
          strokeWidth="1.5"
        />
      </svg>
    ),
    bQ: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/queen.png" alt="queen" className="h-[85px] mx-auto" />
      </div>
    ),
    // Tours
    wR: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M34 14l-3 3H14l-3-3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M31 17v12.5H14V17"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
          fill="none"
        />
        <path
          d="M11 14h23"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
      </svg>
    ),
    bR: () => <img src="/rook.png" alt="rook" className="h-[85px] mx-auto" />,
    // Fous
    wB: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <g
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        </g>
      </svg>
    ),
    bB: () => (
      <img src="/bishop.png" alt="bishop" className="h-[85px] mx-auto" />
    ),
    // Cavaliers
    wN: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bN: () => (
      <img src="/cavalier.png" alt="cavalier" className="h-[85px] mx-auto" />
    ),
    // Pions
    wP: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bP: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/pawn.png" alt="pawn" className="h-[70px] mx-auto" />
      </div>
    ),
  } as const;
  const chessboardOptions = {
    position: fen,
    onPieceDrop: onPieceDrop,
    boardOrientation: playerColor,
    arePiecesDraggable: gameState.isActive,
    boardWidth: 580,
    animationDuration: 200,
    customPieces: customPieces,
  };

  // Interface d'accueil
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-[url('https://pbs.twimg.com/media/GpoPZdmWkAApRWa?format=jpg&name=large')] bg-center bg-cover flex items-center justify-center p-4">
        <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/20">
          <div className="text-center mb-20">
            <h1 className="text-5xl font-bold text-white mb-3">
              MultiSynq & Monad Chess
            </h1>
            <p className="text-white/80">Real-time chess game with Multisynq</p>
          </div>

          <div className="space-y-10">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <div>
                  <label
                    className={`block text-2xl text-center font-medium ${
                      isConnected ? "text-white" : "text-white/50"
                    } mb-6`}
                  >
                    Game time
                  </label>
                  <Select
                    value={selectedGameTime.toString()}
                    onValueChange={(value) =>
                      setSelectedGameTime(Number(value))
                    }
                    disabled={!isConnected}
                  >
                    <SelectTrigger className="w-full text-base bg-[#252525] border-white/10 h-[45px] text-white disabled:opacity-50">
                      <SelectValue placeholder="Select game time" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#252525] border-white/20 text-base text-white">
                      <SelectItem value="180">3 minutes</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                      <SelectItem value="900">15 minutes</SelectItem>
                      <SelectItem value="1800">30 minutes</SelectItem>
                      <SelectItem value="3600">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={!isConnected || isCreatingRoom || !multisynqReady}
                  className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 disabled:text-white/50 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-3 px-6 rounded text-base transition-all"
                >
                  {!isConnected && !isWrongNetwork
                    ? "Connect wallet to create"
                    : isWrongNetwork
                    ? "Wrong network"
                    : isCreatingRoom
                    ? "Creating..."
                    : !multisynqReady
                    ? "Loading Multisynq..."
                    : "Create a new game"}
                </button>
              </div>
              <div className="space-y-2">
                <label
                  className={`block text-2xl text-center font-medium ${
                    isConnected ? "text-white" : "text-white/50"
                  } mb-4`}
                >
                  Join a game
                </label>
                <input
                  type="text"
                  placeholder="Code room ou room:password"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  disabled={!isConnected}
                  className="w-full p-3 bg-[#252525] border border-white/10 h-[45px] text-white rounded placeholder-gray-400 focus:ring-2 focus:ring-none focus:border-none disabled:opacity-50"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={
                    !isConnected || !roomInput.trim() || !multisynqReady
                  }
                  className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] disabled:text-white/50 text-white font-medium py-3 px-6 rounded text-base transition-all"
                >
                  {!isConnected && !isWrongNetwork
                    ? "Connect wallet to join"
                    : isWrongNetwork
                    ? "Wrong network"
                    : !multisynqReady
                    ? "Loading..."
                    : "Join a game"}
                </button>
              </div>
            </div>
            <div className="w-full h-[1px] bg-white/10 my-4" />
            <WalletConnection />

            {/* <div className="text-center text-sm text-blue-300">
              Status: {connectionStatus}
            </div> */}
          </div>
        </div>
      </div>
    );
  }

  console.log(gameState);

  //   const isWinner =
  //     gameState.gameResult.winner ===
  //     gameState.players.find((p) => p.id === currentPlayerId)?.color;

  const isDraw = gameState.gameResult.winner === "draw";

  console.log("moveHistory", moveHistory);
  console.log("currentMoveIndex", currentMoveIndex);
  console.log("gameState.fen", gameState.fen);
  console.log("gameState.isActive", gameState.isActive);

  // Interface de jeu
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f]/100 to-[#0f0f0f]/80 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">♔ Chess Multi</h1>
              {isReconnecting && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-400 rounded">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-orange-200 text-sm">
                    Reconnecting...
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}${
                      window.location.pathname
                    }?room=${gameState.roomName}${
                      gameState.roomPassword
                        ? `&password=${gameState.roomPassword}`
                        : ""
                    }`
                  );
                }}
                className="px-2 py-1 text-xs bg-[#836EF9]/20 hover:bg-[#836EF9]/30 border border-[#836EF9]/40 text-[#836EF9] rounded transition-colors"
              >
                Copy Link
              </button>
              <p className="text-white text-base">Room: {gameState.roomName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (gameState.gameResult.type) {
                  router.push("/multisynq-test");
                }
              }}
              className="px-4 py-2 bg-[#836EF9] text-white rounded transition-colors"
            >
              Home
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Panel central - Échiquier */}
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="lg:col-span-3">
                <div className="rounded-xl">
                  {/* Pièces capturées par l'adversaire (en haut) */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center justify-between">
                      {gameState.players.find(
                        (entry) => entry.wallet !== address
                      ) ? (
                        <div
                          key={
                            gameState.players.find(
                              (entry) => entry.wallet !== address
                            )?.id
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xl text-white flex items-center gap-2">
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(0, 6)}
                                ...
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(-4)}
                                {/* Indicateur de connexion */}
                                {gameState.players.find(
                                  (entry) => entry.wallet !== address
                                )?.connected ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={true}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white flex items-center gap-1">
                              <span className="animate-[bounce_1s_infinite] text-2xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.2s] text-2xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.4s] text-2xl">
                                .
                              </span>
                              Waiting for opponent
                            </div>
                            <div className="text-sm text-gray-300">Offline</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className={`backdrop-blur-md rounded px-2 py-1 border ${
                        getOpponentTime() <= 30
                          ? "bg-red-500/20 border-red-400"
                          : "bg-white/10 border-white/20"
                      }`}
                    >
                      <span
                        className={`text-2xl font-bold ${
                          getOpponentTime() <= 30
                            ? "text-red-300"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getOpponentTime() / 60)}:
                        {(getOpponentTime() % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {/* Container de l'échiquier avec overlay */}
                  <div className="relative aspect-square max-w-full w-full mx-auto">
                    <Chessboard options={chessboardOptions} />

                    {/* Indicateur de fin de partie (discret) */}
                    {gameState.gameResult.type && !showGameEndModal && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/20">
                          <span className="text-white text-sm font-medium">
                            🏁 Partie terminée - Mode analyse
                            {moveHistory.length > 1 &&
                              currentMoveIndex < moveHistory.length - 1 && (
                                <span className="ml-2 text-yellow-300">
                                  (Coup {currentMoveIndex}/
                                  {moveHistory.length - 1})
                                </span>
                              )}
                          </span>
                        </div>
                      </div>
                    )}

                    {showGameEndModal && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
                        <div className="bg-[#1E1E1E] border border-white/10 rounded-md p-8 max-w-md w-full mx-4 shadow-2xl">
                          <div className="text-center">
                            {/* <h3
                              className={`text-4xl uppercase font-extrabold mb-6 ${
                                isWinner
                                  ? "text-white"
                                  : isDraw
                                  ? "text-white"
                                  : "text-white"
                              }`}
                            >
                              {isWinner
                                ? "You Win"
                                : isDraw
                                ? "Draw"
                                : "You Lost"}
                            </h3> */}

                            {isDraw && (
                              <p className="text-gray-400">
                                {gameState.gameResult.message || ""}
                              </p>
                            )}

                            {/* {gameState.gameResult.winner ===
                            gameState.players.find(
                              (p) => p.id !== currentPlayerId
                            )?.color ? (
                              <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/lost.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="w-2/3 mx-auto"
                              />
                            ) : gameState.gameResult.winner === "draw" ? (
                              <img
                                src="/draw.png"
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            ) : (
                              <img
                                src={"/win.png"}
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            )} */}

                            <div
                              className={`rounded-lg mb-4 pt-4 flex flex-col justify-center `}
                            >
                              <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/lost.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="w-2/3 mx-auto"
                              />
                              <p className="text-white font-bold text-2xl mb-2 mt-6">
                                {gameState.gameResult.message || "Game Over"}
                              </p>
                            </div>

                            <div className="space-y-4">
                              {gameState.rematchOffer?.offered &&
                              gameState.rematchOffer?.by !==
                                gameState.players.find(
                                  (p) => p.id === currentPlayerId
                                )?.color ? (
                                <div className="text-center space-y-4">
                                  <p className="text-white/80 font-light text-lg text-center">
                                    Your opponent offers you a rematch. <br />
                                    Do you accept ?
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <button
                                      onClick={() => handleRespondRematch(true)}
                                      className="col-span-1 px-8 py-3 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded font-bold text-lg transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRespondRematch(false)
                                      }
                                      className="col-span-1 px-8 py-3 bg-[#252525] hover:bg-[#252525] border border-[#836EF9] text-white rounded font-bold text-lg transition-colors"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center space-y-3">
                                  <button
                                    onClick={handleRequestRematch}
                                    disabled={gameState.rematchOffer?.offered}
                                    className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded font-bold text-lg transition-colors"
                                  >
                                    {gameState.rematchOffer?.offered
                                      ? "Rematch offer sent"
                                      : "New game"}
                                  </button>

                                  <button
                                    onClick={handleCloseGameEndModal}
                                    className="w-full px-6 py-4 bg-[#404040] hover:bg-[#4a4a4a] text-white rounded font-bold text-lg transition-colors"
                                  >
                                    Continuer à analyser
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    {gameState.players.map((player) =>
                      player.id === currentPlayerId ? (
                        <div key={player.id} className="rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xl text-white flex items-center gap-2">
                                {player.wallet.slice(0, 6)}...
                                {player.wallet.slice(-4)} (You)
                                {/* Votre indicateur de connexion */}
                                {player.connected && !isReconnecting ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={false}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null
                    )}

                    <div
                      className={`backdrop-blur-md rounded px-2 py-1 border ${
                        getCurrentPlayerTime() <= 30
                          ? "bg-red-500/20 border-red-400"
                          : "bg-white/10 border-white/20"
                      }`}
                    >
                      <span
                        className={`text-2xl font-bold ${
                          getCurrentPlayerTime() <= 30
                            ? "text-red-300"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getCurrentPlayerTime() / 60)}:
                        {(getCurrentPlayerTime() % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Panel de droite - Chat */}
          <div className="lg:col-span-2">
            <div className="rounded  full flex flex-col">
              <h3 className="text-xl font-semibold text-white mb-3">
                Nads Chat
              </h3>

              <div className="overflow-y-auto space-y-2 min-h-[607px] max-h-[607px] mb-4">
                {gameState.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded py-2  ${
                      msg.playerWallet === address
                        ? "bg-[#252525]"
                        : "bg-[#1e1e1e]/70"
                    } border p-3 border-white/10`}
                  >
                    <div
                      className={`text-sm mb-[5px]   ${
                        msg.playerWallet === address
                          ? "text-white font-bold"
                          : "text-gray-400"
                      }`}
                    >
                      {msg.playerWallet === address
                        ? "You"
                        : msg.playerWallet.slice(0, 6) +
                          "..." +
                          msg.playerWallet.slice(-4)}
                    </div>
                    <div className="text-white text-sm">{msg.message}</div>
                  </div>
                ))}
              </div>
              <div className="w-full h-[1px] bg-white/10 mb-5 mt-1" />
              <div className="flex gap-2 mt-auto">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Shame opponent..."
                  className="flex-1 px-5 h-[45px] bg-[#1E1E1E] border border-white/10 text-white text-base placeholder-gray-400 focus:ring-2"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-5 h-[45px] bg-[#836EF9]/80   text-white rounded text-base transition-colors"
                >
                  Send
                </button>
              </div>
              {gameState.isActive ? (
                // Partie en cours - Afficher les contrôles de jeu
                <div className="space-y-3 mt-2.5">
                  {/* Boutons d'action de jeu */}
                  <div className="flex gap-2 justify-between w-full">
                    {gameState.drawOffer.offered &&
                    gameState.drawOffer.by !==
                      gameState.players.find((p) => p.id === currentPlayerId)
                        ?.color ? (
                      // Répondre à une offre de match nul
                      <div className="flex items-center w-full justify-between">
                        <span className="text-yellow-200 text-sm">
                          Draw offer:
                        </span>
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => handleRespondDraw(true)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespondDraw(false)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Boutons normaux pendant la partie
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <button
                          onClick={handleOfferDraw}
                          disabled={gameState.drawOffer.offered}
                          className="px-3 w-full h-[40px] col-span-1  bg-[#836EF9] text-white rounded text-base transition-colors"
                        >
                          {gameState.drawOffer.offered
                            ? "Draw offer sent"
                            : "Offer draw"}
                        </button>
                        <button
                          onClick={handleResign}
                          className="px-3 w-full h-[40px] col-span-1 bg-[#2a2a2a] disabled:border-gray-600  border border-[#836EF9] text-white rounded text-base transition-colors"
                        >
                          Resign
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : gameState.gameResult.type ? (
                // Partie terminée - Panneau persistant de fin de partie
                <div className="space-y-3 mt-2.5">
                  <div className="p-3 bg-[#1E1E1E] border border-white/10 rounded">
                    <div className="text-center mb-3">
                      <p className="text-white font-semibold text-lg mb-1">
                        {gameState.gameResult.message || "Game Over"}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Game #{gameState.gameNumber}
                      </p>
                    </div>

                    {gameState.rematchOffer?.offered &&
                    gameState.rematchOffer?.by !==
                      gameState.players.find((p) => p.id === currentPlayerId)
                        ?.color ? (
                      <div className="space-y-3">
                        <p className="text-yellow-200 text-sm text-center">
                          Votre adversaire propose une revanche
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleRespondRematch(true)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespondRematch(false)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          onClick={handleRequestRematch}
                          disabled={gameState.rematchOffer?.offered}
                          className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                        >
                          {gameState.rematchOffer?.offered
                            ? "Demande de revanche envoyée"
                            : "Proposer une revanche"}
                        </button>
                        <button
                          onClick={() => setShowGameEndModal(true)}
                          className="w-full px-3 py-2 bg-[#404040] hover:bg-[#4a4a4a] text-white rounded text-sm transition-colors"
                        >
                          Voir les détails
                        </button>

                        {/* Contrôles de navigation dans l'historique */}
                        {moveHistory.length > 1 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-gray-400 text-xs mb-2 text-center">
                              Navigation: Coup {currentMoveIndex}/
                              {moveHistory.length - 1}
                            </p>
                            <div className="grid grid-cols-4 gap-1">
                              <button
                                onClick={goToFirstMove}
                                disabled={currentMoveIndex === 0}
                                className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                              >
                                ⏮
                              </button>
                              <button
                                onClick={goToPreviousMove}
                                disabled={currentMoveIndex === 0}
                                className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                              >
                                ◀
                              </button>
                              <button
                                onClick={goToNextMove}
                                disabled={
                                  currentMoveIndex === moveHistory.length - 1
                                }
                                className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                              >
                                ▶
                              </button>
                              <button
                                onClick={goToLastMove}
                                disabled={
                                  currentMoveIndex === moveHistory.length - 1
                                }
                                className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                              >
                                ⏭
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // En attente de joueurs
                <div className="p-3 bg-[#836EF9]/20 flex items-center justify-center border border-[#836EF9] rounded space-y-3 mt-2.5">
                  <p className="text-[#a494fb] text-center">
                    {gameState.players.length >= 2
                      ? "Starting game..."
                      : "Waiting for second player"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
