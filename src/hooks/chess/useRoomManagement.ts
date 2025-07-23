/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

export const useRoomManagement = (
  multisynqReady: boolean,
  createMultisynqSession: (roomName: string, password: string) => Promise<any>,
  setCurrentPlayerId: (id: string | null) => void,
  setMultisynqSession: (session: any) => void,
  setMultisynqView: (view: any) => void,
  setGameState: (state: any) => void,
  setGameFlow: (flow: string) => void,
  setConnectionStatus: (status: string) => void,
  setHasClosedPaymentModal: (closed: boolean) => void,
  selectedGameTime: number,
  setSelectedGameTime: (time: number) => void,
  isBettingEnabled: boolean,
  betAmount: string,
  createBettingGame: (amount: string, roomName: string) => Promise<void>,
  setRoomBetAmount: (amount: string) => void,
  setBettingGameCreationFailed: (failed: boolean) => void
) => {
  const [roomInput, setRoomInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = chainId !== 10143;

  const handleCreateRoom = async () => {
    if (!isConnected || !address || !multisynqReady) return;

    if (isWrongNetwork) {
      try {
        await switchChain({ chainId: 10143 });
        setTimeout(() => handleCreateRoom(), 2000);
        return;
      } catch {
        return;
      }
    }

    setIsCreatingRoom(true);
    setConnectionStatus("Creating room...");

    try {
      const rematchDetails = (window as any).rematchRoomDetails;
      const roomName =
        rematchDetails?.roomName ||
        `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password =
        rematchDetails?.password || Math.random().toString(36).substring(2, 6);
      const gameTime = rematchDetails?.gameTime || selectedGameTime;
      const playerId = `player_${address.slice(-8)}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      if (rematchDetails) {
        delete (window as any).rematchRoomDetails;
      }

      setCurrentPlayerId(playerId);

      const session = await createMultisynqSession(roomName, password);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      setGameState((prev: any) => ({
        ...prev,
        roomName,
        roomPassword: password,
        gameTimeLimit: gameTime,
        whiteTime: gameTime,
        blackTime: gameTime,
      }));
      setHasClosedPaymentModal(false);

      if (isBettingEnabled && parseFloat(betAmount) > 0) {
        try {
          setBettingGameCreationFailed(false);
          await createBettingGame(betAmount, roomName);
          setRoomBetAmount(betAmount);
        } catch (error) {
          console.error("Échec création betting game:", error);
          setBettingGameCreationFailed(true);
        }
      } else {
        session.view.joinPlayer(address, playerId);
      }

      setTimeout(() => {
        session.view.setGameTime(gameTime);
      }, 100);

      if (gameTime !== selectedGameTime) {
        setSelectedGameTime(gameTime);
      }

      if ((window as any).Multisynq?.App?.makeWidgetDock) {
        (window as any).Multisynq.App.makeWidgetDock();
      }

      const newUrl = `${window.location.pathname}?room=${roomName}&password=${password}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`Room created: ${roomName}`);
    } catch (error) {
      console.error("Error creating room:", error);
      setConnectionStatus("Error creating room");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!isConnected || !roomInput.trim() || !address || !multisynqReady)
      return;

    if (isWrongNetwork) {
      try {
        await switchChain({ chainId: 10143 });
        setTimeout(() => handleJoinRoom(), 1000);
        return;
      } catch {
        return;
      }
    }

    const input = roomInput.trim();
    let roomName: string;
    let password: string = "";

    if (input.includes(":")) {
      const parts = input.split(":");
      roomName = parts[0];
      password = parts[1] || "";
    } else {
      roomName = input;
    }

    setConnectionStatus("Connecting to room...");

    try {
      const playerId = `player_${address.slice(-8)}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      const session = await createMultisynqSession(roomName, password);

      setCurrentPlayerId(playerId);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      setGameState((prev: any) => ({
        ...prev,
        roomName,
        roomPassword: password || "",
      }));

      setHasClosedPaymentModal(false);

      const newUrl = password
        ? `${window.location.pathname}?room=${roomName}&password=${password}`
        : `${window.location.pathname}?room=${roomName}`;
      window.history.pushState({}, "", newUrl);
    } catch (error) {
      console.error("Error joining room:", error);
      setConnectionStatus("Room not found");
    }
  };

  const handleAutoJoinRoom = async (roomName: string, password: string) => {
    const playerId = `player_${address?.slice(-8)}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connexion automatique...");

    try {
      const rematchAcceptDetails = (window as any).rematchAcceptDetails;
      const gameTime = rematchAcceptDetails?.gameTime || selectedGameTime;

      if (rematchAcceptDetails) {
        delete (window as any).rematchAcceptDetails;
      }

      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      setTimeout(() => {
        setGameState((prev: any) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
          gameTimeLimit: gameTime,
          whiteTime: gameTime,
          blackTime: gameTime,
        }));

        setHasClosedPaymentModal(false);
      }, 200);

      setTimeout(() => {
        session.view.setGameTime(gameTime);
      }, 300);

      if (gameTime !== selectedGameTime) {
        setSelectedGameTime(gameTime);
      }

      const newUrl = password
        ? `${window.location.pathname}?room=${roomName}&password=${password}`
        : `${window.location.pathname}?room=${roomName}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`Connecté à: ${roomName}`);
    } catch {
      setConnectionStatus("Room introuvable");
      window.history.pushState({}, "", window.location.pathname);
    }
  };

  return {
    roomInput,
    setRoomInput,
    isCreatingRoom,
    setIsCreatingRoom,
    isCreatingRematch,
    setIsCreatingRematch,
    isWrongNetwork,
    handleCreateRoom,
    handleJoinRoom,
    handleAutoJoinRoom,
  };
};
