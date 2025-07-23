import { matchmakingQueue } from "@/lib/matchmaking-queue";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { playerAddress }: { playerAddress: string } = await request.json();

    if (!playerAddress) {
      return NextResponse.json(
        { error: "Player address is required" },
        { status: 400 }
      );
    }

    const playerEntry = matchmakingQueue.findEntryByAddress(playerAddress);
    const playerMatch = matchmakingQueue.findMatchByAddress(playerAddress);

    if (playerMatch) {
      return NextResponse.json({
        inQueue: false,
        matchFound: true,
        match: playerMatch,
      });
    }

    if (playerEntry) {
      const queuePosition = matchmakingQueue.getQueuePosition(playerAddress);

      return NextResponse.json({
        inQueue: true,
        queuePosition,
        totalInQueue: matchmakingQueue.getTotalInQueue(),
        estimatedWaitTime: Math.max(30, (queuePosition - 1) * 15),
        waitingTime: Date.now() - playerEntry.joinedAt,
      });
    }

    return NextResponse.json({
      inQueue: false,
      matchFound: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    );
  }
}
