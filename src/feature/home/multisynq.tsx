/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-direct-mutation-state */
"use client";
import { WalletConnection } from "@/components/connect-wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCanCancelGame,
  useChessBetting,
  useCompleteGameInfo,
  useContractEvents,
  useGameIdByRoom,
} from "@/hooks/useChessBetting";
import { Chess } from "chess.js";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { formatEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import CapturedPieces from "./chessboard";

interface Player {
  id: string;
  wallet: string;
  color: "white" | "black";
  connected: boolean;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerWallet: string;
  message: string;
  timestamp: number;
}

interface GameState {
  fen: string;
  isActive: boolean;
  turn: "w" | "b";
  players: Player[];
  maxPlayers: number;
  whiteTime: number;
  blackTime: number;
  gameTimeLimit: number;
  lastMoveTime: number | null;
  roomName: string;
  roomPassword: string;
  messages: ChatMessage[];
  gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
    message?: string;
  };
  drawOffer: {
    offered: boolean;
    by: "white" | "black" | null;
  };
  rematchOffer?: {
    offered: boolean;
    by: "white" | "black" | null;
  };
  gameNumber: number;
  lastGameWinner: "white" | "black" | "draw" | null;
  createdAt: number;
  rematchAccepted?: boolean; // NOUVEAU
}

// Variables globales pour partager l'état avec Multisynq
let globalSetGameState: (state: GameState) => void;

