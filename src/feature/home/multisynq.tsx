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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    // resetCancelState,
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
        setTimeout(() => {
          setIsFinalizingGame(false);
        }, 2000);
        return true;
      } else {
        return false;
      }
    } catch {
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
      return;
    }

    // Seulement si la partie n'est pas déjà terminée sur le contrat
    if (gameInfo.state === 2) {
      // FINISHED state
      return;
    }

    try {
      let contractResult: 1 | 2 | 3;

      if (gameResult.winner === "draw") {
        contractResult = 3; // DRAW
      } else if (
        gameResult.winner === "white" ||
        gameResult.winner === "black"
      ) {
        // CORRECTION: Déterminer qui a gagné par adresse et l'associer à la position dans le contrat
        const winnerColor = gameResult.winner;
        const winnerPlayer = gameState.players.find(
          (p) => p.color === winnerColor
        );

        if (!winnerPlayer) {
          console.error("Impossible de trouver le joueur gagnant");
          return;
        }

        // Vérifier si le gagnant est whitePlayer ou blackPlayer dans le contrat
        const isWinnerWhiteInContract =
          gameInfo?.whitePlayer?.toLowerCase() ===
          winnerPlayer.wallet.toLowerCase();
        const isWinnerBlackInContract =
          gameInfo?.blackPlayer?.toLowerCase() ===
          winnerPlayer.wallet.toLowerCase();

        if (isWinnerWhiteInContract) {
          contractResult = 1; // WHITE_WINS dans le contrat
        } else if (isWinnerBlackInContract) {
          contractResult = 2; // BLACK_WINS dans le contrat
        } else {
          return;
        }
      } else {
        contractResult = 3; // DRAW par défaut
      }

      // NOUVEAU: Essayer d'abord le relayer automatique
      const relayerSuccess = await finishGameViaRelayer(gameId, contractResult);

      if (relayerSuccess) {
      } else {
        // Fallback vers la méthode manuelle

        try {
          await finishBettingGame(gameId, contractResult);
          setTimeout(() => {
            setIsFinalizingGame(false);
          }, 2000);
        } catch (manualError) {
          setTimeout(() => {
            setIsFinalizingGame(false);
          }, 3000);
        }
      }
    } catch {
      setTimeout(() => {
        setIsFinalizingGame(false);
      }, 3000);
      // Ne pas faire échouer le jeu si la finalisation échoue
    }
  };

  // Fonction supprimée car non utilisée - voir linter error

  // Fonction pour vérifier si tous les gains ont été réclamés et qu'on peut proposer une revanche
  const canOfferRematch = (): boolean => {
    // Pour les parties sans pari, vérifier seulement que le jeu est terminé
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return (
        gameState.gameResult.type !== null && !gameState.rematchOffer?.offered
      );
    }

    // Pour les parties avec pari, vérifier que le jeu est finalisé et que les gains ont été réclamés
    if (gameInfo.state !== 2) {
      return false;
    }

    // Vérifier selon le type de résultat
    if (gameInfo.result === 3) {
      // Draw - les deux doivent avoir claim
      return gameInfo.whiteClaimed && gameInfo.blackClaimed;
    } else if (gameInfo.result === 1) {
      // White wins - white doit avoir claim
      return gameInfo.whiteClaimed;
    } else if (gameInfo.result === 2) {
      // Black wins - black doit avoir claim
      return gameInfo.blackClaimed;
    }

    return false;
  };

  // Fonction pour vérifier si le joueur connecté peut claim (based on contract address, not Multisynq color)
  const canCurrentPlayerClaim = (): boolean => {
    if (!gameInfo?.betAmount || gameInfo.betAmount <= BigInt(0)) {
      return false; // Pas de pari = pas de claim
    }

    if (!address) {
      return false; // Pas connecté
    }

    // Vérifier directement avec l'adresse du contrat
    const isWhiteInContract =
      gameInfo.whitePlayer.toLowerCase() === address.toLowerCase();
    const isBlackInContract =
      gameInfo.blackPlayer.toLowerCase() === address.toLowerCase();

    if (!isWhiteInContract && !isBlackInContract) {
      return false; // Pas un joueur de cette partie
    }

    // NOUVEAU: Si le jeu est terminé localement mais pas encore finalisé dans le contrat
    if (gameInfo.state !== 2 && gameState.gameResult.type) {
      // Vérifier si le joueur local peut potentiellement claim basé sur le résultat local
      const localWinner = gameState.gameResult.winner;
      const currentPlayer = gameState.players.find(
        (p) => p.id === currentPlayerId
      );

      if (localWinner === "draw") {
        return true; // Les deux peuvent claim en cas de draw
      } else if (currentPlayer && localWinner === currentPlayer.color) {
        return true; // Le gagnant local peut claim
      }
      return false;
    }

    // Si le contrat est finalisé, vérifier selon le résultat du contrat
    if (gameInfo.state === 2) {
      if (gameInfo.result === 3) {
        // Draw - peut claim si pas encore fait
        return isWhiteInContract
          ? !gameInfo.whiteClaimed
          : !gameInfo.blackClaimed;
      } else if (gameInfo.result === 1) {
        // White wins - seul white peut claim
        return isWhiteInContract && !gameInfo.whiteClaimed;
      } else if (gameInfo.result === 2) {
        // Black wins - seul black peut claim
        return isBlackInContract && !gameInfo.blackClaimed;
      }
    }

    return false;
  };

  const [isCreatingRematch, setIsCreatingRematch] = useState(false);
  const [rematchInvitation, setRematchInvitation] = useState<{
    from: string;
    roomName: string;
    password: string;
  } | null>(null);

  // Reset claim state lors des transitions de partie
  useEffect(() => {
    if (gameFlow === "welcome" || gameFlow === "lobby" || isRematchTransition) {
      resetClaimState();
    }
  }, [gameFlow, isRematchTransition, resetClaimState]);

  // Reset claim state quand une nouvelle partie commence
  useEffect(() => {
    if (gameState.gameNumber > 0 && gameState.isActive) {
      resetClaimState();
    }
  }, [gameState.gameNumber, gameState.isActive, resetClaimState]);

  // Reset claim state quand le gameId change (nouvelle partie avec pari)
  useEffect(() => {
    if (gameId !== undefined) {
      resetClaimState();
    }
  }, [gameId, resetClaimState]);

  const createRematchWithPayment = async () => {
    if (isCreatingRematch) return; // Empêcher les clics multiples

    setIsCreatingRematch(true);

    try {
      // Générer le nom de la nouvelle room pour l'invitation
      const newRoomName = `chess-${Math.random().toString(36).substring(2, 8)}`;
      const newRoomPassword = Math.random().toString(36).substring(2, 6);
      const correctBetAmount = getCorrectBetAmount();

      // Envoyer invitation avec détails de la nouvelle room
      if (multisynqView && currentPlayerId && address) {
        multisynqView.sendMessage(
          `REMATCH_INVITATION:${newRoomName}:${newRoomPassword}:${correctBetAmount}`,
          currentPlayerId,
          address
        );
      }

      // Fermer la modal de fin de partie
      setShowGameEndModal(false);

      // Stocker les détails de la room pour handleCreateRoom
      (window as any).rematchRoomDetails = {
        roomName: newRoomName,
        password: newRoomPassword,
      };

      // EXACTEMENT comme "Create Room" - utiliser la même logique mais avec les noms spécifiques
      await handleCreateRoom();
    } catch {
    } finally {
      setIsCreatingRematch(false);
    }
  };

  // Vérifier si il y a un pari requis
  const hasBettingRequirement = (): boolean => {
    // NOUVEAU: Pendant la transition de revanche, si betting activé, considérer qu'il y a un requirement
    if (
      isRematchTransition &&
      isBettingEnabled &&
      parseFloat(getCorrectBetAmount()) > 0
    ) {
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
      return false;
    }

    // Si pas de requirement de betting, considérer comme payé
    if (!hasBettingRequirement()) {
      return true;
    }

    // CORRECTION: Vérifier d'abord l'état du contrat (plus fiable)
    if (gameInfo?.state === 1) {
      // ACTIVE
      return true;
    }

    // Fallback: vérifier les status individuels
    const bothPaid =
      paymentStatus.whitePlayerPaid && paymentStatus.blackPlayerPaid;

    return bothPaid;
  };
  const updatePaymentStatus = () => {
    // Cas spécial : si betting activé mais pas encore de gameInfo (création en cours)
    if (isBettingEnabled && parseFloat(betAmount) > 0 && !gameInfo) {
      setPaymentStatus({
        whitePlayerPaid: false,
        blackPlayerPaid: false,
        currentPlayerPaid: false,
      });
      return;
    }

    // S'il n'y a pas de pari requis, tout est considéré comme payé
    if (!hasBettingRequirement()) {
      setPaymentStatus({
        whitePlayerPaid: true,
        blackPlayerPaid: true,
        currentPlayerPaid: true,
      });
      return;
    }

    if (!gameInfo || !address) {
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

      const interval = setInterval(() => {
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
          // Créer un nouveau nom de room pour la revanche
          const rematchRoomName = `${gameState.roomName}_rematch_${gameState.gameNumber}`;
          const correctBetAmount = getCorrectBetAmount();

          await createBettingGame(correctBetAmount, rematchRoomName);
          setRoomBetAmount(correctBetAmount);

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
        } catch {
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
        }, 2000);
      }
    }
  }, [
    gameState.rematchAccepted,
    isBettingEnabled,
    gameState.gameNumber,
    gameState.roomName,
  ]);

  useEffect(() => {
    if (
      isRematchTransition &&
      gameInfo?.betAmount &&
      gameInfo.betAmount > BigInt(0)
    ) {
      setIsRematchTransition(false);
    }
  }, [isRematchTransition, gameInfo?.betAmount]);

  useEffect(() => {
    if (
      multisynqView &&
      currentPlayerId &&
      gameState.roomName &&
      gameFlow === "welcome"
    ) {
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

  // Écouter les invitations de rematch
  useEffect(() => {
    const handleRematchInvitation = (event: CustomEvent) => {
      const { from, senderId, roomName, password } = event.detail;

      // Ne pas afficher la popup à l'expéditeur
      if (senderId === currentPlayerId) {
        return;
      }

      // Afficher l'invitation dans la popup de fin de game (pas popup séparée)
      setRematchInvitation({
        from,
        roomName,
        password: password || "",
      });
    };

    window.addEventListener(
      "rematchInvitation",
      handleRematchInvitation as unknown as EventListener
    );

    return () => {
      window.removeEventListener(
        "rematchInvitation",
        handleRematchInvitation as unknown as EventListener
      );
    };
  }, [currentPlayerId]);

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
        return;
      }

      const hasBetting = hasBettingRequirement();

      // NOUVEAU: Joindre immédiatement si pas de betting OU si les deux ont payé
      if (!hasBetting || bothPlayersPaid()) {
        multisynqView.joinPlayer(address, currentPlayerId);
        return;
      }

      // Cas: Betting requis ET joueur a payé - joindre
      if (hasBetting && paymentStatus.currentPlayerPaid) {
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
    }
  };

  // Charger l'historique depuis localStorage
  const loadHistoryFromStorage = (roomName: string) => {
    if (!roomName) return null;

    try {
      const stored = localStorage.getItem(getStorageKey(roomName));
      if (stored) {
        const data = JSON.parse(stored);

        return data;
      }
    } catch {}
    return null;
  };

  // Supprimer l'historique du localStorage
  const clearHistoryFromStorage = (roomName: string) => {
    if (roomName) {
      localStorage.removeItem(getStorageKey(roomName));
    }
  };
  const isWrongNetwork = chainId !== 10143;
  const gameRef = useRef(new Chess());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer supprimé - utilise celui plus bas qui a plus de conditions

  useEffect(() => {
    const currentPlayer = gameState.players.find(
      (p) => p.id === currentPlayerId
    );

    if (currentPlayer) {
      setPlayerColor(currentPlayer.color === "black" ? "black" : "white");

      // Si on était en train de se reconnecter, maintenant c'est réussi
      if (isReconnecting) {
        setIsReconnecting(false);
      }
    } else if (
      gameState.players.length > 0 &&
      currentPlayerId &&
      !isReconnecting
    ) {
      // Si on a un ID mais qu'on ne trouve pas le joueur dans une partie active
      const hasActiveGame = gameState.isActive || gameState.gameResult.type;
      if (hasActiveGame) {
        setIsReconnecting(true);

        // Tenter une reconnexion automatique
        setTimeout(() => {
          if (multisynqView && address && currentPlayerId) {
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
      // Délai de 1 seconde pour que l'user comprenne rapidement
      const timer = setTimeout(() => {
        setShowGameEndModal(true);
      }, 1000);

      return () => clearTimeout(timer);
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
        setMoveHistory(savedHistory.history);
        setCurrentMoveIndex(savedHistory.currentIndex);
        // Afficher la position correspondant à l'index sauvegardé
        if (savedHistory.history[savedHistory.currentIndex]) {
          setFen(savedHistory.history[savedHistory.currentIndex]);
        }
      } else {
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

    // OPTIMISATION: Timer unique avec conditions strictes
    const shouldRunTimer =
      gameState.isActive &&
      !gameState.gameResult.type &&
      isFirstPlayer &&
      currentPlayer?.connected &&
      !isReconnecting &&
      bothPlayersPaid();

    if (shouldRunTimer && !timerRef.current) {
      timerRef.current = setInterval(() => {
        if (multisynqView) {
          multisynqView.updateTimer();
        }
      }, 5000); // Réduire à 5 secondes au lieu de 1 seconde pour éviter le lag
    } else if (!shouldRunTimer && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
      }, 200);

      setGameFlow("game");
      setConnectionStatus(`Connecté à: ${roomName}`);
    } catch {
      setConnectionStatus("Room introuvable");
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
        setupMultisynqClasses();
        return;
      }

      try {
        // Charger le script Multisynq
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@multisynq/client@latest/bundled/multisynq-client.min.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            resolve();
          };
          script.onerror = () => {
            reject(new Error("Failed to load Multisynq"));
          };
          document.head.appendChild(script);
        });

        // Attendre que Multisynq soit disponible
        await waitForMultisynqAvailable();
        setupMultisynqClasses();
      } catch {
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

  //   const handleRequestRematch = () => {
  //     if (!multisynqView || !currentPlayerId) {
  //       console.error("multisynqView ou currentPlayerId manquant");
  //       return;
  //     }

  //     if (typeof multisynqView.requestRematch === "function") {
  //       multisynqView.requestRematch(currentPlayerId);
  //       console.log("Demande de revanche envoyée");
  //     } else {
  //       console.error("requestRematch n'est pas une fonction:", multisynqView);
  //       alert("Erreur: Fonction de demande de revanche non disponible.");
  //     }
  //   };

  const handleRematchResponse = (accepted: boolean) => {
    if (!multisynqView || !currentPlayerId) {
      return;
    }

    if (typeof multisynqView.respondRematch === "function") {
      multisynqView.respondRematch(currentPlayerId, accepted);
    } else {
      console.error("respondRematch n'est pas une fonction:", multisynqView);
    }
  };

  const router = useRouter();
  const handleNewGame = () => {
    // Si il y a un pari et qu'on peut offrir une revanche, faire une revanche
    if (
      gameInfo?.betAmount &&
      gameInfo.betAmount > BigInt(0) &&
      canOfferRematch()
    ) {
      createRematchWithPayment();
    } else {
      // Sinon, retourner à l'accueil
      router.push("/");
    }
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
      // Définir le modèle Chess
      class ChessModel extends Multisynq.Model {
        init() {
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
          this.state.gameTimeLimit = data.gameTime;
          this.state.whiteTime = data.gameTime;
          this.state.blackTime = data.gameTime;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleRequestRematch(data: { playerId: string }) {
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
          this.state.rematchAccepted = false;
          this.publish(this.sessionId, "game-state", this.state);
        }

        handleMove(data: {
          from: any;
          to: any;
          promotion: any;
          playerId: any;
        }) {
          // Traitement optimisé sans logs
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

              // Publication IMMÉDIATE de l'état après chaque coup
              this.publish(this.sessionId, "game-state", this.state);

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
          } catch {
            // Ignorer les erreurs de mouvement pour éviter le lag
          }
        }

        handleUpdateTimer() {
          if (!this.state.isActive || this.state.gameResult.type) return;

          let needsUpdate = false;

          // Décrémenter exactement 1 seconde pour le joueur actuel
          if (this.state.turn === "w") {
            const previousTime = this.state.whiteTime;
            this.state.whiteTime = Math.max(0, this.state.whiteTime - 1);
            needsUpdate = this.state.whiteTime !== previousTime;

            if (this.state.whiteTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "black",
                message: "Time's up! Black wins",
              };
              this.state.lastGameWinner = "black";
              needsUpdate = true;
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
            const previousTime = this.state.blackTime;
            this.state.blackTime = Math.max(0, this.state.blackTime - 1);
            needsUpdate = this.state.blackTime !== previousTime;

            if (this.state.blackTime <= 0) {
              this.state.isActive = false;
              this.state.gameResult = {
                type: "timeout",
                winner: "white",
                message: "Time's up! White wins",
              };
              this.state.lastGameWinner = "white";
              needsUpdate = true;
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

          // OPTIMISATION: Ne publier QUE si il y a eu un changement
          if (needsUpdate) {
            this.state.lastMoveTime = Date.now();
            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        handlePlayerJoin(data: { playerId: any; wallet: any }) {
          const { playerId, wallet } = data;

          // CORRECTION: Vérifier si le joueur existe déjà par son wallet (reconnexion)
          const existingPlayerIndex = this.state.players.findIndex(
            (p: { wallet: any }) => p.wallet === wallet
          );

          if (existingPlayerIndex >= 0) {
            // CORRECTION: Mettre à jour le joueur existant avec le nouveau playerId
            this.state.players[existingPlayerIndex].connected = true;
            this.state.players[existingPlayerIndex].id = playerId; // Nouveau ID après refresh

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

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleChatMessage(message: {
          message: string;
          playerId: string;
          playerWallet: string;
        }) {
          if (message.message.startsWith("REMATCH_INVITATION:")) {
            try {
              const [, roomName, password, betAmount] =
                message.message.split(":");

              this.state.messages.push({
                ...message,
                id: `msg_${Date.now()}_${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                message: `${message.playerWallet.slice(
                  0,
                  6
                )}...${message.playerWallet.slice(-4)} offers a rematch!`,
                timestamp: Date.now(),
              });

              window.dispatchEvent(
                new CustomEvent("rematchInvitation", {
                  detail: {
                    from: message.playerWallet,
                    senderId: message.playerId,
                    roomName: roomName,
                    password: password,
                    betAmount: betAmount,
                  },
                })
              );
            } catch {}
          } else {
            // Message de chat normal
            this.state.messages.push({
              ...message,
              id: `msg_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              timestamp: Date.now(),
            });
          }

          this.publish(this.sessionId, "game-state", this.state);
        }

        handleStartGame() {
          if (this.state.players.length >= 2) {
            this.state.isActive = true;
            this.state.gameResult = { type: null };
            this.state.lastMoveTime = Date.now();
            // Réinitialiser les offres de draw/rematch
            this.state.drawOffer = { offered: false, by: null };
            this.state.rematchOffer = { offered: false, by: null };

            this.publish(this.sessionId, "game-state", this.state);
          }
        }

        handleResetGame() {
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

          // S'abonner aux mises à jour d'état - SANS bind()
          this.subscribe(this.sessionId, "game-state", "updateGameState");
        }

        updateGameState(newState: any) {
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
          // Publication instantanée sans log pour éviter le lag
          this.publish(this.sessionId, "move", {
            from,
            to,
            playerId,
            promotion: promotion || "q",
          });
        }

        joinPlayer(wallet: any, playerId: any) {
          // Publication rapide sans log
          this.publish(this.sessionId, "join-player", { wallet, playerId });
        }

        sendMessage(message: any, playerId: any, playerWallet: any) {
          // Publication rapide sans log
          this.publish(this.sessionId, "chat-message", {
            message,
            playerId,
            playerWallet,
          });
        }

        startGame() {
          this.publish(this.sessionId, "start-game", {});
        }

        resetGame() {
          this.publish(this.sessionId, "reset-game", {});
        }

        updateTimer() {
          // Publication timer réduite pour éviter le lag
          this.publish(this.sessionId, "update-timer", {});
        }

        // CORRECTION: Méthodes correctement définies dans la classe
        offerDraw(playerId: string) {
          this.publish(this.sessionId, "offer-draw", { playerId });
        }

        respondDraw(playerId: string, accepted: boolean) {
          this.publish(this.sessionId, "respond-draw", { playerId, accepted });
        }

        resign(playerId: string) {
          this.publish(this.sessionId, "resign", { playerId });
        }

        setGameTime(gameTime: number) {
          this.publish(this.sessionId, "set-game-time", { gameTime });
        }

        requestRematch(playerId: string) {
          this.publish(this.sessionId, "request-rematch", { playerId });
        }

        respondRematch(playerId: string, accepted: boolean) {
          this.publish(this.sessionId, "respond-rematch", {
            playerId,
            accepted,
          });
        }

        resetRematchAccepted() {
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

      // Vérifier que les méthodes sont présentes dans la classe
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

    if (typeof multisynqView.offerDraw === "function") {
      multisynqView.offerDraw(currentPlayerId);
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
      if (gameInfo?.state !== 2) {
        return true; // Désactiver pendant la finalisation
      }

      // 2. OU le jeu est finalisé mais des gains peuvent encore être claim
      // CORRECTION: Utiliser la logique du contrat plutôt que les couleurs locales
      if (gameInfo?.result === 1 && !gameInfo?.whiteClaimed) {
        return true; // White a gagné dans le contrat mais n'a pas claim
      }
      if (gameInfo?.result === 2 && !gameInfo?.blackClaimed) {
        return true; // Black a gagné dans le contrat mais n'a pas claim
      }
    }

    return false;
  };

  // Créer une session Multisynq (avec fermeture de l'ancienne)
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
      // IMPORTANT: Fermer l'ancienne session si elle existe
      if (multisynqView) {
        try {
          // Tenter de fermer la session via la vue
          if (multisynqView.session) {
            multisynqView.session.close();
          }
        } catch (error) {
          console.warn(
            "Erreur lors de la fermeture de l'ancienne session:",
            error
          );
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
      // Utiliser les noms prédéfinis si c'est une rematch, sinon générer nouveaux
      const rematchDetails = (window as any).rematchRoomDetails;
      const roomName =
        rematchDetails?.roomName ||
        `chess-${Math.random().toString(36).substring(2, 8)}`;
      const password =
        rematchDetails?.password || Math.random().toString(36).substring(2, 6);
      const playerId = `player_${address.slice(-8)}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      // Nettoyer les détails de rematch
      if (rematchDetails) {
        delete (window as any).rematchRoomDetails;
      }

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
        try {
          setBettingGameCreationFailed(false);
          await createBettingGame(betAmount, roomName);
          setRoomBetAmount(betAmount);

          // NE PAS joindre automatiquement - laisser la popup s'afficher
        } catch (error) {
          console.error("Échec création betting game:", error);
          setBettingGameCreationFailed(true);
          // NE PAS joindre automatiquement - laisser la popup s'afficher pour retry
        }
      } else {
        // Pas de betting - joindre Multisynq normalement
        session.view.joinPlayer(address, playerId);
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
      setConnectionStatus(`Room created: ${roomName}`);
    } catch (error) {
      console.error("Error creating room:", error);
      setConnectionStatus("Error creating room");
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
    } catch (error) {
      console.error("Error joining room:", error);
      setConnectionStatus("Room not found");
      alert(
        `Impossible to join the room "${roomName}". Check the code${
          password ? " and the password" : ""
        }.`
      );
    }
  };

  const onPieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;

      // Vérifications rapides d'abord - pas de logs pour éviter le lag
      if (!targetSquare || !currentPlayerId || !multisynqView) return false;
      if (
        gameState.gameResult.type ||
        currentMoveIndex < moveHistory.length - 1
      )
        return false;
      if (!gameState.isActive) return false;

      const currentPlayer = gameState.players.find(
        (p) => p.id === currentPlayerId
      );
      if (!currentPlayer) return false;

      // Vérification du tour - simplifié
      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) return false;

      // Vérification de paiement - seulement si nécessaire et simplifiée
      if (gameInfo?.betAmount && gameInfo.betAmount > BigInt(0)) {
        const isPlayerInContract =
          (currentPlayer.color === "white" &&
            gameInfo.whitePlayer.toLowerCase() === address?.toLowerCase()) ||
          (currentPlayer.color === "black" &&
            gameInfo.blackPlayer.toLowerCase() === address?.toLowerCase());

        if (!isPlayerInContract && gameInfo.state !== 1) {
          return false; // Pas de popup, juste refuser silencieusement
        }
      }

      // Validation du mouvement - plus directe
      const tempGame = new Chess(gameState.fen);
      try {
        const moveResult = tempGame.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (moveResult) {
          // MISE À JOUR INSTANTANÉE DE L'INTERFACE (optimistic update)
          setFen(tempGame.fen());

          // Mettre à jour l'historique immédiatement
          const newHistory = [...moveHistory, tempGame.fen()];
          setMoveHistory(newHistory);
          setCurrentMoveIndex(newHistory.length - 1);

          // Désélectionner la pièce après mouvement réussi
          setSelectedSquare(null);
          setPossibleMoves([]);

          // Envoyer en parallèle - sans attendre
          multisynqView.makeMove(
            sourceSquare,
            targetSquare,
            currentPlayerId,
            "q"
          );
          return true;
        }
      } catch {
        // Pas de log pour éviter le lag
      }

      return false;
    },
    [
      currentPlayerId,
      multisynqView,
      gameState.gameResult.type,
      gameState.isActive,
      gameState.turn,
      gameState.players,
      gameState.fen,
      currentMoveIndex,
      moveHistory.length,
      gameInfo?.betAmount,
      gameInfo?.whitePlayer,
      gameInfo?.blackPlayer,
      gameInfo?.state,
      address,
    ]
  );

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

  // Fonction pour obtenir la position du roi en échec et mat
  const getCheckmatedKingSquare = useMemo(() => {
    if (gameState.gameResult.type === "checkmate") {
      try {
        const chess = new Chess(fen);

        // Simple: si c'est checkmate, le joueur actuel (chess.turn()) est celui qui ne peut pas jouer = le perdant
        if (chess.isCheckmate()) {
          const board = chess.board();
          const checkmatedColor = chess.turn(); // Couleur qui ne peut pas jouer = perdant

          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const piece = board[row][col];
              if (
                piece &&
                piece.type === "k" &&
                piece.color === checkmatedColor
              ) {
                // Convertir les coordonnées en notation d'échecs
                const file = String.fromCharCode(97 + col); // a-h
                const rank = (8 - row).toString(); // 1-8

                return file + rank;
              }
            }
          }
        }
      } catch {
        // Pas de log pour éviter le lag
      }
    }
    return null;
  }, [fen, gameState.gameResult.type]);

  // État pour la sélection de pièce et coups possibles
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  // Calculer les coups possibles pour une case (avec useCallback pour performance)
  const getPossibleMoves = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(fen);
        const moves = chess.moves({ square: square as any, verbose: true });
        return moves.map((move: any) => move.to);
      } catch {
        return [];
      }
    },
    [fen]
  );

  // Fonction commune pour sélectionner une pièce et afficher les coups
  const selectPiece = useCallback(
    (piece: { pieceType: string }, square: string | null) => {
      if (!square || !gameState.isActive || gameState.gameResult.type) return;

      const currentPlayer = gameState.players.find(
        (p) => p.id === currentPlayerId
      );
      if (!currentPlayer) return;

      const isMyTurn =
        (gameState.turn === "w" && currentPlayer.color === "white") ||
        (gameState.turn === "b" && currentPlayer.color === "black");

      if (!isMyTurn) return;

      // Vérifier si c'est notre pièce
      const pieceColor = piece.pieceType.charAt(0) === "w" ? "white" : "black";
      if (pieceColor !== currentPlayer.color) return;

      // Sélectionner la pièce et afficher les coups possibles
      setSelectedSquare(square);
      setPossibleMoves(getPossibleMoves(square));
    },
    [
      gameState.isActive,
      gameState.gameResult.type,
      gameState.turn,
      gameState.players,
      currentPlayerId,
      getPossibleMoves, // AJOUTÉ: dépendance manquante !
    ]
  );

  // Gestionnaire de clic sur une pièce (API react-chessboard)
  const onPieceClick = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string };
      square: string | null;
    }) => {
      selectPiece(piece, square);
    },
    [selectPiece]
  );

  // Gestionnaire de début de drag d'une pièce (API react-chessboard)
  const onPieceDrag = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string };
      square: string | null;
    }) => {
      selectPiece(piece, square);
    },
    [selectPiece]
  );

  // Gestionnaire de clic sur une case (API react-chessboard)
  const onSquareClick = useCallback(
    ({
      piece,
      square,
    }: {
      piece: { pieceType: string } | null;
      square: string;
    }) => {
      // Si une pièce est sélectionnée et on clique sur un coup possible
      if (selectedSquare && possibleMoves.includes(square)) {
        const args = {
          sourceSquare: selectedSquare,
          targetSquare: square,
          piece: {} as any,
        };
        onPieceDrop(args);
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (!piece) {
        // Clic sur case vide - désélectionner
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    },
    [selectedSquare, possibleMoves, onPieceDrop]
  );

  // Styles pour l'échiquier (coups possibles + checkmate)
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlighting pour checkmate
    if (getCheckmatedKingSquare) {
      styles[getCheckmatedKingSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.3)",
        boxShadow: "inset 0 0 15px rgba(131, 110, 249, 0.6)",
      };
    }

    // Case sélectionnée - violet intense
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(131, 110, 249, 0.6)",
        boxShadow: "inset 0 0 8px rgba(131, 110, 249, 0.8)",
      };
    }

    // Coups possibles - violet plus clair
    possibleMoves.forEach((square) => {
      if (square !== selectedSquare) {
        styles[square] = {
          backgroundColor: "rgba(131, 110, 249, 0.3)",
          boxShadow: "inset 0 0 5px rgba(131, 110, 249, 0.5)",
        };
      }
    });

    return styles;
  }, [selectedSquare, possibleMoves, getCheckmatedKingSquare]);

  // Configuration de l'échiquier avec les nouvelles APIs
  const chessboardOptions = useMemo(
    () => ({
      position: fen,
      onPieceDrop: onPieceDrop,
      onPieceClick: onPieceClick,
      onPieceDrag: onPieceDrag,
      onSquareClick: onSquareClick,
      boardOrientation: playerColor,
      arePiecesDraggable: gameState.isActive,
      boardWidth: 580,
      animationDuration: 50,
      squareStyles: squareStyles,
    }),
    [
      fen,
      onPieceDrop,
      onPieceClick,
      onPieceDrag,
      onSquareClick,
      playerColor,
      gameState.isActive,
      squareStyles,
    ]
  );

  // Fonction pour convertir la notation d'échecs en position pixel
  const getSquarePosition = (square: string) => {
    if (!square) return null;

    const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
    const rank = parseInt(square[1]) - 1; // 1=0, 2=1, etc.

    // Utiliser l'orientation du plateau
    const isFlipped = playerColor === "black";
    const x = isFlipped ? 7 - file : file;
    const y = isFlipped ? rank : 7 - rank;

    const squareSize = 580 / 8; // 72.5px par case

    return {
      left: x * squareSize + squareSize / 2,
      top: y * squareSize + squareSize / 2,
    };
  };

  const checkmateIconPosition = getSquarePosition(
    getCheckmatedKingSquare || ""
  );

  const [menuActive, setMenuActive] = useState("create");

  // Interface d'accueil
  if (gameFlow === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#161616] to-[#191919] bg-center bg-cover flex items-center justify-center p-4">
        <div className="max-w-[700px] w-full bg-[#1E1E1E] backdrop-blur-md rounded-2xl p-[50px] border border-white/5">
          <div className="text-center">
            <h2 className="text-4xl font-medium text-white mb-4">
              Welcome to SynqMate
            </h2>
            <p className="text-white/80 text-lg font-light mb-8 max-w-[500px] mx-auto">
              SynqMate is a platform for playing chess with friends and betting
              on the outcome.
            </p>
          </div>
          <div className="text-center mb-10">
            <div className="flex items-center justify-center w-full">
              <WalletConnection className="w-full" />
            </div>
          </div>

          {!isConnected ? (
            <p className="text-white text-lg mx-auto text-center">
              Connect your wallet to start playing
            </p>
          ) : (
            <>
              <div className="mx-auto w-full flex items-center justify-center">
                <button
                  onClick={() => setMenuActive("create")}
                  className={`group rounded-t-lg  ${
                    menuActive === "create"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
                  } text-white text-lg font-medium py-4 w-[190px] transition-all duration-200 px-4`}
                >
                  Create Game
                </button>

                <button
                  onClick={() => setMenuActive("join")}
                  className={`group rounded-t-lg  ${
                    menuActive === "join"
                      ? "border-white/10 hover:border-[#836EF9]/40 bg-[#252525]"
                      : "border-white/10 hover:border-[#836EF9]/40 bg-[#1E1E1E]"
                  } text-white text-lg font-medium py-4 w-[190px] transition-all duration-200 px-4`}
                >
                  Join Game
                </button>
              </div>
              {menuActive === "create" ? (
                <div className="bg-[#252525] rounded-2xl p-6">
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
                        ? "Switch to Monad & Create"
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
                  <div className="bg-[#252525] rounded-2xl p-8 pt-6">
                    <label className="block text-xl font-medium text-left text-white  mb-3">
                      {" "}
                      Room Code
                    </label>
                    <input
                      type="text"
                      placeholder="Enter room code (e.g. room:password)"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      className="w-full p-4 bg-[#2b2b2b] focus:outline-none border border-white/5 text-white rounded-lg text-lg mb-4 focus:ring-2 focus:ring-[#836EF9] focus:border-transparent"
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
                        ? "Switch to Monad & Join"
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
                <h3 className="text-red-300 font-medium text-xl mb-3">
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
                    } catch {}
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-lg transition-colors"
                >
                  Switch to Monad Testnet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  //   const isWinner =
  //     gameState.gameResult.winner ===
  //     gameState.players.find((p) => p.id === currentPlayerId)?.color;

  const isDraw = gameState.gameResult.winner === "draw";

  return (
    <div className="min-h-screen font-light bg-gradient-to-b from-[#161616] to-[#191919] p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 my-8 ">
          <div className="w-full">
            <div className="flex items-center justify-between w-full gap-3">
              {/* <img src="/synqmate.png" alt="logo" className=" w-[240px]" /> */}
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
                              <div className="font-medium text-xl text-white flex items-center gap-2">
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
                              <span className="animate-[bounce_1s_infinite] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.2s] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.4s] text-xl">
                                .
                              </span>
                              <span className="animate-[bounce_1s_infinite_0.6s] text-xl ml-2">
                                Waiting for opponent
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className={`backdrop-blur-md rounded-lg px-3 py-1 border ${
                        getOpponentTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-xl font-medium ${
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

                    {/* Icône de checkmate */}
                    {checkmateIconPosition && getCheckmatedKingSquare && (
                      <div
                        className="absolute pointer-events-none z-1"
                        style={{
                          left: `${checkmateIconPosition.left}px`,
                          top: `${checkmateIconPosition.top}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="relative z-[0] animate-in zoom-in-50 duration-200">
                          <div className="absolute inset-0 w-10 h-10 bg-red-500 rounded-full opacity-40 animate-ping -translate-x-1/2 -translate-y-1/2 z-[0]" />
                          <div className="absolute inset-0 w-8 h-8 bg-red-600 rounded-full opacity-95 -translate-x-1/2 -translate-y-1/2 z-[0]">
                            <div className="relative text-xl text-white font-medium flex items-center justify-center w-8 h-8 ">
                              ✗
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

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
                              <h3 className="text-2xl font-medium text-white mb-6">
                                Payment Status
                              </h3>

                              {/* Informations de paiement et gains */}
                              <div className="">
                                <div className="flex justify-between text-white text-base mb-2">
                                  <span className="text-gray-300">
                                    Bet amount:
                                  </span>
                                  <span className="font-medium text-white text-base">
                                    {gameInfo?.betAmount
                                      ? formatEther(gameInfo.betAmount)
                                      : betAmount}{" "}
                                    MON
                                  </span>
                                </div>
                                <div className="flex justify-between text-base text-white mb-6">
                                  <span className="text-gray-300">
                                    Potential winnings:
                                  </span>
                                  <span className="font-semibold text-green-400">
                                    {gameInfo?.betAmount
                                      ? formatEther(
                                          gameInfo.betAmount * BigInt(2)
                                        )
                                      : (
                                          parseFloat(betAmount) * 2
                                        ).toString()}{" "}
                                    MON
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-lg mb-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded-lg">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white text-base font-normal mb-0.5">
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
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-normal ${
                                        paymentStatus.whitePlayerPaid
                                          ? "bg-[#836EF9] text-white border border-white/10"
                                          : "bg-[#2c2c2c] text-white border border-white/10"
                                      }`}
                                    >
                                      {paymentStatus.whitePlayerPaid ? null : (
                                        <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                                      )}
                                      {paymentStatus.whitePlayerPaid
                                        ? "READY"
                                        : "PENDING"}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between p-3 bg-[#252525]  rounded-lg">
                                    <div className="flex flex-col items-start">
                                      <span className="text-white text-base font-normal mb-0.5">
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
                                      className={`px-2 py-1 rounded-lg flex items-center justify-center text-xs font-normal ${
                                        paymentStatus.blackPlayerPaid
                                          ? "bg-[#836EF9] text-white border border-white/10"
                                          : "bg-[#2c2c2c] text-white border border-white/10"
                                      }`}
                                    >
                                      {paymentStatus.blackPlayerPaid ? null : (
                                        <div className="inline-block mr-2 animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/80" />
                                      )}
                                      {paymentStatus.blackPlayerPaid
                                        ? "READY"
                                        : "PENDING"}
                                    </span>
                                  </div>
                                </div>

                                {/* Indicateur de progression */}
                                {/* <div className="rounded-lg mt-4">
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
                                </div> */}
                              </div>

                              {!paymentStatus.currentPlayerPaid ? (
                                <div className="space-y-2">
                                  <button
                                    onClick={async () => {
                                      if (isWrongNetwork) {
                                        try {
                                          await switchChain({ chainId: 10143 });

                                          return;
                                        } catch {
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
                                            }, 2000);
                                          }
                                        } catch {
                                          setBettingGameCreationFailed(true);
                                        }
                                      }
                                      // Cas 2: Join d'un betting game existant
                                      else if (
                                        gameInfo?.betAmount &&
                                        gameInfo.betAmount > BigInt(0)
                                      ) {
                                        if (gameInfo.state === 1) {
                                          setPaymentStatus((prev) => ({
                                            ...prev,
                                            currentPlayerPaid: true,
                                          }));
                                          return;
                                        }

                                        try {
                                          await joinBettingGameByRoom(
                                            gameState.roomName,
                                            gameInfo.betAmount
                                          );
                                        } catch {}
                                      }
                                    }}
                                    disabled={
                                      isPending ||
                                      isConfirming ||
                                      !gameState.roomName
                                    }
                                    className="w-full px-6 py-4 bg-[#836EF9] hover:bg-[#937EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
                                  >
                                    {isPending || isConfirming ? (
                                      <>
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
                                      className="w-full mt-5 px-6 py-4 bg-[#836EF9] disabled:bg-[#404040] text-white rounded-lg font-medium text-lg transition-colors flex items-center justify-center"
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
                              <p className="text-white font-bold text-4xl mb-7">
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
                                    <h4 className="text-white font-medium text-base">
                                      Prize Pool:
                                    </h4>
                                    <span className="text-green-400 font-bold text-base">
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
                                        <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
                                        <span className="text-white text-sm font-normal">
                                          White
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs flex items-center justify-center gap-2 font-normal ${
                                          gameInfo.whiteClaimed
                                            ? "bg-[#836EF9] text-white"
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
                                          ? "Can claim"
                                          : "Lost"}
                                      </span>
                                    </div>

                                    {/* Black Player Claim Status */}
                                    <div className="flex items-center justify-between p-2 bg-[#252525] rounded">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 bg-black border border-white rounded-full"></div>
                                        <span className="text-white text-sm font-normal">
                                          Black
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs flex items-center justify-center gap-2 font-normal ${
                                          gameInfo.blackClaimed
                                            ? "bg-[#836EF9] text-white"
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
                                          ? "Can claim"
                                          : "Lost"}
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
                                      className="col-span-1 px-8 py-2 bg-[#836EF9] hover:bg-[#937EF9] text-white rounded-lg font-medium text-lg transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRematchResponse(false)
                                      }
                                      className="col-span-1 px-8 py-2 bg-[#252525] hover:bg-[#252525] border border-[#836EF9] text-white rounded-lg font-medium text-lg transition-colors"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center space-y-3">
                                  {/* Boutons de claim - TOUJOURS VISIBLES mais disabled quand approprié */}
                                  <div className="space-y-3">
                                    {/* Claim winnings - TOUJOURS AFFICHÉ */}
                                    {gameState.gameResult.winner !== "draw" && (
                                      <button
                                        onClick={async () => {
                                          if (
                                            gameId &&
                                            canCurrentPlayerClaim()
                                          ) {
                                            resetClaimState();

                                            // CORRECTION: Déterminer le résultat basé sur l'adresse du joueur, pas sa couleur
                                            let resultParam: 1 | 2 | 3 = 2; // Par défaut BLACK_WINS

                                            if (gameInfo?.result === 1) {
                                              resultParam = 1; // WHITE_WINS
                                            } else if (gameInfo?.result === 2) {
                                              resultParam = 2; // BLACK_WINS
                                            } else if (gameInfo?.result === 3) {
                                              resultParam = 3; // DRAW
                                            }

                                            await claimWinnings(
                                              gameId,
                                              resultParam,
                                              () => {},
                                              (error) => {
                                                console.error(
                                                  "Claim failed:",
                                                  error
                                                );
                                              }
                                            );
                                          }
                                        }}
                                        disabled={
                                          !canCurrentPlayerClaim() ||
                                          claimState.isLoading ||
                                          isPending ||
                                          isConfirming ||
                                          (gameInfo &&
                                            gameInfo.state === 2 &&
                                            claimState.isSuccess)
                                        }
                                        className={`w-full px-6 py-4 ${
                                          claimState.isSuccess
                                            ? "bg-[#252525] border border-[#836EF9] text-[#836EF9]"
                                            : claimState.isError
                                            ? "bg-[#252525] border border-[#eb3f3f] text-[#eb3f3f]"
                                            : gameInfo && gameInfo.state !== 2
                                            ? "bg-[#252525] border border-white/5 text-white"
                                            : "bg-[#836EF9] hover:bg-[#836EF9]/80"
                                        } disabled:bg-[#252525] text-white rounded-lg border border-white/5 font-normal text-base transition-colors`}
                                      >
                                        {!canCurrentPlayerClaim() ? (
                                          "Waiting for opponent..."
                                        ) : gameInfo && gameInfo.state !== 2 ? (
                                          <div className="flex items-center justify-center gap-2">
                                            Waiting for game finalization...
                                          </div>
                                        ) : isPending ||
                                          isConfirming ||
                                          claimState.isLoading ? (
                                          "Confirming transaction..."
                                        ) : claimState.isError ? (
                                          "Try again"
                                        ) : claimState.isSuccess ? (
                                          "Successfully claimed"
                                        ) : (
                                          `Claim  ${
                                            gameInfo?.betAmount
                                              ? formatEther(
                                                  gameInfo.betAmount * BigInt(2)
                                                )
                                              : "0"
                                          } MON`
                                        )}
                                      </button>
                                    )}

                                    {/* Claim draw refund - TOUJOURS AFFICHÉ si match nul */}
                                    {gameState.gameResult.winner === "draw" && (
                                      <button
                                        onClick={async () => {
                                          if (
                                            gameId &&
                                            canCurrentPlayerClaim()
                                          ) {
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
                                          !canCurrentPlayerClaim() ||
                                          getAvailableAmount() <= "0" ||
                                          isPending ||
                                          isConfirming ||
                                          (gameInfo &&
                                            gameInfo.state === 2 &&
                                            claimState.isSuccess)
                                        }
                                        className={`w-full px-6 py-4 ${
                                          gameInfo && gameInfo.state !== 2
                                            ? "bg-[#252525] border border-white/5 text-white"
                                            : "bg-[#836EF9] hover:bg-[#937EF9]"
                                        } disabled:bg-[#252525] text-white rounded-lg font-normal text-base transition-colors`}
                                      >
                                        {!canCurrentPlayerClaim() ? (
                                          "No refund available"
                                        ) : getAvailableAmount() <= "0" ? (
                                          "Already claimed"
                                        ) : gameInfo && gameInfo.state !== 2 ? (
                                          <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
                                            Waiting for game finalization...
                                          </div>
                                        ) : isPending || isConfirming ? (
                                          "Confirming..."
                                        ) : (
                                          `Claim Refund`
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  {/* Accept/Decline seulement si on a reçu une invitation */}
                                  {rematchInvitation &&
                                  rematchInvitation.from !== address ? (
                                    <div className="space-y-3 mb-3">
                                      <p className="text-center text-base text-white">
                                        Your opponent offers you a rematch.{" "}
                                        <br />
                                        Do you want to accept?
                                      </p>
                                      <div className="grid grid-cols-2 gap-3">
                                        <button
                                          onClick={async () => {
                                            setRematchInvitation(null);
                                            setShowGameEndModal(false);

                                            // Utiliser handleAutoJoinRoom pour rejoindre directement
                                            await handleAutoJoinRoom(
                                              rematchInvitation.roomName,
                                              rematchInvitation.password
                                            );
                                          }}
                                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-normal text-base transition-colors"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          onClick={() =>
                                            setRematchInvitation(null)
                                          }
                                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-normal text-base transition-colors"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3">
                                      <button
                                        onClick={handleNewGame}
                                        disabled={
                                          gameState.rematchOffer?.offered ||
                                          shouldDisableNavigationButtons()
                                        }
                                        className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-base transition-colors"
                                      >
                                        {shouldDisableNavigationButtons()
                                          ? gameInfo && gameInfo.state !== 2
                                            ? "Finalizing..."
                                            : gameInfo?.betAmount &&
                                              gameInfo.betAmount > BigInt(0) &&
                                              canOfferRematch()
                                            ? "Rematch"
                                            : "New game"
                                          : gameState.rematchOffer?.offered
                                          ? "Waiting for opponent"
                                          : gameInfo?.betAmount &&
                                            gameInfo.betAmount > BigInt(0) &&
                                            canOfferRematch()
                                          ? "Rematch"
                                          : "New game"}
                                      </button>

                                      <button
                                        onClick={handleCloseGameEndModal}
                                        disabled={shouldDisableNavigationButtons()}
                                        className="w-full h-[45px] bg-[#eaeaea] hover:bg-[#252525] hover:border-white/10 border border-[#252525] disabled:bg-[#252525] disabled:border-white/5 disabled:cursor-not-allowed text-black hover:text-white disabled:text-white rounded-lg font-normal text-base transition-colors"
                                      >
                                        {shouldDisableNavigationButtons()
                                          ? gameInfo && gameInfo.state !== 2
                                            ? "Finalizing..."
                                            : "Analysis"
                                          : "Analysis"}
                                      </button>
                                    </div>
                                  )}
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
                              <div className="font-medium text-xl text-white flex items-center gap-2">
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
                      className={`backdrop-blur-md rounded-lg px-3 py-1 border ${
                        getCurrentPlayerTime() <= 30
                          ? "bg-red-500/20 border-red-500"
                          : "bg-[#252525] border-white/5"
                      }`}
                    >
                      <span
                        className={`text-xl font-medium ${
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
                    <p className="text-white font-medium text-lg ml-2.5">
                      Invite friend
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
                  <div className="px-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white text-lg font-medium">
                        Prize Pool
                      </span>
                      <span className="text-green-400 text-lg font-medium">
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
                <h3 className="text-base font-medium text-white mb-2">
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
                          ? "text-white font-medium"
                          : "text-white/50"
                      }`}
                    >
                      {msg.playerWallet === address
                        ? "You"
                        : msg.playerWallet.slice(0, 6) +
                          "..." +
                          msg.playerWallet.slice(-4)}
                    </div>
                    <div className="text-white/90 font-light text-sm">
                      {msg.message}
                    </div>
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
                  className="flex-1 px-3 h-[45px] bg-[#1E1E1E] min-w-[200px] border font-light border-white/5 text-white text-base placeholder-white/70 focus:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-4 h-[45px] bg-[#836EF9]/80 border border-white/5     text-white rounded-lg text-base font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      {rematchInvitation &&
                      rematchInvitation.from !== address ? (
                        <div>
                          <p className="text-white/80 font-light text-sm text-center mb-2">
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
                              : gameInfo?.betAmount &&
                                gameInfo.betAmount > BigInt(0) &&
                                canOfferRematch()
                              ? "Rematch"
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
