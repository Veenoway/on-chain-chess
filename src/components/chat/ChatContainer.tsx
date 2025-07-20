// components/chat/ChatContainer.tsx
import { GameInfo } from "@/types/betting";
import { ChatMessage, GameState } from "@/types/chess";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatContainerProps {
  gameState: GameState;
  gameInfo: GameInfo | null;
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;
  playerColor: "white" | "black";
  address: string | null;
  getAvailableAmount: () => string;
}

export function ChatContainer({
  gameState,
  gameInfo,
  newMessage,
  setNewMessage,
  onSendMessage,
  playerColor,
  address,
  getAvailableAmount,
}: ChatContainerProps) {
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [gameState.messages]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${
      gameState.roomName
    }${gameState.roomPassword ? `&password=${gameState.roomPassword}` : ""}`;

    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSendMessage = () => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return true; // No betting, anyone can chat
    }

    // With betting, only players who have paid can chat
    const isWhitePlayer =
      gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase();
    const isBlackPlayer =
      gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase();

    return (
      (playerColor === "white" && isWhitePlayer) ||
      (playerColor === "black" && isBlackPlayer)
    );
  };

  return (
    <div className="rounded-lg full flex flex-col h-[800px]">
      {/* Room Info Header */}
      <RoomInfoHeader
        roomName={gameState.roomName}
        gameInfo={gameInfo}
        getAvailableAmount={getAvailableAmount}
        onCopyLink={handleCopyLink}
        copied={copied}
      />

      {/* Chat Header */}
      <div className="rounded-t-lg px-3 pt-2 bg-[#1E1E1E] border border-b-2 border-white/5">
        <h3 className="text-base font-semibold text-white mb-2">Nads Chat</h3>
      </div>

      {/* Messages Container */}
      <div className="overflow-y-auto space-y-2 h-full flex-1 bg-[#1a1a1a] border border-b-0 border-t-0 border-white/5 px-3 py-2">
        {gameState.messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            currentAddress={address}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSendMessage={onSendMessage}
        canSendMessage={canSendMessage()}
      />
    </div>
  );
}

interface RoomInfoHeaderProps {
  roomName: string;
  gameInfo: GameInfo | null;
  getAvailableAmount: () => string;
  onCopyLink: () => void;
  copied: boolean;
}

function RoomInfoHeader({
  roomName,
  gameInfo,
  getAvailableAmount,
  onCopyLink,
  copied,
}: RoomInfoHeaderProps) {
  return (
    <div className="bg-[#1E1E1E] p-3 border border-white/5 rounded-lg mb-3">
      <div className="flex items-center gap-2 mt-1 mb-3 justify-between">
        <div>
          <p className="text-white/80 text-xs ml-2.5">Room:</p>
          <p className="text-white text-base ml-2.5">{roomName}</p>
        </div>

        <button
          onClick={onCopyLink}
          className="px-2 py-1 text-sm flex items-center gap-2 bg-[#836EF9] hover:bg-[#836EF9]/90 text-white rounded-lg transition-colors duration-300 ease-in-out"
        >
          Copy Link
          {copied ? (
            <CheckIcon className="w-3.5 h-3.5" />
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Prize Pool Info */}
      {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
        <div className="rounded-lg px-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white text-xl font-medium">Prize Pool</span>
            <span className="text-green-400 text-xl font-bold">
              {getAvailableAmount() > "0" ? getAvailableAmount() : "0"} MON
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatMessageItemProps {
  message: ChatMessage;
  currentAddress: string | null;
}

function ChatMessageItem({ message, currentAddress }: ChatMessageItemProps) {
  const isCurrentUser = message.playerWallet === currentAddress;

  const getDisplayName = () => {
    if (isCurrentUser) return "You";
    return `${message.playerWallet.slice(0, 6)}...${message.playerWallet.slice(
      -4
    )}`;
  };

  return (
    <div
      className={`rounded-lg py-2 ${
        isCurrentUser ? "bg-[#836EF9]/40" : "bg-neutral-800"
      } border p-3 border-white/5`}
    >
      <div
        className={`text-sm mb-[5px] ${
          isCurrentUser ? "text-white font-bold" : "text-gray-400"
        }`}
      >
        {getDisplayName()}
      </div>
      <div className="text-white text-sm">{message.message}</div>
    </div>
  );
}

interface ChatInputProps {
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;
  canSendMessage: boolean;
}

function ChatInput({
  newMessage,
  setNewMessage,
  onSendMessage,
  canSendMessage,
}: ChatInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSendMessage && newMessage.trim()) {
      onSendMessage();
    }
  };

  return (
    <div className="flex gap-2 bg-[#1a1a1a] border border-t-0 border-white/5 rounded-b-lg px-3 py-2">
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Gmonad"
        disabled={!canSendMessage}
        className="flex-1 px-3 h-[45px] bg-[#1E1E1E] border font-normal border-white/5 text-white text-base placeholder-white/70 focus:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        onClick={onSendMessage}
        disabled={!newMessage.trim() || !canSendMessage}
        className="px-5 h-[45px] bg-[#836EF9]/80 border border-white/5 text-white rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
  );
}
