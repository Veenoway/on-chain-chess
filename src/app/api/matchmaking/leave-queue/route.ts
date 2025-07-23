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

    const wasInQueue = matchmakingQueue.removeEntryByAddress(playerAddress);

    return NextResponse.json({
      success: true,
      wasInQueue,
      remainingInQueue: matchmakingQueue.getTotalInQueue(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    );
  }
}
