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

export class ChessGameModelLocal {
  public gameState: GameState;
  private chess: Chess;
  private timerInterval: NodeJS.Timeout | null = null;
  private playerId: string | null = null;

  constructor() {
    this.chess = new Chess();

    // État initial
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

    this.initializeLocalNetwork();
  }

  // Initialiser la synchronisation locale
  private initializeLocalNetwork(): void {
    if (typeof window !== "undefined") {
      // Écouter les changements localStorage (entre onglets)
      window.addEventListener("storage", this.handleStorageChange.bind(this));

      // Polling pour synchronisation active
      setInterval(() => {
        this.syncWithLocalStorage();
      }, 500);
    }

    console.log("✅ Réseau local initialisé (localStorage + événements)");
  }

  // Gérer les changements localStorage
  private handleStorageChange(event: StorageEvent): void {
    if (
      event.key?.startsWith("chess_game_") &&
      event.key.includes(this.gameState.roomName)
    ) {
      this.syncWithLocalStorage();
    }
  }

  // Synchroniser avec localStorage
  private syncWithLocalStorage(): void {
    if (!this.gameState.roomName) return;

    const key = `chess_game_${this.gameState.roomName}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const storedState = JSON.parse(stored);

        // Vérifier s'il y a des changements
        if (JSON.stringify(storedState) !== JSON.stringify(this.gameState)) {
          this.mergeGameState(storedState);
          this.notifyStateChange();
        }
      } catch (error) {
        console.error("❌ Erreur parsing localStorage:", error);
      }
    }
  }

  // Fusionner l'état du jeu
  private mergeGameState(newState: Partial<GameState>): void {
    // Synchroniser chess.js avec le FEN reçu
    if (newState.fen && newState.fen !== this.gameState.fen) {
      try {
        this.chess.load(newState.fen);
      } catch (error) {
        console.error("❌ Erreur chargement FEN:", error);
      }
    }

    // Fusionner les états
    this.gameState = { ...this.gameState, ...newState };
  }

  // Sauvegarder dans localStorage
  private saveToLocalStorage(): void {
    if (!this.gameState.roomName || typeof window === "undefined") return;

    const key = `chess_game_${this.gameState.roomName}`;
    localStorage.setItem(key, JSON.stringify(this.gameState));

    // Déclencher événement pour autres onglets
    setTimeout(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: key,
          newValue: JSON.stringify(this.gameState),
        })
      );
    }, 50);
  }

  // Notifier les changements d'état
  private notifyStateChange(): void {
    if (typeof window !== "undefined") {
      const event = new CustomEvent("chess-game-updated", {
        detail: { gameState: this.gameState },
      });
      window.dispatchEvent(event);
    }
  }

  // Créer une nouvelle room
  createRoom(
    roomName: string,
    roomPassword: string,
    playerWallet: string,
    gameTimeLimit: number
  ): string | null {
    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;

    this.playerId = playerId;
    this.gameState.roomName = roomName;
    this.gameState.roomPassword = roomPassword;
    this.gameState.gameTimeLimit = gameTimeLimit;
    this.gameState.whiteTime = gameTimeLimit;
    this.gameState.blackTime = gameTimeLimit;

    // Ajouter le créateur comme premier joueur (blanc)
    const newPlayer: Player = {
      id: playerId,
      wallet: playerWallet,
      color: "white",
      connected: true,
    };

    this.gameState.players = [newPlayer];
    this.saveToLocalStorage();

    console.log("🏠 Room créée:", roomName, "par joueur:", playerId);
    this.notifyStateChange();

    return playerId;
  }

  // Rejoindre une room existante
  joinRoom(roomName: string, playerWallet: string): string | null {
    const playerId = `player_${Math.random().toString(36).substring(2, 10)}`;

    this.playerId = playerId;
    this.gameState.roomName = roomName;

    // Charger l'état existant de la room
    if (typeof window !== "undefined") {
      const key = `chess_game_${roomName}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const storedState = JSON.parse(stored);
          this.mergeGameState(storedState);
        } catch (error) {
          console.error("❌ Erreur chargement room:", error);
        }
      }
    }

    // Vérifier si la room peut accueillir plus de joueurs
    if (this.gameState.players.length >= this.gameState.maxPlayers) {
      console.warn("⚠️ Room pleine");
      return null;
    }

    // Déterminer la couleur du joueur
    const existingColors = this.gameState.players.map((p) => p.color);
    const playerColor: "white" | "black" = existingColors.includes("white")
      ? "black"
      : "white";

    // Ajouter le nouveau joueur
    const newPlayer: Player = {
      id: playerId,
      wallet: playerWallet,
      color: playerColor,
      connected: true,
    };

    this.gameState.players.push(newPlayer);
    this.saveToLocalStorage();

    console.log("🚪 Joueur rejoint:", playerId, "couleur:", playerColor);
    this.notifyStateChange();

    return playerId;
  }

  // Effectuer un mouvement
  makeMove(
    from: string,
    to: string,
    playerId?: string,
    promotion?: string
  ): boolean {
    const currentPlayerId = playerId || this.playerId;
    if (!currentPlayerId) return false;

    // Vérifier si c'est le bon joueur qui joue
    const player = this.gameState.players.find((p) => p.id === currentPlayerId);
    if (!player) return false;

    const currentTurn = this.gameState.turn;
    if (
      (currentTurn === "w" && player.color !== "white") ||
      (currentTurn === "b" && player.color !== "black")
    ) {
      console.warn("❌ Ce n'est pas votre tour");
      return false;
    }

    // Valider le mouvement avec chess.js
    try {
      const moveResult = this.chess.move({
        from,
        to,
        promotion: promotion || "q",
      });

      if (!moveResult) {
        console.warn("❌ Mouvement invalide");
        return false;
      }

      // Mettre à jour l'état
      this.gameState.fen = this.chess.fen();
      this.gameState.turn = this.chess.turn();
      this.gameState.lastMoveTime = Date.now();

      // Démarrer/continuer le timer
      if (!this.timerInterval && this.gameState.isActive) {
        this.startTimer();
      }

      // Vérifier fin de partie
      this.checkGameEnd();

      this.saveToLocalStorage();

      console.log("✅ Mouvement exécuté:", from, "->", to);
      this.notifyStateChange();

      return true;
    } catch (error) {
      console.warn("❌ Erreur mouvement:", error);
      return false;
    }
  }

  // Démarrer le jeu
  startGame(): boolean {
    if (this.gameState.players.length < 2) {
      console.warn("⚠️ Il faut 2 joueurs pour démarrer");
      return false;
    }

    this.gameState.isActive = true;
    this.startTimer();
    this.saveToLocalStorage();

    console.log("🚀 Jeu démarré");
    this.notifyStateChange();
    return true;
  }

  // Remettre à zéro le jeu
  resetGame(): void {
    this.chess.reset();

    // Échanger les couleurs
    this.gameState.players.forEach((player) => {
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

    this.stopTimer();
    this.saveToLocalStorage();

    console.log("🔄 Jeu remis à zéro, couleurs échangées");
    this.notifyStateChange();
  }

  // Envoyer un message de chat
  sendMessage(message: string, playerId: string, playerWallet: string): void {
    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      playerId,
      playerWallet,
      message,
      timestamp: Date.now(),
    };

    this.gameState.messages.push(chatMessage);
    this.saveToLocalStorage();

    console.log("💬 Message envoyé:", message);
    this.notifyStateChange();
  }

  // Abandonner la partie
  resign(playerId: string): void {
    const player = this.gameState.players.find((p) => p.id === playerId);
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
    this.stopTimer();
    this.saveToLocalStorage();

    console.log("🏳️ Abandon par:", player.color);
    this.notifyStateChange();
  }

  // Proposer un nul
  offerDraw(playerId: string): void {
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (!player) return;

    this.gameState.drawOffer = { offered: true, by: player.color };
    this.saveToLocalStorage();

    console.log("🤝 Proposition de nul par:", player.color);
    this.notifyStateChange();
  }

  // Accepter un nul
  acceptDraw(): void {
    this.gameState.gameResult = {
      type: "draw",
      winner: "draw",
      message: "Game ended by mutual agreement",
    };
    this.gameState.isActive = false;
    this.gameState.lastGameWinner = "draw";
    this.gameState.drawOffer = { offered: false, by: null };
    this.stopTimer();
    this.saveToLocalStorage();

    console.log("✅ Nul accepté");
    this.notifyStateChange();
  }

  // Refuser un nul
  declineDraw(): void {
    this.gameState.drawOffer = { offered: false, by: null };
    this.saveToLocalStorage();

    console.log("❌ Nul refusé");
    this.notifyStateChange();
  }

  // Définir le temps de jeu
  setGameTime(gameTimeLimit: number): void {
    this.gameState.gameTimeLimit = gameTimeLimit;
    this.gameState.whiteTime = gameTimeLimit;
    this.gameState.blackTime = gameTimeLimit;
    this.saveToLocalStorage();

    console.log("⏰ Temps de jeu défini:", gameTimeLimit, "secondes");
    this.notifyStateChange();
  }

  // Démarrer le timer
  private startTimer(): void {
    if (this.timerInterval) return;

    this.timerInterval = setInterval(() => {
      if (!this.gameState.isActive) {
        this.stopTimer();
        return;
      }

      const currentTurn = this.gameState.turn;

      if (currentTurn === "w") {
        this.gameState.whiteTime = Math.max(0, this.gameState.whiteTime - 1000);
        if (this.gameState.whiteTime <= 0) {
          this.handleTimeout("white");
        }
      } else {
        this.gameState.blackTime = Math.max(0, this.gameState.blackTime - 1000);
        if (this.gameState.blackTime <= 0) {
          this.handleTimeout("black");
        }
      }

      this.notifyStateChange();
    }, 1000);

    console.log("⏱️ Timer démarré");
  }

  // Arrêter le timer
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      console.log("⏹️ Timer arrêté");
    }
  }

  // Gérer les timeouts
  private handleTimeout(player: "white" | "black"): void {
    const winner = player === "white" ? "black" : "white";

    this.gameState.gameResult = {
      type: "timeout",
      winner,
      message: `${player === "white" ? "White" : "Black"} ran out of time`,
    };

    this.gameState.isActive = false;
    this.gameState.lastGameWinner = winner;
    this.stopTimer();
    this.saveToLocalStorage();

    console.log("⏰ Timeout pour:", player);
    this.notifyStateChange();
  }

  // Vérifier la fin de partie
  private checkGameEnd(): void {
    if (this.chess.isGameOver()) {
      this.gameState.isActive = false;
      this.stopTimer();

      if (this.chess.isCheckmate()) {
        const winner = this.chess.turn() === "w" ? "black" : "white";
        this.gameState.gameResult = {
          type: "checkmate",
          winner,
          message: `Checkmate! ${winner === "white" ? "White" : "Black"} wins!`,
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

      console.log("🏁 Fin de partie:", this.gameState.gameResult);
    }
  }

  // Méthodes utilitaires publiques
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

  // Nettoyer les ressources
  public dispose(): void {
    this.stopTimer();
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "storage",
        this.handleStorageChange.bind(this)
      );
    }
    console.log("🧹 ChessGameModel nettoyé");
  }
}
