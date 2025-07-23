import {
  MatchFound,
  MatchmakingCriteria,
  MatchmakingStatus,
  QueueStatus,
} from "@/types/matchmaking";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

export const useMatchmaking = () => {
  const { address } = useAccount();
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    inQueue: false,
  });
  const [matchFound, setMatchFound] = useState<MatchFound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState({
    totalInQueue: 0,
    estimatedWaitTime: 30,
  });

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const currentCriteria = useRef<MatchmakingCriteria | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
  }, []);

  const fetchGlobalStats = useCallback(async () => {
    try {
      const response = await fetch("/api/matchmaking/stats");
      const data = await response.json();
      setGlobalStats({
        totalInQueue: data.totalInQueue,
        estimatedWaitTime: data.estimatedWaitTime,
      });
    } catch {}
  }, []);

  const checkQueueStatus = useCallback(async () => {
    if (!address) return;

    try {
      const response = await fetch("/api/matchmaking/queue-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: address }),
      });

      const data = await response.json();

      if (data.matchFound && data.match) {
        setMatchFound(data.match);
        setStatus("match_found");
        setQueueStatus({ inQueue: false });
        clearPolling();
      } else if (data.inQueue) {
        setQueueStatus({
          inQueue: true,
          queuePosition: data.queuePosition,
          totalInQueue: data.totalInQueue,
          estimatedWaitTime: data.estimatedWaitTime,
        });
      } else {
        setQueueStatus({ inQueue: false });
        if (status === "searching") {
          fetch("/api/matchmaking/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerAddress: address }),
          })
            .then((res) => res.json())
            .then((debug) => {
              console.log(
                "🐛 Debug - User not found in queue or matches:",
                debug
              );
            })
            .catch(() => {});

          setTimeout(() => {
            if (status === "searching") {
              setStatus("idle");
              clearPolling();
            }
          }, 2000);
        }
      }
    } catch {
      setError("Failed to check queue status");
    }
  }, [address, status, clearPolling]);

  const joinQueue = useCallback(
    async (criteria: MatchmakingCriteria) => {
      if (!address) {
        setError("Wallet not connected");
        return;
      }

      try {
        setStatus("searching");
        setError(null);
        currentCriteria.current = criteria;

        const playerId = `player_${address.slice(-8)}_${Math.random()
          .toString(36)
          .substring(2, 6)}`;

        const response = await fetch("/api/matchmaking/join-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            playerAddress: address,
            criteria,
          }),
        });

        const data = await response.json();

        if (data.matchFound && data.match) {
          setMatchFound(data.match);
          setStatus("match_found");
          setQueueStatus({ inQueue: false });
        } else if (data.success) {
          setQueueStatus({
            inQueue: true,
            queuePosition: data.queuePosition,
            estimatedWaitTime: data.estimatedWaitTime,
          });

          pollingInterval.current = setInterval(checkQueueStatus, 500);
        } else {
          setError("Failed to join queue");
          setStatus("failed");
        }
      } catch {
        setError("Failed to join queue");
        setStatus("failed");
      }
    },
    [address, checkQueueStatus]
  );

  const leaveQueue = useCallback(async () => {
    if (!address) return;

    try {
      clearPolling();

      await fetch("/api/matchmaking/leave-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress: address }),
      });

      setStatus("idle");
      setQueueStatus({ inQueue: false });
      setMatchFound(null);
      setError(null);
    } catch {
      setError("Failed to leave queue");
    }
  }, [address, clearPolling]);

  const acceptMatch = useCallback(() => {
    if (matchFound) {
      setStatus("connecting");
      return matchFound;
    }
    return null;
  }, [matchFound]);

  const resetMatchmaking = useCallback(() => {
    clearPolling();
    setStatus("idle");
    setQueueStatus({ inQueue: false });
    setMatchFound(null);
    setError(null);
    currentCriteria.current = null;
  }, [clearPolling]);

  useEffect(() => {
    fetchGlobalStats();
    statsInterval.current = setInterval(fetchGlobalStats, 5000);

    return () => {
      clearPolling();
    };
  }, [clearPolling, fetchGlobalStats]);

  useEffect(() => {
    if (!address && status !== "idle") {
      resetMatchmaking();
    }
  }, [address, status, resetMatchmaking]);

  const cleanupOnGameJoin = useCallback(async () => {
    if (status !== "idle") {
      await leaveQueue();
      resetMatchmaking();
    }
  }, [status, leaveQueue, resetMatchmaking]);

  return {
    status,
    queueStatus,
    matchFound,
    error,
    globalStats,
    joinQueue,
    leaveQueue,
    acceptMatch,
    resetMatchmaking,
    cleanupOnGameJoin,
    isSearching: status === "searching",
    isInQueue: queueStatus.inQueue,
    hasMatchFound: status === "match_found" && !!matchFound,
  };
};
