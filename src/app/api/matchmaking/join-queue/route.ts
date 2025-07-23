import { matchmakingQueue } from "@/lib/matchmaking-queue";
import { MatchmakingCriteria, QueueEntry } from "@/types/matchmaking";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const {
      playerId,
      playerAddress,
      criteria,
    }: {
      playerId: string;
      playerAddress: string;
      criteria: MatchmakingCriteria;
    } = await request.json();

    if (!playerId || !playerAddress || !criteria) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newEntry: QueueEntry = {
      playerId,
      playerAddress,
      criteria,
      joinedAt: Date.now(),
    };

    const { match } = matchmakingQueue.findMatch(newEntry);

    if (match) {
      return NextResponse.json({
        success: true,
        match,
        matchFound: true,
      });
    } else {
      matchmakingQueue.addEntry(newEntry);

      setTimeout(() => {
        matchmakingQueue.removeEntryByAddress(newEntry.playerAddress);
      }, 120000);

      return NextResponse.json({
        success: true,
        queuePosition: matchmakingQueue.getQueuePosition(playerAddress),
        estimatedWaitTime: Math.max(
          30,
          matchmakingQueue.getTotalInQueue() * 15
        ),
        matchFound: false,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    );
  }
}
