/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";

export const useMultisynq = () => {
  const [multisynqSession, setMultisynqSession] = useState<any>(null);
  const [multisynqView, setMultisynqView] = useState<any>(null);
  const [multisynqReady, setMultisynqReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready to play");

  const waitForMultisynqAvailable = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout: Multisynq not available"));
      }, 10000);

      const checkAvailability = () => {
        if ((window as any).Multisynq) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkAvailability, 100);
        }
      };

      checkAvailability();
    });
  };

  const createMultisynqSession = async (
    roomName: string,
    password: string = ""
  ) => {
    const apiKey = process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY;

    if (!apiKey) {
      throw new Error("Multisynq API key is missing");
    }

    if (!multisynqReady) {
      throw new Error("Multisynq is not ready");
    }

    const { Multisynq } = window as any;
    if (!Multisynq) {
      throw new Error("Multisynq is not available");
    }

    try {
      if (multisynqView) {
        try {
          if (multisynqView.session) {
            multisynqView.session.close();
          }
        } catch (error) {
          console.warn("Error closing old session:", error);
        }
        setMultisynqSession(null);
        setMultisynqView(null);
      }

      const session = await Multisynq.Session.join({
        apiKey,
        appId: "com.onchainchess-novee.game",
        model: (window as any).ChessModel,
        view: (window as any).ChessView,
        name: roomName,
        password: password,
      });

      return session;
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  };

  const closeSession = () => {
    if (multisynqView) {
      try {
        if (multisynqView.session) {
          multisynqView.session.close();
        }
      } catch (error) {
        console.warn("Error closing session:", error);
      }
    }
    setMultisynqSession(null);
    setMultisynqView(null);
  };

  return {
    multisynqSession,
    setMultisynqSession,
    multisynqView,
    setMultisynqView,
    multisynqReady,
    setMultisynqReady,
    connectionStatus,
    setConnectionStatus,
    createMultisynqSession,
    closeSession,
    waitForMultisynqAvailable,
  };
};
