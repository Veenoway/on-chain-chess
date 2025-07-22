/* eslint-disable @typescript-eslint/no-explicit-any */
import { GameFlow, GameState, PaymentStatus } from "@/types/chess";
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ChessGameState {
  gameState: GameState;

  gameFlow: GameFlow;
  isReconnecting: boolean;
  lastKnownGameState: GameState | null;

  roomInput: string;
  isCreatingRoom: boolean;
  selectedGameTime: number;

  newMessage: string;
  connectionStatus: string;

  betAmount: string;
  isBettingEnabled: boolean;
  roomBetAmount: string | null;
  bettingGameCreationFailed: boolean;
  isRematchTransition: boolean;

  paymentStatus: PaymentStatus;

  currentPlayerId: string | null;
  multisynqSession: any;
  multisynqView: any;
  multisynqReady: boolean;

  fen: string;
  playerColor: "white" | "black";

  showGameEndModal: boolean;
  hasClosedModal: boolean;
  hasClosedPaymentModal: boolean;
  isFinalizingGame: boolean;

  moveHistory: string[];
  currentMoveIndex: number;
}

interface ChessGameActions {
  setGameState: (
    gameState: GameState | ((prev: GameState) => GameState)
  ) => void;
  resetGameState: () => void;

  setGameFlow: (flow: GameFlow) => void;
  setIsReconnecting: (reconnecting: boolean) => void;
  setLastKnownGameState: (state: GameState | null) => void;

  setRoomInput: (input: string) => void;
  setIsCreatingRoom: (creating: boolean) => void;
  setSelectedGameTime: (time: number) => void;

  setNewMessage: (message: string) => void;
  setConnectionStatus: (status: string) => void;

  setBetAmount: (amount: string) => void;
  setIsBettingEnabled: (enabled: boolean) => void;
  setRoomBetAmount: (amount: string | null) => void;
  setBettingGameCreationFailed: (failed: boolean) => void;
  setIsRematchTransition: (transition: boolean) => void;

  setPaymentStatus: (
    status: PaymentStatus | ((prev: PaymentStatus) => PaymentStatus)
  ) => void;
  updatePaymentStatus: (updates: Partial<PaymentStatus>) => void;

  setCurrentPlayerId: (id: string | null) => void;
  setMultisynqSession: (session: any) => void;
  setMultisynqView: (view: any) => void;
  setMultisynqReady: (ready: boolean) => void;

  setFen: (fen: string) => void;
  setPlayerColor: (color: "white" | "black") => void;

  setShowGameEndModal: (show: boolean) => void;
  setHasClosedModal: (closed: boolean) => void;
  setHasClosedPaymentModal: (closed: boolean) => void;
  setIsFinalizingGame: (finalizing: boolean) => void;

  setMoveHistory: (history: string[] | ((prev: string[]) => string[])) => void;
  setCurrentMoveIndex: (index: number | ((prev: number) => number)) => void;
  addMoveToHistory: (fen: string) => void;
  resetMoveHistory: () => void;

  resetToWelcomeScreen: () => void;
  startNewGame: (
    roomName: string,
    roomPassword: string,
    gameTimeLimit: number
  ) => void;
}

type ChessGameStore = ChessGameState & ChessGameActions;

