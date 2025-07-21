import {
  useChessBetting,
  useCompleteGameInfo,
  useGameIdByRoom,
} from "@/hooks/useChessBetting";
import { useChessStore } from "@/stores/chessStore";
import { useChessGameStore } from "@/stores/useChessGameStore";
import { RematchInvitation } from "@/types/chess";
import { formatEther } from "viem";
import { useAccount } from "wagmi";

interface EndGameModalProps {
  canOfferRematch: () => boolean;
  handleRematchResponse: (accepted: boolean) => void;
  handleAutoJoinRoom: (roomName: string, password: string) => Promise<void>;
  resetClaimState: () => void;
  canCurrentPlayerClaim: () => boolean;
  getAvailableAmount: () => string;
  rematchInvitation: RematchInvitation | null;
  setRematchInvitation: (invitation: RematchInvitation | null) => void;
  handleNewGame: () => void;
  shouldDisableNavigationButtons: () => boolean;
  handleCloseGameEndModal: () => void;
}

export function EndGameModal({
  canOfferRematch,
  handleRematchResponse,
  handleAutoJoinRoom,
  resetClaimState,
  canCurrentPlayerClaim,
  getAvailableAmount,
  rematchInvitation,
  setRematchInvitation,
  handleNewGame,
  shouldDisableNavigationButtons,
  handleCloseGameEndModal,
}: EndGameModalProps) {
  const { gameState, isFinalizingGame, setShowGameEndModal } =
    useChessGameStore();
  const { address } = useAccount();
  const { currentPlayerId } = useChessStore();
  const { gameId } = useGameIdByRoom(gameState.roomName);
  const { gameInfo } = useCompleteGameInfo(gameId);
  const isDraw = gameState.gameResult.type === "draw";
  const {
    isPending,
    isConfirming,
    claimState,
    claimWinnings,
    claimDrawRefund,
  } = useChessBetting();

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {isDraw && (
            <p className="text-gray-400">
              {gameState.gameResult.message || ""}
            </p>
          )}

          <div className={`rounded-lg  flex flex-col justify-center `}>
            <p className="text-white font-bold text-4xl mb-7">
              {gameState.gameResult.winner ===
              gameState.players.find((p) => p.id !== currentPlayerId)?.color
                ? "You Lost"
                : "You Won"}
            </p>
          </div>

          {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
            <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Prize Pool</h4>
                <span className="text-green-400 font-medium">
                  {formatEther(gameInfo.betAmount * BigInt(2))} MON
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span className="text-white text-sm">White</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-xs flex items-center justify-center gap-2 font-light ${
                      gameInfo.whiteClaimed
                        ? "bg-[#836EF9] text-white"
                        : gameInfo.result === 3 || gameInfo.result === 1 // DRAW ou WHITE_WINS
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {isFinalizingGame && (
                      <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-yellow-400" />
                    )}
                    {gameInfo.whiteClaimed
                      ? "Claimed"
                      : gameInfo.result === 3 // DRAW
                      ? "Can claim"
                      : gameInfo.result === 1 // WHITE_WINS
                      ? "Can claim"
                      : "Lost - no claim"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-black border border-white rounded-full"></div>
                    <span className="text-white text-sm">Black</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-xs flex items-center justify-center gap-2 font-light ${
                      gameInfo.blackClaimed
                        ? "bg-[#836EF9] text-white"
                        : gameInfo.result === 3 || gameInfo.result === 2 // DRAW ou BLACK_WINS
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {isFinalizingGame && (
                      <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white/20" />
                    )}

                    {gameInfo.blackClaimed
                      ? "Claimed"
                      : gameInfo.result === 3 // DRAW
                      ? "Can claim"
                      : gameInfo.result === 2 // BLACK_WINS
                      ? "Can claim"
                      : "Lost"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {gameState.rematchOffer?.offered &&
            gameState.rematchOffer?.by !==
              gameState.players.find((p) => p.id === currentPlayerId)?.color ? (
              <div className="text-center space-y-4">
                <p className="text-white/80 font-light text-base text-center">
                  Your opponent offers you a rematch
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleRematchResponse(true)}
                    className="col-span-1 px-8 py-2 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-medium text-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRematchResponse(false)}
                    className="col-span-1 px-8 py-2 bg-[#252525] hover:bg-[#252525] border border-[#836EF9] text-white rounded-lg font-medium text-lg transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                {/* Boutons de claim - TOUJOURS VISIBLES mais disabled quand approprié */}
                <div className="space-y-3">
                  {/* Claim winnings - TOUJOURS AFFICHÉ */}
                  {gameState.gameResult.winner !== "draw" && (
                    <button
                      onClick={async () => {
                        if (gameId && canCurrentPlayerClaim()) {
                          resetClaimState();

                          // CORRECTION: Déterminer le résultat basé sur l'adresse du joueur, pas sa couleur
                          let resultParam: 1 | 2 | 3 = 2; // Par défaut BLACK_WINS

                          if (gameInfo?.result === 1) {
                            resultParam = 1; // WHITE_WINS
                          } else if (gameInfo?.result === 2) {
                            resultParam = 2; // BLACK_WINS
                          } else if (gameInfo?.result === 3) {
                            resultParam = 3; // DRAW
                          }

                          console.log("🎯 Claim avec résultat du contrat:", {
                            gameInfoResult: gameInfo?.result,
                            paramEnvoyé: resultParam,
                            currentPlayerAddress: address,
                            whitePlayerContract: gameInfo?.whitePlayer,
                            blackPlayerContract: gameInfo?.blackPlayer,
                          });

                          await claimWinnings(
                            gameId,
                            resultParam,
                            () => {},
                            (error) => {
                              console.error("Claim failed:", error);
                            }
                          );
                        }
                      }}
                      disabled={
                        !canCurrentPlayerClaim() ||
                        claimState.isLoading ||
                        isPending ||
                        isConfirming ||
                        (gameInfo &&
                          gameInfo.state === 2 &&
                          claimState.isSuccess)
                      }
                      className={`w-full px-6 py-4 ${
                        claimState.isSuccess
                          ? "bg-[#252525] border border-[#836EF9] text-[#836EF9]"
                          : claimState.isError
                          ? "bg-[#252525] border border-[#eb3f3f] text-[#eb3f3f]"
                          : gameInfo && gameInfo.state !== 2
                          ? "bg-[#252525] border border-white/5 text-white"
                          : "bg-[#836EF9] hover:bg-[#836EF9]/80"
                      } disabled:bg-[#252525] text-white rounded-lg border border-white/5 font-medium text-lg transition-colors`}
                    >
                      {!canCurrentPlayerClaim() ? (
                        "No winnings to claim"
                      ) : gameInfo && gameInfo.state !== 2 ? (
                        <div className="flex items-center justify-center gap-2">
                          Finalizing...
                        </div>
                      ) : isPending || isConfirming || claimState.isLoading ? (
                        "Confirming transaction..."
                      ) : claimState.isError ? (
                        "Try again"
                      ) : claimState.isSuccess ? (
                        "Successfully claimed"
                      ) : (
                        `Claim  ${
                          gameInfo?.betAmount
                            ? formatEther(gameInfo.betAmount * BigInt(2))
                            : "0"
                        } MON`
                      )}
                    </button>
                  )}

                  {/* Claim draw refund - TOUJOURS AFFICHÉ si match nul */}
                  {gameState.gameResult.winner === "draw" && (
                    <button
                      onClick={async () => {
                        if (gameId && canCurrentPlayerClaim()) {
                          try {
                            await claimDrawRefund(gameId);
                          } catch (error) {
                            console.error("Claim failed:", error);
                          }
                        }
                      }}
                      disabled={
                        !canCurrentPlayerClaim() ||
                        getAvailableAmount() <= "0" ||
                        isPending ||
                        isConfirming ||
                        (gameInfo &&
                          gameInfo.state === 2 &&
                          claimState.isSuccess)
                      }
                      className={`w-full px-6 py-4 ${
                        gameInfo && gameInfo.state !== 2
                          ? "bg-[#252525] border border-white/5 text-white"
                          : "bg-[#836EF9] hover:bg-[#937EF9]"
                      } disabled:bg-[#252525] text-white rounded-lg font-medium text-base transition-colors`}
                    >
                      {!canCurrentPlayerClaim() ? (
                        "No refund available"
                      ) : getAvailableAmount() <= "0" ? (
                        "Already claimed"
                      ) : gameInfo && gameInfo.state !== 2 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
                          Waiting for game finalization...
                        </div>
                      ) : isPending || isConfirming ? (
                        "Confirming..."
                      ) : (
                        `Claim Refund`
                      )}
                    </button>
                  )}
                </div>
                {/* Accept/Decline seulement si on a reçu une invitation */}
                {rematchInvitation && rematchInvitation.from !== address ? (
                  <div className="space-y-3 mb-3">
                    <p className="text-center text-base text-white/80 font-light">
                      Your opponent offers you a rematch
                      {rematchInvitation.betAmount
                        ? ` for ${rematchInvitation.betAmount} MON`
                        : ""}
                      . <br />
                      Do you want to accept?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={async () => {
                          console.log(
                            "✅ Acceptation du rematch:",
                            rematchInvitation
                          );
                          setRematchInvitation(null);
                          setShowGameEndModal(false);

                          // ✅ NOUVEAU: Rejoindre directement la nouvelle room du rematch
                          try {
                            await handleAutoJoinRoom(
                              rematchInvitation.roomName,
                              rematchInvitation.password
                            );
                            console.log(
                              "🎮 Rejoint la room de rematch avec succès"
                            );
                          } catch (error) {
                            console.error(
                              "❌ Erreur lors du join de rematch:",
                              error
                            );
                          }
                        }}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-base transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          console.log("❌ Refus du rematch");
                          setRematchInvitation(null);
                        }}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-base transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleNewGame}
                      disabled={
                        gameState.rematchOffer?.offered ||
                        shouldDisableNavigationButtons()
                      }
                      className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white disabled:text-white/60 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-medium text-base transition-colors"
                    >
                      {shouldDisableNavigationButtons()
                        ? gameInfo && gameInfo.state !== 2
                          ? "Finalizing..."
                          : gameInfo?.betAmount &&
                            gameInfo.betAmount > BigInt(0) &&
                            canOfferRematch()
                          ? "Rematch"
                          : "New game"
                        : gameState.rematchOffer?.offered
                        ? "Waiting for opponent"
                        : gameInfo?.betAmount &&
                          gameInfo.betAmount > BigInt(0) &&
                          canOfferRematch()
                        ? "Rematch"
                        : "New game"}
                    </button>

                    <button
                      onClick={handleCloseGameEndModal}
                      disabled={shouldDisableNavigationButtons()}
                      className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] disabled:text-white/60 hover:border-white border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-medium text-base transition-colors"
                    >
                      {shouldDisableNavigationButtons()
                        ? gameInfo && gameInfo.state !== 2
                          ? "Finalizing..."
                          : "Analysis"
                        : "Analysis"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
