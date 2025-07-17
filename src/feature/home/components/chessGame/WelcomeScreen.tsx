import { WalletConnection } from "@/components/connect-wallet";
import { useChessBetting } from "@/hooks/useChessBetting";
import { useChessGame } from "@/hooks/useChessGame";
import { useChessStore } from "@/stores/chessStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radix-ui/react-select";
import { useState } from "react";
import { useAccount } from "wagmi";
import BettingOptions from "./BettingOptions";
import NetworkWarning from "./NetworkWaring";

export default function WelcomeScreen() {
  const { isConnected } = useAccount();
  const { createRoom, joinRoom, switchChain, isWrongNetwork, isPending } =
    useChessGame();

  const { isBettingEnabled, betAmount } = useChessStore();

  //   const { balanceFormatted } = usePaymentStore();
  const { createBettingGame } = useChessBetting();

  const [roomInput, setRoomInput] = useState("");
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const handleCreateRoom = async () => {
    if (!isConnected) return;

    setIsCreatingRoom(true);

    try {
      const result = await createRoom(selectedGameTime);

      // Create betting game if enabled
      if (isBettingEnabled && parseFloat(betAmount) > 0 && result) {
        await createBettingGame(betAmount, result.roomName);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!isConnected || !roomInput.trim()) return;

    try {
      await joinRoom(roomInput.trim());
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("Failed to join room. Please check the room code.");
    }
  };

  return (
    <div className="min-h-screen bg-[url('https://pbs.twimg.com/media/GpoPZdmWkAApRWa?format=jpg&name=large')] bg-center bg-cover flex items-center justify-center p-4">
      <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/20">
        <div className="text-center mb-20">
          <h1 className="text-5xl font-bold text-white mb-3">
            MultiSynq & Monad Chess
          </h1>
          <p className="text-white/80">Real-time chess game with Multisynq</p>
        </div>

        <div className="space-y-10">
          {/* Game Creation Section */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label
                className={`block text-2xl text-center font-medium ${
                  isConnected ? "text-white" : "text-white/50"
                } mb-6`}
              >
                Game time
              </label>
              <Select
                value={selectedGameTime.toString()}
                onValueChange={(value) => setSelectedGameTime(Number(value))}
                disabled={!isConnected}
              >
                <SelectTrigger className="w-full text-base bg-[#252525] border-white/10 h-[45px] text-white disabled:opacity-50">
                  <SelectValue placeholder="Select game time" />
                </SelectTrigger>
                <SelectContent className="bg-[#252525] border-white/20 text-base text-white">
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                  <SelectItem value="900">15 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                </SelectContent>
              </Select>

              <button
                onClick={handleCreateRoom}
                disabled={!isConnected || isCreatingRoom || isWrongNetwork}
                className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 disabled:text-white/50 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-3 px-6 rounded text-base transition-all"
              >
                {!isConnected && !isWrongNetwork
                  ? "Connect wallet to create"
                  : isWrongNetwork
                  ? "🔄 Switch to Monad & Create"
                  : isCreatingRoom
                  ? "Creating..."
                  : "Create a new game"}
              </button>
            </div>

            {/* Join Game Section */}
            <div className="space-y-2">
              <label
                className={`block text-2xl text-center font-medium ${
                  isConnected ? "text-white" : "text-white/50"
                } mb-4`}
              >
                Join a game
              </label>
              <input
                type="text"
                placeholder="Room code or room:password"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                disabled={!isConnected}
                className="w-full p-3 bg-[#252525] border border-white/10 h-[45px] text-white rounded placeholder-gray-400 focus:ring-2 focus:ring-none focus:border-none disabled:opacity-50"
              />
              <button
                onClick={handleJoinRoom}
                disabled={
                  !isConnected ||
                  !roomInput.trim() ||
                  isPending ||
                  isWrongNetwork
                }
                className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] disabled:text-white/50 text-white font-medium py-3 px-6 rounded text-base transition-all"
              >
                {!isConnected && !isWrongNetwork
                  ? "Connect wallet to join"
                  : isWrongNetwork
                  ? "🔄 Switch to Monad & Join"
                  : isPending
                  ? "Processing payment..."
                  : "Join a game"}
              </button>
            </div>
          </div>

          {/* Betting Options */}
          <BettingOptions />

          {/* Network Warning */}
          {isConnected && isWrongNetwork && (
            <NetworkWarning onSwitchNetwork={switchChain} />
          )}

          <div className="w-full h-[1px] bg-white/10 my-4" />

          <WalletConnection />
        </div>
      </div>
    </div>
  );
}
