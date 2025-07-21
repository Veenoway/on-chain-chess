/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useChessBetting,
  useCompleteGameInfo,
  useGameIdByRoom,
} from "@/hooks/useChessBetting";
import { useChessGameStore } from "@/stores/useChessGameStore";
import { useEffect } from "react";
import { formatEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";

interface PaymentModalProps {
  canCancel: boolean;
  multisynqView: any;
  currentPlayerId: string;
}

export function PaymentModal({
  canCancel,
  multisynqView,
  currentPlayerId,
}: PaymentModalProps) {
  const {
    isPending,
    isConfirming,
    isSuccess,
    cancelBettingGame,
    cancelState,
    createBettingGame,
    joinBettingGameByRoom,
  } = useChessBetting();
  const {
    setPaymentStatus,
    setRoomBetAmount,
    gameState,
    betAmount,
    paymentStatus,
    setBettingGameCreationFailed,
    isBettingEnabled,
  } = useChessGameStore();
  const { gameId: gameIdByRoom } = useGameIdByRoom(gameState.roomName);
  const { gameInfo, refetchAll } = useCompleteGameInfo(gameIdByRoom);
  const { switchChain } = useSwitchChain();
  const { chainId, address } = useAccount();
  const isWrongNetwork = chainId !== 10143;

  // ✅ NOUVEAU: Mettre à jour le paymentStatus quand une transaction réussit
  useEffect(() => {
    if (isSuccess && address) {
      console.log("🎉 Transaction réussie - mise à jour du paymentStatus");
      setPaymentStatus((prev) => ({
        ...prev,
        currentPlayerPaid: true,
      }));

      setTimeout(() => {
        refetchAll();
      }, 2000);
    }
  }, [isSuccess, address, setPaymentStatus, refetchAll]);

  // ✅ NOUVEAU: Synchroniser le paymentStatus avec les données du contrat
  useEffect(() => {
    if (gameInfo && address) {
      const isWhitePlayer =
        gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
      const isBlackPlayer =
        gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

      // Le joueur blanc a payé si son adresse n'est pas nulle
      const whitePlayerPaid =
        gameInfo.whitePlayer !== "0x0000000000000000000000000000000000000000";

      // Le joueur noir a payé si son adresse n'est pas nulle
      const blackPlayerPaid =
        gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000";

      // Le joueur courant a payé s'il est l'un des deux joueurs dans le contrat
      const currentPlayerPaid = isWhitePlayer || isBlackPlayer;

      // ✅ Mise à jour du status si nécessaire
      setPaymentStatus((prev) => {
        if (
          prev.whitePlayerPaid !== whitePlayerPaid ||
          prev.blackPlayerPaid !== blackPlayerPaid ||
          prev.currentPlayerPaid !== currentPlayerPaid
        ) {
          console.log("🔄 Synchronisation du paymentStatus avec le contrat:", {
            whitePlayerPaid,
            blackPlayerPaid,
            currentPlayerPaid,
            gameState: gameInfo.state,
          });
          return {
            whitePlayerPaid,
            blackPlayerPaid,
            currentPlayerPaid,
          };
        }
        return prev;
      });
    }
  }, [gameInfo, address, setPaymentStatus]);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
        <div className="text-center">
          <h3 className="text-2xl font-medium text-white mb-6">
            Payment Status
          </h3>

          {/* Informations de paiement et gains */}
          <div className="">
            <div className="flex justify-between text-white text-base mb-2">
              <span className="text-gray-300 font-light">Bet amount:</span>
              <span className="font-medium text-white text-base">
                {gameInfo?.betAmount
                  ? formatEther(gameInfo.betAmount)
                  : betAmount}{" "}
                MON
              </span>
            </div>
            <div className="flex justify-between text-base text-white mb-6">
              <span className="text-gray-300 font-light">
                Potential winnings:
              </span>
              <span className="font-medium text-green-400">
                {gameInfo?.betAmount
                  ? formatEther(gameInfo.betAmount * BigInt(2))
                  : (parseFloat(betAmount) * 2).toString()}{" "}
                MON
              </span>
            </div>
          </div>

          <div className="rounded-lg mb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 px-4 bg-[#252525]  rounded-lg">
                <div className="flex flex-col items-start">
                  <span className="text-white font-normal mb-1">
                    White Player (Creator):
                  </span>
                  <span className="text-gray-400 text-sm font-light">
                    {gameInfo?.whitePlayer
                      ? `${gameInfo.whitePlayer.slice(
                          0,
                          6
                        )}...${gameInfo.whitePlayer.slice(-4)}`
                      : "Waiting..."}
                  </span>
                </div>
                <span
                  className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-light ${
                    paymentStatus.whitePlayerPaid
                      ? "bg-[#836EF9] text-white border border-white/10"
                      : "bg-[#2c2c2c] text-white border border-white/10"
                  }`}
                >
                  {paymentStatus.whitePlayerPaid ? null : (
                    <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                  )}
                  {paymentStatus.whitePlayerPaid ? "READY" : "PENDING"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 px-4 bg-[#252525]  rounded-lg">
                <div className="flex flex-col items-start">
                  <span className="text-white font-normal mb-1">
                    Black Player (Joiner):
                  </span>
                  <span className="text-gray-400 text-sm font-light">
                    {gameInfo?.blackPlayer &&
                    gameInfo.blackPlayer !==
                      "0x0000000000000000000000000000000000000000"
                      ? `${gameInfo.blackPlayer.slice(
                          0,
                          6
                        )}...${gameInfo.blackPlayer.slice(-4)}`
                      : "Waiting for player..."}
                  </span>
                </div>
                <span
                  className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-light ${
                    paymentStatus.blackPlayerPaid
                      ? "bg-[#836EF9] text-white border border-white/10"
                      : "bg-[#2c2c2c] text-white border border-white/10"
                  }`}
                >
                  {paymentStatus.blackPlayerPaid ? null : (
                    <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                  )}
                  {paymentStatus.blackPlayerPaid ? "READY" : "PENDING"}
                </span>
              </div>
            </div>
          </div>

          {!paymentStatus.currentPlayerPaid ? (
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (isWrongNetwork) {
                    try {
                      await switchChain({ chainId: 10143 });
                      setTimeout(() => {
                        console.log("Network switched, ready for payment");
                      }, 1000);
                      return;
                    } catch (error) {
                      console.error("Failed to switch network:", error);
                      alert(
                        "Failed to switch to Monad Testnet. Please switch manually in your wallet."
                      );
                      return;
                    }
                  }

                  console.log("🎮 Debug Bet & Play:", {
                    gameInfo: gameInfo
                      ? {
                          betAmount: gameInfo.betAmount.toString(),
                          state: gameInfo.state,
                          roomName: gameInfo.roomName,
                        }
                      : null,
                    currentBetAmount: betAmount,
                    roomName: gameState.roomName,
                    isBettingEnabled,
                    paymentStatus,
                  });

                  // Cas 1: Création de betting game (pas encore de gameInfo)
                  if (
                    (!gameInfo || gameInfo.betAmount === BigInt(0)) &&
                    isBettingEnabled &&
                    parseFloat(betAmount) > 0
                  ) {
                    try {
                      console.log("💰 Création du betting game:", {
                        amount: betAmount,
                        roomName: gameState.roomName,
                      });
                      await createBettingGame(betAmount, gameState.roomName);
                      setBettingGameCreationFailed(false);
                      setRoomBetAmount(betAmount);

                      // Après création réussie, joindre automatiquement
                      if (multisynqView && currentPlayerId && address) {
                        setTimeout(() => {
                          multisynqView.joinPlayer(address, currentPlayerId);
                          console.log(
                            "Créateur joint Multisynq après création réussie"
                          );
                        }, 2000);
                      }
                    } catch (error) {
                      console.error("Échec création betting game:", error);
                      setBettingGameCreationFailed(true);
                      alert("Failed to create betting game. Please try again.");
                    }
                  }
                  // Cas 2: Join d'un betting game existant
                  else if (
                    gameInfo?.betAmount &&
                    gameInfo.betAmount > BigInt(0)
                  ) {
                    console.log("💰 Tentative de rejoindre le betting game:", {
                      roomName: gameState.roomName,
                      betAmount: gameInfo.betAmount.toString(),
                      gameInfoState: gameInfo.state,
                    });

                    // Vérifier si le jeu est déjà actif (les deux ont payé)
                    if (gameInfo.state === 1) {
                      // ACTIVE
                      console.log("Jeu déjà actif - pas besoin de payer");
                      setPaymentStatus((prev) => ({
                        ...prev,
                        currentPlayerPaid: true,
                      }));
                      return;
                    }

                    try {
                      await joinBettingGameByRoom(
                        gameState.roomName,
                        gameInfo.betAmount
                      );
                      console.log("Paiement réussi pour rejoindre le jeu");
                    } catch (error) {
                      console.error("Échec du paiement:", error);
                      alert("Payment failed. Please try again.");
                    }
                  }
                }}
                disabled={isPending || isConfirming || !gameState.roomName}
                className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
              >
                {isPending || isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2.5" />
                    {isPending ? "Signing..." : "Confirming..."}
                  </>
                ) : isWrongNetwork ? (
                  "Switch to Monad & Pay"
                ) : (
                  "Bet & Play"
                )}
              </button>
            </div>
          ) : (
            <>
              {canCancel && (
                <button
                  onClick={() =>
                    cancelBettingGame(
                      gameIdByRoom as bigint,
                      () => {},
                      (error) => console.error(error)
                    )
                  }
                  className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                  disabled={cancelState.isLoading}
                >
                  {cancelState.isLoading
                    ? "Cancelling..."
                    : `Cancel & Get Refund`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
