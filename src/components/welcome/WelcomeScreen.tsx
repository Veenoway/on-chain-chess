// components/layout/WelcomeScreen.tsx
import { WalletConnection } from "@/components/connect-wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface WelcomeScreenProps {
  isConnected: boolean;
  isWrongNetwork: boolean;
  multisynqReady: boolean;
  selectedGameTime: number;
  setSelectedGameTime: (time: number) => void;
  isBettingEnabled: boolean;
  setIsBettingEnabled: (enabled: boolean) => void;
  betAmount: string;
  setBetAmount: (amount: string) => void;
  balanceFormatted: string | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  isCreatingRoom: boolean;
  roomInput: string;
  setRoomInput: (input: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onSwitchNetwork: () => Promise<void>;
}

export function WelcomeScreen({
  isConnected,
  isWrongNetwork,
  multisynqReady,
  selectedGameTime,
  setSelectedGameTime,
  isBettingEnabled,
  setIsBettingEnabled,
  betAmount,
  setBetAmount,
  balanceFormatted,
  isPending,
  isConfirming,
  isSuccess,
  isCreatingRoom,
  roomInput,
  setRoomInput,
  onCreateRoom,
  onJoinRoom,
  onSwitchNetwork,
}: WelcomeScreenProps) {
  const [menuActive, setMenuActive] = useState<"create" | "join">("create");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] bg-center bg-cover flex items-center justify-center p-4">
      <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/5">
        {/* Header */}
        <WelcomeHeader />

        {/* Wallet Connection */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center w-full">
            <WalletConnection className="w-full" />
          </div>
        </div>

        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <>
            {/* Menu Tabs */}
            <MenuTabs menuActive={menuActive} setMenuActive={setMenuActive} />

            {/* Menu Content */}
            {menuActive === "create" ? (
              <CreateGamePanel
                selectedGameTime={selectedGameTime}
                setSelectedGameTime={setSelectedGameTime}
                isBettingEnabled={isBettingEnabled}
                setIsBettingEnabled={setIsBettingEnabled}
                betAmount={betAmount}
                setBetAmount={setBetAmount}
                balanceFormatted={balanceFormatted}
                isPending={isPending}
                isConfirming={isConfirming}
                isSuccess={isSuccess}
                isCreatingRoom={isCreatingRoom}
                multisynqReady={multisynqReady}
                isWrongNetwork={isWrongNetwork}
                onCreateRoom={onCreateRoom}
              />
            ) : (
              <JoinGamePanel
                roomInput={roomInput}
                setRoomInput={setRoomInput}
                multisynqReady={multisynqReady}
                isPending={isPending}
                isWrongNetwork={isWrongNetwork}
                onJoinRoom={onJoinRoom}
              />
            )}
          </>
        )}

        {/* Wrong Network Warning */}
        {isConnected && isWrongNetwork && (
          <WrongNetworkWarning onSwitchNetwork={onSwitchNetwork} />
        )}
      </div>
    </div>
  );
}

function WelcomeHeader() {
  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold text-white mb-4">
        Welcome to SynqMate
      </h2>
      <p className="text-white/80 text-lg font-light mb-8 max-w-[500px] mx-auto">
        SynqMate is a platform for playing chess with friends and betting on the
        outcome.
      </p>
    </div>
  );
}

function ConnectWalletPrompt() {
  return (
    <p className="text-white text-lg mx-auto text-center">
      Connect your wallet to start playing
    </p>
  );
}

interface MenuTabsProps {
  menuActive: "create" | "join";
  setMenuActive: (menu: "create" | "join") => void;
}

function MenuTabs({ menuActive, setMenuActive }: MenuTabsProps) {
  return (
    <div className="mx-auto w-full flex items-center justify-center">
      <button
        onClick={() => setMenuActive("create")}
        className={`group rounded-t-lg ${
          menuActive === "create"
            ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
            : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
        } text-white text-lg font-semibold py-4 w-[190px] transition-all duration-200 px-4`}
      >
        Create Game
      </button>

      <button
        onClick={() => setMenuActive("join")}
        className={`group rounded-t-lg ${
          menuActive === "join"
            ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
            : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
        } text-white text-lg font-semibold py-4 w-[190px] transition-all duration-200 px-4`}
      >
        Join Game
      </button>
    </div>
  );
}

interface CreateGamePanelProps {
  selectedGameTime: number;
  setSelectedGameTime: (time: number) => void;
  isBettingEnabled: boolean;
  setIsBettingEnabled: (enabled: boolean) => void;
  betAmount: string;
  setBetAmount: (amount: string) => void;
  balanceFormatted: string | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  isCreatingRoom: boolean;
  multisynqReady: boolean;
  isWrongNetwork: boolean;
  onCreateRoom: () => void;
}

function CreateGamePanel({
  selectedGameTime,
  setSelectedGameTime,
  isBettingEnabled,
  setIsBettingEnabled,
  betAmount,
  setBetAmount,
  balanceFormatted,
  isPending,
  isConfirming,
  isSuccess,
  isCreatingRoom,
  multisynqReady,
  isWrongNetwork,
  onCreateRoom,
}: CreateGamePanelProps) {
  return (
    <div className="bg-[#252525] rounded-2xl p-6">
      <div className="space-y-6">
        {/* Game Time Selection */}
        <GameTimeSelector
          selectedGameTime={selectedGameTime}
          setSelectedGameTime={setSelectedGameTime}
        />

        {/* Betting Toggle */}
        <BettingToggle
          isBettingEnabled={isBettingEnabled}
          setIsBettingEnabled={setIsBettingEnabled}
        />

        {/* Betting Amount Input */}
        {isBettingEnabled && (
          <BettingAmountInput
            betAmount={betAmount}
            setBetAmount={setBetAmount}
            balanceFormatted={balanceFormatted}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
          />
        )}

        {/* Create Button */}
        <CreateGameButton
          onCreateRoom={onCreateRoom}
          isCreatingRoom={isCreatingRoom}
          multisynqReady={multisynqReady}
          isWrongNetwork={isWrongNetwork}
        />
      </div>
    </div>
  );
}

