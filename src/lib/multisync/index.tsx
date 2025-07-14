"use client";
import { MultiSyncProvider } from "@multisync/react";

export function ChessMultiSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MultiSyncProvider
      roomId="chess-arena-room-001" // à remplacer dynamiquement ensuite
      client={{ publicApiKey: "demo_YOUR_KEY" }} // remplace par ta vraie clé plus tard
    >
      {children}
    </MultiSyncProvider>
  );
}
