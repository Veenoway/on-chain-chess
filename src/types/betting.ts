export interface GameInfo {
  betAmount: bigint;
  state: number; // 0: WAITING, 1: ACTIVE, 2: FINISHED
  result: number; // 1: WHITE_WINS, 2: BLACK_WINS, 3: DRAW
  whitePlayer: string;
  blackPlayer: string;
  whiteClaimed: boolean;
  blackClaimed: boolean;
  roomName: string;
}