const initialGameState: GameState = {
  fen: INITIAL_FEN,
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

const initialPaymentStatus: PaymentStatus = {
  whitePlayerPaid: false,
  blackPlayerPaid: false,
  currentPlayerPaid: false,
};

export const useChessGameStore = create<ChessGameStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      gameState: initialGameState,
      gameFlow: "welcome",
      isReconnecting: false,
      lastKnownGameState: null,
      roomInput: "",
      isCreatingRoom: false,
      selectedGameTime: 600,
      newMessage: "",
      connectionStatus: "Prêt à jouer",
      betAmount: "1",
      isBettingEnabled: true,
      roomBetAmount: null,
      bettingGameCreationFailed: false,
      isRematchTransition: false,
      paymentStatus: initialPaymentStatus,
      currentPlayerId: null,
      multisynqSession: null,
      multisynqView: null,
      multisynqReady: false,
      fen: INITIAL_FEN,
      playerColor: "white",
      showGameEndModal: false,
      hasClosedModal: false,
      hasClosedPaymentModal: false,
      isFinalizingGame: false,
      moveHistory: [INITIAL_FEN],
      currentMoveIndex: 0,

      setGameState: (gameState) =>
        set((state) => ({
          gameState:
            typeof gameState === "function"
              ? gameState(state.gameState)
              : gameState,
        })),

      resetGameState: () =>
        set({
          gameState: { ...initialGameState, createdAt: Date.now() },
        }),

      setGameFlow: (flow) => set({ gameFlow: flow }),
      setIsReconnecting: (reconnecting) =>
        set({ isReconnecting: reconnecting }),
      setLastKnownGameState: (state) => set({ lastKnownGameState: state }),

      setRoomInput: (input) => set({ roomInput: input }),
      setIsCreatingRoom: (creating) => set({ isCreatingRoom: creating }),
      setSelectedGameTime: (time) => set({ selectedGameTime: time }),

      setNewMessage: (message) => set({ newMessage: message }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setBetAmount: (amount) => set({ betAmount: amount }),
      setIsBettingEnabled: (enabled) => set({ isBettingEnabled: enabled }),
      setRoomBetAmount: (amount) => set({ roomBetAmount: amount }),
      setBettingGameCreationFailed: (failed) =>
        set({ bettingGameCreationFailed: failed }),
      setIsRematchTransition: (transition) =>
        set({ isRematchTransition: transition }),

      setPaymentStatus: (status) =>
        set((state) => ({
          paymentStatus:
            typeof status === "function" ? status(state.paymentStatus) : status,
        })),

      updatePaymentStatus: (updates) =>
        set((state) => ({
          paymentStatus: { ...state.paymentStatus, ...updates },
        })),

      setCurrentPlayerId: (id) => set({ currentPlayerId: id }),
      setMultisynqSession: (session) => set({ multisynqSession: session }),
      setMultisynqView: (view) => set({ multisynqView: view }),
      setMultisynqReady: (ready) => set({ multisynqReady: ready }),

      setFen: (fen) => set({ fen: fen }),
      setPlayerColor: (color) => set({ playerColor: color }),

      setShowGameEndModal: (show) => set({ showGameEndModal: show }),
      setHasClosedModal: (closed) => set({ hasClosedModal: closed }),
      setHasClosedPaymentModal: (closed) =>
        set({ hasClosedPaymentModal: closed }),
      setIsFinalizingGame: (finalizing) =>
        set({ isFinalizingGame: finalizing }),

      setMoveHistory: (history) =>
        set((state) => ({
          moveHistory:
            typeof history === "function"
              ? history(state.moveHistory)
              : history,
        })),

      setCurrentMoveIndex: (index) =>
        set((state) => ({
          currentMoveIndex:
            typeof index === "function" ? index(state.currentMoveIndex) : index,
        })),

      addMoveToHistory: (fen) =>
        set((state) => {
          const newHistory = [...state.moveHistory, fen];
          return {
            moveHistory: newHistory,
            currentMoveIndex: newHistory.length - 1,
            fen: fen,
          };
        }),

      resetMoveHistory: () =>
        set({
          moveHistory: [INITIAL_FEN],
          currentMoveIndex: 0,
          fen: INITIAL_FEN,
        }),

      resetToWelcomeScreen: () =>
        set({
          gameFlow: "welcome",
          gameState: { ...initialGameState, createdAt: Date.now() },
          isReconnecting: false,
          lastKnownGameState: null,
          roomInput: "",
          isCreatingRoom: false,
          newMessage: "",
          connectionStatus: "Prêt à jouer",
          bettingGameCreationFailed: false,
          isRematchTransition: false,
          paymentStatus: initialPaymentStatus,
          currentPlayerId: null,
          fen: INITIAL_FEN,
          playerColor: "white",
          showGameEndModal: false,
          hasClosedModal: false,
          hasClosedPaymentModal: false,
          isFinalizingGame: false,
          moveHistory: [INITIAL_FEN],
          currentMoveIndex: 0,
        }),

      startNewGame: (roomName, roomPassword, gameTimeLimit) =>
        set((state) => ({
          gameState: {
            ...state.gameState,
            roomName,
            roomPassword,
            gameTimeLimit,
            whiteTime: gameTimeLimit,
            blackTime: gameTimeLimit,
            gameNumber: state.gameState.gameNumber + 1,
            createdAt: Date.now(),
          },
          gameFlow: "game",
          hasClosedPaymentModal: false,
          selectedGameTime: gameTimeLimit,
        })),
    })),
    {
      name: "chess-game-store",
    }
  )
);

export const useGameState = () => useChessGameStore((state) => state.gameState);
export const useGameFlow = () => useChessGameStore((state) => state.gameFlow);
export const useCurrentPlayer = () => {
  const gameState = useChessGameStore((state) => state.gameState);
  const currentPlayerId = useChessGameStore((state) => state.currentPlayerId);
  return gameState.players.find((p) => p.id === currentPlayerId) || null;
};
export const useOpponentPlayer = () => {
  const gameState = useChessGameStore((state) => state.gameState);
  const currentPlayerId = useChessGameStore((state) => state.currentPlayerId);
  return gameState.players.find((p) => p.id !== currentPlayerId) || null;
};
export const useBettingConfig = () => {
  const betAmount = useChessGameStore((state) => state.betAmount);
  const isBettingEnabled = useChessGameStore((state) => state.isBettingEnabled);
  return { betAmount, isBettingEnabled };
};
export const useChessBoard = () => {
  const fen = useChessGameStore((state) => state.fen);
  const playerColor = useChessGameStore((state) => state.playerColor);
  const moveHistory = useChessGameStore((state) => state.moveHistory);
  const currentMoveIndex = useChessGameStore((state) => state.currentMoveIndex);
  return { fen, playerColor, moveHistory, currentMoveIndex };
};
