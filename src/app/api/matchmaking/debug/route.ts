import { matchmakingQueue } from "@/lib/matchmaking-queue";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { playerAddress } = await request.json();

    const entries = matchmakingQueue.getEntries();
    const matches = matchmakingQueue.getMatches();

    const playerEntry = matchmakingQueue.findEntryByAddress(playerAddress);
    const playerMatch = matchmakingQueue.findMatchByAddress(playerAddress);

    return NextResponse.json({
      playerAddress: playerAddress.toLowerCase(),
      totalEntries: entries.length,
      totalMatches: matches.length,
      entries: entries.map((e) => ({
        address: e.playerAddress.toLowerCase(),
        joinedAt: e.joinedAt,
        gameTime: e.criteria.gameTime,
        betAmount: e.criteria.betAmount,
      })),
      matches: matches.map((m) => ({
        matchId: m.matchId,
        whitePlayer: m.whitePlayer.address.toLowerCase(),
        blackPlayer: m.blackPlayer.address.toLowerCase(),
        gameTime: m.gameTime,
        betAmount: m.betAmount,
      })),
      playerEntry: playerEntry
        ? {
            address: playerEntry.playerAddress.toLowerCase(),
            joinedAt: playerEntry.joinedAt,
          }
        : null,
      playerMatch: playerMatch
        ? {
            matchId: playerMatch.matchId,
            whitePlayer: playerMatch.whitePlayer.address.toLowerCase(),
            blackPlayer: playerMatch.blackPlayer.address.toLowerCase(),
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to get debug info" },
      { status: 500 }
    );
  }
}
