import { NextResponse } from "next/server";
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

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

interface DebugConfig {
  relayerAddress?: string;
  latestBlock?: string;
  relayerBalance?: string;
  relayerBalanceWei?: string;
  walletClientReady?: boolean;
  contractAccessible?: boolean;
  gasEstimate?: string;
}

interface DebugInfo {
  steps: string[];
  errors: string[];
  config: DebugConfig;
  success: boolean;
}

export const GET = async () => {
  const debug: DebugInfo = {
    steps: [],
    errors: [],
    config: {},
    success: false,
  };

  try {
    debug.steps.push("1. Testing private key format...");

    if (!RELAYER_PRIVATE_KEY?.startsWith("0x")) {
      throw new Error("Private key must start with 0x");
    }

    if (RELAYER_PRIVATE_KEY?.length !== 66) {
      throw new Error(
        `Private key must be 66 characters long (including 0x), got ${RELAYER_PRIVATE_KEY.length}`
      );
    }

    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    debug.config.relayerAddress = account.address;
    debug.steps.push("✅ Private key format is valid");

    // Step 2: Test de la connexion au réseau
    debug.steps.push("2. Testing network connection...");

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    const blockNumber = await publicClient.getBlockNumber();
    debug.config.latestBlock = blockNumber.toString();
    debug.steps.push(
      `✅ Connected to Monad Testnet, latest block: ${blockNumber}`
    );

    // Step 3: Test du solde du relayer
    debug.steps.push("3. Checking relayer balance...");

    const relayerBalance = await publicClient.getBalance({
      address: account.address,
    });

    debug.config.relayerBalance = formatEther(relayerBalance);
    debug.config.relayerBalanceWei = relayerBalance.toString();
    debug.steps.push(`✅ Relayer balance: ${formatEther(relayerBalance)} MON`);

    if (relayerBalance < BigInt("10000000000000000")) {
      // 0.01 MON
      debug.errors.push(
        "⚠️  Relayer balance is low (< 0.01 MON). Add funds for gas fees."
      );
    }

    // Step 4: Test du wallet client
    debug.steps.push("4. Testing wallet client creation...");

    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(),
    });
    void walletClient; // Used for testing creation only

    debug.config.walletClientReady = true;
    debug.steps.push("✅ Wallet client created successfully");

    // Step 5: Test de lecture du contrat
    debug.steps.push("5. Testing contract read...");

    try {
      const testGameInfo = await publicClient.readContract({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: [
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
        ],
        functionName: "getGame",
        args: [BigInt(1)],
      });
      void testGameInfo; // Used for testing contract accessibility only

      debug.config.contractAccessible = true;
      debug.steps.push("✅ Contract is accessible");
    } catch (contractError) {
      debug.errors.push(
        `❌ Contract read error: ${
          contractError instanceof Error
            ? contractError.message
            : String(contractError)
        }`
      );
      debug.config.contractAccessible = false;
    }

    // Step 6: Test d'estimation de gas
    debug.steps.push("6. Testing gas estimation...");

    try {
      const gasEstimate = await publicClient.estimateContractGas({
        address: CHESS_BETTING_CONTRACT_ADDRESS,
        abi: [
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
        ],
        functionName: "finishGame",
        args: [BigInt(1), 1],
        account: account.address,
      });

      debug.config.gasEstimate = gasEstimate.toString();
      debug.steps.push(`✅ Gas estimation successful: ${gasEstimate} gas`);
    } catch (gasError) {
      debug.errors.push(
        `⚠️  Gas estimation failed (normal for non-existent games): ${
          gasError instanceof Error ? gasError.message : String(gasError)
        }`
      );
    }

    debug.success = debug.errors.length === 0;
    debug.steps.push(`\n🏁 Debug complete. Errors: ${debug.errors.length}`);

    return NextResponse.json({
      success: debug.success,
      message: debug.success
        ? "Relayer configuration is valid"
        : "Relayer has configuration issues",
      debug,
      recommendations:
        debug.errors.length > 0
          ? [
              "Check the errors above",
              "Ensure RELAYER_PRIVATE_KEY is set correctly in .env.local",
              "Add MON funds to the relayer wallet if balance is low",
              "Verify network connectivity",
            ]
          : ["Configuration looks good!", "You can now use the relayer API"],
    });
  } catch (error: unknown) {
    debug.errors.push(
      `❌ Fatal error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    return NextResponse.json(
      {
        success: false,
        message: "Relayer configuration failed",
        debug,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
};
