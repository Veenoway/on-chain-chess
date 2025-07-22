/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

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

export interface GameOffer {
  offered: boolean;
  by: "white" | "black" | null;
}

export interface PaymentStatus {
  whitePlayerPaid: boolean;
  blackPlayerPaid: boolean;
  currentPlayerPaid: boolean;
}

export interface ChessState {
  // Game state
  fen: string;
  isActive: boolean;
  turn: "w" | "b";
  players: Player[];
  whiteTime: number;
  blackTime: number;
  gameTimeLimit: number;
  lastMoveTime: number | null;
  gameResult: GameResult;
  drawOffer: GameOffer;
  rematchOffer: GameOffer;
  gameNumber: number;

  // Room state
  roomName: string;
  roomPassword: string;
  messages: ChatMessage[];

  // UI state
  gameFlow: "welcome" | "lobby" | "game";
  isReconnecting: boolean;
  showGameEndModal: boolean;
  hasClosedModal: boolean;

  // Player state
  currentPlayerId: string | null;
  playerColor: "white" | "black";

  // Betting state
  isBettingEnabled: boolean;
  betAmount: string;
  roomBetAmount: string | null;
  paymentStatus: PaymentStatus;

  // History state
  moveHistory: string[];
  currentMoveIndex: number;

  // Multisynq state
  // @ts-ignore
  multisynqSession: any;
  multisynqView: any;
  multisynqReady: boolean;

  // Connection state
  connectionStatus: string;

  // Actions
  setGameState: (updates: Partial<ChessState>) => void;
  setPlayers: (players: Player[]) => void;
  addMessage: (message: ChatMessage) => void;
  setCurrentPlayer: (playerId: string, color: "white" | "black") => void;
  updatePaymentStatus: (status: Partial<PaymentStatus>) => void;
  setMoveHistory: (history: string[], index: number) => void;
  nextMove: () => void;
  previousMove: () => void;
  goToMove: (index: number) => void;
  resetGame: () => void;
  startNewGame: () => void;

  // Game actions
  makeMove: (from: string, to: string, promotion?: string) => void;
  offerDraw: () => void;
  respondDraw: (accepted: boolean) => void;
  resign: () => void;
  requestRematch: () => void;
  respondRematch: (accepted: boolean) => void;
  setGameFlow: (flow: "welcome" | "lobby" | "game") => void;
}

const initialState = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  isActive: false,
  turn: "w" as "w" | "b",
  players: [],
  whiteTime: 600,
  blackTime: 600,
  gameTimeLimit: 600,
  lastMoveTime: null,
  gameResult: { type: null } as GameResult,
  drawOffer: { offered: false, by: null } as GameOffer,
  rematchOffer: { offered: false, by: null } as GameOffer,
  gameNumber: 1,

  roomName: "",
  roomPassword: "",
  messages: [],

  gameFlow: "welcome" as "welcome" | "lobby" | "game",
  isReconnecting: false,
  showGameEndModal: false,
  hasClosedModal: false,

  currentPlayerId: null,
  playerColor: "white" as "white" | "black",

  isBettingEnabled: false,
  betAmount: "0.1",
  roomBetAmount: null,
  paymentStatus: {
    whitePlayerPaid: false,
    blackPlayerPaid: false,
    currentPlayerPaid: false,
  },

  moveHistory: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
  currentMoveIndex: 0,

  multisynqSession: null,
  multisynqView: null,
  multisynqReady: false,

  connectionStatus: "Initializing...",
};

