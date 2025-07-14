import { createConfig, http } from "wagmi";

// Configuration de la chaîne Monad Testnet
const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  network: "monad-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MONAD",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.monad.xyz/"],
    },
    public: {
      http: ["https://rpc.testnet.monad.xyz/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://explorer.testnet.monad.xyz",
    },
  },
  testnet: true,
} as const;

export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
});
