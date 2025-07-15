// ChessApp avec session dynamique et synchronisation
"use client";
import { WalletConnection } from "@/components/connect-wallet";
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useAccount } from "wagmi";

export default function ChessMultisynqApp() {
  // États pour l'interface
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [sessionInfo, setSessionInfo] = useState({ name: "", password: "" });
  const [connectionStatus, setConnectionStatus] = useState("Prêt à jouer");
  const [isGameActive, setIsGameActive] = useState(false);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [playerId] = useState(Date.now().toString());

  // États pour le flow UX
  const [gameFlow, setGameFlow] = useState<"welcome" | "lobby" | "game">(
    "welcome"
  );
  const [roomInput, setRoomInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // États pour les timers individuels
  const [whiteTime, setWhiteTime] = useState(600); // 10 minutes par défaut
  const [blackTime, setBlackTime] = useState(600); // 10 minutes par défaut
  const [gameTimeLimit, setGameTimeLimit] = useState(600); // Temps sélectionné
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [lastMoveTime, setLastMoveTime] = useState<number | null>(null);

  // États pour le chat
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      playerId: string;
      playerWallet: string;
      message: string;
      timestamp: number;
    }>
  >([]);
  const [newMessage, setNewMessage] = useState("");

  // Wallet connection
  const { address, isConnected } = useAccount();

  // États pour les fins de partie
  const [gameResult, setGameResult] = useState<{
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
    message?: string;
  }>({ type: null });
  const [drawOffer, setDrawOffer] = useState<{
    offered: boolean;
    by: "white" | "black" | null;
  }>({ offered: false, by: null });

  const gameRef = useRef(new Chess());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Valeurs des pièces pour le calcul de l'avantage matériel
  const pieceValues: { [key: string]: number } = {
    p: 1, // pion
    n: 3, // cavalier
    b: 3, // fou
    r: 5, // tour
    q: 9, // dame
    k: 0, // roi (ne compte pas)
  };

  // Fonction pour tronquer l'adresse wallet
  const formatWalletAddress = (address: string) => {
    return `${address?.slice(0, 6)}...${address?.slice(-4)}`;
  };

  // Fonction pour formater le temps en MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Flow UX - Vérifier la connexion wallet et les paramètres URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomName = urlParams.get("room");

    if (roomName && isConnected) {
      // Si on a un lien de room et qu'on est connecté, aller directement au jeu
      initializeGameFromURL();
    } else if (roomName && !isConnected) {
      // Si on a un lien mais pas connecté, rester sur welcome pour forcer la connexion
      setGameFlow("welcome");
    } else if (isConnected) {
      // Si connecté mais pas de room, aller au lobby
      setGameFlow("lobby");
    } else {
      // Sinon, écran de bienvenue
      setGameFlow("welcome");
    }
  }, [isConnected]);

  // Créer une nouvelle room
  const createNewRoom = () => {
    if (!isConnected) return;

    setIsCreatingRoom(true);
    const roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
    const roomPassword = Math.random().toString(36).substring(2, 6);

    // Mettre à jour l'URL
    const newUrl = `${window.location.pathname}?room=${roomName}&password=${roomPassword}`;
    window.history.pushState({}, "", newUrl);

    // Initialiser la room
    setSessionInfo({ name: roomName, password: roomPassword });
    initializeNewRoom(roomName);
    setGameFlow("game");
    setIsCreatingRoom(false);
  };

  // Rejoindre une room existante
  const joinRoom = () => {
    if (!isConnected || !roomInput.trim()) return;

    const roomName = roomInput.trim();
    const roomPassword = ""; // Pour simplifier, pas de password pour rejoindre

    // Mettre à jour l'URL
    const newUrl = `${window.location.pathname}?room=${roomName}&password=${roomPassword}`;
    window.history.pushState({}, "", newUrl);

    // Rejoindre la room
    setSessionInfo({ name: roomName, password: roomPassword });
    determinePlayerColor(roomName);
    setGameFlow("game");
  };

  // Initialiser le jeu depuis l'URL
  const initializeGameFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomName = urlParams.get("room");
    let roomPassword = urlParams.get("password");

    if (!roomName) return;

    if (!roomPassword) {
      roomPassword = Math.random().toString(36).substring(2, 6);
    }

    setSessionInfo({ name: roomName, password: roomPassword });
    console.log("🎯 Session:", { name: roomName, password: roomPassword });

    // Déterminer la couleur du joueur
    determinePlayerColor(roomName);
    setGameFlow("game");
  };

  // Initialiser une nouvelle room
  const initializeNewRoom = (roomName: string) => {
    const roomKey = `chess-room-${roomName}`;
    const newRoom = {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      player1Id: playerId,
      player1Color: "white",
      player1Wallet: address,
      player2Id: null,
      player2Color: null,
      player2Wallet: null,
      playerCount: 1,
      turn: "w",
      isActive: false,
      lastMoveTime: null,
      whiteTime: gameTimeLimit,
      blackTime: gameTimeLimit,
      gameTimeLimit: gameTimeLimit,
      gameNumber: 1,
      lastGameWinner: null,
      messages: [],
    };
    localStorage.setItem(roomKey, JSON.stringify(newRoom));
    setPlayerColor("white");
    setConnectionStatus("En attente d'un adversaire...");
    console.log("🆕 Nouvelle room créée - Joueur 1 (Blanc)");
  };

  // Sélecteur de temps de partie
  const selectGameTime = (minutes: number) => {
    const seconds = minutes * 60;
    setGameTimeLimit(seconds);
    setWhiteTime(seconds);
    setBlackTime(seconds);
    setShowTimeSelector(false);

    // Sauvegarder dans la room et forcer la synchronisation
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        gameTimeLimit: seconds,
        whiteTime: seconds,
        blackTime: seconds,
        // Maintenir tous les autres champs pour éviter la perte de données
        player1Id: roomData.player1Id,
        player2Id: roomData.player2Id,
        player1Color: roomData.player1Color,
        player2Color: roomData.player2Color,
        player1Wallet: roomData.player1Wallet,
        player2Wallet: roomData.player2Wallet,
        messages: roomData.messages || [],
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
      console.log("⏰ Temps synchronisé dans la room:", updatedRoom);
    }

    console.log(`⏰ Temps de partie sélectionné: ${minutes} minutes`);
  };

  // Déterminer la couleur du joueur basé sur l'ordre d'arrivée et les parties précédentes
  const determinePlayerColor = (roomName: string) => {
    const roomKey = `chess-room-${roomName}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      console.log("🏠 Room existante trouvée:", roomData);

      // Synchroniser le temps de jeu depuis la room existante
      if (roomData.gameTimeLimit) {
        setGameTimeLimit(roomData.gameTimeLimit);
        setWhiteTime(roomData.whiteTime || roomData.gameTimeLimit);
        setBlackTime(roomData.blackTime || roomData.gameTimeLimit);
        console.log(
          "⏰ Temps synchronisé depuis la room:",
          roomData.gameTimeLimit
        );
      }

      // Synchroniser les messages depuis la room existante
      if (roomData.messages) {
        setMessages(roomData.messages);
        console.log("💬 Messages synchronisés:", roomData.messages.length);
      }

      // Vérifier si c'est un joueur existant
      const isPlayer1 = roomData.player1Id === playerId;
      const isPlayer2 = roomData.player2Id === playerId;

      if (isPlayer1) {
        // C'est le joueur 1 - utiliser sa couleur actuelle
        setPlayerColor(roomData.player1Color || "white");
        setConnectionStatus(
          roomData.player2Id
            ? "Partie prête ! Deux joueurs connectés"
            : "En attente d'un adversaire..."
        );
        console.log(
          "🎯 Joueur 1 reconnecté avec couleur:",
          roomData.player1Color || "white"
        );
      } else if (isPlayer2) {
        // C'est le joueur 2 - utiliser sa couleur actuelle
        setPlayerColor(roomData.player2Color || "black");
        setConnectionStatus("Partie prête ! Deux joueurs connectés");
        console.log(
          "🎯 Joueur 2 reconnecté avec couleur:",
          roomData.player2Color || "black"
        );
      } else if (!roomData.player1Id) {
        // Nouveau joueur 1
        const player1Color = roomData.lastGameWinner
          ? roomData.lastGameWinner === "white"
            ? "black"
            : "white"
          : "white";
        setPlayerColor(player1Color);
        setConnectionStatus("En attente d'un adversaire...");
        const updatedRoom = {
          ...roomData,
          player1Id: playerId,
          player1Color,
          player1Wallet: address,
          playerCount: 1,
        };
        localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
        console.log("🎯 Nouveau joueur 1 avec couleur:", player1Color);
      } else if (!roomData.player2Id) {
        // Nouveau joueur 2 - hériter des paramètres de la room
        const player2Color =
          roomData.player1Color === "white" ? "black" : "white";
        setPlayerColor(player2Color);
        setConnectionStatus("Partie prête ! Deux joueurs connectés");
        const updatedRoom = {
          ...roomData,
          player2Id: playerId,
          player2Color,
          player2Wallet: address,
          playerCount: 2,
        };
        localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
        console.log("🎯 Nouveau joueur 2 avec couleur:", player2Color);
      } else {
        // Spectateur ou trop de joueurs
        setPlayerColor("white"); // Par défaut
        setConnectionStatus("Room pleine - Mode spectateur");
        console.log("👁️ Spectateur");
      }
    } else {
      // Créer une nouvelle room - premier joueur = Blanc par défaut
      setPlayerColor("white");
      setConnectionStatus("En attente d'un adversaire...");
      const newRoom = {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        player1Id: playerId,
        player1Color: "white",
        player1Wallet: address,
        player2Id: null,
        player2Color: null,
        player2Wallet: null,
        playerCount: 1,
        turn: "w",
        isActive: false,
        startTime: null,
        whiteTime: gameTimeLimit,
        blackTime: gameTimeLimit,
        gameTimeLimit: gameTimeLimit,
        gameNumber: 1,
        lastGameWinner: null,
        messages: [],
      };
      localStorage.setItem(roomKey, JSON.stringify(newRoom));
      console.log("🆕 Nouvelle room créée - Joueur 1 (Blanc)");
    }
  };

  // Écouter les changements dans localStorage pour la synchronisation
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `chess-room-${sessionInfo.name}` && e.newValue) {
        const roomData = JSON.parse(e.newValue);
        console.log("🔄 Synchronisation reçue:", roomData);

        // Synchroniser l'état du jeu
        if (roomData.fen !== fen) {
          console.log("📱 Mise à jour FEN:", roomData.fen);
          setFen(roomData.fen);
          gameRef.current.load(roomData.fen);
        }

        if (roomData.isActive !== isGameActive) {
          console.log("🎮 Mise à jour isActive:", roomData.isActive);
          setIsGameActive(roomData.isActive);
        }

        // Synchroniser les timers
        if (roomData.whiteTime !== whiteTime) {
          console.log("⏰ Mise à jour whiteTime:", roomData.whiteTime);
          setWhiteTime(roomData.whiteTime);
        }

        if (roomData.blackTime !== blackTime) {
          console.log("⏰ Mise à jour blackTime:", roomData.blackTime);
          setBlackTime(roomData.blackTime);
        }

        if (
          roomData.gameTimeLimit &&
          roomData.gameTimeLimit !== gameTimeLimit
        ) {
          console.log("⏰ Mise à jour gameTimeLimit:", roomData.gameTimeLimit);
          setGameTimeLimit(roomData.gameTimeLimit);
        }

        if (roomData.lastMoveTime !== lastMoveTime) {
          console.log("⏰ Mise à jour lastMoveTime:", roomData.lastMoveTime);
          setLastMoveTime(roomData.lastMoveTime);
        }

        // Synchroniser les fins de partie
        if (
          roomData.gameResult &&
          roomData.gameResult.type !== gameResult.type
        ) {
          console.log("🏁 Fin de partie reçue:", roomData.gameResult);
          setGameResult(roomData.gameResult);
          setIsGameActive(false);
        }

        // Synchroniser les propositions de nul
        if (
          roomData.drawOffer &&
          (roomData.drawOffer.offered !== drawOffer.offered ||
            roomData.drawOffer.by !== drawOffer.by)
        ) {
          console.log("🤝 Proposition de nul reçue:", roomData.drawOffer);
          setDrawOffer(roomData.drawOffer);
        }

        // Synchroniser les couleurs des joueurs
        if (
          roomData.player1Id === playerId &&
          roomData.player1Color !== playerColor
        ) {
          console.log(
            "🎭 Mise à jour couleur joueur 1:",
            roomData.player1Color
          );
          setPlayerColor(roomData.player1Color);
        } else if (
          roomData.player2Id === playerId &&
          roomData.player2Color !== playerColor
        ) {
          console.log(
            "🎭 Mise à jour couleur joueur 2:",
            roomData.player2Color
          );
          setPlayerColor(roomData.player2Color);
        }

        // Synchroniser les messages du chat
        if (roomData.messages) {
          // Vérifier si les messages sont différents (par longueur et dernière timestamp)
          const currentLastMessage = messages[messages.length - 1];
          const roomLastMessage =
            roomData.messages[roomData.messages.length - 1];

          const messagesDifferent =
            roomData.messages.length !== messages.length ||
            (roomLastMessage &&
              currentLastMessage &&
              roomLastMessage.timestamp !== currentLastMessage.timestamp) ||
            (!currentLastMessage && roomLastMessage) ||
            (currentLastMessage && !roomLastMessage);

          if (messagesDifferent) {
            console.log("💬 Synchronisation des messages:", roomData.messages);
            setMessages(roomData.messages);
          }
        }

        // Mettre à jour le statut selon les joueurs connectés
        const player1Connected = !!roomData.player1Id;
        const player2Connected = !!roomData.player2Id;

        if (player1Connected && player2Connected) {
          setConnectionStatus("Partie en cours - 2 joueurs connectés");
        } else if (player1Connected || player2Connected) {
          setConnectionStatus("En attente d'un adversaire...");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Polling supplémentaire pour s'assurer de la synchronisation
    const pollInterval = setInterval(() => {
      const roomKey = `chess-room-${sessionInfo.name}`;
      const roomData = localStorage.getItem(roomKey);
      if (roomData) {
        const parsed = JSON.parse(roomData);

        // Synchroniser FEN
        if (parsed.fen !== fen) {
          console.log("🔄 Polling: FEN différent détecté");
          setFen(parsed.fen);
          gameRef.current.load(parsed.fen);
        }

        // Synchroniser timers
        if (parsed.whiteTime !== whiteTime) {
          setWhiteTime(parsed.whiteTime);
        }

        if (parsed.blackTime !== blackTime) {
          setBlackTime(parsed.blackTime);
        }

        if (parsed.gameTimeLimit && parsed.gameTimeLimit !== gameTimeLimit) {
          setGameTimeLimit(parsed.gameTimeLimit);
        }

        // Synchroniser état du jeu
        if (parsed.isActive !== isGameActive) {
          console.log("🔄 Polling: État jeu différent détecté");
          setIsGameActive(parsed.isActive);
        }

        // Synchroniser les couleurs des joueurs
        if (
          parsed.player1Id === playerId &&
          parsed.player1Color !== playerColor
        ) {
          console.log("🔄 Polling: Couleur joueur 1 différente");
          setPlayerColor(parsed.player1Color);
        } else if (
          parsed.player2Id === playerId &&
          parsed.player2Color !== playerColor
        ) {
          console.log("🔄 Polling: Couleur joueur 2 différente");
          setPlayerColor(parsed.player2Color);
        }

        // Synchroniser les messages
        if (parsed.messages) {
          const currentLastMessage = messages[messages.length - 1];
          const parsedLastMessage = parsed.messages[parsed.messages.length - 1];

          const messagesDifferent =
            parsed.messages.length !== messages.length ||
            (parsedLastMessage &&
              currentLastMessage &&
              parsedLastMessage.timestamp !== currentLastMessage.timestamp) ||
            (!currentLastMessage && parsedLastMessage) ||
            (currentLastMessage && !parsedLastMessage);

          if (messagesDifferent) {
            console.log("🔄 Polling: Messages différents détectés");
            setMessages(parsed.messages);
          }
        }
      }
    }, 1000); // Vérifier toutes les secondes

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [
    sessionInfo.name,
    fen,
    isGameActive,
    whiteTime,
    blackTime,
    gameTimeLimit,
    lastMoveTime,
    gameResult,
    drawOffer,
    playerColor,
    playerId,
    messages.length,
  ]);

  // Timer principal pour décompter le temps
  useEffect(() => {
    if (isGameActive && lastMoveTime) {
      timerRef.current = setInterval(() => {
        const currentTurn = gameRef.current.turn();

        if (currentTurn === "w") {
          const newWhiteTime = Math.max(0, whiteTime - 1);
          setWhiteTime(newWhiteTime);

          // Vérifier si le temps est écoulé
          if (newWhiteTime <= 0) {
            const result = {
              type: "timeout" as const,
              winner: "black" as const,
              message:
                "Les Blancs ont dépassé le temps limite ! Les Noirs gagnent !",
            };
            setGameResult(result);
            setIsGameActive(false);
            syncGameEndState(result);
            return;
          }

          // Synchroniser le nouveau temps
          syncTimers(newWhiteTime, blackTime, lastMoveTime);
        } else {
          const newBlackTime = Math.max(0, blackTime - 1);
          setBlackTime(newBlackTime);

          // Vérifier si le temps est écoulé
          if (newBlackTime <= 0) {
            const result = {
              type: "timeout" as const,
              winner: "white" as const,
              message:
                "Les Noirs ont dépassé le temps limite ! Les Blancs gagnent !",
            };
            setGameResult(result);
            setIsGameActive(false);
            syncGameEndState(result);
            return;
          }

          // Synchroniser le nouveau temps
          syncTimers(whiteTime, newBlackTime, lastMoveTime);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameActive, lastMoveTime, whiteTime, blackTime]);

  // Synchroniser les timers avec localStorage
  const syncTimers = (
    newWhiteTime: number,
    newBlackTime: number,
    moveTime: number
  ) => {
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        whiteTime: newWhiteTime,
        blackTime: newBlackTime,
        lastMoveTime: moveTime,
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
    }
  };

  // Synchroniser les changements avec localStorage
  const syncGameState = (
    newFen: string,
    gameActive: boolean,
    moveTime: number | null = null
  ) => {
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        fen: newFen,
        isActive: gameActive,
        lastMoveTime: moveTime || roomData.lastMoveTime,
        turn: gameRef.current.turn(),
        // Maintenir les données des joueurs et tous les paramètres existants
        player1Id: roomData.player1Id,
        player2Id: roomData.player2Id,
        player1Color: roomData.player1Color,
        player2Color: roomData.player2Color,
        player1Wallet: roomData.player1Wallet,
        player2Wallet: roomData.player2Wallet,
        playerCount: roomData.player1Id && roomData.player2Id ? 2 : 1,
        whiteTime: roomData.whiteTime,
        blackTime: roomData.blackTime,
        gameTimeLimit: roomData.gameTimeLimit,
        messages: roomData.messages || [],
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
      console.log("💾 État synchronisé:", updatedRoom);
    }
  };

  // Commencer une partie
  const startGame = () => {
    const now = Date.now();
    setLastMoveTime(now);
    setIsGameActive(true);
    setConnectionStatus("Partie en cours");
    syncGameState(fen, true, now);
    console.log("🚀 Partie démarrée avec timers");
  };

  // Gérer les mouvements
  const onPieceDrop = (args: PieceDropHandlerArgs): boolean => {
    const { sourceSquare, targetSquare } = args;
    if (!targetSquare) return false;

    console.log("🧩 Tentative de mouvement:", sourceSquare, "->", targetSquare);
    console.log(
      "🎭 Joueur actuel:",
      playerColor,
      "| Tour du jeu:",
      gameRef.current.turn()
    );

    // Vérifier si c'est le tour du joueur
    const currentTurn = gameRef.current.turn();
    const isPlayerTurn =
      (currentTurn === "w" && playerColor === "white") ||
      (currentTurn === "b" && playerColor === "black");

    console.log("✅ Validation du tour:", {
      currentTurn,
      playerColor,
      isPlayerTurn,
      condition1: currentTurn === "w" && playerColor === "white",
      condition2: currentTurn === "b" && playerColor === "black",
    });

    if (!isPlayerTurn) {
      console.warn("❌ Ce n'est pas votre tour !");
      console.warn(
        "❌ Détails: currentTurn =",
        currentTurn,
        "playerColor =",
        playerColor
      );
      return false;
    }

    try {
      const move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move) {
        const newFen = gameRef.current.fen();
        const now = Date.now();
        setFen(newFen);
        setLastMoveTime(now); // Important: réinitialiser le timer pour le prochain joueur
        console.log("✅ Mouvement valide:", move);
        console.log("📋 Nouveau FEN:", newFen);

        // Démarrer la partie au premier mouvement
        if (!isGameActive) {
          startGame();
        } else {
          syncGameState(newFen, isGameActive, now);
        }

        return true;
      } else {
        console.warn("❌ Mouvement invalide");
        return false;
      }
    } catch (error) {
      console.warn("❌ Erreur de mouvement:", error);
      return false;
    }
  };

  // Fonctions pour les fins de partie
  const abandonGame = () => {
    const winner =
      playerColor === "white" ? ("black" as const) : ("white" as const);
    const result = {
      type: "abandoned" as const,
      winner,
      message: `${
        playerColor === "white" ? "Les Blancs" : "Les Noirs"
      } abandonnent ! ${winner === "white" ? "Blancs" : "Noirs"} gagnent !`,
    };

    setGameResult(result);
    setIsGameActive(false);
    syncGameEndState(result);
    console.log("🏳️ Abandon:", result);
  };

  const offerDraw = () => {
    const offer = { offered: true, by: playerColor };
    setDrawOffer(offer);
    syncDrawOffer(offer);
    console.log("🤝 Proposition de nul par:", playerColor);
  };

  const acceptDraw = () => {
    const result = {
      type: "draw" as const,
      winner: "draw" as const,
      message: "Match nul accepté !",
    };

    setGameResult(result);
    setDrawOffer({ offered: false, by: null });
    setIsGameActive(false);
    syncGameEndState(result);
    console.log("✅ Nul accepté");
  };

  const declineDraw = () => {
    const offer = { offered: false, by: null };
    setDrawOffer(offer);
    syncDrawOffer(offer);
    console.log("❌ Nul refusé");
  };

  // Synchroniser l'état de fin de partie
  const syncGameEndState = (result: typeof gameResult) => {
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        gameResult: result,
        isActive: false,
        lastGameWinner: result.winner,
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
    }
  };

  // Synchroniser les propositions de nul
  const syncDrawOffer = (offer: typeof drawOffer) => {
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        drawOffer: offer,
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
    }
  };

  // Réinitialiser la partie avec inversion des couleurs
  const resetGame = () => {
    gameRef.current.reset();
    const initialFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    setFen(initialFen);
    setIsGameActive(false);
    setLastMoveTime(null);
    setWhiteTime(gameTimeLimit); // Reset aux temps sélectionnés
    setBlackTime(gameTimeLimit); // Reset aux temps sélectionnés
    setGameResult({ type: null });
    setDrawOffer({ offered: false, by: null });
    setConnectionStatus("Prêt à jouer");

    // Inverser les couleurs des joueurs après chaque partie
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);

      // Inverser les couleurs
      const newPlayer1Color =
        roomData.player1Color === "white" ? "black" : "white";
      const newPlayer2Color =
        roomData.player2Color === "white" ? "black" : "white";

      // Déterminer ma nouvelle couleur
      const myNewColor =
        roomData.player1Id === playerId ? newPlayer1Color : newPlayer2Color;
      setPlayerColor(myNewColor);

      const updatedRoom = {
        ...roomData,
        fen: initialFen,
        isActive: false,
        lastMoveTime: null,
        whiteTime: gameTimeLimit,
        blackTime: gameTimeLimit,
        gameResult: null,
        drawOffer: { offered: false, by: null },
        turn: "w",
        player1Color: newPlayer1Color,
        player2Color: newPlayer2Color,
        gameNumber: (roomData.gameNumber || 1) + 1,
      };

      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
      console.log("🔄 Partie réinitialisée avec couleurs inversées");
      console.log("🎯 Votre nouvelle couleur:", myNewColor);
    } else {
      syncGameState(initialFen, false, null);
    }
  };

  // Calculer l'avantage matériel
  const calculateMaterialAdvantage = () => {
    const board = gameRef.current.board();
    const whitePieces: string[] = [];
    const blackPieces: string[] = [];

    // Compter les pièces sur l'échiquier
    board.forEach((row) => {
      row.forEach((square) => {
        if (square) {
          if (square.color === "w") {
            whitePieces.push(square.type.toUpperCase());
          } else {
            blackPieces.push(square.type.toLowerCase());
          }
        }
      });
    });

    // Calculer l'avantage
    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];

    // Compter chaque type de pièce
    const pieceCount = {
      white: { Q: 0, R: 0, B: 0, N: 0, P: 0 },
      black: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    };

    // Compter les pièces actuellement sur l'échiquier
    whitePieces.forEach((piece) => {
      if (piece !== "K")
        pieceCount.white[piece as keyof typeof pieceCount.white]++;
    });
    blackPieces.forEach((piece) => {
      if (piece !== "k")
        pieceCount.black[piece as keyof typeof pieceCount.black]++;
    });

    // Pièces de départ par type
    const startingCount = {
      white: { Q: 1, R: 2, B: 2, N: 2, P: 8 },
      black: { q: 1, r: 2, b: 2, n: 2, p: 8 },
    };

    // Calculer les pièces capturées
    Object.entries(startingCount.white).forEach(([pieceType, startCount]) => {
      const currentCount =
        pieceCount.white[pieceType as keyof typeof pieceCount.white];
      const captured = startCount - currentCount;
      for (let i = 0; i < captured; i++) {
        blackCaptured.push(pieceType); // Pièces blanches capturées = avantage noir
      }
    });

    Object.entries(startingCount.black).forEach(([pieceType, startCount]) => {
      const currentCount =
        pieceCount.black[pieceType as keyof typeof pieceCount.black];
      const captured = startCount - currentCount;
      for (let i = 0; i < captured; i++) {
        whiteCaptured.push(pieceType); // Pièces noires capturées = avantage blanc
      }
    });

    const whiteCapturedValue = whiteCaptured.reduce(
      (sum, piece) => sum + (pieceValues[piece.toLowerCase()] || 0),
      0
    );
    const blackCapturedValue = blackCaptured.reduce(
      (sum, piece) => sum + (pieceValues[piece.toLowerCase()] || 0),
      0
    );

    return {
      whiteAdvantage: whiteCapturedValue - blackCapturedValue,
      blackAdvantage: blackCapturedValue - whiteCapturedValue,
      whiteCaptured,
      blackCaptured,
      whiteCapturedValue,
      blackCapturedValue,
    };
  };

  const sessionLink =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?room=${sessionInfo.name}&password=${sessionInfo.password}`
      : "";

  const copyInviteLink = () => {
    navigator.clipboard.writeText(sessionLink);
    console.log("📋 Lien copié:", sessionLink);
    setConnectionStatus("Lien copié !");
    setTimeout(
      () =>
        setConnectionStatus(isGameActive ? "Partie en cours" : "Prêt à jouer"),
      2000
    );
  };

  // Fonction pour envoyer un message
  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected || !address) return;

    const message = {
      id: Date.now().toString(),
      playerId,
      playerWallet: address,
      message: newMessage.trim(),
      timestamp: Date.now(),
    };

    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedMessages = [...(roomData.messages || []), message];
      const updatedRoom = {
        ...roomData,
        messages: updatedMessages,
        // Maintenir explicitement tous les champs critiques
        player1Id: roomData.player1Id,
        player2Id: roomData.player2Id,
        player1Color: roomData.player1Color,
        player2Color: roomData.player2Color,
        player1Wallet: roomData.player1Wallet,
        player2Wallet: roomData.player2Wallet,
        gameTimeLimit: roomData.gameTimeLimit,
        whiteTime: roomData.whiteTime,
        blackTime: roomData.blackTime,
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
      console.log("💬 Message envoyé et room synchronisée:", message.message);
      setNewMessage("");
    }
  };

  // Configuration de react-chessboard selon la documentation officielle
  const chessboardOptions = {
    position: fen,
    onPieceDrop: onPieceDrop,
    boardOrientation: playerColor,
    arePiecesDraggable: true,
    boardWidth: 480,
    animationDuration: 200,
    showBoardNotation: true,
  };

  // Calculer l'avantage matériel actuel
  const materialAdvantage = calculateMaterialAdvantage();

  // Écran de bienvenue - Connexion wallet obligatoire
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gray-800 rounded-xl p-8 text-center shadow-2xl">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">♔ Chess Game</h1>
              <p className="text-gray-400">
                Multiplayer chess with real-time sync
              </p>
            </div>

            {/* Connexion wallet requise */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Connect your wallet to create or join chess games and chat with
                other players.
              </p>

              <WalletConnection />

              {!isConnected && (
                <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                  <p className="text-blue-300 text-xs">
                    🔒 Wallet connection is required to ensure secure gameplay
                    and player identification.
                  </p>
                </div>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-green-400 mb-1">⚡</div>
                <div className="font-semibold">Real-time Sync</div>
                <div className="text-gray-400">Instant move updates</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-blue-400 mb-1">💬</div>
                <div className="font-semibold">Chat System</div>
                <div className="text-gray-400">Talk with opponents</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-purple-400 mb-1">⏰</div>
                <div className="font-semibold">Timed Games</div>
                <div className="text-gray-400">3, 5, 10, 15 minutes</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-orange-400 mb-1">🔗</div>
                <div className="font-semibold">Share Links</div>
                <div className="text-gray-400">Invite friends easily</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Écran lobby - Créer ou rejoindre une room
  if (gameFlow === "lobby") {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header avec wallet connecté */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">♔ Chess Game</h1>
              <div className="text-sm text-gray-400">Welcome to the lobby</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">{formatWalletAddress(address!)}</span>
              </div>
              <button
                onClick={() => setGameFlow("welcome")}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Main lobby content */}
        <div className="max-w-4xl mx-auto p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Créer une nouvelle partie */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Create New Game</h2>
                <p className="text-gray-400 text-sm">
                  Start a new chess game and invite opponents
                </p>
              </div>

              {/* Sélection du temps */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">
                  Game Duration (per player)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGameTimeLimit(180)}
                    className={`p-3 rounded-lg border transition-colors ${
                      gameTimeLimit === 180
                        ? "border-blue-500 bg-blue-600/20 text-blue-300"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">3 min</div>
                    <div className="text-xs text-gray-400">Rapid</div>
                  </button>
                  <button
                    onClick={() => setGameTimeLimit(300)}
                    className={`p-3 rounded-lg border transition-colors ${
                      gameTimeLimit === 300
                        ? "border-blue-500 bg-blue-600/20 text-blue-300"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">5 min</div>
                    <div className="text-xs text-gray-400">Blitz</div>
                  </button>
                  <button
                    onClick={() => setGameTimeLimit(600)}
                    className={`p-3 rounded-lg border transition-colors ${
                      gameTimeLimit === 600
                        ? "border-blue-500 bg-blue-600/20 text-blue-300"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">10 min</div>
                    <div className="text-xs text-gray-400">Standard</div>
                  </button>
                  <button
                    onClick={() => setGameTimeLimit(900)}
                    className={`p-3 rounded-lg border transition-colors ${
                      gameTimeLimit === 900
                        ? "border-blue-500 bg-blue-600/20 text-blue-300"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="font-semibold">15 min</div>
                    <div className="text-xs text-gray-400">Long</div>
                  </button>
                </div>
              </div>

              <button
                onClick={createNewRoom}
                disabled={isCreatingRoom}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-semibold transition-colors"
              >
                {isCreatingRoom ? "Creating..." : "Create Game"}
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Join Existing Game</h2>
                <p className="text-gray-400 text-sm">
                  Enter a room code to join an ongoing game
                </p>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="roomInput"
                  className="block text-sm font-medium mb-2"
                >
                  Room Code
                </label>
                <input
                  id="roomInput"
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Enter room code (e.g., chess-abc123)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 Get the room code from a friend&apos;s invitation link
                </p>
              </div>

              <button
                onClick={joinRoom}
                disabled={!roomInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-semibold transition-colors"
              >
                🔗 Join Game
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-gray-800/50 rounded-xl p-6">
            <h3 className="font-bold mb-4 text-center">🎯 How to Play</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">1️⃣</div>
                <div className="font-semibold mb-1">Create or Join</div>
                <div className="text-gray-400">
                  Start a new game or join with a room code
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">2️⃣</div>
                <div className="font-semibold mb-1">Share & Play</div>
                <div className="text-gray-400">
                  Invite friends with the link and start playing
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">3️⃣</div>
                <div className="font-semibold mb-1">Chat & Enjoy</div>
                <div className="text-gray-400">
                  Use the chat system and have fun!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Interface de jeu - Seulement si gameFlow === "game"
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Sélecteur de temps modal */}
      {showTimeSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-center">
              ⏰ Sélectionner le temps de partie
            </h3>
            <p className="text-center mb-6 text-gray-400">
              Choisissez la durée pour chaque joueur :
            </p>
            <div className="space-y-3">
              <button
                onClick={() => selectGameTime(3)}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded transition-colors"
              >
                🏃‍♂️ Partie rapide - 3 minutes
              </button>
              <button
                onClick={() => selectGameTime(5)}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded transition-colors"
              >
                ⚡ Partie blitz - 5 minutes
              </button>
              <button
                onClick={() => selectGameTime(10)}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded transition-colors"
              >
                🎯 Partie standard - 10 minutes
              </button>
              <button
                onClick={() => selectGameTime(15)}
                className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded transition-colors"
              >
                🐌 Partie longue - 15 minutes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header avec informations de connexion */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setGameFlow("lobby")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Lobby
            </button>
            <h1 className="text-2xl font-bold">♔ Chess Game</h1>
            <div className="text-sm text-gray-400">
              Room: <span className="text-blue-400">{sessionInfo.name}</span>
            </div>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            <WalletConnection />
          </div>
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Game Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Player Info - Top (Adversaire) */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  {playerColor === "white" ? "♚" : "♔"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Adversaire</div>
                  <div className="text-xs text-gray-400">En attente...</div>
                </div>
                {/* Timer adversaire */}
                <div className="text-right">
                  <div
                    className={`text-2xl font-mono ${
                      (gameRef.current.turn() === "b" &&
                        playerColor === "white") ||
                      (gameRef.current.turn() === "w" &&
                        playerColor === "black")
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {playerColor === "white"
                      ? formatTime(blackTime)
                      : formatTime(whiteTime)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {playerColor === "white" ? "Black" : "White"}
                  </div>
                </div>
              </div>

              {/* Pieces captured by opponent */}
              <div className="flex gap-1 min-h-[24px]">
                {playerColor === "white"
                  ? materialAdvantage.blackCaptured.map((piece, index) => (
                      <span key={index} className="text-lg">
                        {piece === "Q"
                          ? "♕"
                          : piece === "R"
                          ? "♖"
                          : piece === "B"
                          ? "♗"
                          : piece === "N"
                          ? "♘"
                          : "♙"}
                      </span>
                    ))
                  : materialAdvantage.whiteCaptured.map((piece, index) => (
                      <span key={index} className="text-lg">
                        {piece === "q"
                          ? "♛"
                          : piece === "r"
                          ? "♜"
                          : piece === "b"
                          ? "♝"
                          : piece === "n"
                          ? "♞"
                          : "♟"}
                      </span>
                    ))}
                {((playerColor === "white" &&
                  materialAdvantage.blackAdvantage > 0) ||
                  (playerColor === "black" &&
                    materialAdvantage.whiteAdvantage > 0)) && (
                  <span className="text-green-400 font-bold text-sm ml-2">
                    +
                    {playerColor === "white"
                      ? materialAdvantage.blackAdvantage
                      : materialAdvantage.whiteAdvantage}
                  </span>
                )}
              </div>
            </div>

            {/* Game Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Game Status</h3>
              <div className="space-y-2 text-sm">
                <div>
                  Status:{" "}
                  <span className="text-blue-400">{connectionStatus}</span>
                </div>
                <div>
                  Game Time:{" "}
                  <span className="text-yellow-400">
                    {formatTime(gameTimeLimit)} per player
                  </span>
                </div>
                <div>
                  Your Color:{" "}
                  <span className="text-green-400">
                    {playerColor === "white" ? "White" : "Black"}
                  </span>
                </div>
                <div>
                  Turn:{" "}
                  <span className="text-orange-400">
                    {gameRef.current.turn() === "w" ? "White" : "Black"}
                  </span>
                </div>
              </div>

              {/* Game Controls */}
              <div className="flex gap-2 mt-4">
                <button
                  className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-700 transition-colors text-xs"
                  onClick={() => setShowTimeSelector(true)}
                  disabled={isGameActive}
                >
                  ⏰ Time
                </button>
                <button
                  className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 transition-colors text-xs"
                  onClick={startGame}
                  disabled={isGameActive}
                >
                  🚀 Start
                </button>
                <button
                  className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 transition-colors text-xs"
                  onClick={resetGame}
                >
                  🔄 Reset
                </button>
              </div>

              {/* End Game Actions */}
              {isGameActive && !gameResult.type && (
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-2 py-1 bg-orange-600 rounded hover:bg-orange-700 text-xs transition-colors"
                    onClick={abandonGame}
                  >
                    🏳️ Resign
                  </button>
                  <button
                    className="px-2 py-1 bg-purple-600 rounded hover:bg-purple-700 text-xs transition-colors"
                    onClick={offerDraw}
                    disabled={drawOffer.offered}
                  >
                    🤝 Draw
                  </button>
                </div>
              )}
            </div>

            {/* Share Game */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Share Game</h3>
              <button
                className="w-full px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors text-sm"
                onClick={copyInviteLink}
              >
                📎 Copy Invite Link
              </button>
            </div>
          </div>

          {/* Center - Chessboard */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-4">
              {/* Top captured pieces */}
              <div className="flex justify-start items-center mb-4 h-8">
                {playerColor === "white" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">♚</span>
                    <div className="flex gap-1">
                      {materialAdvantage.blackCaptured.map((piece, index) => (
                        <span key={index} className="text-xl">
                          {piece === "Q"
                            ? "♕"
                            : piece === "R"
                            ? "♖"
                            : piece === "B"
                            ? "♗"
                            : piece === "N"
                            ? "♘"
                            : "♙"}
                        </span>
                      ))}
                    </div>
                    {materialAdvantage.blackAdvantage > 0 && (
                      <span className="text-green-400 font-bold text-sm">
                        +{materialAdvantage.blackAdvantage}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">♔</span>
                    <div className="flex gap-1">
                      {materialAdvantage.whiteCaptured.map((piece, index) => (
                        <span key={index} className="text-xl">
                          {piece === "q"
                            ? "♛"
                            : piece === "r"
                            ? "♜"
                            : piece === "b"
                            ? "♝"
                            : piece === "n"
                            ? "♞"
                            : "♟"}
                        </span>
                      ))}
                    </div>
                    {materialAdvantage.whiteAdvantage > 0 && (
                      <span className="text-green-400 font-bold text-sm">
                        +{materialAdvantage.whiteAdvantage}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Chessboard */}
              <div className="flex justify-center">
                <div style={{ width: "480px", height: "480px" }}>
                  <Chessboard options={chessboardOptions} />
                </div>
              </div>

              {/* Bottom captured pieces */}
              <div className="flex justify-start items-center mt-4 h-8">
                {playerColor === "white" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">♔</span>
                    <div className="flex gap-1">
                      {materialAdvantage.whiteCaptured.map((piece, index) => (
                        <span key={index} className="text-xl">
                          {piece === "q"
                            ? "♛"
                            : piece === "r"
                            ? "♜"
                            : piece === "b"
                            ? "♝"
                            : piece === "n"
                            ? "♞"
                            : "♟"}
                        </span>
                      ))}
                    </div>
                    {materialAdvantage.whiteAdvantage > 0 && (
                      <span className="text-green-400 font-bold text-sm">
                        +{materialAdvantage.whiteAdvantage}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">♚</span>
                    <div className="flex gap-1">
                      {materialAdvantage.blackCaptured.map((piece, index) => (
                        <span key={index} className="text-xl">
                          {piece === "Q"
                            ? "♕"
                            : piece === "R"
                            ? "♖"
                            : piece === "B"
                            ? "♗"
                            : piece === "N"
                            ? "♘"
                            : "♙"}
                        </span>
                      ))}
                    </div>
                    {materialAdvantage.blackAdvantage > 0 && (
                      <span className="text-green-400 font-bold text-sm">
                        +{materialAdvantage.blackAdvantage}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat & Player Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Current Player Info */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  {playerColor === "white" ? "♔" : "♚"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">You</div>
                  <div className="text-xs text-gray-400">
                    {isConnected
                      ? formatWalletAddress(address!)
                      : "Not connected"}
                  </div>
                </div>
                {/* Mon timer */}
                <div className="text-right">
                  <div
                    className={`text-2xl font-mono ${
                      (gameRef.current.turn() === "w" &&
                        playerColor === "white") ||
                      (gameRef.current.turn() === "b" &&
                        playerColor === "black")
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {playerColor === "white"
                      ? formatTime(whiteTime)
                      : formatTime(blackTime)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {playerColor === "white" ? "White" : "Black"}
                  </div>
                </div>
              </div>

              {/* Your captured pieces */}
              <div className="flex gap-1 min-h-[24px]">
                {playerColor === "white"
                  ? materialAdvantage.whiteCaptured.map((piece, index) => (
                      <span key={index} className="text-lg">
                        {piece === "q"
                          ? "♛"
                          : piece === "r"
                          ? "♜"
                          : piece === "b"
                          ? "♝"
                          : piece === "n"
                          ? "♞"
                          : "♟"}
                      </span>
                    ))
                  : materialAdvantage.blackCaptured.map((piece, index) => (
                      <span key={index} className="text-lg">
                        {piece === "Q"
                          ? "♕"
                          : piece === "R"
                          ? "♖"
                          : piece === "B"
                          ? "♗"
                          : piece === "N"
                          ? "♘"
                          : "♙"}
                      </span>
                    ))}
                {((playerColor === "white" &&
                  materialAdvantage.whiteAdvantage > 0) ||
                  (playerColor === "black" &&
                    materialAdvantage.blackAdvantage > 0)) && (
                  <span className="text-green-400 font-bold text-sm ml-2">
                    +
                    {playerColor === "white"
                      ? materialAdvantage.whiteAdvantage
                      : materialAdvantage.blackAdvantage}
                  </span>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-gray-800 rounded-lg p-4 h-80 flex flex-col">
              <h3 className="font-bold mb-3">Chat</h3>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-400">
                        {msg.playerId === playerId
                          ? "You"
                          : formatWalletAddress(msg.playerWallet)}
                        :
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-200 ml-2">{msg.message}</div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-gray-500 text-center text-sm">
                    No messages yet...
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={
                    isConnected ? "Type a message..." : "Connect wallet to chat"
                  }
                  disabled={!isConnected}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!isConnected || !newMessage.trim()}
                  className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Draw Offer Modal */}
      {drawOffer.offered && drawOffer.by && drawOffer.by !== playerColor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-center">
              🤝 Draw Offer
            </h3>
            <p className="text-center mb-4">
              {drawOffer.by === "white" ? "White" : "Black"} offers a draw.
            </p>
            <div className="flex gap-3">
              <button
                onClick={acceptDraw}
                className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded transition-colors"
              >
                ✅ Accept
              </button>
              <button
                onClick={declineDraw}
                className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded transition-colors"
              >
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game End Modal */}
      {(gameResult.type || gameRef.current.isGameOver()) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-2xl font-bold mb-4">🏁 Game Over!</h2>

            {gameResult.type === "abandoned" && (
              <div>
                <p className="text-lg mb-2">{gameResult.message}</p>
                <p className="text-sm text-gray-400">
                  Game ended by resignation
                </p>
              </div>
            )}

            {gameResult.type === "timeout" && (
              <div>
                <p className="text-lg mb-2">{gameResult.message}</p>
                <p className="text-sm text-gray-400">Game ended by timeout</p>
              </div>
            )}

            {gameResult.type === "draw" && (
              <div>
                <p className="text-lg mb-2">🤝 {gameResult.message}</p>
                <p className="text-sm text-gray-400">
                  Game ended by mutual agreement
                </p>
              </div>
            )}

            {!gameResult.type && gameRef.current.isGameOver() && (
              <div>
                {gameRef.current.isCheckmate() && (
                  <div>
                    <p className="text-lg mb-2">
                      ♔ Checkmate!{" "}
                      {gameRef.current.turn() === "w" ? "Black" : "White"} wins!
                    </p>
                    <p className="text-sm text-gray-400">
                      Game ended by checkmate
                    </p>
                  </div>
                )}
                {gameRef.current.isDraw() && (
                  <div>
                    <p className="text-lg mb-2">🤝 Draw!</p>
                    <p className="text-sm text-gray-400">
                      Game ended by chess rules
                    </p>
                  </div>
                )}
                {gameRef.current.isStalemate() && (
                  <div>
                    <p className="text-lg mb-2">🔒 Stalemate!</p>
                    <p className="text-sm text-gray-400">
                      Game ended by stalemate
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={resetGame}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded transition-colors"
            >
              🔄 New Game (colors swapped)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
