"use client";
import { Chess } from "chess.js";

// Composant pour afficher les pièces capturées
export default function CapturedPieces({
  fen,
  playerColor,
  isOpponent = false,
}: {
  fen: string;
  playerColor: "white" | "black";
  isOpponent?: boolean;
}) {
  // Valeurs des pièces pour calculer l'avantage matériel
  const PIECE_VALUES: Record<string, number> = {
    p: 1, // pion
    n: 3, // cavalier
    b: 3, // fou
    r: 5, // tour
    q: 9, // dame
    k: 0, // roi (non comptabilisé)
  };

  // Symboles Unicode pour les pièces
  const PIECE_SYMBOLS = {
    white: {
      p: "♙",
      n: "♘",
      b: "♗",
      r: "♖",
      q: "♕",
      k: "♔",
    },
    black: {
      p: "♟",
      n: "♞",
      b: "♝",
      r: "♜",
      q: "♛",
      k: "♚",
    },
  } as const;

  interface CapturedPiece {
    type: string;
    color: "w" | "b";
  }

  // Calculer les pièces capturées à partir du FEN
  const getCapturedPieces = (fen: string) => {
    const chess = new Chess(fen);
    const board = chess.board();

    // Pièces initiales
    const initialPieces = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    };

    // Compter les pièces restantes sur l'échiquier
    const remainingPieces = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } as Record<string, number>,
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } as Record<string, number>,
    };

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          remainingPieces[piece.color][piece.type]++;
        }
      }
    }

    // Calculer les pièces capturées
    const capturedByWhite: CapturedPiece[] = [];
    const capturedByBlack: CapturedPiece[] = [];

    // Pièces noires capturées par les blancs
    Object.entries(initialPieces.b).forEach(([type, initialCount]) => {
      const captured = initialCount - remainingPieces.b[type];
      for (let i = 0; i < captured; i++) {
        capturedByWhite.push({ type, color: "b" });
      }
    });

    // Pièces blanches capturées par les noirs
    Object.entries(initialPieces.w).forEach(([type, initialCount]) => {
      const captured = initialCount - remainingPieces.w[type];
      for (let i = 0; i < captured; i++) {
        capturedByBlack.push({ type, color: "w" });
      }
    });

    return { capturedByWhite, capturedByBlack };
  };

  // Calculer l'avantage matériel
  const getMaterialAdvantage = (
    capturedByPlayer: CapturedPiece[],
    capturedByOpponent: CapturedPiece[]
  ) => {
    const playerValue = capturedByPlayer.reduce(
      (sum, piece) => sum + (PIECE_VALUES[piece.type] || 0),
      0
    );
    const opponentValue = capturedByOpponent.reduce(
      (sum, piece) => sum + (PIECE_VALUES[piece.type] || 0),
      0
    );

    return playerValue - opponentValue;
  };

  const { capturedByWhite, capturedByBlack } = getCapturedPieces(fen);

  // Déterminer quelles pièces afficher selon la perspective
  const isPlayerWhite = playerColor === "white";
  const capturedByPlayer = isPlayerWhite ? capturedByWhite : capturedByBlack;
  const capturedByOpponent = isPlayerWhite ? capturedByBlack : capturedByWhite;

  // Pièces à afficher selon si c'est l'adversaire ou le joueur
  const piecesToShow = isOpponent ? capturedByOpponent : capturedByPlayer;
  const materialAdvantage = getMaterialAdvantage(
    capturedByPlayer,
    capturedByOpponent
  );

  // Ajuster l'avantage selon la perspective (adversaire vs joueur)
  const displayAdvantage = isOpponent ? -materialAdvantage : materialAdvantage;

  return (
    <div className={`flex items-center justify-between`}>
      {/* Pièces capturées */}
      <div className="flex items-center gap-1">
        {piecesToShow.map((piece, index) => (
          <span key={index} className="text-2xl">
            {
              PIECE_SYMBOLS[piece.color === "w" ? "white" : "black"][
                piece.type as keyof typeof PIECE_SYMBOLS.white
              ]
            }
          </span>
        ))}
        {displayAdvantage > 0 && (
          <span className="text-[#836EF9] font-bold text-lg -mb-1 ml-2">
            +{displayAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}

// Remplacez la section de l'échiquier dans votre JSX par ceci :

/* Panel central - Échiquier */