export const useChessStore = create<ChessState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        setGameState: (updates) => set((state) => ({ ...state, ...updates })),

        setPlayers: (players) => set({ players }),

        addMessage: (message) =>
          set((state) => ({
            messages: [...state.messages, message],
          })),

        setCurrentPlayer: (playerId, color) =>
          set({
            currentPlayerId: playerId,
            playerColor: color,
          }),

        updatePaymentStatus: (status) =>
          set((state) => ({
            paymentStatus: { ...state.paymentStatus, ...status },
          })),

        setMoveHistory: (history, index) =>
          set({
            moveHistory: history,
            currentMoveIndex: index,
          }),

        nextMove: () =>
          set((state) => {
            const newIndex = Math.min(
              state.currentMoveIndex + 1,
              state.moveHistory.length - 1
            );
            return {
              currentMoveIndex: newIndex,
              fen: state.moveHistory[newIndex] || state.fen,
            };
          }),

        previousMove: () =>
          set((state) => {
            const newIndex = Math.max(state.currentMoveIndex - 1, 0);
            return {
              currentMoveIndex: newIndex,
              fen: state.moveHistory[newIndex] || state.fen,
            };
          }),

        goToMove: (index) =>
          set((state) => {
            const clampedIndex = Math.max(
              0,
              Math.min(index, state.moveHistory.length - 1)
            );
            return {
              currentMoveIndex: clampedIndex,
              fen: state.moveHistory[clampedIndex] || state.fen,
            };
          }),

        resetGame: () =>
          set((state) => ({
            ...initialState,
            roomName: state.roomName,
            roomPassword: state.roomPassword,
            currentPlayerId: state.currentPlayerId,
            multisynqSession: state.multisynqSession,
            multisynqView: state.multisynqView,
            multisynqReady: state.multisynqReady,
            gameNumber: state.gameNumber + 1,
          })),

        startNewGame: () =>
          set((state) => ({
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            isActive: true,
            turn: "w",
            whiteTime: state.gameTimeLimit,
            blackTime: state.gameTimeLimit,
            gameResult: { type: null },
            drawOffer: { offered: false, by: null },
            rematchOffer: { offered: false, by: null },
            lastMoveTime: Date.now(),
            moveHistory: [
              "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            ],
            currentMoveIndex: 0,
            showGameEndModal: false,
            hasClosedModal: false,
          })),

        makeMove: (from, to, promotion = "q") => {
          const { multisynqView, currentPlayerId } = get();
          if (multisynqView && currentPlayerId) {
            multisynqView.makeMove(from, to, currentPlayerId, promotion);
          }
        },

        offerDraw: () => {
          const { multisynqView, currentPlayerId } = get();
          if (multisynqView && currentPlayerId) {
            multisynqView.offerDraw(currentPlayerId);
          }
        },

        respondDraw: (accepted) => {
          const { multisynqView, currentPlayerId } = get();
          if (multisynqView && currentPlayerId) {
            multisynqView.respondDraw(currentPlayerId, accepted);
          }
        },

        resign: () => {
          const { multisynqView, currentPlayerId } = get();
          if (
            multisynqView &&
            currentPlayerId &&
            confirm("Are you sure you want to resign?")
          ) {
            multisynqView.resign(currentPlayerId);
          }
        },

        requestRematch: () => {
          const { multisynqView, currentPlayerId } = get();
          if (multisynqView && currentPlayerId) {
            multisynqView.requestRematch(currentPlayerId);
          }
        },

        respondRematch: (accepted) => {
          const { multisynqView, currentPlayerId } = get();
          if (multisynqView && currentPlayerId) {
            multisynqView.respondRematch(currentPlayerId, accepted);
          }
        },

        setGameFlow: (flow) => set({ gameFlow: flow }),
      }),
      {
        name: "chess-game-storage",
        partialize: (state) => ({
          roomName: state.roomName,
          roomPassword: state.roomPassword,
          gameTimeLimit: state.gameTimeLimit,
          isBettingEnabled: state.isBettingEnabled,
          betAmount: state.betAmount,
          moveHistory: state.moveHistory,
          currentMoveIndex: state.currentMoveIndex,
          gameResult: state.gameResult,
          isActive: state.isActive,
          players: state.players,
          showGameEndModal: state.showGameEndModal,
          hasClosedModal: state.hasClosedModal,
          turn: state.turn,
          fen: state.fen,
          whiteTime: state.whiteTime,
          blackTime: state.blackTime,
          gameNumber: state.gameNumber,
          lastMoveTime: state.lastMoveTime,
          // Persister également les offres en cours
          drawOffer: state.drawOffer,
          rematchOffer: state.rematchOffer,
        }),
      }
    )
  )
);
