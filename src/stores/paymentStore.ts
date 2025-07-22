/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface GameInfo {
  gameId: bigint;
  betAmount: bigint;
  whitePlayer: string;
  blackPlayer: string;
  state: number; // 0: WAITING, 1: ACTIVE, 2: FINISHED, 3: CANCELLED
}

export interface PaymentState {
  // Contract state
  gameInfo: GameInfo | null;
  gameId: bigint | null;

  // Payment status
  whitePlayerPaid: boolean;
  blackPlayerPaid: boolean;
  currentPlayerPaid: boolean;

  // Transaction status
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;

  // Network status
  isWrongNetwork: boolean;

  // Balance
  balance: bigint;
  balanceFormatted: string;

  // Actions
  setGameInfo: (gameInfo: GameInfo | null) => void;
  setGameId: (gameId: bigint | null) => void;
  updatePaymentStatus: () => void;
  setTransactionStatus: (
    status: Partial<
      Pick<PaymentState, "isPending" | "isConfirming" | "isConfirmed">
    >
  ) => void;
  setNetworkStatus: (isWrong: boolean) => void;
  setBalance: (balance: bigint, formatted: string) => void;
  reset: () => void;
}

const initialPaymentState = {
  gameInfo: null,
  gameId: null,
  whitePlayerPaid: false,
  blackPlayerPaid: false,
  currentPlayerPaid: false,
  isPending: false,
  isConfirming: false,
  isConfirmed: false,
  isWrongNetwork: false,
  balance: BigInt(0),
  balanceFormatted: "0",
};

export const usePaymentStore = create<PaymentState>()(
  subscribeWithSelector((set, get) => ({
    ...initialPaymentState,

    setGameInfo: (gameInfo) => {
      set({ gameInfo });
      get().updatePaymentStatus();
    },

    setGameId: (gameId) => set({ gameId }),

    updatePaymentStatus: () => {
      const { gameInfo } = get();

      if (!gameInfo || !gameInfo.betAmount || gameInfo.betAmount <= BigInt(0)) {
        set({
          whitePlayerPaid: true,
          blackPlayerPaid: true,
          currentPlayerPaid: true,
        });
        return;
      }

      const whitePlayerPaid =
        gameInfo.whitePlayer !== "0x0000000000000000000000000000000000000000";
      const blackPlayerPaid =
        gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";
      const bothPaidFromContract = gameInfo.state === 1;

      // @ts-ignore
      const address = (window as any).currentUserAddress;

      let currentPlayerPaid = false;
      if (address && gameInfo) {
        const isWhitePlayer =
          gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
        const isBlackPlayer =
          gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();
        currentPlayerPaid = isWhitePlayer || isBlackPlayer;
      }

      set({
        whitePlayerPaid: bothPaidFromContract || whitePlayerPaid,
        blackPlayerPaid: bothPaidFromContract || blackPlayerPaid,
        currentPlayerPaid,
      });
    },

    setTransactionStatus: (status) => set((state) => ({ ...state, ...status })),

    setNetworkStatus: (isWrong) => set({ isWrongNetwork: isWrong }),

    setBalance: (balance, formatted) =>
      set({ balance, balanceFormatted: formatted }),

    reset: () => set(initialPaymentState),
  }))
);

export const useHasBettingRequirement = () =>
  usePaymentStore((state) =>
    state.gameInfo?.betAmount ? state.gameInfo.betAmount > BigInt(0) : false
  );

export const useBothPlayersPaid = () =>
  usePaymentStore((state) => state.whitePlayerPaid && state.blackPlayerPaid);

export const useCanPlay = () => {
  const hasBetting = useHasBettingRequirement();
  const currentPlayerPaid = usePaymentStore((state) => state.currentPlayerPaid);

  return !hasBetting || currentPlayerPaid;
};
