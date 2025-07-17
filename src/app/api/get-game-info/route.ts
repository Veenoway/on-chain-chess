import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

const CHESS_BETTING_CONTRACT_ADDRESS =
  "0xC17f273ff1E0aeb058e1c512d968c70CaAfa1Fd1";

export const monadTestnet = {
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
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameIdParam = searchParams.get("gameId");

    if (!gameIdParam) {
      return NextResponse.json(
        { error: "Game ID is required" },
        { status: 400 }
      );
    }

    const gameId = BigInt(gameIdParam);

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    const gameInfo = await publicClient.readContract({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "getGame",
      args: [gameId],
    });

    return NextResponse.json({ gameInfo });
  } catch (error) {
    console.error("Error fetching game info:", error);
    return NextResponse.json(
      { error: "Failed to fetch game info" },
      { status: 500 }
    );
  }
}
