import { useEffect, useState } from "react";
import { formatEther } from "viem";

interface PaymentStatus {
  whitePlayerPaid: boolean;
  blackPlayerPaid: boolean;
  currentPlayerPaid: boolean;
}

export const useBettingGame = (gameInfo: any, address: string | undefined) => {
  const [betAmount, setBetAmount] = useState("1");
  const [isBettingEnabled, setIsBettingEnabled] = useState(true);
  const [roomBetAmount, setRoomBetAmount] = useState<string | null>(null);
  const [bettingGameCreationFailed, setBettingGameCreationFailed] =
    useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    whitePlayerPaid: false,
    blackPlayerPaid: false,
    currentPlayerPaid: false,
  });
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);

  const hasBettingRequirement = (): boolean => {
    const hasBetting = gameInfo?.betAmount
      ? gameInfo.betAmount > BigInt(0)
      : false;

    if (isBettingEnabled && parseFloat(betAmount) > 0) {
      return true;
    }

    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      return true;
    }

    return hasBetting;
  };

  const bothPlayersPaid = (): boolean => {
    if (!hasBettingRequirement()) {
      return true;
    }

    if (gameInfo?.state === 1) {
      return true;
    }

    const bothPaid =
      paymentStatus.whitePlayerPaid && paymentStatus.blackPlayerPaid;
    return bothPaid;
  };

  const getCorrectBetAmount = (): string => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      return formatEther(gameInfo.betAmount);
    }
    return betAmount;
  };

  const canCurrentPlayerClaim = (): boolean => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return false;
    }

    if (!address) {
      return false;
    }

    const isWhiteInContract =
      gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
    const isBlackInContract =
      gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

    if (!isWhiteInContract && !isBlackInContract) {
      return false;
    }

    if (gameInfo.state === 2) {
      if (gameInfo.result === 3) {
        return isWhiteInContract
          ? !gameInfo.whiteClaimed
          : !gameInfo.blackClaimed;
      } else if (gameInfo.result === 1) {
        return isWhiteInContract && !gameInfo.whiteClaimed;
      } else if (gameInfo.result === 2) {
        return isBlackInContract && !gameInfo.blackClaimed;
      }
    }

    return false;
  };

  const getAvailableAmount = () => {
    if (!gameInfo || !gameInfo.betAmount) return "0";

    const totalPot = gameInfo.betAmount * BigInt(2);

    if (gameInfo.result === 3) {
      const claimedAmount =
        (gameInfo.whiteClaimed ? gameInfo.betAmount : BigInt(0)) +
        (gameInfo.blackClaimed ? gameInfo.betAmount : BigInt(0));
      const available = totalPot - claimedAmount;
      return formatEther(available);
    } else {
      const whiteWon = gameInfo.result === 1;
      const blackWon = gameInfo.result === 2;

      if (whiteWon && gameInfo.whiteClaimed) return "0";
      if (blackWon && gameInfo.blackClaimed) return "0";

      return formatEther(totalPot);
    }
  };

  // Sync betAmount with contract
  useEffect(() => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      const currentBetAmount = formatEther(gameInfo.betAmount);
      if (currentBetAmount !== betAmount) {
        setBetAmount(currentBetAmount);
      }
    }
  }, [gameInfo?.betAmount]);

  return {
    betAmount,
    setBetAmount,
    isBettingEnabled,
    setIsBettingEnabled,
    roomBetAmount,
    setRoomBetAmount,
    bettingGameCreationFailed,
    setBettingGameCreationFailed,
    paymentStatus,
    setPaymentStatus,
    isFinalizingGame,
    setIsFinalizingGame,
    hasBettingRequirement,
    bothPlayersPaid,
    getCorrectBetAmount,
    canCurrentPlayerClaim,
    getAvailableAmount,
  };
};
