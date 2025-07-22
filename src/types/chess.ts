export interface Player {
  id: string;
  wallet: string;
  color: "white" | "black";
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerWallet: string;
  message: string;
  timestamp: number;
}

export interface GameResult {
  type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
  winner?: "white" | "black" | "draw";
  message?: string;
}

export interface DrawOffer {
  offered: boolean;
  by: "white" | "black" | null;
}

export interface RematchOffer {
  offered: boolean;
  by: "white" | "black" | null;
}

export interface RematchCreating {
  inProgress: boolean;
  by: "white" | "black" | null;
}

export interface RematchInvitation {
  from: string;
  roomName: string;
  password: string;
  betAmount?: string;
}

export interface GameState {
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
  gameResult: GameResult;
  drawOffer: DrawOffer;
  rematchOffer?: RematchOffer;
  rematchCreating?: RematchCreating; // ✅ NOUVEAU: État de création de rematch
  gameNumber: number;
  lastGameWinner: "white" | "black" | "draw" | null;
  createdAt: number;
  rematchAccepted?: boolean;
}

export interface PaymentStatus {
  whitePlayerPaid: boolean;
  blackPlayerPaid: boolean;
  currentPlayerPaid: boolean;
}

export interface RematchInvitation {
  from: string;
  roomName: string;
  password: string;
}

export type GameFlow = "welcome" | "lobby" | "game";