export default function ChessMultisynqApp() {
  const [gameState, setGameState] = useState<GameState>({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    isActive: false,
    turn: "w",
    players: [],
    maxPlayers: 2,
    whiteTime: 600,
    blackTime: 600,
    gameTimeLimit: 600,
    lastMoveTime: null,
    roomName: "",
    roomPassword: "",
    messages: [],
    gameResult: { type: null },
    drawOffer: { offered: false, by: null },
    rematchOffer: { offered: false, by: null },
    gameNumber: 1,
    lastGameWinner: null,
    createdAt: Date.now(),
  });

  const [gameFlow, setGameFlow] = useState<"welcome" | "lobby" | "game">(
    "welcome"
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [, setLastKnownGameState] = useState<GameState | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [selectedGameTime, setSelectedGameTime] = useState(600);
  const [newMessage, setNewMessage] = useState("");
  const [, setConnectionStatus] = useState("Prêt à jouer");

  // États pour les paris
  const [betAmount, setBetAmount] = useState("1");
  const [isBettingEnabled, setIsBettingEnabled] = useState(true);
  const [, setRoomBetAmount] = useState<string | null>(null);
  const [bettingGameCreationFailed, setBettingGameCreationFailed] =
    useState(false);
  const [isRematchTransition, setIsRematchTransition] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<{
    whitePlayerPaid: boolean;
    blackPlayerPaid: boolean;
    currentPlayerPaid: boolean;
  }>({
    whitePlayerPaid: false,
    blackPlayerPaid: false,
    currentPlayerPaid: false,
  });

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [, setMultisynqSession] = useState<any>(null);
  const [multisynqView, setMultisynqView] = useState<any>(null);
  const [multisynqReady, setMultisynqReady] = useState(false);
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [hasClosedModal, setHasClosedModal] = useState(false);
  const [hasClosedPaymentModal, setHasClosedPaymentModal] = useState(false);
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const moveHistoryRef = useRef<string[]>([]);
  const currentMoveIndexRef = useRef(-1);

  // Hooks pour les paris
  const {
    createBettingGame,
    joinBettingGameByRoom,
    claimWinnings,
    claimDrawRefund,
    finishBettingGame,
    isPending,
    isConfirming,
    isSuccess,
    balanceFormatted,
    claimState,
    resetClaimState,
    cancelBettingGame,
    cancelState,
    resetCancelState,
  } = useChessBetting();

  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const { gameId } = useGameIdByRoom(gameState.roomName);
  const { gameInfo, refetchAll } = useCompleteGameInfo(gameId);
  const { canCancel } = useCanCancelGame(gameId);

  // Écouter les événements du contrat pour ce gameId
  useContractEvents(gameId);

  // NOUVEAU: Surveiller les claims et notifier dans le chat
  const [lastClaimState, setLastClaimState] = useState<{
    whiteClaimed: boolean;
    blackClaimed: boolean;
  }>({ whiteClaimed: false, blackClaimed: false });

  useEffect(() => {
    if (!gameInfo || !multisynqView || !currentPlayerId || !address) return;

    // Détecter les nouveaux claims
    const whiteJustClaimed =
      gameInfo.whiteClaimed && !lastClaimState.whiteClaimed;
    const blackJustClaimed =
      gameInfo.blackClaimed && !lastClaimState.blackClaimed;

    if (whiteJustClaimed || blackJustClaimed) {
      setTimeout(() => {
        if (whiteJustClaimed) {
          const isCurrentPlayer =
            gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase();

          // Seul le joueur blanc envoie le message quand il claim
          if (isCurrentPlayer) {
            multisynqView.sendMessage(
              `I just claimed!`,
              currentPlayerId,
              address
            );
          }
        }

        if (blackJustClaimed) {
          const isCurrentPlayer =
            gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase();

          // Seul le joueur noir envoie le message quand il claim
          if (isCurrentPlayer) {
            multisynqView.sendMessage(
              `I just claimed!`,
              currentPlayerId,
              address
            );
          }
        }
      }, 1000);

      setLastClaimState({
        whiteClaimed: gameInfo.whiteClaimed,
        blackClaimed: gameInfo.blackClaimed,
      });
    } else if (
      gameInfo.whiteClaimed !== lastClaimState.whiteClaimed ||
      gameInfo.blackClaimed !== lastClaimState.blackClaimed
    ) {
      setLastClaimState({
        whiteClaimed: gameInfo.whiteClaimed,
        blackClaimed: gameInfo.blackClaimed,
      });
    }
  }, [
    gameInfo?.whiteClaimed,
    gameInfo?.blackClaimed,
    gameInfo?.whitePlayer,
    gameInfo?.blackPlayer,
    multisynqView,
    currentPlayerId,
    address,
    lastClaimState,
  ]);

  // Refetch automatique après transactions réussies
  useEffect(() => {
    if (isSuccess && gameId) {
      console.log("🔄 Transaction réussie, actualisation des données...");
      // Attendre un peu avant de refetch pour que les changements se propagent
      setTimeout(() => {
        refetchAll();
      }, 3000);
    }
  }, [isSuccess, gameId, refetchAll]);

  // Fonction pour finaliser via relayer API
  const finishGameViaRelayer = async (
    gameId: bigint,
    result: 1 | 2 | 3
  ): Promise<boolean> => {
    try {
      console.log("🤖 Tentative de finalisation automatique via relayer...");
      setIsFinalizingGame(true);

      const response = await fetch("/api/finish-game-relayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: gameId.toString(),
          result: result,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(
          "✅ Partie finalisée automatiquement par le relayer:",
          data.transactionHash
        );
        setTimeout(() => {
          setIsFinalizingGame(false);
        }, 2000);
        return true;
      } else {
        console.log("❌ Erreur relayer automatique:", data.error);
        return false;
      }
    } catch (error) {
      console.error("❌ Erreur de communication avec le relayer:", error);
      setTimeout(() => {
        setIsFinalizingGame(false);
      }, 3000);
      return false;
    }
  };

  // Fonction pour terminer une partie avec pari sur le contrat
  const finishGameOnContract = async (gameResult: {
    type: "abandoned" | "draw" | "checkmate" | "stalemate" | "timeout" | null;
    winner?: "white" | "black" | "draw";
  }) => {
    // Seulement terminer sur le contrat si il y a un pari et un gameId
    if (!gameId || !gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      console.log("💰 Pas de pari ou gameId manquant, skip finish on contract");
      return;
    }

    // Seulement si la partie n'est pas déjà terminée sur le contrat
    if (gameInfo.state === 2) {
      // FINISHED state
      console.log("💰 Partie déjà terminée sur le contrat");
      return;
    }

    try {
      let contractResult: 1 | 2 | 3;

      if (gameResult.winner === "white") {
        contractResult = 1; // WHITE_WINS
      } else if (gameResult.winner === "black") {
        contractResult = 2; // BLACK_WINS
      } else {
        contractResult = 3; // DRAW
      }

      console.log("💰 Tentative de finalisation sur le contrat:", {
        gameId: gameId.toString(),
        result: contractResult,
        resultText:
          gameResult.winner === "white"
            ? "WHITE_WINS"
            : gameResult.winner === "black"
            ? "BLACK_WINS"
            : "DRAW",
      });

      // NOUVEAU: Essayer d'abord le relayer automatique
      const relayerSuccess = await finishGameViaRelayer(gameId, contractResult);

      if (relayerSuccess) {
        console.log("✅ Partie finalisée automatiquement via relayer");
      } else {
        // Fallback vers la méthode manuelle
        console.log("⚠️ Relayer automatique échoué, tentative manuelle...");

        try {
          await finishBettingGame(gameId, contractResult);
          console.log(
            "✅ Partie finalisée manuellement sur le contrat avec succès"
          );
          setTimeout(() => {
            setIsFinalizingGame(false);
          }, 2000);
        } catch (manualError) {
          console.error("❌ Erreur finalisation manuelle:", manualError);
          setTimeout(() => {
            setIsFinalizingGame(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error("❌ Erreur lors de la finalisation sur le contrat:", error);
      setTimeout(() => {
        setIsFinalizingGame(false);
      }, 3000);
      // Ne pas faire échouer le jeu si la finalisation échoue
    }
  };

  const hasPlayerPaid = (color: "white" | "black"): boolean => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      console.log("💰 hasPlayerPaid: No betting requirement");
      return true; // Pas de pari requis
    }

    if (!address) {
      console.log("💰 hasPlayerPaid: No address connected");
      return false;
    }

    console.log("💰 hasPlayerPaid check:", {
      color,
      address: address.slice(-4),
      whitePlayer: gameInfo.whitePlayer?.slice(-4),
      blackPlayer: gameInfo.blackPlayer?.slice(-4),
      gameState: gameInfo.state,
      contractIsActive: gameInfo.state === 1,
    });

    // CORRECTION: Si le contrat est ACTIVE, tous les paiements sont valides
    if (gameInfo.state === 1) {
      console.log("💰 hasPlayerPaid: Contract is ACTIVE - player can play");
      return true;
    }

    // Sinon vérifier les adresses individuelles
    if (color === "white") {
      const paid = gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
      console.log(`💰 White player paid: ${paid}`);
      return paid;
    } else {
      const paid = gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();
      console.log(`💰 Black player paid: ${paid}`);
      return paid;
    }
  };

  // Fonction pour vérifier si il y a un pari requis MAIS que la création a échoué
  const hasBettingRequirementButCreationFailed = (): boolean => {
    return (
      isBettingEnabled &&
      parseFloat(betAmount) > 0 &&
      bettingGameCreationFailed &&
      Boolean(gameState.roomName) &&
      (!gameId || gameId === BigInt(0))
    );
  };

  // Vérifier si il y a un pari requis
  const hasBettingRequirement = (): boolean => {
    // NOUVEAU: Pendant la transition de revanche, si betting activé, considérer qu'il y a un requirement
    if (
      isRematchTransition &&
      isBettingEnabled &&
      parseFloat(getCorrectBetAmount()) > 0
    ) {
      console.log("💰 Rematch transition - betting requirement active");
      return true;
    }

    const hasBetting = gameInfo?.betAmount
      ? gameInfo.betAmount > BigInt(0)
      : false;

    if (isBettingEnabled && parseFloat(betAmount) > 0 && gameState.roomName) {
      return true;
    }

    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      return true;
    }

    console.log("💰 hasBettingRequirement check:", {
      gameId,
      gameInfo: !!gameInfo,
      betAmount: gameInfo?.betAmount?.toString(),
      hasBetting,
      roomName: gameState.roomName,
      bettingGameCreationFailed,
      isRematchTransition,
    });
    return hasBetting;
  };

  // Vérifier si les deux joueurs ont payé (nécessaire pour que la partie démarre)
  const bothPlayersPaid = (): boolean => {
    // NOUVEAU: Pendant la transition de revanche, considérer que personne n'a payé pour forcer la popup
    if (
      isRematchTransition &&
      isBettingEnabled &&
      parseFloat(getCorrectBetAmount()) > 0
    ) {
      console.log("💰 Rematch transition - forcing payment popup");
      return false;
    }

    // Si pas de requirement de betting, considérer comme payé
    if (!hasBettingRequirement()) {
      console.log("💰 No betting requirement - considered paid");
      return true;
    }

    // CORRECTION: Vérifier d'abord l'état du contrat (plus fiable)
    if (gameInfo?.state === 1) {
      // ACTIVE
      console.log("💰 Contract is ACTIVE - both players have paid");
      return true;
    }

    // Fallback: vérifier les status individuels
    const bothPaid =
      paymentStatus.whitePlayerPaid && paymentStatus.blackPlayerPaid;
    console.log("💰 Checking individual payment status:", {
      whitePlayerPaid: paymentStatus.whitePlayerPaid,
      blackPlayerPaid: paymentStatus.blackPlayerPaid,
      bothPaid,
      contractState: gameInfo?.state,
    });

    return bothPaid;
  };
  const updatePaymentStatus = () => {
    console.log("💰 UPDATE PAYMENT STATUS - START:", {
      isBettingEnabled,
      betAmount,
      gameInfo: !!gameInfo,
      gameInfoBetAmount: gameInfo?.betAmount?.toString(),
      gameInfoState: gameInfo?.state,
      address,
    });

    // Cas spécial : si betting activé mais pas encore de gameInfo (création en cours)
    if (isBettingEnabled && parseFloat(betAmount) > 0 && !gameInfo) {
      console.log("💰 Betting enabled but no gameInfo yet");
      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });
      return;
    }

    // S'il n'y a pas de pari requis, tout est considéré comme payé
    if (!hasBettingRequirement()) {
      console.log("💰 No betting requirement - all paid");
      setPaymentStatus({
        whitePlayerPaid: true,
        blackPlayerPaid: true,
        currentPlayerPaid: true,
      });
      return;
    }

    if (!gameInfo || !address) {
      console.log("💰 Missing gameInfo or address");
      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });
      return;
    }

    // CORRECTION: Logique simplifiée basée sur l'état du contrat
    // Si le contrat est ACTIVE (state === 1), cela signifie que les DEUX joueurs ont payé
    const contractIsActive = gameInfo.state === 1;

    // Vérifier les paiements individuels basés sur les adresses
    const whitePlayerPaid = !!(
      gameInfo.whitePlayer &&
      gameInfo.whitePlayer !== "0x0000000000000000000000000000000000000000"
    );

    const blackPlayerPaid = !!(
      gameInfo.blackPlayer &&
      gameInfo.blackPlayer !== "0x0000000000000000000000000000000000000000"
    );

    // Vérifier si le joueur actuel a payé
    let currentPlayerPaid = false;
    if (address && gameInfo) {
      const isWhitePlayer =
        gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
      const isBlackPlayer =
        gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

      if (isWhitePlayer) {
        currentPlayerPaid = whitePlayerPaid;
      } else if (isBlackPlayer) {
        currentPlayerPaid = blackPlayerPaid;
      }
    }

    console.log("💰 Payment Status Calculated:", {
      contractIsActive,
      whitePlayerPaid,
      blackPlayerPaid,
      currentPlayerPaid,
      gameState: gameInfo.state,
      userAddress: address?.slice(-4),
      whitePlayer: gameInfo.whitePlayer?.slice(-4),
      blackPlayer: gameInfo.blackPlayer?.slice(-4),
    });

    // NOUVEAU: Si le contrat est ACTIVE, forcer les deux joueurs comme payés
    setPaymentStatus({
      whitePlayerPaid: contractIsActive || whitePlayerPaid,
      blackPlayerPaid: contractIsActive || blackPlayerPaid,
      currentPlayerPaid: currentPlayerPaid,
    });
  };

  // Surveiller les changements de gameInfo pour mettre à jour le statut de paiement
  useEffect(() => {
    updatePaymentStatus();
  }, [gameInfo, gameState.players, currentPlayerId, bettingGameCreationFailed]);

  // NOUVEAU: Refresh plus fréquent quand les joueurs sont en train de payer
  useEffect(() => {
    if (!gameId || !gameInfo || !hasBettingRequirement()) return;

    // Si le contrat existe mais n'est pas encore ACTIVE et qu'il y a 2 joueurs
    if (gameInfo.state === 0 && gameState.players.length >= 2) {
      // WAITING state
      console.log("💰 Refresh fréquent pendant les paiements...");

      const interval = setInterval(() => {
        console.log("🔄 Refresh automatique des données de paiement");
        refetchAll();
        updatePaymentStatus();
      }, 2000); // Refresh toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [gameId, gameInfo?.state, gameState.players.length]);

  // NOUVEAU: Fonction pour obtenir le montant de pari correct (priorité au contrat actuel)
  const getCorrectBetAmount = (): string => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      return formatEther(gameInfo.betAmount);
    }
    return betAmount;
  };

  // NOUVEAU: Synchroniser betAmount avec le montant du contrat actuel
  useEffect(() => {
    if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
      const currentBetAmount = formatEther(gameInfo.betAmount);
      if (currentBetAmount !== betAmount) {
        console.log("💰 Synchronisation du montant de pari:", {
          oldAmount: betAmount,
          newAmount: currentBetAmount,
          gameId: gameId?.toString(),
        });
        setBetAmount(currentBetAmount);
      }
    }
  }, [gameInfo?.betAmount, gameId]);

  // NOUVEAU: Gérer les revanches avec paris
  useEffect(() => {
    if (
      gameState.rematchAccepted &&
      isBettingEnabled &&
      parseFloat(getCorrectBetAmount()) > 0
    ) {
      console.log(
        "🔄 Revanche acceptée avec paris activés - réinitialisation des paiements"
      );

      // NOUVEAU: Activer le mode transition de revanche
      setIsRematchTransition(true);

      // Réinitialiser les états de paiement pour la revanche
      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });

      // Réinitialiser les états de la popup
      setHasClosedPaymentModal(false);
      setBettingGameCreationFailed(false);

      // Créer un nouveau contrat de pari pour la revanche
      const createRematchBettingGame = async () => {
        try {
          console.log(
            "💰 Création d'un nouveau contrat de pari pour la revanche"
          );

          // Créer un nouveau nom de room pour la revanche
          const rematchRoomName = `${gameState.roomName}_rematch_${gameState.gameNumber}`;
          const correctBetAmount = getCorrectBetAmount();

          console.log("💰 Montant de pari pour la revanche:", correctBetAmount);

          await createBettingGame(correctBetAmount, rematchRoomName);
          setRoomBetAmount(correctBetAmount);

          console.log("✅ Nouveau contrat de pari créé pour la revanche");

          // CORRECTION: Mettre à jour le gameState.roomName pour pointer vers le nouveau contrat
          setGameState((prev) => ({
            ...prev,
            roomName: rematchRoomName,
          }));

          // Mettre à jour l'URL avec le nouveau nom de room
          const newUrl = gameState.roomPassword
            ? `${window.location.pathname}?room=${rematchRoomName}&password=${gameState.roomPassword}`
            : `${window.location.pathname}?room=${rematchRoomName}`;
          window.history.pushState({}, "", newUrl);

          // Envoyer un message pour informer
          if (multisynqView) {
            multisynqView.sendMessage(
              "New betting contract created for rematch!",
              currentPlayerId,
              address
            );
          }
        } catch (error) {
          console.error("Échec création du contrat de revanche:", error);
          setBettingGameCreationFailed(true);
        }
      };

      // Créer le contrat avec un délai pour s'assurer que l'état est bien synchronisé
      setTimeout(() => {
        createRematchBettingGame();
      }, 1000);

      // Réinitialiser le flag rematchAccepted côté Multisynq
      if (
        multisynqView &&
        typeof multisynqView.resetRematchAccepted === "function"
      ) {
        setTimeout(() => {
          multisynqView.resetRematchAccepted();
          console.log("✅ Flag rematchAccepted réinitialisé côté Multisynq");
        }, 2000);
      }
    }
  }, [
    gameState.rematchAccepted,
    isBettingEnabled,
    gameState.gameNumber,
    gameState.roomName,
  ]);

  // NOUVEAU: Désactiver le mode transition quand le nouveau gameInfo est disponible
  useEffect(() => {
    if (
      isRematchTransition &&
      gameInfo?.betAmount &&
      gameInfo.betAmount > BigInt(0)
    ) {
      console.log(
        "💰 Nouveau gameInfo détecté, fin de la transition de revanche"
      );
      setIsRematchTransition(false);
    }
  }, [isRematchTransition, gameInfo?.betAmount]);

  // Ajouter des logs de débogage pour la popup
  useEffect(() => {
    const hasBetting = hasBettingRequirement();
    const bothPaid = bothPlayersPaid();
    const creationFailed = hasBettingRequirementButCreationFailed();

    console.log("🐛 DEBUG POPUP CONDITIONS:", {
      hasBetting,
      bothPaid,
      creationFailed,
      bettingGameCreationFailed,
      isBettingEnabled,
      betAmount,
      gameIdExists: !!gameId,
      gameId: gameId?.toString(),
      roomName: gameState.roomName,
      paymentStatus,
      isRematchTransition,
      shouldShowPopup: hasBetting && !bothPaid,
    });
  }, [
    bettingGameCreationFailed,
    gameId,
    paymentStatus,
    gameState.roomName,
    isBettingEnabled,
    betAmount,
    isRematchTransition,
  ]);

  useEffect(() => {
    if (
      multisynqView &&
      currentPlayerId &&
      gameState.roomName &&
      gameFlow === "welcome"
    ) {
      console.log("🔄 Transition vers l'interface de jeu:", gameState.roomName);

      // NOUVEAU: Ne pas auto-transitioner si la popup de pari doit s'afficher
      const shouldShowBettingPopup =
        isBettingEnabled && parseFloat(betAmount) > 0 && !bothPlayersPaid();

      if (!shouldShowBettingPopup) {
        setTimeout(() => {
          setGameFlow("game");
          setConnectionStatus(`Connected to: ${gameState.roomName}`);
        }, 1000);
      } else {
        // Transition immédiate pour afficher la popup
        setGameFlow("game");
        setConnectionStatus(`Connected to: ${gameState.roomName}`);
      }
    }
  }, [
    multisynqView,
    currentPlayerId,
    gameState.roomName,
    gameFlow,
    isBettingEnabled,
    betAmount,
  ]);

  useEffect(() => {
    const currentPlayerInGame = gameState.players.find(
      (p) => p.id === currentPlayerId
    );

    if (
      !currentPlayerInGame &&
      multisynqView &&
      currentPlayerId &&
      address &&
      gameFlow === "game"
    ) {
      // Attendre que les infos du contrat se chargent
      if (gameId === undefined) {
        console.log(
          "⏳ Attente du gameId pour déterminer les exigences de pari..."
        );
        return;
      }

      const hasBetting = hasBettingRequirement();
      console.log("🤔 Vérification du join:", {
        hasBetting,
        currentPlayerPaid: paymentStatus.currentPlayerPaid,
        gameId: gameId?.toString(),
        bothPlayersPaid: bothPlayersPaid(),
        playersInGame: gameState.players.length,
      });

      // NOUVEAU: Joindre immédiatement si pas de betting OU si les deux ont payé
      if (!hasBetting || bothPlayersPaid()) {
        console.log("Join Multisynq immédiat (pas de betting ou tous payés)");
        multisynqView.joinPlayer(address, currentPlayerId);
        return;
      }

      // Cas: Betting requis ET joueur a payé - joindre
      if (hasBetting && paymentStatus.currentPlayerPaid) {
        console.log("💰 Paiement confirmé, join Multisynq...");
        multisynqView.joinPlayer(address, currentPlayerId);

        // Message de confirmation
        setTimeout(() => {
          if (multisynqView && currentPlayerId && address) {
            multisynqView.sendMessage(
              `Player paid and joined the betting game!`,
              currentPlayerId,
              address
            );
          }
        }, 500);
      }
    }
  }, [
    gameState.players,
    multisynqView,
    currentPlayerId,
    address,
    gameFlow,
    gameId,
    paymentStatus.currentPlayerPaid,
    paymentStatus.whitePlayerPaid,
    paymentStatus.blackPlayerPaid,
  ]);

  useEffect(() => {
    if (
      gameState.players.length >= 2 &&
      !gameState.isActive &&
      !gameState.gameResult.type &&
      multisynqView &&
      currentPlayerId &&
      address
    ) {
      const hasBetting = hasBettingRequirement();
      const bothPaid = bothPlayersPaid();

      const shouldStart =
        (!hasBetting || bothPaid) &&
        gameState.players.every((p) => p.connected);

      if (shouldStart) {
        setTimeout(() => {
          if (multisynqView) {
            multisynqView.startGame();

            const message = "Game started - both players have paid!";

            setTimeout(() => {
              if (multisynqView && currentPlayerId && address) {
                multisynqView.sendMessage(message, currentPlayerId, address);
              }
            }, 500);
          }
        }, 1000);
      }
    }
  }, [
    gameState.players.length,
    gameState.isActive,
    gameState.gameResult.type,
    multisynqView,
    currentPlayerId,
    address,
    paymentStatus.whitePlayerPaid,
    paymentStatus.blackPlayerPaid,
    gameInfo?.state,
  ]);

  // Clé pour localStorage basée sur la room
  const getStorageKey = (roomName: string) => `chess_history_${roomName}`;

  // Sauvegarder l'historique dans localStorage
  const saveHistoryToStorage = (
    history: string[],
    index: number,
    roomName: string
  ) => {
    if (roomName) {
      const data = {
        history,
        currentIndex: index,
        savedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(roomName), JSON.stringify(data));
      console.log("📱 Historique sauvegardé dans localStorage:", {
        history: history.length,
        index,
        room: roomName,
      });
    }
  };

  // Charger l'historique depuis localStorage
  const loadHistoryFromStorage = (roomName: string) => {
    if (!roomName) return null;

    try {
      const stored = localStorage.getItem(getStorageKey(roomName));
      if (stored) {
        const data = JSON.parse(stored);
        console.log("📱 Historique chargé depuis localStorage:", {
          history: data.history?.length,
          index: data.currentIndex,
          room: roomName,
        });
        return data;
      }
    } catch (error) {
      console.error("Erreur chargement localStorage:", error);
    }
    return null;
  };

  // Supprimer l'historique du localStorage
  const clearHistoryFromStorage = (roomName: string) => {
    if (roomName) {
      localStorage.removeItem(getStorageKey(roomName));
      console.log("🗑️ Historique supprimé du localStorage pour:", roomName);
    }
  };
  const isWrongNetwork = chainId !== 10143;
  console.log("chainId", chainId, isWrongNetwork);
  const gameRef = useRef(new Chess());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer fonctionnel - seul le premier joueur gère le timer
  useEffect(() => {
    const isFirstPlayer =
      gameState.players.length > 0 &&
      gameState.players[0].id === currentPlayerId;

    if (gameState.isActive && !gameState.gameResult.type && isFirstPlayer) {
      // Démarrer le timer (seulement pour le premier joueur)
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 1000);
      console.log("Timer démarré par le premier joueur");
    } else {
      // Arrêter le timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    gameState.isActive,
    gameState.gameResult.type,
    gameState.players,
    currentPlayerId,
    multisynqView,
  ]);

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      console.log("🎨 Setting player color:", {
        playerId: currentPlayer.id.slice(-4),
        playerColor: currentPlayer.color,
        wallet: currentPlayer.wallet.slice(-4),
      });

      setPlayerColor(currentPlayer.color === "black" ? "black" : "white");

      // Si on était en train de se reconnecter, maintenant c'est réussi
      if (isReconnecting) {
        setIsReconnecting(false);
        console.log("✅ Reconnexion réussie! Joueur retrouvé:", {
          id: currentPlayer.id,
          color: currentPlayer.color,
          wallet:
            currentPlayer.wallet.slice(0, 6) +
            "..." +
            currentPlayer.wallet.slice(-4),
        });
      }
    } else if (
      gameState.players.length > 0 &&
      currentPlayerId &&
      !isReconnecting
    ) {
      // Si on a un ID mais qu'on ne trouve pas le joueur dans une partie active
      const hasActiveGame = gameState.isActive || gameState.gameResult.type;
      if (hasActiveGame) {
        console.log(
          "⚠️ Joueur non trouvé dans la partie active, tentative de reconnexion..."
        );
        setIsReconnecting(true);

        // Tenter une reconnexion automatique
        setTimeout(() => {
          if (multisynqView && address && currentPlayerId) {
            console.log("Tentative de reconnexion automatique...");
            multisynqView.joinPlayer(address, currentPlayerId);
          }
        }, 1000);
      }
    }

    setLastKnownGameState(gameState);
  }, [
    gameState.players,
    currentPlayerId,
    isReconnecting,
    gameState.isActive,
    gameState.gameResult.type,
    address,
    multisynqView,
  ]);

  // Mettre à jour les refs quand l'état change et sauvegarder dans localStorage
  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    currentMoveIndexRef.current = currentMoveIndex;

    // Sauvegarder dans localStorage si on a une room active
    if (gameState.roomName && moveHistory.length > 0) {
      saveHistoryToStorage(moveHistory, currentMoveIndex, gameState.roomName);
    }
  }, [moveHistory, currentMoveIndex, gameState.roomName]);

  // Synchroniser gameRef avec l'état
  useEffect(() => {
    if (gameState.fen) {
      gameRef.current.load(gameState.fen);

      // Si on n'est pas en mode navigation, mettre à jour la position affichée
      if (
        currentMoveIndexRef.current === moveHistoryRef.current.length - 1 ||
        moveHistoryRef.current.length === 0
      ) {
        setFen(gameState.fen);
      }

      // Détecter un nouveau coup et l'ajouter à l'historique
      // CORRECTION: Inclure les coups qui terminent la partie (échec et mat)
      if (
        moveHistoryRef.current.length > 0 &&
        gameState.fen !==
          moveHistoryRef.current[moveHistoryRef.current.length - 1]
      ) {
        console.log("🆕 Nouveau coup détecté:", {
          nouveauFen: gameState.fen,
          dernierFenHistorique:
            moveHistoryRef.current[moveHistoryRef.current.length - 1],
          tailleHistorique: moveHistoryRef.current.length,
          isActive: gameState.isActive,
          gameResult: gameState.gameResult.type,
        });

        // Ajouter la nouvelle position à l'historique
        const newHistory = [...moveHistoryRef.current, gameState.fen];
        setMoveHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);
        setFen(gameState.fen);
      }
    }
  }, [gameState.fen, gameState.isActive]);

  // Ouvrir le modal quand la partie se termine (seulement si pas fermé manuellement)
  useEffect(() => {
    if (gameState.gameResult.type && !showGameEndModal && !hasClosedModal) {
      setShowGameEndModal(true);
    } else if (!gameState.gameResult.type && showGameEndModal) {
      setShowGameEndModal(false);
      setHasClosedModal(false); // Réinitialiser pour la prochaine partie
    }
  }, [gameState.gameResult.type, showGameEndModal, hasClosedModal]);

  // Réinitialiser l'historique quand une nouvelle partie commence
  useEffect(() => {
    if (
      gameState.isActive &&
      gameState.fen ===
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    ) {
      console.log("Réinitialisation de l'historique pour nouvelle partie");

      // Supprimer l'ancien historique du localStorage
      if (gameState.roomName) {
        clearHistoryFromStorage(gameState.roomName);
      }

      setMoveHistory([
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ]);
      setCurrentMoveIndex(0);
      setHasClosedModal(false); // Réinitialiser pour permettre l'ouverture auto de la modal
      setHasClosedPaymentModal(false); // Réinitialiser pour permettre l'ouverture de la modal de paiement
    }
  }, [gameState.isActive, gameState.gameNumber]);

  // Charger l'historique depuis localStorage quand on rejoint une room
  useEffect(() => {
    if (
      gameState.roomName &&
      moveHistory.length === 0 &&
      gameState.players.length > 0
    ) {
      const savedHistory = loadHistoryFromStorage(gameState.roomName);

      if (
        savedHistory &&
        savedHistory.history &&
        savedHistory.history.length > 0
      ) {
        console.log("📥 Chargement de l'historique depuis localStorage");
        setMoveHistory(savedHistory.history);
        setCurrentMoveIndex(savedHistory.currentIndex);
        // Afficher la position correspondant à l'index sauvegardé
        if (savedHistory.history[savedHistory.currentIndex]) {
          setFen(savedHistory.history[savedHistory.currentIndex]);
        }
      } else {
        console.log("🆔 Initialisation de l'historique initial");
        setMoveHistory([
          "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ]);
        setCurrentMoveIndex(0);
      }
    }
  }, [gameState.roomName, gameState.players.length, moveHistory.length]);

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    const isFirstPlayer =
      gameState.players.length > 0 &&
      gameState.players[0].id === currentPlayerId;

    // CORRECTION: Seulement démarrer le timer si le joueur est connecté et trouvé
    // ET si les deux joueurs ont payé (en cas de pari)
    if (
      gameState.isActive &&
      !gameState.gameResult.type &&
      isFirstPlayer &&
      currentPlayer?.connected &&
      !isReconnecting &&
      bothPlayersPaid()
    ) {
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 1000);
      console.log("⏰ Timer démarré par le premier joueur connecté");
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    gameState.isActive,
    gameState.gameResult.type,
    gameState.players,
    currentPlayerId,
    multisynqView,
    isReconnecting,
    paymentStatus,
  ]);

  // Auto-join depuis l'URL au démarrage
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !multisynqReady ||
      !isConnected ||
      !address
    )
      return;

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get("room");
    const passwordFromUrl = urlParams.get("password");

    if (roomFromUrl && gameFlow === "welcome") {
      console.log("🔗 Auto-join depuis URL:", { roomFromUrl, passwordFromUrl });
      handleAutoJoinRoom(roomFromUrl, passwordFromUrl || "");
    }
  }, [multisynqReady, isConnected, address, gameFlow]);

  const handleAutoJoinRoom = async (roomName: string, password: string) => {
    const playerId = `player_${address?.slice(-8)}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setCurrentPlayerId(playerId);
    setConnectionStatus("Connexion automatique...");

    try {
      const session = await createMultisynqSession(roomName, password);

      setMultisynqSession(session);
      setMultisynqView(session.view);

      console.log(
        "🔍 Méthodes disponibles (auto-join):",
        Object.getOwnPropertyNames(session.view)
      );

      // CORRECTION: Ne pas joindre automatiquement - laisser les useEffect gérer
      // session.view.joinPlayer(address!, playerId);

      setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          roomName,
          roomPassword: password || "",
        }));

        // Réinitialiser les états pour permettre la popup si nécessaire
        setHasClosedPaymentModal(false);

        console.log("Demande de synchronisation d'état après auto-join");
      }, 200);

      setGameFlow("game");
      setConnectionStatus(`✅ Connecté à: ${roomName}`);
    } catch (error) {
      console.error("❌ Erreur auto-join:", error);
      setConnectionStatus("❌ Room introuvable");
      window.history.pushState({}, "", window.location.pathname);
    }
  };

  // Synchroniser les variables globales
  useEffect(() => {
    globalSetGameState = setGameState;
    // Rendre finishGameOnContract accessible globalement
    (window as any).finishGameOnContract = finishGameOnContract;
  }, [gameState, finishGameOnContract]);

  // Charger et initialiser Multisynq
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeMultisynq = async () => {
      // Vérifier si Multisynq est déjà chargé
      if ((window as any).Multisynq) {
        console.log("Multisynq déjà présent");
        setupMultisynqClasses();
        return;
      }

      console.log("📦 Chargement Multisynq depuis CDN...");

      try {
        // Charger le script Multisynq
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log("Multisynq chargé depuis CDN");
            resolve();
          };
          script.onerror = () => {
            console.error("Erreur chargement Multisynq CDN");
            reject(new Error("Failed to load Multisynq"));
          };
          document.head.appendChild(script);
        });

        // Attendre que Multisynq soit disponible
        await waitForMultisynqAvailable();
        setupMultisynqClasses();
      } catch (error) {
        console.error("Erreur lors de l'initialisation Multisynq:", error);
        setConnectionStatus("Erreur chargement Multisynq");
      }
    };

    initializeMultisynq();
  }, []);

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

  const handleRequestRematch = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.requestRematch === "function") {
      multisynqView.requestRematch(currentPlayerId);
      console.log("Demande de revanche envoyée");
    } else {
      console.error("requestRematch n'est pas une fonction:", multisynqView);
      alert("Erreur: Fonction de demande de revanche non disponible.");
    }
  };

  const handleRematchResponse = (accepted: boolean) => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.respondRematch === "function") {
      multisynqView.respondRematch(currentPlayerId, accepted);
      console.log(`Réponse revanche: ${accepted ? "acceptée" : "refusée"}`);
    } else {
      console.error("respondRematch n'est pas une fonction:", multisynqView);
      alert("Erreur: Fonction de réponse à la revanche non disponible.");
    }
  };

  const router = useRouter();
  const handleNewGame = () => {
    router.push("/");
  };

  //   const handleRespondRematch = (data: {
  //     playerId: string;
  //     accepted: boolean;
  //   }) => {
  //     console.log("Réponse revanche:", data);

  //     const player = this.players.find((p: any) => p.id === data.playerId);
  //     if (!player) return;

  //     // Ajouter un message dans le chat
  //     this.state.messages.push({
  //       id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  //       playerId: data.playerId,
  //       playerWallet: player.wallet,
  //       message: data.accepted ? "Accept rematch" : "Decline rematch",
  //       timestamp: Date.now(),
  //     });

  //     if (data.accepted) {
  //       // Revanche acceptée - réinitialiser la partie
  //       this.state.fen =
  //         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  //       this.state.isActive = false; // IMPORTANT: Ne pas démarrer automatiquement
  //       this.state.turn = "w";
  //       this.state.whiteTime = this.state.gameTimeLimit;
  //       this.state.blackTime = this.state.gameTimeLimit;
  //       this.state.gameResult = { type: null };
  //       this.state.drawOffer = { offered: false, by: null };
  //       this.state.gameNumber += 1;
  //       this.state.lastMoveTime = null; // IMPORTANT: Pas de timestamp pour permettre la popup

  //       // Inverser les couleurs pour la revanche
  //       this.state.players.forEach((p: any) => {
  //         p.color = p.color === "white" ? "black" : "white";
  //       });

  //       // NOUVEAU: Ajouter un flag pour indiquer qu'une revanche a été acceptée
  //       this.state.rematchAccepted = true;
  //     }

  //     // Réinitialiser l'offre de revanche
  //     this.state.rematchOffer = { offered: false, by: null };
  //     this.publish(this.sessionId, "game-state", this.state);
  //   };

  const setupMultisynqClasses = () => {
    const { Multisynq } = window as any;
    if (!Multisynq) {
      console.error("Multisynq not available");
      return;
    }

    try {
      console.log("🧩 Configuration des classes Multisynq");

      // Définir le modèle Chess
      class ChessModel extends Multisynq.Model {
        init() {
          console.log("🎯 Initialisation ChessModel");
          this.state = {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            isActive: false,
            turn: "w",
            players: [],
            maxPlayers: 2,
            whiteTime: 600,
            blackTime: 600,
            gameTimeLimit: 600,
            lastMoveTime: null,
            roomName: "",
            roomPassword: "",
            messages: [],
            gameResult: { type: null },
            drawOffer: { offered: false, by: null },
            rematchOffer: { offered: false, by: null },
            gameNumber: 1,
            lastGameWinner: null,
            createdAt: Date.now(),
            rematchAccepted: false, // NOUVEAU
          };

          // S'abonner aux événements - SANS bind() ni fonctions fléchées
          this.subscribe(this.sessionId, "move", "handleMove");
          this.subscribe(this.sessionId, "join-player", "handlePlayerJoin");
          this.subscribe(this.sessionId, "chat-message", "handleChatMessage");
          this.subscribe(this.sessionId, "start-game", "handleStartGame");
          this.subscribe(this.sessionId, "reset-game", "handleResetGame");
          this.subscribe(this.sessionId, "update-timer", "handleUpdateTimer");
          this.subscribe(this.sessionId, "offer-draw", "handleOfferDraw");
          this.subscribe(this.sessionId, "respond-draw", "handleRespondDraw");
          this.subscribe(this.sessionId, "resign", "handleResign");
          this.subscribe(this.sessionId, "set-game-time", "handleSetGameTime");
          this.subscribe(
            this.sessionId,
            "request-rematch",
            "handleRequestRematch"
          );
          this.subscribe(
            this.sessionId,
            "respond-rematch",
            "handleRespondRematch"
          );
          this.subscribe(
            this.sessionId,
            "reset-rematch-accepted",
            "handleResetRematchAccepted"
          );
          // Publier l'état initial
          this.publish(this.sessionId, "game-state", this.state);
        }

        // Ajoutez ces nouvelles méthodes dans ChessModel :
        handleSetGameTime(data: { gameTime: number }) {
          console.log("Réglage du temps de jeu:", data);
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRequestRematch(data: { playerId: string }) {
          console.log("Demande de revanche:", data);

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Request rematch",
            timestamp: Date.now(),
          });

          // Marquer qu'une revanche est demandée
          this.state.rematchOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRespondRematch(data: { playerId: string; accepted: boolean }) {
          console.log("Réponse revanche:", data);

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept rematch" : "Decline rematch",
            timestamp: Date.now(),
          });

          if (data.accepted) {
            // Revanche acceptée - réinitialiser la partie MAIS ne pas démarrer automatiquement
            this.state.fen =
              "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
            this.state.isActive = false; // IMPORTANT: Ne pas démarrer automatiquement
            this.state.turn = "w";
            this.state.whiteTime = this.state.gameTimeLimit;
            this.state.blackTime = this.state.gameTimeLimit;
            this.state.gameResult = { type: null };
            this.state.drawOffer = { offered: false, by: null };
            this.state.gameNumber += 1;
            this.state.lastMoveTime = null; // IMPORTANT: Pas de timestamp pour permettre la popup

            // Inverser les couleurs pour la revanche
            this.state.players.forEach((p: any) => {
              p.color = p.color === "white" ? "black" : "white";
            });

            // NOUVEAU: Marquer qu'une revanche a été acceptée pour déclencher les paiements
            this.state.rematchAccepted = true;
          }

          // Réinitialiser l'offre de revanche
          this.state.rematchOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResetRematchAccepted() {
          console.log("🔄 Réinitialisation du flag rematchAccepted");
          this.state.rematchAccepted = false;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleMove(data: {
          from: any;
          to: any;
          promotion: any;
          playerId: any;
        }) {
          console.log("🏃 Traitement mouvement:", data);
          const { from, to, promotion } = data;

          const chess = new Chess(this.state.fen);

          try {
            const move = chess.move({
              from,
              to,
              promotion: promotion || "q",
            });

            if (move) {
              this.state.fen = chess.fen();
              this.state.turn = chess.turn();
              this.state.lastMoveTime = Date.now();

              // Vérifier fin de partie
              if (chess.isGameOver()) {
                this.state.isActive = false;
                if (chess.isCheckmate()) {
                  this.state.gameResult = {
                    type: "checkmate",
                    winner: chess.turn() === "w" ? "black" : "white",
                    message: `Checkmate ! ${
                      chess.turn() === "w" ? "Black" : "White"
                    } win`,
                  };
                  // Finaliser sur le contrat si pari activé
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                } else if (chess.isStalemate()) {
                  this.state.gameResult = {
                    type: "stalemate",
                    winner: "draw",
                    message: "Pat ! Draw",
                  };
                  // Finaliser sur le contrat si pari activé
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                } else if (chess.isDraw()) {
                  this.state.gameResult = {
                    type: "draw",
                    winner: "draw",
                    message: "Draw",
                  };
                  // Finaliser sur le contrat si pari activé
                  if (
                    // @ts-ignore
                    globalSetGameState &&
                    (window as any).finishGameOnContract
                  ) {
                    setTimeout(
                      () =>
                        (window as any).finishGameOnContract(
                          this.state.gameResult
                        ),
                      1000
                    );
                  }
                }

                this.publish(this.sessionId, "game-state", this.state);
              }
            }
          } catch (error) {
            console.error("Mouvement invalide:", error);
          }
        }

        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) return;

          // Décrémenter exactement 1 seconde pour le joueur actuel
          if (this.state.turn === "w") {
            this.state.whiteTime = Math.max(0, this.state.whiteTime - 1);

            if (this.state.whiteTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "black",
                message: "Time's up! Black wins",
              };
              this.state.lastGameWinner = "black";
              // Finaliser sur le contrat si pari activé
              // @ts-ignore
              if (globalSetGameState && (window as any).finishGameOnContract) {
                setTimeout(
                  () =>
                    (window as any).finishGameOnContract(this.state.gameResult),
                  1000
                );
              }
            }
          } else {
            this.state.blackTime = Math.max(0, this.state.blackTime - 1);

            if (this.state.blackTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "white",
                message: "Time's up! White wins",
              };
              this.state.lastGameWinner = "white";
              // Finaliser sur le contrat si pari activé
              // @ts-ignore
              if (globalSetGameState && (window as any).finishGameOnContract) {
                setTimeout(
                  () =>
                    (window as any).finishGameOnContract(this.state.gameResult),
                  1000
                );
              }
            }
          }

          // Mettre à jour le timestamp
          this.state.lastMoveTime = Date.now();
          this.publish(this.sessionId, "game-state", this.state);
        }

        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          console.log("👤 Joueur rejoint:", data);
          console.log("👥 Joueurs actuels:", this.state.players);

          const { playerId, wallet } = data;

          // CORRECTION: Vérifier si le joueur existe déjà par son wallet (reconnexion)
          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // CORRECTION: Mettre à jour le joueur existant avec le nouveau playerId
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId; // Nouveau ID après refresh
            console.log("✅ Joueur existant reconnecté avec nouveau ID:", {
              wallet: wallet.slice(0, 6) + "..." + wallet.slice(-4),
              oldId: "refresh",
              newId: playerId,
              color: this.state.players[existingPlayerIndex].color,
            });

            // Ajouter un message de reconnexion dans le chat
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: "Reconnected to the game",
              timestamp: Date.now(),
            });

            console.log(
              "📊 État final des joueurs (reconnexion):",
              this.state.players
            );
            this.publish(this.sessionId, "game-state", this.state);
            return; // IMPORTANT: Sortir ici pour éviter de traiter comme un nouveau joueur
          }

          // Si ce n'est pas une reconnexion et qu'il y a de la place
          else if (this.state.players.length < this.state.maxPlayers) {
            // CORRECTION IMPORTANTE: Assigner la couleur selon l'ordre d'arrivée
            // Le PREMIER joueur est TOUJOURS blanc, le DEUXIÈME est TOUJOURS noir
            const color = this.state.players.length === 0 ? "white" : "black";

            const newPlayer = {
              id: playerId,
              wallet,
              color,
              connected: true,
            };

            this.state.players.push(newPlayer);
            console.log("✅ Nouveau joueur ajouté:", newPlayer);

            // Ajouter un message de bienvenue
            this.state.messages.push({
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              playerId: playerId,
              playerWallet: wallet,
              message: `Joined as ${color}`,
              timestamp: Date.now(),
            });
          } else {
            console.warn("⚠️ Room pleine, impossible d'ajouter le joueur");
            return; // Ne pas publier si room pleine
          }

          console.log("📊 État final des joueurs:", this.state.players);
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
          console.log("💬 Message chat:", message);
          this.state.messages.push({
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          });
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleStartGame() {
          console.log("🚀 Démarrage de la partie");
          if (this.state.players.length >= 2) {
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();
            // Réinitialiser les offres de draw/rematch
            this.state.drawOffer = { offered: false, by: null };
            this.state.rematchOffer = { offered: false, by: null };

            console.log("✅ Partie activée:", {
              players: this.state.players.length,
              isActive: this.state.isActive,
              gameNumber: this.state.gameNumber,
              whiteTime: this.state.whiteTime,
              blackTime: this.state.blackTime,
            });

            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        handleResetGame() {
          console.log("Reset de la partie");
          this.state.fen =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          this.state.isActive = false;
          this.state.turn = "w";
          this.state.whiteTime = this.state.gameTimeLimit;
          this.state.blackTime = this.state.gameTimeLimit;
          this.state.gameResult = { type: null };
          this.state.drawOffer = { offered: false, by: null };
          this.state.gameNumber += 1;
          this.state.lastMoveTime = null;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleOfferDraw(data: { playerId: string }) {
          console.log("Draw offer:", data);

          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          this.state.drawOffer = {
            offered: true,
            by: player.color as "white" | "black",
          };

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Offer draw",
            timestamp: Date.now(),
          });

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRespondDraw(data: { playerId: string; accepted: boolean }) {
          console.log("Respond draw:", data);

          if (!this.state.drawOffer.offered || this.state.gameResult.type)
            return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: data.accepted ? "Accept draw" : "Decline draw offer",
            timestamp: Date.now(),
          });

          if (data.accepted) {
            // Match nul accepté
            this.state.isActive = false;
            this.state.gameResult = {
              type: "draw",
              winner: "draw",
              message: "Draw accepted",
            };
            this.state.lastGameWinner = "draw";
            // Finaliser sur le contrat si pari activé
            // @ts-ignore
            if (globalSetGameState && (window as any).finishGameOnContract) {
              setTimeout(
                () =>
                  (window as any).finishGameOnContract(this.state.gameResult),
                1000
              );
            }
          }

          // Réinitialiser l'offre
          this.state.drawOffer = { offered: false, by: null };
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleResign(data: { playerId: string }) {
          console.log("Resign:", data);

          if (!this.state.isActive || this.state.gameResult.type) return;

          const player = this.state.players.find(
            (p: any) => p.id === data.playerId
          );
          if (!player) return;

          // Ajouter un message dans le chat
          this.state.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            playerId: data.playerId,
            playerWallet: player.wallet,
            message: "Resign",
            timestamp: Date.now(),
          });

          this.state.isActive = false;
          this.state.gameResult = {
            type: "abandoned",
            winner: player.color === "white" ? "black" : "white",
            message: `${
              player.color === "white" ? "White" : "Black"
            } resign ! ${player.color === "white" ? "Black" : "White"} win`,
          };
          this.state.lastGameWinner =
            player.color === "white" ? "black" : "white";

          // Finaliser sur le contrat si pari activé
          // @ts-ignore
          if (globalSetGameState && (window as any).finishGameOnContract) {
            setTimeout(
              () => (window as any).finishGameOnContract(this.state.gameResult),
              1000
            );
          }

          this.publish(this.sessionId, "game-state", this.state);
        }
      }

      // Définir la vue Chess - CORRECTION IMPORTANTE ICI
      class ChessView extends Multisynq.View {
        constructor(model: any) {
          super(model);
          console.log("👁️ Initialisation ChessView");

          // S'abonner aux mises à jour d'état - SANS bind()
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
          console.log("Mise à jour état jeu:", {
            players: newState.players?.length || 0,
            isActive: newState.isActive,
            turn: newState.turn,
            gameResult: newState.gameResult?.type,
          });

          if (globalSetGameState) {
            // @ts-ignore
            globalSetGameState((prevState: GameState) => {
              // NOUVEAU: Vérifier si c'est une vraie mise à jour
              const hasRealChanges =
                JSON.stringify(newState.players) !==
                  JSON.stringify(prevState.players) ||
                newState.isActive !== prevState.isActive ||
                newState.fen !== prevState.fen ||
                newState.turn !== prevState.turn;

              if (hasRealChanges) {
                console.log("✅ Changements détectés, mise à jour de l'état");
              }

              return {
                ...prevState,
                ...newState,
                // S'assurer que les propriétés importantes sont bien mises à jour
                players: newState.players || [],
                messages: newState.messages || [],
                fen: newState.fen || prevState.fen,
                isActive:
                  newState.isActive !== undefined
                    ? newState.isActive
                    : prevState.isActive,
                turn: newState.turn || prevState.turn,
                roomName: newState.roomName || prevState.roomName,
                roomPassword: newState.roomPassword || prevState.roomPassword,
                // NOUVEAU: Préserver les offres en cours
                drawOffer: newState.drawOffer || prevState.drawOffer,
                rematchOffer: newState.rematchOffer || prevState.rematchOffer,
                gameResult: newState.gameResult || prevState.gameResult,
              };
            });
          }
        }

        // Méthodes pour envoyer des actions
        makeMove(from: any, to: any, playerId: any, promotion: any) {
          console.log("📤 Envoi mouvement:", { from, to, playerId });
          this.publish(this.sessionId, "move", {
            from,
            to,
            playerId,
            promotion: promotion || "q",
          });
        }

        joinPlayer(wallet: any, playerId: any) {
          console.log("📤 Envoi join player:", { wallet, playerId });
          this.publish(this.sessionId, "join-player", { wallet, playerId });
        }

        sendMessage(message: any, playerId: any, playerWallet: any) {
          console.log("📤 Envoi message:", { message, playerId });
          this.publish(this.sessionId, "chat-message", {
            message,
            playerId,
            playerWallet,
          });
        }

        startGame() {
          console.log("📤 Envoi start game");
          this.publish(this.sessionId, "start-game", {});
        }

        resetGame() {
          console.log("📤 Envoi reset game");
          this.publish(this.sessionId, "reset-game", {});
        }

        updateTimer() {
          console.log("📤 Envoi update timer");
          this.publish(this.sessionId, "update-timer", {});
        }

        // CORRECTION: Méthodes correctement définies dans la classe
        offerDraw(playerId: string) {
          console.log("📤 Envoi offer draw:", playerId);
          this.publish(this.sessionId, "offer-draw", { playerId });
        }

        respondDraw(playerId: string, accepted: boolean) {
          console.log("📤 Envoi respond draw:", { playerId, accepted });
          this.publish(this.sessionId, "respond-draw", { playerId, accepted });
        }

        resign(playerId: string) {
          console.log("📤 Envoi resign:", playerId);
          this.publish(this.sessionId, "resign", { playerId });
        }

        setGameTime(gameTime: number) {
          console.log("📤 Envoi réglage temps:", gameTime);
          this.publish(this.sessionId, "set-game-time", { gameTime });
        }

        requestRematch(playerId: string) {
          console.log("📤 Envoi demande revanche:", playerId);
          this.publish(this.sessionId, "request-rematch", { playerId });
        }

        respondRematch(playerId: string, accepted: boolean) {
          console.log("📤 Envoi réponse revanche:", { playerId, accepted });
          this.publish(this.sessionId, "respond-rematch", {
            playerId,
            accepted,
          });
        }

        resetRematchAccepted() {
          console.log("📤 Envoi reset rematch accepted");
          this.publish(this.sessionId, "reset-rematch-accepted", {});
        }
      }

      // Enregistrer les classes avec Multisynq selon la documentation officielle
      ChessModel.register("ChessModel");

      // Stocker les références pour l'utilisation locale
      (window as any).ChessModel = ChessModel;
      (window as any).ChessView = ChessView;

      setMultisynqReady(true);
      setConnectionStatus("Multisynq prêt");
      console.log("Classes Multisynq configurées et enregistrées");

      // Vérifier que les méthodes sont présentes dans la classe
      console.log(
        "🔍 Méthodes ChessView:",
        Object.getOwnPropertyNames(ChessView.prototype)
      );
    } catch (error) {
      console.error("Erreur lors de la configuration des classes:", error);
      setConnectionStatus("Erreur configuration Multisynq");
    }
  };

  // CORRECTION IMPORTANTE: Modifiez aussi les handlers dans votre composant principal
  const handleOfferDraw = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    console.log("🔍 Vérification des méthodes disponibles:", {
      offerDraw: typeof multisynqView.offerDraw,
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(multisynqView)),
    });

    if (typeof multisynqView.offerDraw === "function") {
      multisynqView.offerDraw(currentPlayerId);
      console.log("Offre de match nul envoyée");
    } else {
      console.error("offerDraw n'est pas une fonction:", multisynqView);
      alert(
        "Erreur: Fonction d'offre de match nul non disponible. Veuillez recharger la page."
      );
    }
  };

  const handleRespondDraw = (accepted: boolean) => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.respondDraw === "function") {
      multisynqView.respondDraw(currentPlayerId, accepted);
      console.log(`Respond draw: ${accepted ? "accepté" : "refusé"}`);
    } else {
      console.error("Respond draw n'est pas une fonction:", multisynqView);
      alert(
        "Erreur: Fonction de réponse au draw non disponible. Veuillez recharger la page."
      );
    }
  };

  const handleResign = () => {
    if (!multisynqView || !currentPlayerId) {
      console.error("multisynqView ou currentPlayerId manquant");
      return;
    }

    if (typeof multisynqView.resign === "function") {
      multisynqView.resign(currentPlayerId);
      console.log("Abandon envoyé");
    } else {
      console.error("resign n'est pas une fonction:", multisynqView);
    }
  };

  const handleCloseGameEndModal = () => {
    setShowGameEndModal(false);
    setHasClosedModal(true); // Marquer que l'utilisateur a fermé manuellement
    // Ne pas appeler handleRespondDraw(false) pour permettre les revanches ultérieures
  };

  // Fonction pour vérifier si on doit désactiver new game/analysis
  const shouldDisableNavigationButtons = (): boolean => {
    // Si pas de popup endgame active, ne pas désactiver
    if (!showGameEndModal) return false;

    // Si pas de pari, ne pas désactiver
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) return false;

    // Si c'est un draw, ne pas désactiver (les deux peuvent claim)
    if (gameState.gameResult.winner === "draw") return false;

    // Si il y a un gagnant, désactiver tant que :
    if (
      gameState.gameResult.winner === "white" ||
      gameState.gameResult.winner === "black"
    ) {
      // 1. Le jeu n'est pas encore finalisé par le relayer
      if (gameInfo.state !== 2) {
        return true; // Désactiver pendant la finalisation
      }

      // 2. OU le jeu est finalisé mais le gagnant n'a pas claim
      if (gameState.gameResult.winner === "white" && !gameInfo.whiteClaimed) {
        return true;
      }
      if (gameState.gameResult.winner === "black" && !gameInfo.blackClaimed) {
        return true;
      }
    }

    return false;
  };

  // Créer une session Multisynq
  const createMultisynqSession = async (
    roomName: string,
    password: string = ""
  ) => {
    const apiKey = process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY;

    if (!apiKey) {
      throw new Error("Clé API Multisynq manquante");
    }

    if (!multisynqReady) {
      throw new Error("Multisynq n'est pas prêt");
    }

    const { Multisynq } = window as any;
    if (!Multisynq) {
      throw new Error("Multisynq non disponible");
    }

    try {
      console.log("🚀 Création session Multisynq:", { roomName, password });

      const session = await Multisynq.Session.join({
        apiKey,
        appId: "com.onchainchess-novee.game",
        model: (window as any).ChessModel,
        view: (window as any).ChessView,
        name: roomName,
        password: password,
      });

      console.log("Session créée:", session);
      return session;
    } catch (error) {
      console.error("Erreur création session:", error);
      throw error;
    }
  };

  // Créer une nouvelle room
  const handleCreateRoom = async () => {
    if (!isConnected || !address || !multisynqReady) return;

    if (isWrongNetwork) {
      try {
        await switchChain({ chainId: 10143 });
        setTimeout(() => {
          handleCreateRoom();
        }, 2000);
        return;
      } catch (error) {
        console.error("Failed to switch network:", error);
        alert(
          "Failed to switch to Monad Testnet. Please switch manually in your wallet."
        );
        return;
      }
    }

    if (isBettingEnabled && isWrongNetwork) {
      await switchChain({ chainId: 10143 });

      return;
    }

    setIsCreatingRoom(true);
    setConnectionStatus("Creating room...");

    try {
      const roomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password = Math.random().toString(36).substring(2, 6);
      const playerId = `player_${address.slice(-8)}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      setCurrentPlayerId(playerId);

      const session = await createMultisynqSession(roomName, password);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      // Mettre à jour le gameState AVANT tout pour que les useEffect fonctionnent
      setGameState((prev) => ({
        ...prev,
        roomName,
        roomPassword: password,
        gameTimeLimit: selectedGameTime,
        whiteTime: selectedGameTime,
        blackTime: selectedGameTime,
      }));
      setHasClosedPaymentModal(false);

      // Créer la partie avec pari si activé
      if (isBettingEnabled && parseFloat(betAmount) > 0) {
        console.log("💰 Création d'une partie avec pari:", {
          amount: betAmount,
          roomName,
        });

        try {
          setBettingGameCreationFailed(false);
          await createBettingGame(betAmount, roomName);
          setRoomBetAmount(betAmount);

          console.log("💰 Betting game créé, mais n'auto-join pas encore");
          // NE PAS joindre automatiquement - laisser la popup s'afficher
        } catch (error) {
          console.error("❌ Échec création betting game:", error);
          setBettingGameCreationFailed(true);
          // NE PAS joindre automatiquement - laisser la popup s'afficher pour retry
        }
      } else {
        // Pas de betting - joindre Multisynq normalement
        session.view.joinPlayer(address, playerId);
        console.log("✅ Partie sans pari - join Multisynq immédiat");
      }

      // Configurer le temps de jeu
      setTimeout(() => {
        session.view.setGameTime(selectedGameTime);
      }, 100);

      if ((window as any).Multisynq?.App?.makeWidgetDock) {
        (window as any).Multisynq.App.makeWidgetDock();
      }

      const newUrl = `${window.location.pathname}?room=${roomName}&password=${password}`;
      window.history.pushState({}, "", newUrl);

      setGameFlow("game");
      setConnectionStatus(`✅ Room created: ${roomName}`);
    } catch (error) {
      console.error("❌ Error creating room:", error);
      setConnectionStatus("❌ Error creating room");
      alert("Impossible to create the room. Check your Multisynq API key.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!isConnected || !roomInput.trim() || !address || !multisynqReady)
      return;

    // Si mauvais réseau, essayer de changer automatiquement
    if (isWrongNetwork) {
      try {
        await switchChain({ chainId: 10143 });
        // Attendre un peu que le changement de réseau soit effectif
        setTimeout(() => {
          // Relancer le join après le changement de réseau
          handleJoinRoom();
        }, 1000);
        return;
      } catch (error) {
        console.error("Failed to switch network:", error);
        alert(
          "Failed to switch to Monad Testnet. Please switch manually in your wallet."
        );
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

      console.log("🔗 Création session pour join:", roomName);
      const session = await createMultisynqSession(roomName, password);

      setCurrentPlayerId(playerId);
      setMultisynqSession(session);
      setMultisynqView(session.view);

      setGameState((prev) => ({
        ...prev,
        roomName,
        roomPassword: password || "",
      }));

      setHasClosedPaymentModal(false);

      // Mettre à jour l'URL
      const newUrl = password
        ? `${window.location.pathname}?room=${roomName}&password=${password}`
        : `${window.location.pathname}?room=${roomName}`;
      window.history.pushState({}, "", newUrl);

      console.log("✅ Session créée, transition vers game flow");
    } catch (error) {
      console.error("❌ Error joining room:", error);
      setConnectionStatus("❌ Room not found");
      alert(
        `Impossible to join the room "${roomName}". Check the code${
          password ? " and the password" : ""
        }.`
      );
    }
  };

  console.log("🎮 Game State Debug:", {
    players: gameState.players.map((p) => ({
      id: p.id.slice(-4),
      wallet: p.wallet.slice(-4),
      color: p.color,
      connected: p.connected,
    })),
    currentPlayerId: currentPlayerId?.slice(-4),
    playerColor,
    isActive: gameState.isActive,
  });

  const onPieceDrop = (args: PieceDropHandlerArgs): boolean => {
    const { sourceSquare, targetSquare } = args;
    if (!targetSquare || !currentPlayerId || !multisynqView) return false;

    console.log("🎯 Tentative de mouvement:", {
      from: sourceSquare,
      to: targetSquare,
      currentPlayerId: currentPlayerId?.slice(-4),
      gameActive: gameState.isActive,
      gameResult: gameState.gameResult.type,
      currentMoveIndex,
      historyLength: moveHistory.length,
    });

    // Empêcher les mouvements si la partie est terminée ou si on n'est pas à la position actuelle
    if (
      gameState.gameResult.type ||
      currentMoveIndex < moveHistory.length - 1
    ) {
      console.warn(
        "Cannot move pieces while in analysis mode! Return to current position first."
      );
      return false;
    }

    // Empêcher les mouvements si la partie n'est pas active
    if (!gameState.isActive) {
      console.warn("Game is not active!");
      return false;
    }

    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) {
      console.warn("Current player not found in game!");
      return false;
    }

    console.log("👤 Current player info:", {
      id: currentPlayer.id.slice(-4),
      color: currentPlayer.color,
      wallet: currentPlayer.wallet.slice(-4),
      connected: currentPlayer.connected,
    });

    // CORRECTION: Vérification de paiement améliorée
    if (hasBettingRequirement()) {
      const playerPaid = hasPlayerPaid(currentPlayer.color);
      console.log("💰 Payment check:", {
        playerColor: currentPlayer.color,
        playerPaid,
        whitePlayerPaid: paymentStatus.whitePlayerPaid,
        blackPlayerPaid: paymentStatus.blackPlayerPaid,
      });

      if (!playerPaid) {
        console.warn("You must pay the betting amount to play!");
        alert("Vous devez payer le montant du pari pour jouer!");
        return false;
      }
    }

    const currentTurn = gameState.turn;
    console.log("🔄 Turn check:", {
      gameTurn: currentTurn,
      playerColor: currentPlayer.color,
      isPlayerTurn:
        (currentTurn === "w" && currentPlayer.color === "white") ||
        (currentTurn === "b" && currentPlayer.color === "black"),
    });

    if (
      (currentTurn === "w" && currentPlayer.color !== "white") ||
      (currentTurn === "b" && currentPlayer.color !== "black")
    ) {
      console.warn("It's not your turn!");
      return false;
    }

    const tempGame = new Chess(gameState.fen);
    try {
      const moveResult = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
        console.log("✅ Valid move, sending to Multisynq:", {
          from: sourceSquare,
          to: targetSquare,
          playerId: currentPlayerId?.slice(-4),
        });

        multisynqView.makeMove(
          sourceSquare,
          targetSquare,
          currentPlayerId,
          "q"
        );
        return true;
      }
    } catch (error) {
      console.warn("Mouvement invalide:", error);
    }

    return false;
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentPlayerId || !address || !multisynqView)
      return;

    multisynqView.sendMessage(newMessage, currentPlayerId, address);
    setNewMessage("");
  };

  const getCurrentPlayerTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.whiteTime
      : gameState.blackTime;
  };

  const getOpponentTime = (): number => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );
    if (!currentPlayer) return 0;
    return currentPlayer.color === "white"
      ? gameState.blackTime
      : gameState.whiteTime;
  };

  // Fonctions de navigation dans l'historique
  const goToPreviousMove = () => {
    if (currentMoveIndex > 0) {
      const newIndex = currentMoveIndex - 1;
      setCurrentMoveIndex(newIndex);
      setFen(moveHistory[newIndex]);
      // Fermer la modal de fin de partie si elle est ouverte
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const goToNextMove = () => {
    if (currentMoveIndex < moveHistory.length - 1) {
      const newIndex = currentMoveIndex + 1;
      setCurrentMoveIndex(newIndex);
      setFen(moveHistory[newIndex]);
      // Fermer la modal de fin de partie si elle est ouverte
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const goToFirstMove = () => {
    if (moveHistory.length > 0) {
      setCurrentMoveIndex(0);
      setFen(moveHistory[0]);
      // Fermer la modal de fin de partie si elle est ouverte
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };

  const getAvailableAmount = () => {
    if (!gameInfo) return "0";
    if (!gameInfo.betAmount) return "0";
    const totalPot = gameInfo.betAmount * BigInt(2);

    if (gameInfo.result === 3) {
      // DRAW
      const claimedAmount =
        (gameInfo.whiteClaimed ? gameInfo.betAmount : BigInt(0)) +
        (gameInfo.blackClaimed ? gameInfo.betAmount : BigInt(0));
      const available = totalPot - claimedAmount;
      return formatEther(available);
    } else {
      const whiteWon = gameInfo.result === 1; // WHITE_WINS
      const blackWon = gameInfo.result === 2; // BLACK_WINS

      if (whiteWon && gameInfo.whiteClaimed) return "0";
      if (blackWon && gameInfo.blackClaimed) return "0";

      return formatEther(totalPot);
    }
  };

  const goToLastMove = () => {
    if (moveHistory.length > 0) {
      const lastIndex = moveHistory.length - 1;
      setCurrentMoveIndex(lastIndex);
      setFen(moveHistory[lastIndex]);
      // Fermer la modal de fin de partie si elle est ouverte
      if (showGameEndModal) {
        setShowGameEndModal(false);
        setHasClosedModal(true);
      }
    }
  };
  const [copied, setCopied] = useState(false);
  const customPieces = {
    wK: () => (
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    ),
    bK: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/king.png" alt="king" className="h-[85px] mx-auto" />
      </div>
    ),
    // Dames
    wQ: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <circle cx="6" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="14" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="22.5" cy="8" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="31" cy="9" r="2.75" stroke="black" strokeWidth="1.5" />
        <circle cx="39" cy="12" r="2.75" stroke="black" strokeWidth="1.5" />
        <path
          d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-2.5-14.5L22.5 24l-2.5-14.5L14 25 6.5 13.5 9 26z"
          stroke="black"
          strokeWidth="1.5"
        />
        <path
          d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
          stroke="black"
          strokeWidth="1.5"
        />
      </svg>
    ),
    bQ: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/queen.png" alt="queen" className="h-[85px] mx-auto" />
      </div>
    ),
    // Tours
    wR: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M34 14l-3 3H14l-3-3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
        />
        <path
          d="M31 17v12.5H14V17"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="butt"
          fill="none"
        />
        <path
          d="M11 14h23"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
      </svg>
    ),
    bR: () => <img src="/rook.png" alt="rook" className="h-[85px] mx-auto" />,
    // Fous
    wB: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <g
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        </g>
      </svg>
    ),
    bB: () => (
      <img src="/bishop.png" alt="bishop" className="h-[85px] mx-auto" />
    ),
    // Cavaliers
    wN: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bN: () => (
      <img src="/cavalier.png" alt="cavalier" className="h-[85px] mx-auto" />
    ),
    // Pions
    wP: () => (
      <svg viewBox="0 0 45 45" fill="white">
        <path
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    bP: () => (
      <div className="w-full h-full flex items-center justify-center h-[85px]">
        <img src="/pawn.png" alt="pawn" className="h-[70px] mx-auto" />
      </div>
    ),
  } as const;
  const chessboardOptions = {
    position: fen,
    onPieceDrop: onPieceDrop,
    boardOrientation: playerColor,
    arePiecesDraggable: gameState.isActive,
    boardWidth: 580,
    animationDuration: 200,
    customPieces: customPieces,
  };

  const [menuActive, setMenuActive] = useState("create");

  // Interface d'accueil
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] bg-center bg-cover flex items-center justify-center p-4">
        <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/5">
          <div className="text-center mb-10">
            <div className="flex items-center justify-between w-full">
              <img src="/synqmate.png" alt="logo" className="w-[250px]" />
              <WalletConnection />
            </div>
          </div>

          {!isConnected ? (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to Multisynq Chess
              </h2>
              <p className="text-white/80 text-lg mb-8">
                Multisynq is a platform for playing chess with friends.
              </p>
              <p className="text-white/80 text-lg mb-8">
                Connect your wallet to start playing
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setMenuActive("create")}
                  className={`group rounded-xl border ${
                    menuActive === "create"
                      ? "border-[#836EF9] bg-[#2b2b2b]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                  } text-white text-lg font-semibold py-4 transition-all duration-200`}
                >
                  Create Game
                </button>

                <button
                  onClick={() => setMenuActive("join")}
                  className={`group rounded-xl border ${
                    menuActive === "join"
                      ? "border-[#836EF9] bg-[#2b2b2b]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                  } text-white text-lg font-semibold py-4 transition-all duration-200`}
                >
                  Join Game
                </button>
              </div>
              {menuActive === "create" ? (
                <div className="bg-[#252525] border border-white/5 rounded-2xl p-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xl font-medium text-white mb-3">
                        Game Settings
                      </label>
                      <Select
                        value={selectedGameTime.toString()}
                        onValueChange={(value) =>
                          setSelectedGameTime(Number(value))
                        }
                      >
                        <SelectTrigger className="w-full text-lg bg-[#2b2b2b] border-white/5 h-[50px] text-white">
                          <SelectValue
                            placeholder="Select game duration"
                            className="text-lg"
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-[#252525] border-white/10 text-lg text-white">
                          <SelectItem className="text-lg" value="180">
                            3 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="300">
                            5 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="600">
                            10 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="900">
                            15 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="1800">
                            30 minutes
                          </SelectItem>
                          <SelectItem className="text-lg" value="3600">
                            1 hour
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-medium text-white">
                        Enable Betting
                      </h3>
                      <label className="flex items-center cursor-pointer">
                        <div
                          className={`w-14 h-6 rounded-full transition-colors ${
                            isBettingEnabled ? "bg-[#836EF9]" : "bg-[#2b2b2b]"
                          }`}
                        >
                          <div
                            className={`w-[21px] h-[21px] bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
                              isBettingEnabled
                                ? "translate-x-7 ml-1"
                                : "translate-x-0 ml-0.5"
                            }`}
                          ></div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isBettingEnabled}
                          onChange={(e) =>
                            setIsBettingEnabled(e.target.checked)
                          }
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {isBettingEnabled && (
                      <div className="space-y-2">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          placeholder="Enter bet amount"
                          className="w-full px-4 py-3 focus:outline-none bg-[#2b2b2b] border border-white/5 rounded-lg text-white text-lg focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                        />
                        <div className="text-base text-white/80">
                          Balance:{" "}
                          {balanceFormatted?.split(".")?.[0] +
                            "." +
                            balanceFormatted?.split(".")?.[1]?.slice(0, 2)}{" "}
                          MON
                          {(isPending || isConfirming) && (
                            <span className="ml-2 text-yellow-400">
                              {isPending ? "Signing..." : "Confirming..."}
                            </span>
                          )}
                          {isSuccess && (
                            <span className="ml-2 text-green-400">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleCreateRoom}
                      disabled={
                        isCreatingRoom || !multisynqReady || isWrongNetwork
                      }
                      className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-4 px-6 rounded-xl text-lg transition-all"
                    >
                      {isWrongNetwork
                        ? "🔄 Switch to Monad & Create"
                        : isCreatingRoom
                        ? "Creating..."
                        : !multisynqReady
                        ? "Loading Multisynq..."
                        : "Create Game"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className=" text-center">
                  <div className="bg-[#252525] border border-white/5 rounded-2xl p-8 pt-6">
                    <label className="block text-xl font-medium text-left text-white  mb-3">
                      {" "}
                      Room Code
                    </label>
                    <input
                      type="text"
                      placeholder="Enter room code (e.g. room:password)"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      className="w-full p-4 bg-[#2b2b2b] focus:outline-none border border-white/10 text-white rounded-lg text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={
                        !roomInput.trim() ||
                        !multisynqReady ||
                        isPending ||
                        isWrongNetwork
                      }
                      className="w-full bg-gradient-to-r from-[#836EF9] to-[#836EF9]/80 hover:from-[#836EF9]/80 hover:to-[#836EF9] disabled:from-[rgba(255,255,255,0.07)] disabled:to-[rgba(255,255,255,0.07)] text-white font-medium py-4 px-6 rounded-xl text-lg transition-all"
                    >
                      {isWrongNetwork
                        ? "🔄 Switch to Monad & Join"
                        : isPending
                        ? "Processing..."
                        : "Join Game"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {isConnected && isWrongNetwork && (
            <div className="mt-8 bg-red-500/20 border border-red-400 rounded-xl p-6">
              <div className="text-center">
                <h3 className="text-red-300 font-bold text-xl mb-3">
                  Wrong Network Detected
                </h3>
                <p className="text-red-200 text-lg mb-4">
                  Please switch to <strong>Monad Testnet</strong> to use betting
                  features
                </p>
                <button
                  onClick={async () => {
                    try {
                      await switchChain({ chainId: 10143 });
                    } catch (error) {
                      console.error("Failed to switch network:", error);
                      alert(
                        "Failed to switch network. Please switch manually in your wallet."
                      );
                    }
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-lg transition-colors"
                >
                  🔄 Switch to Monad Testnet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log(gameState);

  //   const isWinner =
  //     gameState.gameResult.winner ===
  //     gameState.players.find((p) => p.id === currentPlayerId)?.color;

  const isDraw = gameState.gameResult.winner === "draw";

  // console.log("moveHistory", moveHistory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 my-8 ">
          <div className="w-full">
            <div className="flex items-center justify-between w-full gap-3">
              {/* <img src="/synqmate.png" alt="logo" className=" w-[240px]" /> */}

              {isReconnecting && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 border border-orange-400 rounded">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-orange-200 text-sm">
                    Reconnecting...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Panel central - Échiquier */}
          <div className="lg:col-span-4">
            <div className="relative">
              <div className="lg:col-span-3">
                <div className="rounded-xl">
                  {/* Pièces capturées par l'adversaire (en haut) */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center justify-between">
                      {gameState.players.find(
                        (entry) => entry.wallet !== address
                      ) ? (
                        <div
                          key={
                            gameState.players.find(
                              (entry) => entry.wallet !== address
                            )?.id
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xl text-white flex items-center gap-2">
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(0, 6)}
                                ...
                                {gameState.players
                                  .find((entry) => entry.wallet !== address)
                                  ?.wallet.slice(-4)}
                                {/* Indicateur de connexion */}
                                {gameState.players.find(
                                  (entry) => entry.wallet !== address
                                )?.connected ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={true}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white flex items-center gap-1">
                              <span className="animate-[bounce_1s_infinite] text-2xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.2s] text-2xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.4s] text-2xl">
                                .
                              </span>
                              Waiting for opponent
                            </div>
                            <div className="text-sm text-gray-300">Offline</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className={`backdrop-blur-md rounded-lg px-2 py-1 border ${
                        getOpponentTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-2xl font-bold ${
                          getOpponentTime() <= 30
                            ? "text-red-500"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getOpponentTime() / 60)}:
                        {(getOpponentTime() % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {/* Container de l'échiquier avec overlay */}
                  <div className="relative aspect-square max-w-full w-full mx-auto">
                    <Chessboard options={chessboardOptions} />

                    {/* Modal de paiement */}
                    {((isBettingEnabled &&
                      parseFloat(betAmount) > 0 &&
                      gameState.roomName &&
                      !bothPlayersPaid()) ||
                      (gameInfo?.betAmount &&
                        gameInfo.betAmount > BigInt(0) &&
                        !bothPlayersPaid()) ||
                      (gameState.rematchAccepted &&
                        isBettingEnabled &&
                        parseFloat(betAmount) > 0 &&
                        !bothPlayersPaid()) ||
                      (isRematchTransition &&
                        isBettingEnabled &&
                        parseFloat(betAmount) > 0)) &&
                      !hasClosedPaymentModal &&
                      gameFlow === "game" && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
                          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
                            <div className="text-center">
                              <h3 className="text-3xl font-bold text-white mb-6">
                                Payment Status
                              </h3>

                              <div className="rounded-lg mb-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white font-medium">
                                        White Player (Creator):
                                      </span>
                                      <span className="text-gray-400 text-sm">
                                        {gameInfo?.whitePlayer
                                          ? `${gameInfo.whitePlayer.slice(
                                              0,
                                              6
                                            )}...${gameInfo.whitePlayer.slice(
                                              -4
                                            )}`
                                          : "Waiting..."}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                        paymentStatus.whitePlayerPaid
                                          ? "bg-green-500/20 text-green-300 border border-green-400"
                                          : "bg-red-500/20 text-red-500 border border-red-500"
                                      }`}
                                    >
                                      {paymentStatus.whitePlayerPaid
                                        ? "PAID"
                                        : "NOT PAID"}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white font-medium">
                                        Black Player (Joiner):
                                      </span>
                                      <span className="text-gray-400 text-sm">
                                        {gameInfo?.blackPlayer &&
                                        gameInfo.blackPlayer !==
                                          "0x0000000000000000000000000000000000000000"
                                          ? `${gameInfo.blackPlayer.slice(
                                              0,
                                              6
                                            )}...${gameInfo.blackPlayer.slice(
                                              -4
                                            )}`
                                          : "Waiting for player..."}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                        paymentStatus.blackPlayerPaid
                                          ? "bg-green-500/20 text-green-300 border border-green-400"
                                          : "bg-red-500/20 text-red-500 border border-red-500"
                                      }`}
                                    >
                                      {paymentStatus.blackPlayerPaid
                                        ? "PAID"
                                        : "NOT PAID"}
                                    </span>
                                  </div>
                                </div>

                                {/* Indicateur de progression */}
                                <div className="rounded-lg mt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-white text-sm">
                                      Payment Progress:
                                    </span>
                                    <span className="text-white text-sm font-medium">
                                      {(paymentStatus.whitePlayerPaid ? 1 : 0) +
                                        (paymentStatus.blackPlayerPaid ? 1 : 0)}
                                      /2
                                    </span>
                                  </div>
                                  <div className="w-full bg-white/10 rounded-full h-3">
                                    <div
                                      className="bg-[#836EF9] h-3 rounded-full transition-all duration-500"
                                      style={{
                                        width: `${
                                          ((paymentStatus.whitePlayerPaid
                                            ? 1
                                            : 0) +
                                            (paymentStatus.blackPlayerPaid
                                              ? 1
                                              : 0)) *
                                          50
                                        }%`,
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>

                              {!paymentStatus.currentPlayerPaid ? (
                                <div className="space-y-2">
                                  <button
                                    onClick={async () => {
                                      if (isWrongNetwork) {
                                        try {
                                          await switchChain({ chainId: 10143 });
                                          setTimeout(() => {
                                            console.log(
                                              "Network switched, ready for payment"
                                            );
                                          }, 1000);
                                          return;
                                        } catch (error) {
                                          console.error(
                                            "Failed to switch network:",
                                            error
                                          );
                                          alert(
                                            "Failed to switch to Monad Testnet. Please switch manually in your wallet."
                                          );
                                          return;
                                        }
                                      }

                                      // Cas 1: Création de betting game (pas encore de gameInfo)
                                      if (
                                        (!gameInfo ||
                                          gameInfo.betAmount === BigInt(0)) &&
                                        isBettingEnabled &&
                                        parseFloat(betAmount) > 0
                                      ) {
                                        try {
                                          console.log(
                                            "💰 Création du betting game:",
                                            {
                                              amount: betAmount,
                                              roomName: gameState.roomName,
                                            }
                                          );
                                          await createBettingGame(
                                            betAmount,
                                            gameState.roomName
                                          );
                                          setBettingGameCreationFailed(false);
                                          setRoomBetAmount(betAmount);

                                          // Après création réussie, joindre automatiquement
                                          if (
                                            multisynqView &&
                                            currentPlayerId &&
                                            address
                                          ) {
                                            setTimeout(() => {
                                              multisynqView.joinPlayer(
                                                address,
                                                currentPlayerId
                                              );
                                              console.log(
                                                "✅ Créateur joint Multisynq après création réussie"
                                              );
                                            }, 2000);
                                          }
                                        } catch (error) {
                                          console.error(
                                            "❌ Échec création betting game:",
                                            error
                                          );
                                          setBettingGameCreationFailed(true);
                                          alert(
                                            "Failed to create betting game. Please try again."
                                          );
                                        }
                                      }
                                      // Cas 2: Join d'un betting game existant
                                      else if (
                                        gameInfo?.betAmount &&
                                        gameInfo.betAmount > BigInt(0)
                                      ) {
                                        try {
                                          await joinBettingGameByRoom(
                                            gameState.roomName,
                                            gameInfo.betAmount
                                          );
                                          console.log(
                                            "✅ Paiement réussi pour rejoindre le jeu"
                                          );
                                        } catch (error) {
                                          console.error(
                                            "❌ Échec du paiement:",
                                            error
                                          );
                                          alert(
                                            "Payment failed. Please try again."
                                          );
                                        }
                                      }
                                    }}
                                    disabled={
                                      isPending ||
                                      isConfirming ||
                                      !gameState.roomName
                                    }
                                    className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center"
                                  >
                                    {isPending || isConfirming ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2.5" />
                                        {isPending
                                          ? "Signing..."
                                          : "Confirming..."}
                                      </>
                                    ) : isWrongNetwork ? (
                                      "Switch to Monad & Pay"
                                    ) : (
                                      "Bet & Play"
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {canCancel && (
                                    <button
                                      onClick={() =>
                                        cancelBettingGame(
                                          gameId as bigint,
                                          () => {},
                                          (error) => console.error(error)
                                        )
                                      }
                                      className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center"
                                      disabled={cancelState.isLoading}
                                    >
                                      {cancelState.isLoading
                                        ? "Cancelling..."
                                        : `Cancel & Get Refund`}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Indicateur de mode analyse */}
                    {((gameState.gameResult.type && !showGameEndModal) ||
                      (gameState.isActive &&
                        currentMoveIndex < moveHistory.length - 1)) && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="bg-[#252525] backdrop-blur-sm px-3 py-1 flex items-center rounded-lg border border-white/10 shadow-xl">
                          <div className="bg-yellow-300 h-2.5 w-2.5 rounded-full animate-pulse" />
                          <span className="text-white text-sm font-medium ml-2">
                            {gameState.gameResult.type
                              ? "Analysis mode"
                              : "Analysis mode"}
                            {moveHistory.length > 1 &&
                              currentMoveIndex < moveHistory.length - 1 && (
                                <span className="ml-2 text-yellow-300">
                                  (Move {currentMoveIndex}/
                                  {moveHistory.length - 1})
                                </span>
                              )}
                          </span>
                        </div>
                      </div>
                    )}

                    {gameState.isActive &&
                      currentMoveIndex < moveHistory.length - 1 && (
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={goToLastMove}
                            className="bg-[#836EF9]/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#836EF9] text-white text-sm font-medium hover:bg-[#836EF9] transition-colors"
                          >
                            Back to game
                          </button>
                        </div>
                      )}

                    {/* MODAL ENDGAME */}
                    {showGameEndModal && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 backdrop-blur-xs">
                        <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                          <div className="text-center">
                            {/* <h3
                              className={`text-4xl uppercase font-extrabold mb-6 ${
                                isWinner
                                  ? "text-white"
                                  : isDraw
                                  ? "text-white"
                                  : "text-white"
                              }`}
                            >
                              {isWinner
                                ? "You Win"
                                : isDraw
                                ? "Draw"
                                : "You Lost"}
                            </h3> */}

                            {isDraw && (
                              <p className="text-gray-400">
                                {gameState.gameResult.message || ""}
                              </p>
                            )}

                            {/* {gameState.gameResult.winner ===
                            gameState.players.find(
                              (p) => p.id !== currentPlayerId
                            )?.color ? (
                              <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/loser.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="w-2/3 mx-auto"
                              />
                            ) : gameState.gameResult.winner === "draw" ? (
                              <img
                                src="/draw.png"
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            ) : (
                              <img
                                src={"/win.png"}
                                alt="draw"
                                className="w-1/2 mx-auto"
                              />
                            )} */}

                            <div
                              className={`rounded-lg  flex flex-col justify-center `}
                            >
                              <p className="text-white font-bold text-4xl mb-8">
                                {gameState.gameResult.winner ===
                                gameState.players.find(
                                  (p) => p.id !== currentPlayerId
                                )?.color
                                  ? "You Lost"
                                  : "You Won"}
                              </p>
                              {/* <img
                                src={
                                  gameState.gameResult.winner ===
                                  gameState.players.find(
                                    (p) => p.id !== currentPlayerId
                                  )?.color
                                    ? "/loser.png"
                                    : "/win.png"
                                }
                                alt="draw"
                                className="h-[300px] mx-auto"
                              /> */}
                            </div>

                            {/* NOUVEAU: Affichage des claims si il y a un pari */}
                            {gameInfo?.betAmount &&
                              gameInfo.betAmount > BigInt(0) && (
                                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-white font-semibold">
                                      Prize Pool Status
                                    </h4>
                                    <span className="text-green-400 font-bold">
                                      {formatEther(
                                        gameInfo.betAmount * BigInt(2)
                                      )}{" "}
                                      MON
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {/* White Player Claim Status */}
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-white rounded-full"></div>
                                        <span className="text-white text-sm">
                                          White:{" "}
                                          {gameInfo.whitePlayer.slice(0, 6)}...
                                          {gameInfo.whitePlayer.slice(-4)}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-lg text-xs flex items-center justify-center gap-2 font-medium ${
                                          gameInfo.whiteClaimed
                                            ? "bg-green-500/20 text-green-300"
                                            : gameInfo.result === 3 ||
                                              gameInfo.result === 1 // DRAW ou WHITE_WINS
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        }`}
                                      >
                                        {isFinalizingGame && (
                                          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-yellow-400" />
                                        )}
                                        {gameInfo.whiteClaimed
                                          ? "Claimed"
                                          : gameInfo.result === 3 // DRAW
                                          ? "Can claim"
                                          : gameInfo.result === 1 // WHITE_WINS
                                          ? "Winner - can claim"
                                          : "Lost - no claim"}
                                      </span>
                                    </div>

                                    {/* Black Player Claim Status */}
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-black border border-white rounded-full"></div>
                                        <span className="text-white text-sm">
                                          Black:{" "}
                                          {gameInfo.blackPlayer.slice(0, 6)}...
                                          {gameInfo.blackPlayer.slice(-4)}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-lg text-xs flex items-center justify-center gap-2 font-medium ${
                                          gameInfo.blackClaimed
                                            ? "bg-green-500/20 text-green-300"
                                            : gameInfo.result === 3 ||
                                              gameInfo.result === 2 // DRAW ou BLACK_WINS
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        }`}
                                      >
                                        {isFinalizingGame && (
                                          <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-yellow-400" />
                                        )}

                                        {gameInfo.blackClaimed
                                          ? "Claimed"
                                          : gameInfo.result === 3 // DRAW
                                          ? "Can claim"
                                          : gameInfo.result === 2 // BLACK_WINS
                                          ? "Winner - can claim"
                                          : "Lost - no claim"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                            <div className="space-y-4">
                              {gameState.rematchOffer?.offered &&
                              gameState.rematchOffer?.by !==
                                gameState.players.find(
                                  (p) => p.id === currentPlayerId
                                )?.color ? (
                                <div className="text-center space-y-4">
                                  <p className="text-white/80 font-light text-base text-center">
                                    Your opponent offers you a rematch
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <button
                                      onClick={() =>
                                        handleRematchResponse(true)
                                      }
                                      className="col-span-1 px-8 py-2 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-bold text-lg transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRematchResponse(false)
                                      }
                                      className="col-span-1 px-8 py-2 bg-[#252525] hover:bg-[#252525] border border-[#836EF9] text-white rounded-lg font-bold text-lg transition-colors"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center space-y-3">
                                  {/* Boutons de claim si il y a des gains à récupérer */}
                                  <div className="space-y-3">
                                    {/* Claim winnings si le joueur a gagné */}
                                    {gameState.gameResult.winner !== "draw" &&
                                      gameState.gameResult.winner ===
                                        gameState.players.find(
                                          (p) => p.id === currentPlayerId
                                        )?.color && (
                                        <button
                                          onClick={async () => {
                                            if (gameId) {
                                              resetClaimState();

                                              await claimWinnings(
                                                gameId,
                                                gameState.gameResult.winner ===
                                                  "white"
                                                  ? 1
                                                  : 2,
                                                () => {},
                                                (error) => {
                                                  console.error(
                                                    "❌ Claim failed:",
                                                    error
                                                  );
                                                }
                                              );
                                            }
                                          }}
                                          disabled={
                                            claimState.isLoading ||
                                            isPending ||
                                            isConfirming ||
                                            (gameInfo && gameInfo.state !== 2)
                                          }
                                          className={`w-full px-6 py-4 ${
                                            claimState.isSuccess
                                              ? "bg-green-800 hover:bg-green-800"
                                              : claimState.isError
                                              ? "bg-red-600 hover:bg-red-700"
                                              : "bg-[#836EF9] hover:bg-[#836EF9]/80"
                                          } disabled:bg-[#252525] text-white rounded-lg font-bold text-lg transition-colors`}
                                        >
                                          {gameInfo && gameInfo.state !== 2
                                            ? "Game not finalized yet..."
                                            : claimState.isLoading
                                            ? "Processing claim..."
                                            : claimState.isError
                                            ? "Try again"
                                            : isPending || isConfirming
                                            ? "Confirming transaction..."
                                            : claimState.isSuccess
                                            ? "Successfully claimed"
                                            : `Claim  ${
                                                gameInfo?.betAmount
                                                  ? formatEther(
                                                      gameInfo.betAmount *
                                                        BigInt(2)
                                                    )
                                                  : "0"
                                              } MON`}
                                        </button>
                                      )}

                                    {/* Claim draw refund si match nul */}
                                    {gameState.gameResult.winner === "draw" &&
                                      getAvailableAmount() > 0 && (
                                        <button
                                          onClick={async () => {
                                            if (gameId) {
                                              try {
                                                await claimDrawRefund(gameId);
                                              } catch (error) {
                                                console.error(
                                                  "Claim failed:",
                                                  error
                                                );
                                              }
                                            }
                                          }}
                                          disabled={
                                            isPending ||
                                            isConfirming ||
                                            (gameInfo && gameInfo.state !== 2) // Désactiver si le jeu n'est pas FINISHED
                                          }
                                          className="w-full px-6 py-3 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-gray-600 text-white rounded-lg font-bold text-base transition-colors"
                                        >
                                          {gameInfo && gameInfo.state !== 2
                                            ? "Game not finalized yet..."
                                            : isPending || isConfirming
                                            ? "Confirming..."
                                            : `Claim Refund`}
                                        </button>
                                      )}
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <button
                                      onClick={handleNewGame}
                                      disabled={
                                        gameState.rematchOffer?.offered ||
                                        shouldDisableNavigationButtons()
                                      }
                                      className="w-full h-[45px] bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg font-bold text-base transition-colors"
                                    >
                                      {shouldDisableNavigationButtons()
                                        ? gameInfo && gameInfo.state !== 2
                                          ? "Finalizing..."
                                          : "New game"
                                        : gameState.rematchOffer?.offered
                                        ? "Waiting for opponent"
                                        : "New game"}
                                    </button>

                                    <button
                                      onClick={handleCloseGameEndModal}
                                      disabled={shouldDisableNavigationButtons()}
                                      className="w-full h-[45px] bg-[#404040] hover:bg-[#4a4a4a] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg font-bold text-base transition-colors"
                                    >
                                      {shouldDisableNavigationButtons()
                                        ? gameInfo && gameInfo.state !== 2
                                          ? "Finalizing..."
                                          : "Analysis"
                                        : "Analysis"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-3">
                    {gameState.players.map((player) =>
                      player.id === currentPlayerId ? (
                        <div key={player.id} className="rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xl text-white flex items-center gap-2">
                                {player.wallet.slice(0, 6)}...
                                {player.wallet.slice(-4)} (You)
                                {player.connected && !isReconnecting ? (
                                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                ) : (
                                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300">
                                <CapturedPieces
                                  fen={fen}
                                  playerColor={playerColor}
                                  isOpponent={false}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null
                    )}

                    <div
                      className={`backdrop-blur-md rounded-lg px-2 py-1 border ${
                        getCurrentPlayerTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-2xl font-bold ${
                          getCurrentPlayerTime() <= 30
                            ? "text-red-500"
                            : "text-white"
                        }`}
                      >
                        {Math.floor(getCurrentPlayerTime() / 60)}:
                        {(getCurrentPlayerTime() % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Panel de droite - Chat */}
          <div className="lg:col-span-2">
            <div className="rounded-lg  full flex flex-col h-[800px]  ">
              <div className="bg-[#1E1E1E] p-3 border border-white/5 rounded-lg mb-3">
                <div className="flex items-center gap-2 mt-1 mb-3 justify-between">
                  <div>
                    <p className="text-white/80 text-xs ml-2.5">Room:</p>
                    <p className="text-white text-base ml-2.5">
                      {gameState.roomName}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(
                          `${window.location.origin}${
                            window.location.pathname
                          }?room=${gameState.roomName}${
                            gameState.roomPassword
                              ? `&password=${gameState.roomPassword}`
                              : ""
                          }`
                        )
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                    }}
                    className="px-2 py-1 text-sm flex items-center gap-2 bg-[#836EF9] hover:bg-[#836EF9]/90 text-white rounded-lg transition-colors duration-300 ease-in-out"
                  >
                    Copy Link
                    {copied ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <CopyIcon className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Affichage des informations de pari */}
                </div>
                {gameInfo?.betAmount && gameInfo.betAmount > BigInt(0) && (
                  <div className="rounded-lg px-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xl font-medium">
                        Prize Pool
                      </span>
                      <span className="text-green-400 text-xl font-bold">
                        {getAvailableAmount() > "0"
                          ? getAvailableAmount()
                          : "0"}{" "}
                        MON
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-t-lg px-3 pt-2 bg-[#1E1E1E] border border-b-2 border-white/5">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Nads Chat
                </h3>
              </div>
              <div
                className="overflow-y-auto space-y-2 h-full flex-1 bg-[#1a1a1a] border border-b-0 border-t-0 border-white/5 px-3 py-2"
                ref={(el) => {
                  if (el) {
                    el.scrollTop = el.scrollHeight;
                  }
                }}
              >
                {gameState.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg py-2  ${
                      msg.playerWallet === address
                        ? "bg-[#836EF9]/40"
                        : "bg-neutral-800"
                    } border p-3 border-white/5`}
                  >
                    <div
                      className={`text-sm mb-[5px]   ${
                        msg.playerWallet === address
                          ? "text-white font-bold"
                          : "text-gray-400"
                      }`}
                    >
                      {msg.playerWallet === address
                        ? "You"
                        : msg.playerWallet.slice(0, 6) +
                          "..." +
                          msg.playerWallet.slice(-4)}
                    </div>
                    <div className="text-white text-sm">{msg.message}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 bg-[#1a1a1a] border border-t-0 border-white/5 rounded-b-lg px-3 py-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Gmonad"
                  disabled={
                    gameInfo?.betAmount !== undefined &&
                    gameInfo.betAmount > BigInt(0) &&
                    !(
                      (playerColor === "white" &&
                        gameInfo.whitePlayer.toLowerCase() ===
                          address?.toLowerCase()) ||
                      (playerColor === "black" &&
                        gameInfo.blackPlayer.toLowerCase() ===
                          address?.toLowerCase())
                    )
                  }
                  className="flex-1 px-3 h-[45px] bg-[#1E1E1E] border font-normal border-white/5 text-white text-base placeholder-white/70 focus:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={
                    !newMessage.trim() ||
                    (gameInfo?.betAmount !== undefined &&
                      gameInfo.betAmount > BigInt(0) &&
                      !(
                        (playerColor === "white" &&
                          gameInfo.whitePlayer.toLowerCase() ===
                            address?.toLowerCase()) ||
                        (playerColor === "black" &&
                          gameInfo.blackPlayer.toLowerCase() ===
                            address?.toLowerCase())
                      ))
                  }
                  className="px-5 h-[45px] bg-[#836EF9]/80 border border-white/5     text-white rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              {/* Box persistante - toujours visible */}
              <div className="space-y-3 mt-3">
                <div className="p-3 bg-[#1E1E1E] border border-white/5 rounded-lg">
                  {gameState.isActive ? (
                    // ========== PARTIE EN COURS ==========
                    <div className="space-y-3">
                      {gameState.drawOffer.offered &&
                      gameState.drawOffer.by !==
                        gameState.players.find((p) => p.id === currentPlayerId)
                          ?.color ? (
                        // Répondre à une offre de match nul
                        <div>
                          <p className="text-white text-sm text-center mb-3">
                            Your opponent offers a draw
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleRespondDraw(true)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-base transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondDraw(false)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-base transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Boutons normaux pendant la partie
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleOfferDraw}
                            disabled={
                              gameState.drawOffer.offered ||
                              (gameInfo?.betAmount !== undefined &&
                                gameInfo.betAmount > BigInt(0) &&
                                !(
                                  (playerColor === "white" &&
                                    gameInfo.whitePlayer.toLowerCase() ===
                                      address?.toLowerCase()) ||
                                  (playerColor === "black" &&
                                    gameInfo.blackPlayer.toLowerCase() ===
                                      address?.toLowerCase())
                                ))
                            }
                            className="px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            {gameState.drawOffer.offered
                              ? "Draw offer sent"
                              : "Offer draw"}
                          </button>
                          <button
                            onClick={handleResign}
                            disabled={
                              gameInfo?.betAmount !== undefined &&
                              gameInfo.betAmount > BigInt(0) &&
                              !(
                                (playerColor === "white" &&
                                  gameInfo.whitePlayer.toLowerCase() ===
                                    address?.toLowerCase()) ||
                                (playerColor === "black" &&
                                  gameInfo.blackPlayer.toLowerCase() ===
                                    address?.toLowerCase())
                              )
                            }
                            className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#836EF9] text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Resign
                          </button>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/10">
                        <p className="text-gray-400 text-xs mb-2 text-center">
                          Navigation: Move {currentMoveIndex}/
                          {moveHistory.length - 1}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={goToFirstMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏭
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : gameState.gameResult.type ? (
                    // ========== PARTIE TERMINÉE ==========
                    <div className="space-y-3">
                      <div className="text-center mb-3">
                        <p className="text-white font-semibold text-lg mb-1">
                          {gameState.gameResult.message || "Game Over"}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Game #{gameState.gameNumber}
                        </p>
                      </div>

                      {gameState.rematchOffer?.offered &&
                      gameState.rematchOffer?.by !==
                        gameState.players.find((p) => p.id === currentPlayerId)
                          ?.color ? (
                        <div>
                          <p className="text-[#FFF] text-sm text-center mb-2">
                            Your opponent offers you a rematch
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleRematchResponse(true)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRematchResponse(false)}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={handleNewGame}
                            disabled={
                              gameState.rematchOffer?.offered ||
                              shouldDisableNavigationButtons()
                            }
                            className="w-full px-3 py-2 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                          >
                            {shouldDisableNavigationButtons()
                              ? gameInfo && gameInfo.state !== 2
                                ? "Finalizing..."
                                : "Claim first"
                              : gameState.rematchOffer?.offered
                              ? "Waiting "
                              : "New game"}
                          </button>
                        </div>
                      )}

                      {/* Navigation après la partie */}
                      <div
                        className="pt-3 border-t border-white/10 "
                        onClick={() => {
                          if (!shouldDisableNavigationButtons()) {
                            setShowGameEndModal(false);
                          }
                        }}
                      >
                        <p className="text-gray-400 text-xs mb-2 text-center">
                          Navigation: Move {currentMoveIndex}/
                          {moveHistory.length - 1}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={goToFirstMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={goToPreviousMove}
                            disabled={currentMoveIndex === 0}
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ◀
                          </button>
                          <button
                            onClick={goToNextMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ▶
                          </button>
                          <button
                            onClick={goToLastMove}
                            disabled={
                              currentMoveIndex === moveHistory.length - 1
                            }
                            className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs transition-colors"
                          >
                            ⏭
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-[#a494fb]">
                        {gameState.players.length >= 2
                          ? "Starting game..."
                          : "Waiting for second player"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
