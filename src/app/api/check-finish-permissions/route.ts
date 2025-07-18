import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

const CHESS_BETTING_CONTRACT_ADDRESS =
  "0xC17f273ff1E0aeb058e1c512d968c70CaAfa1Fd1";

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

const CHESS_BETTING_ABI = [
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

export const POST = async (request: NextRequest) => {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json(
        { error: "Game ID is required" },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    // Récupérer les infos de la partie
    const gameInfo = await publicClient.readContract({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "getGame",
      args: [BigInt(gameId)],
    });

    if (!gameInfo || gameInfo.gameId === BigInt(0)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Récupérer le propriétaire du contrat
    let contractOwner = "Unknown";
    try {
      contractOwner = (await publicClient.readContract({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: CHESS_BETTING_ABI,
        functionName: "owner",
      })) as string;
    } catch (error) {
      console.log("Could not get contract owner:", error);
    }

    // Tester qui peut appeler finishGame
    const testAddresses = [
      {
        name: "Contract Owner",
        address: contractOwner,
      },
      {
        name: "White Player",
        address: gameInfo.whitePlayer,
      },
      {
        name: "Black Player",
        address: gameInfo.blackPlayer,
      },
      {
        name: "Random Address (Relayer)",
        address: "0x1B5Cb3Be01a1E424ec8Db5eD3924ABF5f59EAbFa", // L'adresse du relayer
      },
    ];

    const permissionTests = [];

    for (const testAddr of testAddresses) {
      if (
        !testAddr.address ||
        testAddr.address === "0x0000000000000000000000000000000000000000"
      ) {
        permissionTests.push({
          role: testAddr.name,
          address: testAddr.address || "N/A",
          canFinish: false,
          reason: "Invalid address",
        });
        continue;
      }

      try {
        // Essayer d'estimer le gas - si ça marche, la personne peut appeler la fonction
        await publicClient.estimateContractGas({
          address: CHESS_BETTING_CONTRACT_ADDRESS,
          abi: CHESS_BETTING_ABI,
          functionName: "finishGame",
          args: [BigInt(gameId), 1], // Test avec WHITE_WINS
          account: testAddr.address as `0x${string}`,
        });

        permissionTests.push({
          role: testAddr.name,
          address: testAddr.address,
          canFinish: true,
          reason: "Gas estimation successful",
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        permissionTests.push({
          role: testAddr.name,
          address: testAddr.address,
          canFinish: false,
          reason: errorMsg.includes("0x118cdaa7")
            ? "Unauthorized (custom error)"
            : errorMsg.includes("revert")
            ? "Transaction would revert"
            : errorMsg.includes("Unauthorized")
            ? "Not authorized"
            : "Unknown error",
          error: errorMsg.substring(0, 200) + "...", // Limiter la taille de l'erreur
        });
      }
    }

    return NextResponse.json({
      gameId: gameInfo.gameId.toString(),
      gameState: gameInfo.state,
      whitePlayer: gameInfo.whitePlayer,
      blackPlayer: gameInfo.blackPlayer,
      contractOwner,
      permissionTests,
      analysis: {
        whoCanFinish: permissionTests
          .filter((test) => test.canFinish)
          .map((test) => test.role),
        recommendation: permissionTests.some(
          (test) => test.canFinish && test.role.includes("Player")
        )
          ? "Only players can finish the game. Consider using player-sponsored transactions."
          : permissionTests.some(
              (test) => test.canFinish && test.role === "Contract Owner"
            )
          ? "Only the contract owner can finish games. Use the owner's private key as relayer."
          : "No one can finish this game. Check game state and contract logic.",
      },
    });
  } catch (error) {
    console.error("Error checking finish permissions:", error);
    return NextResponse.json(
      {
        error: "Failed to check permissions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
