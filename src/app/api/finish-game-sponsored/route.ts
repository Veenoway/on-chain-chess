import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

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

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

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
] as const;

export const POST = async (request: NextRequest) => {
  try {
    const { gameId, result, playerAddress } = await request.json();

    // Validation des paramètres
    if (!gameId || !result || !playerAddress) {
      return NextResponse.json(
        { error: "gameId, result, and playerAddress are required" },
        { status: 400 }
      );
    }

    if (![1, 2, 3].includes(Number(result))) {
      return NextResponse.json(
        { error: "Result must be 1 (White wins), 2 (Black wins), or 3 (Draw)" },
        { status: 400 }
      );
    }

    const gameIdBigInt = BigInt(gameId);
    const resultNumber = Number(result) as 1 | 2 | 3;

    console.log("💰 Sponsored Transaction: Starting process", {
      gameId,
      result: resultNumber,
      playerAddress,
    });

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    const relayerAccount = privateKeyToAccount(
      RELAYER_PRIVATE_KEY as `0x${string}`
    );
    const relayerWallet = createWalletClient({
      account: relayerAccount,
      chain: monadTestnet,
      transport: http(),
    });

    // Vérifier les informations de la partie
    const gameInfo = await publicClient.readContract({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "getGame",
      args: [gameIdBigInt],
    });

    if (!gameInfo || gameInfo.gameId === BigInt(0)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Vérifier que l'adresse fournie est bien un joueur de la partie
    const isWhitePlayer =
      gameInfo.whitePlayer.toLowerCase() === playerAddress.toLowerCase();
    const isBlackPlayer =
      gameInfo.blackPlayer.toLowerCase() === playerAddress.toLowerCase();

    if (!isWhitePlayer && !isBlackPlayer) {
      return NextResponse.json(
        { error: "Player address is not part of this game" },
        { status: 400 }
      );
    }

    // Vérifier le solde du joueur
    const playerBalance = await publicClient.getBalance({
      address: playerAddress as `0x${string}`,
    });

    console.log(`💰 Player balance: ${formatEther(playerBalance)} MON`);

    // Estimer le coût de la transaction
    const gasEstimate = await publicClient.estimateContractGas({
      address: CHESS_BETTING_CONTRACT_ADDRESS,
      abi: CHESS_BETTING_ABI,
      functionName: "finishGame",
      args: [gameIdBigInt, resultNumber],
      account: playerAddress as `0x${string}`,
    });

    const gasPrice = await publicClient.getGasPrice();
    const estimatedCost = gasEstimate * gasPrice;
    const costWithBuffer = estimatedCost + estimatedCost / BigInt(5); // +20% de marge

    console.log(
      `💰 Estimated transaction cost: ${formatEther(costWithBuffer)} MON`
    );

    // Si le joueur n'a pas assez de fonds, le relayer lui en envoie
    if (playerBalance < costWithBuffer) {
      const amountToSend = costWithBuffer - playerBalance + parseEther("0.001"); // +0.001 MON de marge

      console.log(
        `💰 Sending ${formatEther(amountToSend)} MON to player for gas fees`
      );

      // Le relayer envoie des fonds au joueur
      const fundingTx = await relayerWallet.sendTransaction({
        to: playerAddress as `0x${string}`,
        value: amountToSend,
      });

      console.log(`💰 Funding transaction sent: ${fundingTx}`);

      // Attendre la confirmation
      await publicClient.waitForTransactionReceipt({
        hash: fundingTx,
      });

      console.log(`✅ Player funded successfully`);
    }

    return NextResponse.json({
      success: true,
      message: "Player has been funded to call finishGame",
      playerAddress,
      estimatedGasCost: formatEther(costWithBuffer),
      instructions: {
        step1: "The relayer has sent you funds for gas fees",
        step2: "You can now call finishGame from your wallet",
        step3: "Contract will finalize the game and enable claims",
      },
      transactionDetails: {
        contractAddress: CHESS_BETTING_CONTRACT_ADDRESS,
        functionName: "finishGame",
        parameters: {
          gameId: gameId,
          result: resultNumber,
        },
      },
    });
  } catch (error: unknown) {
    console.error("💰 Sponsored transaction error:", error);

    let errorMessage = "Failed to process sponsored transaction";
    if (error instanceof Error) {
      errorMessage = error.message;
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
