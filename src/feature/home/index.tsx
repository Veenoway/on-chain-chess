// ChessApp avec session dynamique et synchronisation
"use client";
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

export default function ChessMultisynqApp() {
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [sessionInfo, setSessionInfo] = useState({ name: "", password: "" });
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Prêt à jouer");
  const [isGameActive, setIsGameActive] = useState(false);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");

  const gameRef = useRef(new Chess());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Générer une session unique au démarrage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let roomName = urlParams.get("room");
    let roomPassword = urlParams.get("password");

    if (!roomName) {
      roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
    }

    if (!roomPassword) {
      roomPassword = Math.random().toString(36).substring(2, 6);
    }

    setSessionInfo({ name: roomName, password: roomPassword });
    console.log("🎯 Session:", { name: roomName, password: roomPassword });

    // Mettre à jour l'URL
    const newUrl = `${window.location.pathname}?room=${roomName}&password=${roomPassword}`;
    window.history.replaceState({}, "", newUrl);

    // Déterminer la couleur du joueur
    determinePlayerColor(roomName);
  }, []);

  // Déterminer la couleur du joueur basé sur l'ordre d'arrivée
  const determinePlayerColor = (roomName: string) => {
    const roomKey = `chess-room-${roomName}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      console.log("🏠 Room existante trouvée:", roomData);

      // Compter le nombre de joueurs actuels
      const playerCount = roomData.playerCount || 0;

      if (playerCount === 0) {
        // Premier joueur = Blanc
        setPlayerColor("white");
        setConnectionStatus("En attente d'un adversaire...");
        const updatedRoom = {
          ...roomData,
          playerCount: 1,
          whitePlayer: Date.now(), // Timestamp pour identifier
        };
        localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
        console.log("🎯 Joueur 1 (Blanc) rejoint");
      } else if (playerCount === 1) {
        // Deuxième joueur = Noir
        setPlayerColor("black");
        setConnectionStatus("Partie prête ! Deux joueurs connectés");
        const updatedRoom = {
          ...roomData,
          playerCount: 2,
          blackPlayer: Date.now(), // Timestamp pour identifier
        };
        localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
        console.log("🎯 Joueur 2 (Noir) rejoint");
      } else {
        // Spectateur ou trop de joueurs
        setPlayerColor("white"); // Par défaut
        setConnectionStatus("Room pleine - Mode spectateur");
        console.log("👁️ Spectateur");
      }
    } else {
      // Créer une nouvelle room - premier joueur = Blanc
      setPlayerColor("white");
      setConnectionStatus("En attente d'un adversaire...");
      const newRoom = {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        playerCount: 1,
        whitePlayer: Date.now(),
        turn: "w",
        isActive: false,
        startTime: null,
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

          // Forcer le re-render en mettant à jour un état
          setElapsedTime((prev) => prev); // Trigger re-render
        }

        if (roomData.isActive !== isGameActive) {
          console.log("🎮 Mise à jour isActive:", roomData.isActive);
          setIsGameActive(roomData.isActive);
        }

        if (roomData.startTime && roomData.startTime !== startTime) {
          console.log("⏰ Mise à jour startTime:", roomData.startTime);
          setStartTime(roomData.startTime);
        }

        // Mettre à jour le statut selon le nombre de joueurs
        if (roomData.playerCount === 2) {
          setConnectionStatus("Partie en cours - 2 joueurs connectés");
        } else if (roomData.playerCount === 1) {
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
        if (parsed.fen !== fen) {
          console.log("🔄 Polling: FEN différent détecté");
          setFen(parsed.fen);
          gameRef.current.load(parsed.fen);
        }
      }
    }, 1000); // Vérifier toutes les secondes

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [sessionInfo.name, fen, isGameActive, startTime]);

  // Timer pour le jeu
  useEffect(() => {
    if (startTime && isGameActive) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isGameActive]);

  // Synchroniser les changements avec localStorage
  const syncGameState = (
    newFen: string,
    gameActive: boolean,
    gameStartTime: number | null = null
  ) => {
    const roomKey = `chess-room-${sessionInfo.name}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      const updatedRoom = {
        ...roomData,
        fen: newFen,
        isActive: gameActive,
        startTime: gameStartTime || roomData.startTime,
        turn: gameRef.current.turn(),
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
    }
  };

  // Commencer une partie
  const startGame = () => {
    const now = Date.now();
    setStartTime(now);
    setElapsedTime(0);
    setIsGameActive(true);
    setConnectionStatus("Partie en cours");
    syncGameState(fen, true, now);
    console.log("🚀 Partie démarrée");
  };

  // Gérer les mouvements
  const onPieceDrop = (args: any): boolean => {
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
        setFen(newFen);
        console.log("✅ Mouvement valide:", move);
        console.log("📋 Nouveau FEN:", newFen);

        // Démarrer la partie au premier mouvement
        if (!isGameActive) {
          startGame();
        } else {
          syncGameState(newFen, isGameActive);
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

  // Fonction helper pour les boutons de test
  const makeTestMove = (from: string, to: string) => {
    return onPieceDrop({ sourceSquare: from, targetSquare: to });
  };

  // Réinitialiser la partie
  const resetGame = () => {
    gameRef.current.reset();
    const initialFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    setFen(initialFen);
    setIsGameActive(false);
    setStartTime(null);
    setElapsedTime(0);
    setConnectionStatus("Prêt à jouer");
    syncGameState(initialFen, false, null);
    console.log("🔄 Partie réinitialisée");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
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

  // Configuration de react-chessboard selon la documentation officielle
  const chessboardOptions = {
    position: fen,
    onPieceDrop: onPieceDrop,
    boardOrientation: playerColor,
    arePiecesDraggable: true,
    boardWidth: 400,
    animationDuration: 200,
    showBoardNotation: true,
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-4 text-white">
      <div className="bg-black/70 p-4 rounded-xl shadow-md w-fit text-center">
        <p className="mb-1">
          🔗 Status: <strong>{connectionStatus}</strong>
        </p>
        <p className="mb-1">
          🎯 Room: <strong>{sessionInfo.name}</strong>
        </p>
        <p className="mb-1">
          🔒 Password: <strong>{sessionInfo.password}</strong>
        </p>
        <p className="mb-1">🕒 Time: {formatTime(elapsedTime)}</p>
        <p className="mb-1">
          🎭 Vous jouez:{" "}
          <strong>{playerColor === "white" ? "Blancs" : "Noirs"}</strong>
        </p>
        <p className="mb-1">
          🎯 Tour actuel:{" "}
          <strong>{gameRef.current.turn() === "w" ? "Blancs" : "Noirs"}</strong>
        </p>

        <div className="flex gap-2 mt-3">
          <button
            className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            onClick={copyInviteLink}
          >
            📎 Copier le lien
          </button>

          <button
            className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 transition-colors"
            onClick={startGame}
            disabled={isGameActive}
          >
            🚀 Démarrer
          </button>

          <button
            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 transition-colors"
            onClick={resetGame}
          >
            🔄 Reset
          </button>
        </div>

        {/* Boutons de test temporaires */}
        <div className="flex gap-2 mt-2">
          <button
            className="px-2 py-1 bg-yellow-600 rounded hover:bg-yellow-700 text-xs"
            onClick={() => makeTestMove("e2", "e4")}
            disabled={gameRef.current.turn() !== "w" || playerColor !== "white"}
          >
            Test: e2-e4
          </button>
          <button
            className="px-2 py-1 bg-yellow-600 rounded hover:bg-yellow-700 text-xs"
            onClick={() => makeTestMove("e7", "e5")}
            disabled={gameRef.current.turn() !== "b" || playerColor !== "black"}
          >
            Test: e7-e5
          </button>
          <button
            className="px-2 py-1 bg-yellow-600 rounded hover:bg-yellow-700 text-xs"
            onClick={() => makeTestMove("g1", "f3")}
            disabled={gameRef.current.turn() !== "w" || playerColor !== "white"}
          >
            Test: g1-f3
          </button>
        </div>
      </div>

      <div className="w-96 h-96">
        {/* Debug: afficher le FEN actuel */}
        <div className="text-xs mb-2 bg-gray-800 p-2 rounded">
          <strong>FEN actuel:</strong>
          <br />
          <code className="text-green-400">{fen}</code>
          <br />
          <strong>Tour:</strong>{" "}
          <span className="text-yellow-400">
            {gameRef.current.turn() === "w" ? "Blancs" : "Noirs"}
          </span>
          {" | "}
          <strong>Vous:</strong>{" "}
          <span className="text-blue-400">
            {playerColor === "white" ? "Blancs" : "Noirs"}
          </span>
          {" | "}
          <strong>Votre tour:</strong>{" "}
          <span
            className={
              (gameRef.current.turn() === "w" && playerColor === "white") ||
              (gameRef.current.turn() === "b" && playerColor === "black")
                ? "text-green-400"
                : "text-red-400"
            }
          >
            {(gameRef.current.turn() === "w" && playerColor === "white") ||
            (gameRef.current.turn() === "b" && playerColor === "black")
              ? "OUI"
              : "NON"}
          </span>
        </div>

        {/* Chessboard avec la bonne API options */}
        <Chessboard options={chessboardOptions} />

        {/* Affichage alternatif simple */}
        <div className="mt-2 text-xs bg-blue-900/50 p-2 rounded">
          <strong>Dernière action:</strong>{" "}
          {gameRef.current.history().slice(-1)[0] || "Aucune"}
        </div>
      </div>

      {/* Instructions pour l'utilisateur */}
      <div className="bg-blue-900/50 p-3 rounded-lg text-center max-w-md">
        <p className="text-sm mb-2">
          <strong>🎮 Jeu d'échecs synchronisé :</strong>
        </p>
        <p className="text-xs">
          Drag &amp; drop les pièces ou utilisez les boutons de test. Copiez le
          lien pour inviter un adversaire !
        </p>
      </div>

      {gameRef.current.isGameOver() && (
        <div className="bg-red-900/70 p-4 rounded-xl text-center">
          <h2 className="text-xl font-bold mb-2">🏁 Partie terminée !</h2>
          {gameRef.current.isCheckmate() && (
            <p>
              Échec et mat !{" "}
              {gameRef.current.turn() === "w" ? "Noirs" : "Blancs"} gagnent !
            </p>
          )}
          {gameRef.current.isDraw() && <p>Match nul !</p>}
          {gameRef.current.isStalemate() && <p>Pat !</p>}
        </div>
      )}
    </div>
  );
}
