/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { WalletConnection } from "@/components/connect-wallet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChessMain } from "@/hooks/chess/useChessMain";
import { MatchFound } from "@/types/matchmaking";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { formatEther } from "viem";
import { useSwitchChain } from "wagmi";
import CapturedPieces from "../../components/captured-pieces";
import { MatchmakingScreen } from "../../components/matchmaking-screen";

export default function ChessMultisynqApp() {
  const chess = useChessMain();
  const [isResignPopoverOpen, setIsResignPopoverOpen] = useState(false);

  const {
    gameState,
    gameFlow,
    currentPlayerId,
    playerColor,
    fen,
    menuActive,
    setMenuActive,
    selectedGameTime,
    setSelectedGameTime,
    betAmount,
    isBettingEnabled,
    newMessage,
    setNewMessage,
    handleAutoJoinRoom,
    handleSendMessageWrapper,
    handleOfferDraw,
    handleRespondDraw,
    handleResign,
    handleNewGame,
    handleBackHome,

    getCurrentPlayerTime,
    getOpponentTime,

    goToPreviousMoveWithFen,
    goToNextMoveWithFen,
    goToFirstMoveWithFen,
    goToLastMoveWithFen,
    currentMoveIndex,
    moveHistory,

    chessboardOptions,

    paymentStatus,
    bothPlayersPaid,
    canCurrentPlayerClaim,
    getAvailableAmount,
    isFinalizingGame,

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
    rematchCreating,

    isWrongNetwork,
    address,
    gameInfo,
    gameId,
    isPending,
    isConfirming,
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

    isReconnecting,
  } = chess;

  const [copied, setCopied] = useState(false);
  const { switchChain } = useSwitchChain();

  const handleSendMessage = () => {
    handleSendMessageWrapper(newMessage);
  };

  const handleMatchFound = async (match: MatchFound) => {
    try {
      (window as any).matchFoundDetails = {
        roomName: match.roomName,
        password: match.roomPassword,
        gameTime: match.gameTime,
        betAmount: match.betAmount,
      };

      await fetch("/api/matchmaking/leave-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: chess.address }),
      }).catch(() => {});

      chess.setGameFlow("game");
      await chess.handleAutoJoinRoom(match.roomName, match.roomPassword);
    } catch (error) {
      console.error("Failed to join matched game:", error);
    }
  };

  const handleCancelMatchmaking = () => {
    chess.setGameFlow("welcome");
  };

  if (chess.gameFlow === "matchmaking") {
    return (
      <MatchmakingScreen
        onMatchFound={handleMatchFound}
        onCancel={handleCancelMatchmaking}
      />
    );
  }

  if (chess.gameFlow === "welcome") {
    return (
      <div
        className={`min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] bg-center bg-cover flex justify-center p-4 ${
          chess.isConnected
            ? "pt-[50px] sm:pt-[10vh] lg:pt-[14vh]"
            : "items-center"
        }`}
      >
        <div
          className={`w-[90%] ${!chess.isConnected ? "max-w-5xl" : "max-w-xl"}`}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl uppercase md:leading-[80px] font-bold text-white mb-2">
              {!chess.isConnected
                ? "Welcome to SynqMate"
                : menuActive === "create"
                ? "Create Game"
                : menuActive === "join"
                ? "Join Game"
                : "Matchmaking"}
            </h1>
            <p className="text-white/80 text-base md:text-xl mt-3 mx-auto md:max-w-[80%]">
              {!chess.isConnected
                ? "SynqMate is a chess game on Monad that allows you to find a match, bet and win crypto while playing chess."
                : menuActive === "create"
                ? "Create a game and invite your friends to play."
                : menuActive === "join"
                ? "Join a game and play with your friends."
                : menuActive === "matchmaking"
                ? "Find a match, bet and win crypto while playing chess."
                : "Find a match, bet and win crypto while playing chess."}
            </p>
          </div>

          <div className="text-center mb-6">
            <WalletConnection />
          </div>

          {!chess.isConnected ? (
            <p className="text-white text-sm md:text-lg mx-auto text-center mt-10">
              Connect your wallet to start playing
            </p>
          ) : (
            <>
              <div className="mx-auto w-full flex items-center justify-center mb-3 gap-3 mt-5">
                <button
                  onClick={() => setMenuActive("create")}
                  className={`group rounded-lg  ${
                    menuActive === "create"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525] text-white "
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E] hover:bg-[#252525] text-white/60 hover:text-white"
                  }  text-sm md:text-lg font-normal md:py-4 py-2 w-[190px] transition-all duration-200 px-4`}
                >
                  Create
                </button>

                <button
                  onClick={() => setMenuActive("join")}
                  className={`group rounded-lg  ${
                    menuActive === "join"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525] text-white"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E] hover:bg-[#252525] text-white/60 hover:text-white"
                  }  text-sm md:text-lg font-normal md:py-4 py-2 w-[190px] transition-all duration-200 px-4`}
                >
                  Join Game
                </button>

                <button
                  onClick={() => setMenuActive("matchmaking")}
                  className={`group rounded-lg  ${
                    menuActive === "matchmaking"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525] text-white"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E] hover:bg-[#252525] text-white/60 hover:text-white"
                  }  text-sm md:text-lg font-normal md:py-4 py-2 w-[190px] transition-all duration-200 px-4`}
                >
                  Matchmaking
                </button>
              </div>

              {/* Container avec animation slide */}
              <div className="relative overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{
                    transform: `translateX(-${
                      menuActive === "create"
                        ? 0
                        : menuActive === "join"
                        ? 100
                        : 200
                    }%)`,
                  }}
                >
                  {/* Section Create */}
                  <div className="w-full flex-shrink-0">
                    <div className="text-center">
                      <div className="md:bg-[#1E1E1E] border border-white/5 rounded-lg p-0 md:p-8 pt-6">
                        <label className="block text-lg md:text-xl font-medium text-left text-white mb-3">
                          Game Time
                        </label>
                        <Select
                          value={selectedGameTime.toString()}
                          onValueChange={(value) =>
                            setSelectedGameTime(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-full p-4 h-12 bg-[#252525] focus:outline-none border border-white/5 text-white rounded-lg text-sm md:text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#252525] border border-white/10">
                            <SelectItem
                              value="180"
                              className="text-white hover:bg-white/10 text-sm md:text-base"
                            >
                              3 minutes
                            </SelectItem>
                            <SelectItem
                              value="300"
                              className="text-white hover:bg-white/10 text-sm md:text-base"
                            >
                              5 minutes
                            </SelectItem>
                            <SelectItem
                              value="600"
                              className="text-white hover:bg-white/10 text-sm md:text-base"
                            >
                              10 minutes
                            </SelectItem>
                            <SelectItem
                              value="900"
                              className="text-white hover:bg-white/10 text-sm md:text-base"
                            >
                              15 minutes
                            </SelectItem>
                            <SelectItem
                              value="1800"
                              className="text-white hover:bg-white/10 text-sm md:text-base"
                            >
                              30 minutes
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center justify-between mb-4 mt-5">
                          <label className="text-lg md:text-xl font-medium text-white">
                            Enable Betting
                          </label>
                          <button
                            onClick={() =>
                              chess.setIsBettingEnabled(!chess.isBettingEnabled)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              chess.isBettingEnabled
                                ? "bg-[#836EF9]"
                                : "bg-gray-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                chess.isBettingEnabled
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        {chess.isBettingEnabled && (
                          <div className="mb-4">
                            <label className="block text-sm md:text-base font-light text-white/80 text-left mb-3">
                              Bet Amount (MON)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="^[0-9]*\.?[0-9]*$"
                              value={chess.betAmount}
                              onChange={(e) =>
                                chess.setBetAmount(e.target.value)
                              }
                              className="w-full px-4 py-2 h-12 bg-[#2b2b2b] focus:outline-none border border-white/5 text-white rounded-lg text-sm md:text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                              placeholder="1.0"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => {
                            if (chess.isConnected && chess.isWrongNetwork) {
                              try {
                                switchChain({ chainId: 10143 });
                              } catch {}
                            } else {
                              chess.handleCreateRoom();
                            }
                          }}
                          disabled={
                            chess.isCreatingRoom || !chess.multisynqReady
                          }
                          className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-4 px-6 rounded-xl text-sm md:text-lg transition-all"
                        >
                          {chess.isWrongNetwork
                            ? "Switch to Monad & Create"
                            : chess.isCreatingRoom
                            ? "Creating..."
                            : !chess.multisynqReady
                            ? "Loading Multisynq..."
                            : "Create Game"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section Join */}
                  <div className="w-full flex-shrink-0">
                    <div className="text-center">
                      <div className="md:bg-[#1E1E1E] border border-white/5 rounded-lg p-0 md:p-8 pt-6">
                        <label className="block text-lg md:text-xl font-medium text-left text-white  mb-3">
                          Room Code
                        </label>
                        <input
                          type="text"
                          placeholder="Enter room code (e.g. room:password)"
                          value={chess.roomInput}
                          onChange={(e) => chess.setRoomInput(e.target.value)}
                          className="w-full p-4 bg-[#252525] focus:outline-none border border-white/5 text-white rounded-lg text-sm md:text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                        />
                        <button
                          onClick={chess.handleJoinRoom}
                          disabled={
                            !chess.roomInput.trim() ||
                            !chess.multisynqReady ||
                            chess.isPending ||
                            chess.isWrongNetwork
                          }
                          className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[#252525] disabled:to-[#252525] text-white font-medium py-4 px-6 rounded-xl text-sm md:text-lg transition-all"
                        >
                          {chess.isWrongNetwork
                            ? "Switch to Monad & Join"
                            : chess.isPending
                            ? "Processing..."
                            : "Join Game"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section Matchmaking */}
                  <div className="w-full flex-shrink-0">
                    <div className="text-center">
                      <MatchmakingScreen
                        onMatchFound={handleMatchFound}
                        onCancel={handleCancelMatchmaking}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const isDraw = gameState.gameResult.winner === "draw";

  return (
    <div className="min-h-screen font-light bg-gradient-to-br  from-[#101010] via-[#1f1f1f] to-[#0c0c0c] p-4">
      <div className="max-w-5xl mx-auto mt-10">
        {/* Header */}

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="lg:col-span-3">
                <div className="rounded-xl">
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
                            <div className="font-medium text-white flex items-center gap-1 text-sm md:text-base">
                              <span className="animate-[bounce_1s_infinite] text-lg md:text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.2s] text-lg md:text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.4s] text-lg md:text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.6s] text-lg md:text-xl ml-2">
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
                      (gameState.roomName &&
                        gameState.roomName.startsWith("rematch-") &&
                        gameInfo?.betAmount &&
                        gameInfo.betAmount > BigInt(0) &&
                        !bothPlayersPaid())) &&
                      !hasClosedPaymentModal &&
                      gameFlow === "game" &&
                      gameState.gameResult.type === null &&
                      (gameState.roomName?.startsWith("rematch-") ||
                        !gameState.isActive) && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
                          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl relative">
                            <div className="text-center">
                              <h3 className="text-xl md:text-2xl font-medium text-white md:mb-6 mb-5">
                                Payment Status
                              </h3>

                              <div className="">
                                <div className="flex justify-between text-white text-sm md:text-base mb-2">
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
                                <div className="flex justify-between text-sm md:text-base text-white md:mb-6 mb-3">
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
                                      <span className="text-white text-sm md:text-base font-normal mb-0.5">
                                        White Player:
                                      </span>
                                      <span className="text-gray-400 text-xs md:text-sm">
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
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs md:text-sm font-normal ${
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
                                      <span className="text-white text-sm md:text-base text-left font-normal mb-0.5">
                                        Black Player:
                                      </span>
                                      <span className="text-gray-400 text-xs md:text-sm">
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
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs md:text-sm font-normal ${
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
                                    className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-sm md:text-lg transition-colors flex items-center justify-center"
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
                                          className="w-full mt-5 px-6 py-4 bg-[#404040] text-white rounded-lg font-medium text-sm md:text-lg transition-colors flex items-center justify-center"
                                        >
                                          {cancelState.txHash
                                            ? "Confirming..."
                                            : "Cancelling..."}
                                        </button>
                                      ) : cancelState.isError ? (
                                        <button
                                          onClick={() =>
                                            cancelBettingGame(gameId as bigint)
                                          }
                                          className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-sm md:text-lg transition-colors flex items-center justify-center"
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
                                          className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-medium text-sm md:text-lg transition-colors"
                                        >
                                          Cancel & Get Refund
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      onClick={handleBackHome}
                                      className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-sm md:text-lg transition-colors flex items-center justify-center"
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

                    {((gameState.gameResult.type && !showGameEndModal) ||
                      (gameState.isActive &&
                        currentMoveIndex < moveHistory.length - 1)) && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="bg-[#252525] backdrop-blur-sm px-3 py-1 flex items-center rounded-lg border border-white/10 shadow-xl">
                          <div className="bg-[#836EF9] h-2.5 w-2.5 rounded-full animate-pulse" />
                          <span className="text-white text-xs md:text-sm font-light ml-2">
                            Analysis mode
                            {moveHistory.length > 1 &&
                              currentMoveIndex < moveHistory.length - 1 && (
                                <span className="ml-2 text-[#836EF9] text-xs md:text-sm font-light">
                                  ({currentMoveIndex}/{moveHistory.length - 1})
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
                            onClick={goToLastMoveWithFen}
                            className="bg-[#836EF9]/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#836EF9] text-white text-xs md:text-sm font-medium hover:bg-[#836EF9] transition-colors"
                          >
                            Back to game
                          </button>
                        </div>
                      )}

                    {showGameEndModal && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
                        <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                          <div className="text-center">
                            {isDraw && (
                              <p className="text-gray-400">
                                {gameState.gameResult.message || ""}
                              </p>
                            )}

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
                            </div>

                            {gameInfo?.betAmount &&
                              gameInfo.betAmount > BigInt(0) && (
                                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-white font-medium text-sm md:text-base">
                                      Prize Pool:
                                    </h4>
                                    <span className="text-green-400 font-bold text-sm md:text-base">
                                      {formatEther(
                                        gameInfo.betAmount * BigInt(2)
                                      )}{" "}
                                      MON
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
                                        <span className="text-white text-xs md:text-sm font-normal">
                                          White
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs md:text-sm flex items-center justify-center gap-2 font-normal ${
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

                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-black border border-white rounded-full"></div>
                                        <span className="text-white text-xs md:text-sm font-normal">
                                          Black
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs md:text-sm flex items-center justify-center gap-2 font-normal ${
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
                              <div className="text-center space-y-3">
                                <div className="space-y-3">
                                  {gameState.gameResult.winner !== "draw" && (
                                    <button
                                      onClick={async () => {
                                        if (gameId && canCurrentPlayerClaim()) {
                                          resetClaimState();

                                          let resultParam: 1 | 2 | 3 = 2;

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
                                      } disabled:bg-[#252525] text-white rounded-lg border border-white/5 font-normal text-sm md:text-base transition-colors`}
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

                                  {gameState.gameResult.winner === "draw" && (
                                    <button
                                      onClick={async () => {
                                        if (gameId && canCurrentPlayerClaim()) {
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
                                      } disabled:bg-[#252525] text-white rounded-lg font-normal text-sm md:text-base transition-colors`}
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

                                {rematchInvitation &&
                                rematchInvitation.from !== address ? (
                                  <div className="space-y-3 mb-3">
                                    <p className="text-center text-xs md:text-sm text-white/80 font-thin max-w-[80%] mx-auto">
                                      Your opponent offers you a rematch for{" "}
                                      <span className="text-white font-medium">
                                        {rematchInvitation?.betAmount
                                          ? `${rematchInvitation?.betAmount} MON`
                                          : `${betAmount} MON`}
                                      </span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <button
                                        onClick={async () => {
                                          console.log(
                                            "[multisynq.tsx] Acceptation du rematch - rejoindre la room:",
                                            rematchInvitation
                                          );

                                          setRematchInvitation(null);
                                          setShowGameEndModal(false);

                                          try {
                                            if (!rematchInvitation) {
                                              console.error(
                                                "[multisynq.tsx] Invitation de rematch manquante"
                                              );
                                              return;
                                            }

                                            if (
                                              rematchInvitation.betAmount ||
                                              rematchInvitation.gameTime
                                            ) {
                                              (
                                                window as any
                                              ).rematchAcceptDetails = {
                                                betAmount:
                                                  rematchInvitation.betAmount,
                                                gameTime:
                                                  rematchInvitation.gameTime
                                                    ? parseInt(
                                                        rematchInvitation.gameTime
                                                      )
                                                    : undefined,
                                              };
                                            }

                                            await handleAutoJoinRoom(
                                              rematchInvitation.roomName,
                                              rematchInvitation.password
                                            );

                                            const newUrl = `${window.location.pathname}?room=${rematchInvitation.roomName}&password=${rematchInvitation.password}`;
                                            window.history.pushState(
                                              {},
                                              "",
                                              newUrl
                                            );
                                          } catch (error) {
                                            console.error(
                                              "[multisynq.tsx] Erreur lors du join de rematch:",
                                              error
                                            );
                                          }
                                        }}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-normal text-sm md:text-base transition-colors"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRematchInvitation(null);
                                        }}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-normal text-sm md:text-base transition-colors"
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
                                        rematchCreating?.inProgress ||
                                        shouldDisableNavigationButtons()
                                      }
                                      className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-sm md:text-base transition-colors"
                                    >
                                      {rematchCreating?.inProgress
                                        ? "Loading..."
                                        : shouldDisableNavigationButtons()
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
                                      className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-sm md:text-base transition-colors"
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
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-3">
                    {gameState.players.length > 0
                      ? gameState.players.map((player) =>
                          player.id === currentPlayerId ? (
                            <div key={player.id} className="rounded">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-lg md:text-xl text-white flex items-center gap-2">
                                    {player.wallet.slice(0, 6)}...
                                    {player.wallet.slice(-4)} (You)
                                    {player.connected && !isReconnecting ? (
                                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    ) : (
                                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                                    )}
                                  </div>
                                  <div className="text-xs md:text-sm text-gray-300">
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
                        )
                      : null}

                    <div
                      className={`backdrop-blur-md rounded-lg px-3 py-1 border ${
                        getCurrentPlayerTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-lg md:text-xl font-medium ${
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
          <div className="lg:col-span-2">
            <div className="rounded-lg  full flex flex-col h-[800px]  ">
              <div className="bg-[#1E1E1E] p-3 border border-white/5 rounded-lg mb-3">
                <div className="flex items-center gap-2 mt-1 mb-1 justify-between">
                  <div>
                    <p className="text-white font-medium text-sm md:text-base ml-2">
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
                    className="px-2.5 py-1.5 text-xs md:text-sm flex font-normal items-center gap-2 bg-[#836EF9] hover:bg-[#836EF9]/90 text-white rounded-lg transition-colors duration-300 ease-in-out"
                  >
                    Copy Link
                    {copied ? (
                      <CheckIcon className="w-3 h-3" />
                    ) : (
                      <CopyIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
                {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
                  <div className="px-2 pt-2 border-t border-white/10 mt-3">
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white text-sm md:text-base font-medium">
                        Prize Pool
                      </span>
                      <span className="text-green-400 text-sm md:text-base font-medium">
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
                <h3 className="text-sm md:text-base font-medium text-white mb-2">
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
                      className={`text-xs md:text-sm mb-[5px]   ${
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
                    <div className="text-white/90 font-light text-xs md:text-sm">
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
                  className="flex-1 px-3 h-[40px] bg-[#252525] min-w-[200px] border font-light border-white/5 text-white text-xs md:text-sm placeholder-white/70 focus:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-4 h-[40px] bg-[#836EF9] border border-white/5 text-white rounded-lg text-xs md:text-sm font-light transition-colors"
                >
                  Send
                </button>
              </div>

              <div className="space-y-3 mt-3">
                <div className="p-3 bg-[#1E1E1E] border border-white/5 rounded-lg">
                  {gameState.isActive ? (
                    <div className="space-y-3">
                      {gameState.drawOffer.offered &&
                      gameState.drawOffer.by !== playerColor ? (
                        <div>
                          <p className="text-white/80 font-light text-xs md:text-sm text-center mb-3">
                            Your opponent offers you a draw
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleRespondDraw(true)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs md:text-sm transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondDraw(false)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs md:text-sm transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
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
                            className="px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs md:text-sm transition-colors"
                          >
                            {gameState.drawOffer.offered
                              ? "Offer sent"
                              : "Offer draw"}
                          </button>

                          <Popover
                            open={isResignPopoverOpen}
                            onOpenChange={setIsResignPopoverOpen}
                          >
                            <PopoverTrigger asChild>
                              <button
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
                                className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#836EF9] text-white rounded-lg text-xs md:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Resign
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="end"
                              className="w-48 bg-[#1E1E1E] border border-white/10 shadow-ring shadow-lg text-white"
                            >
                              <div className="space-y-3">
                                <p className="text-white/90 text-xs md:text-sm font-light text-center">
                                  Are you sure you want to resign?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      handleResign();
                                      setIsResignPopoverOpen(false);
                                    }}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs md:text-sm transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => {
                                      setIsResignPopoverOpen(false);
                                    }}
                                    className="px-3 py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white rounded-lg text-xs md:text-sm transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/10">
                        <p className="text-gray-400 text-xs md:text-sm mb-2 text-center">
                          Navigation: Move {currentMoveIndex}/
                          {moveHistory.length - 1}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={goToFirstMoveWithFen}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMoveWithFen}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMoveWithFen}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMoveWithFen}
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
                    <div className="space-y-3">
                      {gameState.gameResult.type && !showGameEndModal ? (
                        <button
                          onClick={() => {
                            setShowGameEndModal(true);
                          }}
                          className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg text-xs md:text-sm transition-colors"
                        >
                          Game Results
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={handleNewGame}
                            disabled={
                              gameState.rematchOffer?.offered ||
                              rematchCreating?.inProgress ||
                              shouldDisableNavigationButtons() ||
                              (rematchInvitation! &&
                                rematchInvitation.from !== address)
                            }
                            className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            {rematchCreating?.inProgress
                              ? "Creating rematch..."
                              : shouldDisableNavigationButtons()
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
                            onClick={goToFirstMoveWithFen}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMoveWithFen}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMoveWithFen}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMoveWithFen}
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
