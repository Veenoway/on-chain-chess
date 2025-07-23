export interface MatchmakingCriteria {
  gameTime: number;
  betAmount: string;
  preferredColor?: "white" | "black" | "random";
}

export interface QueueEntry {
  playerId: string;
  playerAddress: string;
  criteria: MatchmakingCriteria;
  joinedAt: number;
}

export interface MatchFound {
  roomName: string;
  roomPassword: string;
  gameTime: number;
  betAmount: string;
  whitePlayer: {
    id: string;
    address: string;
  };
  blackPlayer: {
    id: string;
    address: string;
  };
  matchId: string;
}

export interface QueueStatus {
  inQueue: boolean;
  estimatedWaitTime?: number;
  queuePosition?: number;
  totalInQueue?: number;
}

export type MatchmakingStatus =
  | "idle"
  | "searching"
  | "match_found"
  | "connecting"
  | "failed";
