// components/ChessGame/ChatPanel.tsx
"use client";
import { useChat } from "@/hooks/useChessGame";
import React, { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

export default function ChatPanel() {
  const { address } = useAccount();
  const { messages, sendMessage, canSendMessage } = useChat();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const success = sendMessage(newMessage.trim());
    if (success) {
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      <h3 className="text-xl font-semibold text-white mb-3">Nads Chat</h3>

      {/* Messages container */}
      <div className="overflow-y-auto space-y-2 h-full flex-1 mb-4">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isOwnMessage={msg.playerWallet === address}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={canSendMessage ? "Shame opponent..." : "Pay to chat..."}
          disabled={!canSendMessage}
          className="flex-1 px-5 h-[45px] bg-[#1E1E1E] text-white text-base placeholder-gray-400 focus:ring-2 rounded disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 focus:border-[#836EF9]"
          maxLength={200}
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || !canSendMessage}
          className="px-5 h-[45px] bg-[#836EF9]/80 hover:bg-[#836EF9] text-white rounded text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </>
  );
}

interface ChatMessageProps {
  message: {
    id: string;
    playerId: string;
    playerWallet: string;
    message: string;
    timestamp: number;
  };
  isOwnMessage: boolean;
}

function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatWallet = (wallet: string) => {
    return wallet.slice(0, 6) + "..." + wallet.slice(-4);
  };

  return (
    <div
      className={`rounded py-2 border p-3 border-white/10 ${
        isOwnMessage ? "bg-[#252525]" : "bg-[#1e1e1e]/70"
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <div
          className={`text-sm ${
            isOwnMessage ? "text-white font-bold" : "text-gray-400"
          }`}
        >
          {isOwnMessage ? "You" : formatWallet(message.playerWallet)}
        </div>
        <div className="text-xs text-gray-500">
          {formatTime(message.timestamp)}
        </div>
      </div>
      <div className="text-white text-sm break-words">{message.message}</div>
    </div>
  );
}