interface GameTimeSelectorProps {
  selectedGameTime: number;
  setSelectedGameTime: (time: number) => void;
}

function GameTimeSelector({
  selectedGameTime,
  setSelectedGameTime,
}: GameTimeSelectorProps) {
  return (
    <div>
      <label className="block text-xl font-medium text-white mb-3">
        Game Settings
      </label>
      <Select
        value={selectedGameTime.toString()}
        onValueChange={(value) => setSelectedGameTime(Number(value))}
      >
        <SelectTrigger className="w-full text-lg bg-[#2b2b2b] border-white/5 h-[50px] text-white">
          <SelectValue placeholder="Select game duration" className="text-lg" />
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
  );
}

interface BettingToggleProps {
  isBettingEnabled: boolean;
  setIsBettingEnabled: (enabled: boolean) => void;
}

function BettingToggle({
  isBettingEnabled,
  setIsBettingEnabled,
}: BettingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-medium text-white">Enable Betting</h3>
      <label className="flex items-center cursor-pointer">
        <div
          className={`w-14 h-6 rounded-full transition-colors ${
            isBettingEnabled ? "bg-[#836EF9]" : "bg-[#2b2b2b]"
          }`}
        >
          <div
            className={`w-[21px] h-[21px] bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
              isBettingEnabled ? "translate-x-7 ml-1" : "translate-x-0 ml-0.5"
            }`}
          ></div>
        </div>
        <input
          type="checkbox"
          checked={isBettingEnabled}
          onChange={(e) => setIsBettingEnabled(e.target.checked)}
          className="sr-only"
        />
      </label>
    </div>
  );
}

interface BettingAmountInputProps {
  betAmount: string;
  setBetAmount: (amount: string) => void;
  balanceFormatted: string | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
}

function BettingAmountInput({
  betAmount,
  setBetAmount,
  balanceFormatted,
  isPending,
  isConfirming,
  isSuccess,
}: BettingAmountInputProps) {
  return (
    <div className="space-y-2">
      <input
        type="number"
        step="1"
        min="1"
        value={betAmount}
        onChange={(e) => setBetAmount(e.target.value)}
        placeholder="Enter bet amount"
        className="w-full px-4 py-3 focus:outline-none bg-[#2b2b2b] border border-white/5 rounded-lg text-white text-lg focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
      />
      <div className="text-base text-white/80">
        Balance:{" "}
        {balanceFormatted?.split(".")?.[0] +
          "." +
          balanceFormatted?.split(".")?.[1]?.slice(0, 2)}{" "}
        MON
        {(isPending || isConfirming) && (
          <span className="ml-2 text-yellow-400">
            {isPending ? "Signing..." : "Confirming..."}
          </span>
        )}
        {isSuccess && <span className="ml-2 text-green-400">Confirmed</span>}
      </div>
    </div>
  );
}

interface CreateGameButtonProps {
  onCreateRoom: () => void;
  isCreatingRoom: boolean;
  multisynqReady: boolean;
  isWrongNetwork: boolean;
}

function CreateGameButton({
  onCreateRoom,
  isCreatingRoom,
  multisynqReady,
  isWrongNetwork,
}: CreateGameButtonProps) {
  return (
    <button
      onClick={onCreateRoom}
      disabled={isCreatingRoom || !multisynqReady || isWrongNetwork}
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
  );
}

interface JoinGamePanelProps {
  roomInput: string;
  setRoomInput: (input: string) => void;
  multisynqReady: boolean;
  isPending: boolean;
  isWrongNetwork: boolean;
  onJoinRoom: () => void;
}

function JoinGamePanel({
  roomInput,
  setRoomInput,
  multisynqReady,
  isPending,
  isWrongNetwork,
  onJoinRoom,
}: JoinGamePanelProps) {
  return (
    <div className="text-center">
      <div className="bg-[#252525] rounded-2xl p-8 pt-6">
        <label className="block text-xl font-medium text-left text-white mb-3">
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
          onClick={onJoinRoom}
          disabled={
            !roomInput.trim() || !multisynqReady || isPending || isWrongNetwork
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
  );
}

interface WrongNetworkWarningProps {
  onSwitchNetwork: () => Promise<void>;
}

function WrongNetworkWarning({ onSwitchNetwork }: WrongNetworkWarningProps) {
  return (
    <div className="mt-8 bg-red-500/20 border border-red-400 rounded-xl p-6">
      <div className="text-center">
        <h3 className="text-red-300 font-bold text-xl mb-3">
          Wrong Network Detected
        </h3>
        <p className="text-red-200 text-lg mb-4">
          Please switch to <strong>Monad Testnet</strong> to use betting
          features
        </p>
        <button
          onClick={onSwitchNetwork}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-lg transition-colors"
        >
          Switch to Monad Testnet
        </button>
      </div>
    </div>
  );
}
