import { MatchFound, QueueEntry } from "@/types/matchmaking";

interface QueueData {
  entries: QueueEntry[];
  matches: MatchFound[];
}

class MatchmakingQueue {
  private static instance: MatchmakingQueue;
  private data: QueueData = {
    entries: [],
    matches: [],
  };

  static getInstance(): MatchmakingQueue {
    if (!MatchmakingQueue.instance) {
      MatchmakingQueue.instance = new MatchmakingQueue();
    }
    return MatchmakingQueue.instance;
  }

  getEntries(): QueueEntry[] {
    return this.data.entries;
  }

  getMatches(): MatchFound[] {
    return this.data.matches;
  }

  addEntry(entry: QueueEntry): void {
    this.removeEntryByAddress(entry.playerAddress);
    this.data.entries.push(entry);

    setTimeout(() => {
      this.removeEntryByAddress(entry.playerAddress);
    }, 120000);
  }

  removeEntryByAddress(playerAddress: string): boolean {
    const initialLength = this.data.entries.length;
    const normalizedAddress = playerAddress.toLowerCase();
    this.data.entries = this.data.entries.filter(
      (entry) => entry.playerAddress.toLowerCase() !== normalizedAddress
    );
    return this.data.entries.length < initialLength;
  }

  addMatch(match: MatchFound): void {
    this.data.matches.push(match);
    setTimeout(() => {
      this.removeMatch(match.matchId);
    }, 180000);
  }

  removeMatch(matchId: string): void {
    this.data.matches = this.data.matches.filter((m) => m.matchId !== matchId);
  }

  findMatch(newEntry: QueueEntry): {
    match: MatchFound | null;
    matchedEntry: QueueEntry | null;
  } {
    const TIME_TOLERANCE = 60;
    const BET_TOLERANCE = 10;

    for (let i = 0; i < this.data.entries.length; i++) {
      const existingEntry = this.data.entries[i];

      if (
        existingEntry.playerAddress.toLowerCase() ===
        newEntry.playerAddress.toLowerCase()
      )
        continue;

      const timeDiff = Math.abs(
        existingEntry.criteria.gameTime - newEntry.criteria.gameTime
      );
      const betDiff = Math.abs(
        parseFloat(existingEntry.criteria.betAmount) -
          parseFloat(newEntry.criteria.betAmount)
      );

      if (timeDiff <= TIME_TOLERANCE && betDiff <= BET_TOLERANCE) {
        const roomName = `match-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`;
        const roomPassword = Math.random().toString(36).substring(2, 8);

        const shouldSwapColors = Math.random() < 0.5;
        const whitePlayer = shouldSwapColors ? newEntry : existingEntry;
        const blackPlayer = shouldSwapColors ? existingEntry : newEntry;

        const match: MatchFound = {
          roomName,
          roomPassword,
          gameTime: newEntry.criteria.gameTime,
          betAmount: newEntry.criteria.betAmount,
          whitePlayer: {
            id: whitePlayer.playerId,
            address: whitePlayer.playerAddress,
          },
          blackPlayer: {
            id: blackPlayer.playerId,
            address: blackPlayer.playerAddress,
          },
          matchId: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}`,
        };

        this.addMatch(match);

        setTimeout(() => {
          this.removeEntryByAddress(existingEntry.playerAddress);
          this.removeEntryByAddress(newEntry.playerAddress);
        }, 100);

        return { match, matchedEntry: existingEntry };
      }
    }

    return { match: null, matchedEntry: null };
  }

  findEntryByAddress(playerAddress: string): QueueEntry | undefined {
    const normalizedAddress = playerAddress.toLowerCase();
    return this.data.entries.find(
      (entry) => entry.playerAddress.toLowerCase() === normalizedAddress
    );
  }

  findMatchByAddress(playerAddress: string): MatchFound | undefined {
    const normalizedAddress = playerAddress.toLowerCase();
    return this.data.matches.find(
      (match) =>
        match.whitePlayer.address.toLowerCase() === normalizedAddress ||
        match.blackPlayer.address.toLowerCase() === normalizedAddress
    );
  }

  getQueuePosition(playerAddress: string): number {
    const normalizedAddress = playerAddress.toLowerCase();
    return (
      this.data.entries.findIndex(
        (entry) => entry.playerAddress.toLowerCase() === normalizedAddress
      ) + 1
    );
  }

  getTotalInQueue(): number {
    return this.data.entries.length;
  }

  cleanupExpiredEntries(): void {
    const now = Date.now();
    const maxAge = 120000;

    this.data.entries = this.data.entries.filter(
      (entry) => now - entry.joinedAt < maxAge
    );

    const matchMaxAge = 180000;
    this.data.matches = this.data.matches.filter((match) => {
      const matchCreatedAt = parseInt(match.matchId.split("-")[0]);
      return now - matchCreatedAt < matchMaxAge;
    });
  }
}

setInterval(() => {
  matchmakingQueue.cleanupExpiredEntries();
}, 60000);

export const matchmakingQueue = MatchmakingQueue.getInstance();
