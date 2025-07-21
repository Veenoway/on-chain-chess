/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { WalletConnection } from "@/components/connect-wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChessGameMain } from "@/hooks/chess/useChessMain";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { formatEther } from "viem";
import { useSwitchChain } from "wagmi";
import CapturedPieces from "./chessboard";

export default function ChessMultisynqApp() {
  const chess = useChessGameMain();

  const {
    // États principaux
    gameState,
    gameFlow,
    currentPlayerId,
    playerColor,
    fen,

    // Interface
    menuActive,
    setMenuActive,
    roomInput,
    setRoomInput,
    selectedGameTime,
    setSelectedGameTime,
    betAmount,
    setBetAmount,
    isBettingEnabled,
    setIsBettingEnabled,
    isCreatingRoom,
    newMessage,
    setNewMessage,

    // Actions
    handleCreateRoom,
    handleJoinRoom,
    handleAutoJoinRoom,
    handleSendMessageWrapper,
    handleOfferDraw,
    handleRespondDraw,
    handleResign,
    handleRematchResponse,
    handleNewGame,
    handleBackHome,

    // Timer
    getCurrentPlayerTime,
    getOpponentTime,

    // Navigation
    goToPreviousMoveWithFen: goToPreviousMove,
    goToNextMoveWithFen: goToNextMove,
    goToFirstMoveWithFen: goToFirstMove,
    goToLastMoveWithFen: goToLastMove,
    currentMoveIndex,
    moveHistory,

    // Échiquier
    chessboardOptions,
    getCheckmatedKingSquare,
    getSquarePosition,

    // Betting
    paymentStatus,
    bothPlayersPaid,
    canCurrentPlayerClaim,
    getAvailableAmount,
    isFinalizingGame,

    // Modals
    showGameEndModal,
    setShowGameEndModal,
    hasClosedPaymentModal,
    rematchInvitation,
    setRematchInvitation,
    shouldDisableNavigationButtons,
    canOfferRematch,
    isRematchTransition,
    setBettingGameCreationFailed,
    multisynqView,

    // États wallet et contract
    isConnected,
    isWrongNetwork,
    address,
    multisynqReady,
    gameInfo,
    gameId,
    isPending,
    isConfirming,
    balanceFormatted,
    claimState,
    resetClaimState,
    cancelState,
    canCancel,
    createBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    cancelBettingGame,
    setRoomBetAmount,
    handleCloseGameEndModal,
    setPaymentStatus,

    // État de reconnexion
    isReconnecting,
  } = chess;

  // États locaux uniquement pour l'UI
  const [copied, setCopied] = useState(false);
  const { switchChain } = useSwitchChain();

  // Fonction wrapper pour envoyer un message
  const handleSendMessage = () => {
    handleSendMessageWrapper(newMessage);
  };

  // Position de l'icône de checkmate
  const checkmateIconPosition = getSquarePosition(
    getCheckmatedKingSquare || ""
  );

  // Interface d'accueil
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br  from-[#101010] via-[#1d1D1d] to-[#0c0c0c] bg-center bg-cover flex items-center justify-center p-4">
        <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/5">
          <div className="text-center">
            <h2 className="text-4xl font-medium text-white mb-4">
              Welcome to SynqMate
            </h2>
            <p className="text-white/80 text-lg font-light mb-8 max-w-[500px] mx-auto">
              SynqMate is a platform for playing chess with friends and betting
              on the outcome.
            </p>
          </div>
          <div className="text-center mb-10">
            <div className="flex items-center justify-center w-full">
              <WalletConnection className="w-full" />
            </div>
          </div>

          {!isConnected ? (
            <p className="text-white text-lg mx-auto text-center">
              Connect your wallet to start playing
            </p>
          ) : (
            <>
              <div className="mx-auto w-full flex items-center justify-center">
                <button
                  onClick={() => setMenuActive("create")}
                  className={`group rounded-t-lg  ${
                    menuActive === "create"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
                  } text-white text-lg font-medium py-4 w-[190px] transition-all duration-200 px-4`}
                >
                  Create Game
                </button>

                <button
                  onClick={() => setMenuActive("join")}
                  className={`group rounded-t-lg  ${
                    menuActive === "join"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
                  } text-white text-lg font-medium py-4 w-[190px] transition-all duration-200 px-4`}
                >
                  Join Game
                </button>
              </div>
              {menuActive === "create" ? (
                <div className="bg-[#252525] rounded-2xl p-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xl font-medium text-white mb-3">
                        Game Settings
                      </label>
                      <Select
                        value={selectedGameTime.toString()}
                        onValueChange={(value) =>
                          setSelectedGameTime(Number(value))
                        }
                      >
                        <SelectTrigger className="w-full text-lg bg-[#2b2b2b] border-white/5 focus:outline-none h-[50px] text-white focus:ring-0 focus:ring-offset-0  focus:ring-0 focus:ring-offset-0 ">
                          <SelectValue
                            placeholder="Select game duration"
                            className="text-lg"
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-[#252525] border-white/10 text-lg text-white">
                          <SelectItem className="text-lg" value="180">
                            3 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="300">
                            5 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="600">
                            10 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="900">
                            15 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="1800">
                            30 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="3600">
                            1 hour
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-medium text-white">
                        Enable Betting
                      </h3>
                      <label className="flex items-center cursor-pointer">
                        <div
                          className={`w-14 h-6 rounded-full transition-colors ${
                            isBettingEnabled ? "bg-[#836EF9]" : "bg-[#2b2b2b]"
                          }`}
                        >
                          <div
                            className={`w-[21px] h-[21px] bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
                              isBettingEnabled
                                ? "translate-x-7 ml-1"
                                : "translate-x-0 ml-0.5"
                            }`}
                          ></div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isBettingEnabled}
                          onChange={(e) =>
                            setIsBettingEnabled(e.target.checked)
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {isBettingEnabled && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          placeholder="Enter bet amount"
                          className="w-full px-4 py-3 focus:outline-none bg-[#2b2b2b] border border-white/5 rounded-lg text-white text-lg focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                        />
                        <div className="text-base text-white font-bold">
                          <span className="font-light text-white/80">
                            Balance:
                          </span>{" "}
                          {balanceFormatted?.split(".")?.[0] +
                            "." +
                            balanceFormatted?.split(".")?.[1]?.slice(0, 2)}{" "}
                          MON
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleCreateRoom}
                      disabled={
                        isCreatingRoom || !multisynqReady || isWrongNetwork
                      }
                      className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-4 px-6 rounded-xl text-lg transition-all"
                    >
                      {isWrongNetwork
                        ? "Switch to Monad & Create"
                        : isCreatingRoom
                        ? "Creating..."
                        : !multisynqReady
                        ? "Loading Multisynq..."
                        : "Create Game"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className=" text-center">
                  <div className="bg-[#252525] rounded-2xl p-8 pt-6">
                    <label className="block text-xl font-medium text-left text-white  mb-3">
                      {" "}
                      Room Code
                    </label>
                    <input
                      type="text"
                      placeholder="Enter room code (e.g. room:password)"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      className="w-full p-4 bg-[#2b2b2b] focus:outline-none border border-white/5 text-white rounded-lg text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={
                        !roomInput.trim() ||
                        !multisynqReady ||
                        isPending ||
                        isWrongNetwork
                      }
                      className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-4 px-6 rounded-xl text-lg transition-all"
                    >
                      {isWrongNetwork
                        ? "Switch to Monad & Join"
                        : isPending
                        ? "Processing..."
                        : "Join Game"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {isConnected && isWrongNetwork && (
            <div className="mt-8 bg-red-500/20 border border-red-400 rounded-xl p-6">
              <div className="text-center">
                <h3 className="text-red-300 font-medium text-xl mb-3">
                  Wrong Network Detected
                </h3>
                <p className="text-red-200 text-lg mb-4">
                  Please switch to <strong>Monad Testnet</strong> to use betting
                  features
                </p>
                <button
                  onClick={async () => {
                    try {
                      await switchChain({ chainId: 10143 });
                    } catch {}
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-lg transition-colors"
                >
                  Switch to Monad Testnet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  //   const isWinner =
  //     gameState.gameResult.winner ===
  //     gameState.players.find((p) => p.id === currentPlayerId)?.color;

  const isDraw = gameState.gameResult.winner === "draw";

  return (
    <div className="min-h-screen font-light bg-gradient-to-br  from-[#101010] via-[#1f1f1f] to-[#0c0c0c] p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 my-8 ">
          <div className="w-full">
            <div className="flex items-center justify-between w-full gap-3">
              {/* <img src="/synqmate.png" alt="logo" className=" w-[240px]" /> */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Panel central - Échiquier */}
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="lg:col-span-3">
                <div className="rounded-xl">
                  {/* Pièces capturées par l'adversaire (en haut) */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center justify-between">
                      {gameState.players.find(
                        (entry) => entry.wallet !== address
                      ) ? (
                        <div
                          key={
                            gameState.players.find(
                              (entry) => entry.wallet !== address
                            )?.id
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-xl text-white flex items-center gap-2">
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(0, 6)}
                                ...
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(-4)}
                                {/* Indicateur de connexion */}
                                {gameState.players.find(
                                  (entry) => entry.wallet !== address
                                )?.connected ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={true}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white flex items-center gap-1">
                              <span className="animate-[bounce_1s_infinite] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.2s] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.4s] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.6s] text-xl ml-2">
                                Waiting for opponent
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className={`backdrop-blur-md rounded-lg px-3 py-1 border ${
                        getOpponentTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-xl font-medium ${
                          getOpponentTime() <= 30
                            ? "text-red-500"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getOpponentTime() / 60)}:
                        {(getOpponentTime() % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  <div className="relative aspect-square max-w-full w-full mx-auto">
                    <Chessboard options={chessboardOptions as any} />

                    {checkmateIconPosition && getCheckmatedKingSquare && (
                      <div
                        className="absolute pointer-events-none z-1"
                        style={{
                          left: `${checkmateIconPosition.left}px`,
                          top: `${checkmateIconPosition.top}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="relative z-[0] animate-in zoom-in-50 duration-200">
                          <div className="absolute inset-0 w-10 h-10 bg-red-500 rounded-full opacity-40 animate-ping -translate-x-1/2 -translate-y-1/2 z-[0]" />
                          <div className="absolute inset-0 w-8 h-8 bg-red-600 rounded-full opacity-95 -translate-x-1/2 -translate-y-1/2 z-[0]">
                            <div className="relative text-xl text-white font-medium flex items-center justify-center w-8 h-8 ">
                              ✗
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {((isBettingEnabled &&
                      parseFloat(betAmount) > 0 &&
                      gameState.roomName &&
                      !bothPlayersPaid()) ||
                      (gameInfo?.betAmount &&
                        gameInfo.betAmount > BigInt(0) &&
                        !bothPlayersPaid()) ||
                      (gameState.rematchAccepted &&
                        isBettingEnabled &&
                        parseFloat(betAmount) > 0 &&
                        !bothPlayersPaid()) ||
                      (isRematchTransition &&
                        isBettingEnabled &&
                        parseFloat(betAmount) > 0) ||
                      // ✅ NOUVEAU: Afficher pour les rooms de rematch
                      (gameState.roomName &&
                        gameState.roomName.startsWith("rematch-") &&
                        gameInfo?.betAmount &&
                        gameInfo.betAmount > BigInt(0) &&
                        !bothPlayersPaid())) &&
                      !hasClosedPaymentModal &&
                      gameFlow === "game" &&
                      gameState.gameResult.type === null && // ✅ Ne pas afficher si jeu terminé
                      !gameState.isActive && ( // ✅ Ne pas afficher si jeu déjà actif
                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
                          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
                            <div className="text-center">
                              <h3 className="text-2xl font-medium text-white mb-6">
                                Payment Status
                              </h3>

                              {/* Informations de paiement et gains */}
                              <div className="">
                                <div className="flex justify-between text-white text-base mb-2">
                                  <span className="text-gray-300">
                                    Bet amount:
                                  </span>
                                  <span className="font-medium text-white text-base">
                                    {gameInfo?.betAmount
                                      ? formatEther(gameInfo.betAmount)
                                      : betAmount}{" "}
                                    MON
                                  </span>
                                </div>
                                <div className="flex justify-between text-base text-white mb-6">
                                  <span className="text-gray-300">
                                    Potential winnings:
                                  </span>
                                  <span className="font-semibold text-green-400">
                                    {gameInfo?.betAmount
                                      ? formatEther(
                                          gameInfo.betAmount * BigInt(2)
                                        )
                                      : (
                                          parseFloat(betAmount) * 2
                                        ).toString()}{" "}
                                    MON
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-lg mb-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded-lg">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white text-base font-normal mb-0.5">
                                        White Player (Creator):
                                      </span>
                                      <span className="text-gray-400 text-sm">
                                        {gameInfo?.whitePlayer
                                          ? `${gameInfo.whitePlayer.slice(
                                              0,
                                              6
                                            )}...${gameInfo.whitePlayer.slice(
                                              -4
                                            )}`
                                          : "Waiting..."}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-normal ${
                                        paymentStatus.whitePlayerPaid
                                          ? "bg-[#836EF9] text-white border border-white/10"
                                          : "bg-[#2c2c2c] text-white border border-white/10"
                                      }`}
                                    >
                                      {paymentStatus.whitePlayerPaid ? null : (
                                        <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                                      )}
                                      {paymentStatus.whitePlayerPaid
                                        ? "READY"
                                        : "PENDING"}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded-lg">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white text-base font-normal mb-0.5">
                                        Black Player (Joiner):
                                      </span>
                                      <span className="text-gray-400 text-sm">
                                        {gameInfo?.blackPlayer &&
                                        gameInfo.blackPlayer !==
                                          "0x0000000000000000000000000000000000000000"
                                          ? `${gameInfo.blackPlayer.slice(
                                              0,
                                              6
                                            )}...${gameInfo.blackPlayer.slice(
                                              -4
                                            )}`
                                          : "Waiting for player..."}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-normal ${
                                        paymentStatus.blackPlayerPaid
                                          ? "bg-[#836EF9] text-white border border-white/10"
                                          : "bg-[#2c2c2c] text-white border border-white/10"
                                      }`}
                                    >
                                      {paymentStatus.blackPlayerPaid ? null : (
                                        <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                                      )}
                                      {paymentStatus.blackPlayerPaid
                                        ? "READY"
                                        : "PENDING"}
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

                                          return;
                                        } catch {
                                          return;
                                        }
                                      }

                                      // Cas 1: Création de betting game (pas encore de gameInfo)
                                      if (
                                        (!gameInfo ||
                                          gameInfo.betAmount === BigInt(0)) &&
                                        isBettingEnabled &&
                                        parseFloat(betAmount) > 0
                                      ) {
                                        try {
                                          await createBettingGame(
                                            betAmount,
                                            gameState.roomName
                                          );
                                          setBettingGameCreationFailed(false);
                                          setRoomBetAmount(betAmount);

                                          if (
                                            multisynqView &&
                                            currentPlayerId &&
                                            address
                                          ) {
                                            setTimeout(() => {
                                              multisynqView.joinPlayer(
                                                address,
                                                currentPlayerId
                                              );
                                            }, 2000);
                                          }
                                        } catch {
                                          setBettingGameCreationFailed(true);
                                        }
                                      } else if (
                                        gameInfo?.betAmount &&
                                        gameInfo.betAmount > BigInt(0)
                                      ) {
                                        if (gameInfo.state === 1) {
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
                                        } catch {}
                                      }
                                    }}
                                    disabled={
                                      isPending ||
                                      isConfirming ||
                                      !gameState.roomName
                                    }
                                    className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                  >
                                    {isPending || isConfirming ? (
                                      <>
                                        {isPending
                                          ? "Signing..."
                                          : "Confirming..."}
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
                                  {canCancel ? (
                                    <>
                                      {cancelState.isLoading ? (
                                        <button
                                          disabled
                                          className="w-full mt-5 px-6 py-4 bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                        >
                                          {cancelState.txHash
                                            ? "Confirming..."
                                            : "Cancelling..."}
                                        </button>
                                      ) : cancelState.isSuccess ? (
                                        <button
                                          disabled
                                          className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                        >
                                          Back to Home
                                        </button>
                                      ) : cancelState.isError ? (
                                        <button
                                          onClick={() =>
                                            cancelBettingGame(gameId as bigint)
                                          }
                                          className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                        >
                                          Retry Cancel
                                          {cancelState.error && (
                                            <span className="ml-2 text-sm">
                                              ({cancelState.error})
                                            </span>
                                          )}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            cancelBettingGame(gameId as bigint)
                                          }
                                          className="w-full mt-5 px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-medium text-lg transition-colors"
                                        >
                                          Cancel & Get Refund
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      onClick={handleBackHome}
                                      className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                    >
                                      Back to Home
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Indicateur de mode analyse */}
                    {((gameState.gameResult.type && !showGameEndModal) ||
                      (gameState.isActive &&
                        currentMoveIndex < moveHistory.length - 1)) && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="bg-[#252525] backdrop-blur-sm px-3 py-1 flex items-center rounded-lg border border-white/10 shadow-xl">
                          <div className="bg-yellow-300 h-2.5 w-2.5 rounded-full animate-pulse" />
                          <span className="text-white text-sm font-medium ml-2">
                            {gameState.gameResult.type
                              ? "Analysis mode"
                              : "Analysis mode"}
                            {moveHistory.length > 1 &&
                              currentMoveIndex < moveHistory.length - 1 && (
                                <span className="ml-2 text-yellow-300">
                                  (Move {currentMoveIndex}/
                                  {moveHistory.length - 1})
                                </span>
                              )}
                          </span>
                        </div>
                      </div>
                    )}

                    {gameState.isActive &&
                      currentMoveIndex < moveHistory.length - 1 && (
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={goToLastMove}
                            className="bg-[#836EF9]/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#836EF9] text-white text-sm font-medium hover:bg-[#836EF9] transition-colors"
                          >
                            Back to game
                          </button>
                        </div>
                      )}

                    {/* MODAL ENDGAME */}
                    {showGameEndModal && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
                        <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                          <div className="text-center">
                            {/* <h3
                              className={`text-4xl uppercase font-extrabold mb-6 ${
                                isWinner
                                  ? "text-white"
                                  : isDraw
                                  ? "text-white"
                                  : "text-white"
                              }`}
                            >
                              {isWinner
                                ? "You Win"
                                : isDraw
                                ? "Draw"
                                : "You Lost"}
                            </h3> */}

                            {isDraw && (
                              <p className="text-gray-400">
                                {gameState.gameResult.message || ""}
                              </p>
                            )}

                            {/* {gameState.gameResult.winner ===
                            gameState.players.find(
                              (p) => p.id !== currentPlayerId
                            )?.color ? (
                              <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/loser.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="w-2/3 mx-auto"
                              />
                            ) : gameState.gameResult.winner === "draw" ? (
                              <img
                                src="/draw.png"
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            ) : (
                              <img
                                src={"/win.png"}
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            )} */}

                            <div
                              className={`rounded-lg  flex flex-col justify-center `}
                            >
                              <p className="text-white font-bold text-4xl mb-7">
                                {gameState.gameResult.winner ===
                                gameState.players.find(
                                  (p) => p.id !== currentPlayerId
                                )?.color
                                  ? "You Lost"
                                  : "You Won"}
                              </p>
                              {/* <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/loser.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="h-[300px] mx-auto"
                              /> */}
                            </div>

                            {/* NOUVEAU: Affichage des claims si il y a un pari */}
                            {gameInfo?.betAmount &&
                              gameInfo.betAmount > BigInt(0) && (
                                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-white font-medium text-base">
                                      Prize Pool:
                                    </h4>
                                    <span className="text-green-400 font-bold text-base">
                                      {formatEther(
                                        gameInfo.betAmount * BigInt(2)
                                      )}{" "}
                                      MON
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {/* White Player Claim Status */}
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
                                        <span className="text-white text-sm font-normal">
                                          White
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs flex items-center justify-center gap-2 font-normal ${
                                          gameInfo.whiteClaimed
                                            ? "bg-[#836EF9] text-white"
                                            : gameInfo.result === 3 ||
                                              gameInfo.result === 1 // DRAW ou WHITE_WINS
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        }`}
                                      >
                                        {isFinalizingGame && (
                                          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white/90" />
                                        )}
                                        {gameInfo.whiteClaimed
                                          ? "Claimed"
                                          : gameInfo.result === 3 // DRAW
                                          ? "Can claim"
                                          : gameInfo.result === 1 // WHITE_WINS
                                          ? "Can claim"
                                          : isFinalizingGame
                                          ? "Loading..."
                                          : "Lost"}
                                      </span>
                                    </div>

                                    {/* Black Player Claim Status */}
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-black border border-white rounded-full"></div>
                                        <span className="text-white text-sm font-normal">
                                          Black
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs flex items-center justify-center gap-2 font-normal ${
                                          gameInfo.blackClaimed
                                            ? "bg-[#836EF9] text-white"
                                            : gameInfo.result === 3 ||
                                              gameInfo.result === 2 // DRAW ou BLACK_WINS
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        }`}
                                      >
                                        {isFinalizingGame && (
                                          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white/90" />
                                        )}

                                        {gameInfo.blackClaimed
                                          ? "Claimed"
                                          : gameInfo.result === 3 // DRAW
                                          ? "Can claim"
                                          : gameInfo.result === 2 // BLACK_WINS
                                          ? "Can claim"
                                          : isFinalizingGame
                                          ? "Loading..."
                                          : "Lost"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                            <div className="space-y-4">
                              {gameState.rematchOffer?.offered &&
                              gameState.rematchOffer?.by !==
                                gameState.players.find(
                                  (p) => p.id === currentPlayerId
                                )?.color ? (
                                <div className="text-center space-y-4">
                                  <p className="text-white/80 font-light text-base text-center">
                                    Your opponent offers you a rematch
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <button
                                      onClick={() =>
                                        handleRematchResponse(true)
                                      }
                                      className="col-span-1 px-8 py-2 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-medium text-lg transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRematchResponse(false)
                                      }
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
                                          if (
                                            gameId &&
                                            canCurrentPlayerClaim()
                                          ) {
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

                                            await claimWinnings(
                                              gameId,
                                              resultParam,
                                              () => {},
                                              (error) => {
                                                console.error(
                                                  "Claim failed:",
                                                  error
                                                );
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
                                        } disabled:bg-[#252525] text-white rounded-lg border border-white/5 font-normal text-base transition-colors`}
                                      >
                                        {!canCurrentPlayerClaim() ? (
                                          "Waiting for opponent..."
                                        ) : gameInfo && gameInfo.state !== 2 ? (
                                          <div className="flex items-center justify-center gap-2">
                                            Waiting for game finalization...
                                          </div>
                                        ) : isPending ||
                                          isConfirming ||
                                          claimState.isLoading ? (
                                          "Confirming transaction..."
                                        ) : claimState.isError ? (
                                          "Try again"
                                        ) : claimState.isSuccess ? (
                                          "Successfully claimed"
                                        ) : (
                                          `Claim  ${
                                            gameInfo?.betAmount
                                              ? formatEther(
                                                  gameInfo.betAmount * BigInt(2)
                                                )
                                              : "0"
                                          } MON`
                                        )}
                                      </button>
                                    )}

                                    {/* Claim draw refund - TOUJOURS AFFICHÉ si match nul */}
                                    {gameState.gameResult.winner === "draw" && (
                                      <button
                                        onClick={async () => {
                                          if (
                                            gameId &&
                                            canCurrentPlayerClaim()
                                          ) {
                                            try {
                                              await claimDrawRefund(gameId);
                                            } catch (error) {
                                              console.error(
                                                "Claim failed:",
                                                error
                                              );
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
                                        } disabled:bg-[#252525] text-white rounded-lg font-normal text-base transition-colors`}
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
                                  {rematchInvitation &&
                                  rematchInvitation.from !== address ? (
                                    <div className="space-y-3 mb-3">
                                      <p className="text-center text-base text-white/80 font-thin">
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
                                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-normal text-base transition-colors"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          onClick={() => {
                                            console.log("❌ Refus du rematch");
                                            setRematchInvitation(null);
                                          }}
                                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-normal text-base transition-colors"
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
                                        className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-base transition-colors"
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
                                        className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-base transition-colors"
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
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-3">
                    {gameState.players.map((player) =>
                      player.id === currentPlayerId ? (
                        <div key={player.id} className="rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-xl text-white flex items-center gap-2">
                                {player.wallet.slice(0, 6)}...
                                {player.wallet.slice(-4)} (You)
                                {player.connected && !isReconnecting ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={false}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null
                    )}

                    <div
                      className={`backdrop-blur-md rounded-lg px-3 py-1 border ${
                        getCurrentPlayerTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-xl font-medium ${
                          getCurrentPlayerTime() <= 30
                            ? "text-red-500"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getCurrentPlayerTime() / 60)}:
                        {(getCurrentPlayerTime() % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Panel de droite - Chat */}
          <div className="lg:col-span-2">
            <div className="rounded-lg  full flex flex-col h-[800px]  ">
              <div className="bg-[#1E1E1E] p-3 border border-white/5 rounded-lg mb-3">
                <div className="flex items-center gap-2 mt-1 mb-1 justify-between">
                  <div>
                    <p className="text-white font-medium text-lg ml-2.5">
                      Invite friend
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(
                          `${window.location.origin}${
                            window.location.pathname
                          }?room=${gameState.roomName}${
                            gameState.roomPassword
                              ? `&password=${gameState.roomPassword}`
                              : ""
                          }`
                        )
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                    }}
                    className="px-2 py-1 text-sm flex items-center gap-2 bg-[#836EF9] hover:bg-[#836EF9]/90 text-white rounded-lg transition-colors duration-300 ease-in-out"
                  >
                    Copy Link
                    {copied ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <CopyIcon className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Affichage des informations de pari */}
                </div>
                {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
                  <div className="px-3 pt-2 border-t border-white/10 mt-2">
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white text-lg font-medium">
                        Prize Pool
                      </span>
                      <span className="text-green-400 text-lg font-medium">
                        {getAvailableAmount() > "0"
                          ? getAvailableAmount()
                          : "0"}{" "}
                        MON
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-t-lg px-3 pt-2 bg-[#1E1E1E] border border-b-2 border-white/5">
                <h3 className="text-base font-medium text-white mb-2">
                  Nads Chat
                </h3>
              </div>
              <div
                className="overflow-y-auto space-y-2 h-full flex-1 bg-[#1a1a1a] border border-b-0 border-t-0 border-white/5 relative px-3 py-2"
                ref={(el) => {
                  if (el) {
                    el.scrollTop = el.scrollHeight;
                  }
                }}
              >
                {gameState.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg py-2  ${
                      msg.playerWallet === address
                        ? "bg-[#836EF9]/40"
                        : "bg-neutral-800"
                    } border p-3 border-white/5`}
                  >
                    <div
                      className={`text-sm mb-[5px]   ${
                        msg.playerWallet === address
                          ? "text-white font-medium"
                          : "text-white/50"
                      }`}
                    >
                      {msg.playerWallet === address
                        ? "You"
                        : msg.playerWallet.slice(0, 6) +
                          "..." +
                          msg.playerWallet.slice(-4)}
                    </div>
                    <div className="text-white/90 font-light text-sm">
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 bg-[#1a1a1a] border border-t-0 border-white/5 rounded-b-lg px-3 py-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Gmonad"
                  disabled={
                    gameInfo?.betAmount !== undefined &&
                    gameInfo.betAmount > BigInt(0) &&
                    !(
                      (playerColor === "white" &&
                        gameInfo.whitePlayer.toLowerCase() ===
                          address?.toLowerCase()) ||
                      (playerColor === "black" &&
                        gameInfo.blackPlayer.toLowerCase() ===
                          address?.toLowerCase())
                    )
                  }
                  className="flex-1 px-3 h-[40px] bg-[#252525] min-w-[200px] border font-light border-white/5 text-white text-sm placeholder-white/70 focus:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={
                    !newMessage.trim() ||
                    (gameInfo?.betAmount !== undefined &&
                      gameInfo.betAmount > BigInt(0) &&
                      !(
                        (playerColor === "white" &&
                          gameInfo.whitePlayer.toLowerCase() ===
                            address?.toLowerCase()) ||
                        (playerColor === "black" &&
                          gameInfo.blackPlayer.toLowerCase() ===
                            address?.toLowerCase())
                      ))
                  }
                  className="px-4 h-[40px] bg-[#836EF9] border border-white/5 text-white rounded-lg text-sm font-light transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              {/* Box persistante - toujours visible */}
              <div className="space-y-3 mt-3">
                <div className="p-3 bg-[#1E1E1E] border border-white/5 rounded-lg">
                  {gameState.isActive ? (
                    // ========== PARTIE EN COURS ==========
                    <div className="space-y-3">
                      {gameState.drawOffer.offered &&
                      gameState.drawOffer.by !==
                        gameState.players.find((p) => p.id === currentPlayerId)
                          ?.color ? (
                        // Répondre à une offre de match nul
                        <div>
                          <p className="text-white text-sm text-center mb-3">
                            Your opponent offers a draw
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleRespondDraw(true)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-base transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondDraw(false)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Boutons normaux pendant la partie
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleOfferDraw}
                            disabled={
                              gameState.drawOffer.offered ||
                              (gameInfo?.betAmount !== undefined &&
                                gameInfo.betAmount > BigInt(0) &&
                                !(
                                  (playerColor === "white" &&
                                    gameInfo.whitePlayer.toLowerCase() ===
                                      address?.toLowerCase()) ||
                                  (playerColor === "black" &&
                                    gameInfo.blackPlayer.toLowerCase() ===
                                      address?.toLowerCase())
                                ))
                            }
                            className="px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            {gameState.drawOffer.offered
                              ? "Draw offer sent"
                              : "Offer draw"}
                          </button>
                          <button
                            onClick={handleResign}
                            disabled={
                              gameInfo?.betAmount !== undefined &&
                              gameInfo.betAmount > BigInt(0) &&
                              !(
                                (playerColor === "white" &&
                                  gameInfo.whitePlayer.toLowerCase() ===
                                    address?.toLowerCase()) ||
                                (playerColor === "black" &&
                                  gameInfo.blackPlayer.toLowerCase() ===
                                    address?.toLowerCase())
                              )
                            }
                            className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#836EF9] text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Resign
                          </button>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/10">
                        <p className="text-gray-400 text-xs mb-2 text-center">
                          Navigation: Move {currentMoveIndex}/
                          {moveHistory.length - 1}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={goToFirstMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏭
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : gameState.gameResult.type ? (
                    // ========== PARTIE TERMINÉE ==========
                    <div className="space-y-3">
                      {rematchInvitation &&
                      rematchInvitation.from !== address ? (
                        <div>
                          <p className="text-white/80 font-light text-sm text-center mb-2">
                            Your opponent offers you a rematch
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleRematchResponse(true)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRematchResponse(false)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={handleNewGame}
                            disabled={
                              gameState.rematchOffer?.offered ||
                              shouldDisableNavigationButtons()
                            }
                            className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            {shouldDisableNavigationButtons()
                              ? gameInfo && gameInfo.state !== 2
                                ? "Finalizing..."
                                : "Claim first"
                              : gameState.rematchOffer?.offered
                              ? "Waiting "
                              : gameInfo?.betAmount &&
                                gameInfo.betAmount > BigInt(0) &&
                                canOfferRematch()
                              ? "Rematch"
                              : "New game"}
                          </button>
                        </div>
                      )}

                      {/* Navigation après la partie */}
                      <div
                        className="pt-3 border-t border-white/10 "
                        onClick={() => {
                          if (!shouldDisableNavigationButtons()) {
                            setShowGameEndModal(false);
                          }
                        }}
                      >
                        <p className="text-gray-400 text-xs mb-2 text-center">
                          Navigation: Move {currentMoveIndex}/
                          {moveHistory.length - 1}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={goToFirstMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏭
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-[#a494fb]">
                        {gameState.players.length >= 2
                          ? "Starting game..."
                          : "Waiting for second player"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
