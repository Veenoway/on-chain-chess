export interface MultisynqSession {
  view: MultisynqView;
  close: () => void;
}

export interface MultisynqView {
  makeMove: (
    from: string,
    to: string,
    playerId: string,
    promotion?: string
  ) => void;
  joinPlayer: (wallet: string, playerId: string) => void;
  sendMessage: (
    message: string,
    playerId: string,
    playerWallet: string
  ) => void;
  startGame: () => void;
  resetGame: () => void;
  updateTimer: () => void;
  offerDraw: (playerId: string) => void;
  respondDraw: (playerId: string, accepted: boolean) => void;
  resign: (playerId: string) => void;
  setGameTime: (gameTime: number) => void;
  requestRematch: (playerId: string) => void;
  respondRematch: (playerId: string, accepted: boolean) => void;
  resetRematchAccepted: () => void;
  session?: { close: () => void };
}
