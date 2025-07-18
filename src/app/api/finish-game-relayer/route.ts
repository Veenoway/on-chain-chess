import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CHESS_BETTING_CONTRACT_ADDRESS =
  "0xC17f273ff1E0aeb058e1c512d968c70CaAfa1Fd1";

// Configuration du réseau Monad Testnet
const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  network: "Monad Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "TMON",
    symbol: "TMON",
  },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
        "https://testnet-rpc.monad.xyz/",
        "https://cold-alien-pine.monad-testnet.quiknode.pro/bd2bdf09752a1d1519c98a1b8baa6467eaa50cb8/",
        "https://monad-testnet.drpc.org/",
      ],
    },
    public: {
      http: [
        "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
        "https://testnet-rpc.monad.xyz/",
        "https://cold-alien-pine.monad-testnet.quiknode.pro/bd2bdf09752a1d1519c98a1b8baa6467eaa50cb8/",
        "https://monad-testnet.drpc.org/",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://scan.monad.com",
    },
  },
};

// ABI du contrat avec erreurs personnalisées
const CHESS_BETTING_ABI = [
  // Erreurs personnalisées courantes
  {
    inputs: [],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "GameNotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "GameNotFound",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidResult",
    type: "error",
  },

  // Fonctions
  {
    inputs: [{ name: "gameId", type: "uint256" }],
    name: "getGame",
    outputs: [
      {
        components: [
          { name: "gameId", type: "uint256" },
          { name: "whitePlayer", type: "address" },
          { name: "blackPlayer", type: "address" },
          { name: "betAmount", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "result", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "finishedAt", type: "uint256" },
          { name: "roomName", type: "string" },
          { name: "whiteClaimed", type: "bool" },
          { name: "blackClaimed", type: "bool" },
          { name: "feePaid", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "result", type: "uint8" },
    ],
    name: "finishGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Clé privée du relayer (à garder secrète en production)
// TODO: Mettre cette clé dans les variables d'environnement (.env.local)
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY; // Clé d'exemple - CHANGEZ EN PRODUCTION!0

console.log(
  "🤖 Relayer address:",
  privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`).address
);
export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { gameId, result } = body;

    // Validation des paramètres
    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json(
        { error: "Game ID is required and must be a string" },
        { status: 400 }
      );
    }

    if (!result || ![1, 2, 3].includes(Number(result))) {
      return NextResponse.json(
        { error: "Result must be 1 (White wins), 2 (Black wins), or 3 (Draw)" },
        { status: 400 }
      );
    }

    const gameIdBigInt = BigInt(gameId);
    const resultNumber = Number(result) as 1 | 2 | 3;

    console.log("🤖 Relayer: Starting game finish process", {
      gameId: gameId,
      result: resultNumber,
      resultText:
        resultNumber === 1
          ? "WHITE_WINS"
          : resultNumber === 2
          ? "BLACK_WINS"
          : "DRAW",
    });

    // Créer les clients
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(),
    });

    console.log("🤖 Relayer address:", account.address);

    // Vérifier le propriétaire du contrat
    try {
      const contractOwner = (await publicClient.readContract({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: CHESS_BETTING_ABI,
        functionName: "owner",
      })) as string;

      console.log("🤖 Contract owner:", contractOwner);
      console.log(
        "🤖 Is relayer the owner?",
        contractOwner.toLowerCase() === account.address.toLowerCase()
      );

      if (contractOwner.toLowerCase() !== account.address.toLowerCase()) {
        return NextResponse.json(
          {
            error: "Relayer is not the contract owner",
            details: `Contract owner: ${contractOwner}, Relayer: ${account.address}. Only the contract owner can finish games.`,
            contractOwner: contractOwner,
            relayerAddress: account.address,
          },
          { status: 403 }
        );
      }
    } catch (ownerError) {
      console.log("⚠️  Could not check contract owner:", ownerError);
      // Continue anyway, the owner check might not be implemented
    }

    // Vérifier les informations de la partie
    const gameInfo = await publicClient.readContract({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "getGame",
      args: [gameIdBigInt],
    });

    console.log("🤖 Game info:", {
      gameId: gameInfo.gameId.toString(),
      state: gameInfo.state,
      currentResult: gameInfo.result,
      betAmount: formatEther(gameInfo.betAmount),
    });

    // Vérifications
    if (!gameInfo || gameInfo.gameId === BigInt(0)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (gameInfo.state === 2) {
      // FINISHED
      return NextResponse.json(
        {
          error: "Game is already finished",
          gameInfo: {
            gameId: gameInfo.gameId.toString(),
            state: gameInfo.state,
            result: gameInfo.result,
          },
        },
        { status: 400 }
      );
    }

    if (gameInfo.state !== 1) {
      // Not ACTIVE
      return NextResponse.json(
        { error: "Game is not active" },
        { status: 400 }
      );
    }

    if (gameInfo.blackPlayer === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: "Game has no black player" },
        { status: 400 }
      );
    }

    // Vérifier le solde du relayer
    const relayerBalance = await publicClient.getBalance({
      address: account.address,
    });

    console.log("🤖 Relayer balance:", formatEther(relayerBalance), "MON");

    if (relayerBalance < BigInt("10000000000000000")) {
      // 0.01 MON minimum
      return NextResponse.json(
        { error: "Relayer has insufficient balance for gas fees" },
        { status: 500 }
      );
    }

    // Estimer le gas nécessaire
    let gasEstimate: bigint;
    try {
      gasEstimate = await publicClient.estimateContractGas({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: CHESS_BETTING_ABI,
        functionName: "finishGame",
        args: [gameIdBigInt, resultNumber],
        account: account.address,
      });
      console.log("🤖 Gas estimate:", gasEstimate.toString());
    } catch (estimateError) {
      console.error("🤖 Gas estimation failed:", estimateError);
      return NextResponse.json(
        { error: "Failed to estimate gas for transaction" },
        { status: 500 }
      );
    }

    // Exécuter la transaction avec le relayer
    console.log("🤖 Sending finishGame transaction...");

    const hash = await walletClient.writeContract({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "finishGame",
      args: [gameIdBigInt, resultNumber],
      gas: gasEstimate + BigInt(10000), // Ajouter une marge
    });

    console.log("🤖 Transaction hash:", hash);

    // Attendre la confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000, // 60 secondes timeout
    });

    console.log("🤖 Transaction confirmed:", {
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber.toString(),
    });

    if (receipt.status === "success") {
      // Vérifier que la partie est bien terminée
      const updatedGameInfo = await publicClient.readContract({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: CHESS_BETTING_ABI,
        functionName: "getGame",
        args: [gameIdBigInt],
      });

      return NextResponse.json({
        success: true,
        message: "Game finished successfully by relayer",
        transactionHash: hash,
        gasUsed: receipt.gasUsed.toString(),
        gameInfo: {
          gameId: updatedGameInfo.gameId.toString(),
          state: updatedGameInfo.state,
          result: updatedGameInfo.result,
          finishedAt: updatedGameInfo.finishedAt.toString(),
        },
      });
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error: unknown) {
    console.error("🤖 Relayer error:", error);

    let errorMessage = "Failed to finish game via relayer";
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("only the contract owner")) {
        errorMessage = "Only the contract owner can finish games";
      } else if (msg.includes("game is not active")) {
        errorMessage = "Game is not active";
      } else if (msg.includes("game has no black player")) {
        errorMessage = "Game has no black player";
      } else if (msg.includes("invalid result")) {
        errorMessage = "Invalid game result";
      } else if (msg.includes("insufficient funds")) {
        errorMessage = "Relayer has insufficient funds for gas";
      } else if (error.message) {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
