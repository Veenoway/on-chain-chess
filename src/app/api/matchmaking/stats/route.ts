import { matchmakingQueue } from "@/lib/matchmaking-queue";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const totalInQueue = matchmakingQueue.getTotalInQueue();
    const totalMatches = matchmakingQueue.getMatches().length;

    const queueCapacity = matchmakingQueue.getQueueCapacity();

    return NextResponse.json({
      totalInQueue,
      totalMatches,
      estimatedWaitTime: Math.max(30, totalInQueue * 15),
      queueCapacity,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to get matchmaking stats" },
      { status: 500 }
    );
  }
}
