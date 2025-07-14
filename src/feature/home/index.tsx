// ChessApp avec session dynamique et synchronisation
"use client";
import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

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
  const [playerId] = useState(Date.now().toString()); // ID unique pour chaque joueur

  // États pour les fins de partie
  const [gameResult, setGameResult] = useState<{
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | null;
    winner?: "white" | "black" | "draw";
    message?: string;
  }>({ type: null });
  const [drawOffer, setDrawOffer] = useState<{
    offered: boolean;
    by: "white" | "black" | null;
  }>({ offered: false, by: null });

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

  // Déterminer la couleur du joueur basé sur l'ordre d'arrivée et les parties précédentes
  const determinePlayerColor = (roomName: string) => {
    const roomKey = `chess-room-${roomName}`;
    const existingRoom = localStorage.getItem(roomKey);

    if (existingRoom) {
      const roomData = JSON.parse(existingRoom);
      console.log("🏠 Room existante trouvée:", roomData);

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
          playerCount: 1,
        };
        localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
        console.log("🎯 Nouveau joueur 1 avec couleur:", player1Color);
      } else if (!roomData.player2Id) {
        // Nouveau joueur 2
        const player2Color =
          roomData.player1Color === "white" ? "black" : "white";
        setPlayerColor(player2Color);
        setConnectionStatus("Partie prête ! Deux joueurs connectés");
        const updatedRoom = {
          ...roomData,
          player2Id: playerId,
          player2Color,
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
        player2Id: null,
        player2Color: null,
        playerCount: 1,
        turn: "w",
        isActive: false,
        startTime: null,
        gameNumber: 1,
        lastGameWinner: null,
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

        // Synchroniser timer
        if (parsed.startTime !== startTime) {
          console.log("🔄 Polling: Timer différent détecté");
          setStartTime(parsed.startTime);
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
    startTime,
    gameResult,
    drawOffer,
    playerColor,
    playerId,
  ]);

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
        // Maintenir les données des joueurs
        player1Id: roomData.player1Id,
        player2Id: roomData.player2Id,
        player1Color: roomData.player1Color,
        player2Color: roomData.player2Color,
        playerCount: roomData.player1Id && roomData.player2Id ? 2 : 1,
      };
      localStorage.setItem(roomKey, JSON.stringify(updatedRoom));
      console.log("💾 État synchronisé:", updatedRoom);
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
    // Pour les tests, on simule juste le mouvement directement
    try {
      const move = gameRef.current.move({
        from: from,
        to: to,
        promotion: "q",
      });

      if (move) {
        const newFen = gameRef.current.fen();
        setFen(newFen);
        console.log("✅ Test mouvement valide:", move);

        if (!isGameActive) {
          startGame();
        } else {
          syncGameState(newFen, isGameActive);
        }

        return true;
      }
    } catch (error) {
      console.warn("❌ Test mouvement invalide:", error);
    }
    return false;
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
    setStartTime(null);
    setElapsedTime(0);
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
        startTime: null,
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

        {/* Boutons de fin de partie */}
        {isGameActive && !gameResult.type && (
          <div className="flex gap-2 mt-2">
            <button
              className="px-2 py-1 bg-orange-600 rounded hover:bg-orange-700 text-xs transition-colors"
              onClick={abandonGame}
            >
              🏳️ Abandonner
            </button>

            <button
              className="px-2 py-1 bg-purple-600 rounded hover:bg-purple-700 text-xs transition-colors"
              onClick={offerDraw}
              disabled={drawOffer.offered}
            >
              🤝 Proposer nul
            </button>
          </div>
        )}

        {/* Proposition de nul en cours */}
        {drawOffer.offered && drawOffer.by && drawOffer.by !== playerColor && (
          <div className="mt-3 p-3 bg-purple-900/50 rounded-lg">
            <p className="text-sm font-bold text-purple-300 mb-2">
              🤝 Proposition de nul reçue !
            </p>
            <p className="text-xs mb-3">
              {drawOffer.by === "white" ? "Les Blancs" : "Les Noirs"} proposent
              un match nul.
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-xs transition-colors"
                onClick={acceptDraw}
              >
                ✅ Accepter
              </button>
              <button
                className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-xs transition-colors"
                onClick={declineDraw}
              >
                ❌ Refuser
              </button>
            </div>
          </div>
        )}

        {/* Attente de réponse */}
        {drawOffer.offered && drawOffer.by === playerColor && (
          <div className="mt-3 p-2 bg-yellow-900/50 rounded-lg">
            <p className="text-xs text-yellow-300">
              ⏳ En attente de la réponse à votre proposition de nul...
            </p>
          </div>
        )}

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
      <div className="bg-blue-900/50 p-3 rounded-lg text-center mt-[200px] max-w-md">
        <p className="text-sm mb-2">
          <strong>🎮 Jeu d&apos;échecs synchronisé :</strong>
        </p>
        <p className="text-xs">
          Drag &amp; drop les pièces ou utilisez les boutons de test. Copiez le
          lien pour inviter un adversaire !
        </p>
      </div>

      {/* Fin de partie - nouveau système complet */}
      {(gameResult.type || gameRef.current.isGameOver()) && (
        <div className="bg-red-900/70 p-4 rounded-xl text-center">
          <h2 className="text-xl font-bold mb-2">🏁 Partie terminée !</h2>

          {/* Abandon */}
          {gameResult.type === "abandoned" && (
            <div>
              <p className="text-lg mb-2">{gameResult.message}</p>
              <p className="text-sm text-gray-300">Fin par abandon</p>
            </div>
          )}

          {/* Nul accepté */}
          {gameResult.type === "draw" && (
            <div>
              <p className="text-lg mb-2">🤝 {gameResult.message}</p>
              <p className="text-sm text-gray-300">Fin par accord mutuel</p>
            </div>
          )}

          {/* Fins de partie automatiques d'échecs */}
          {!gameResult.type && gameRef.current.isGameOver() && (
            <div>
              {gameRef.current.isCheckmate() && (
                <div>
                  <p className="text-lg mb-2">
                    ♔ Échec et mat !{" "}
                    {gameRef.current.turn() === "w" ? "Noirs" : "Blancs"}{" "}
                    gagnent !
                  </p>
                  <p className="text-sm text-gray-300">Fin par échec et mat</p>
                </div>
              )}
              {gameRef.current.isDraw() && (
                <div>
                  <p className="text-lg mb-2">🤝 Match nul !</p>
                  <p className="text-sm text-gray-300">
                    Fin par règles d&apos;échecs
                  </p>
                </div>
              )}
              {gameRef.current.isStalemate() && (
                <div>
                  <p className="text-lg mb-2">🔒 Pat !</p>
                  <p className="text-sm text-gray-300">Fin par pat</p>
                </div>
              )}
            </div>
          )}

          <button
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            onClick={resetGame}
          >
            🔄 Nouvelle partie (couleurs inversées)
          </button>
        </div>
      )}
    </div>
  );
}
