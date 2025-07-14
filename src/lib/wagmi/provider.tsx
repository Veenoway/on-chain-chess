"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";
import { wagmiAdapter } from "./config";

const queryClient = new QueryClient();

// export const monadTestnet = {
//   id: 41454,
//   name: "Monad Devnet",
//   network: "Monad Devnet",
//   nativeCurrency: {
//     decimals: 18,
//     name: "DMON",
//     symbol: "DMON",
//   },
//   rpcUrls: {
//     default: {
//       http: ["https://devnet1.monad.xyz/rpc/8XQAiNSsPCrIdVttyeFLC6StgvRNTdf"],
//     },
//     public: {
//       http: ["https://devnet1.monad.xyz/rpc/8XQAiNSsPCrIdVttyeFLC6StgvRNTdf"],
//     },
//   },
//   blockExplorers: {
//     default: {
//       name: "MonadScan",
//       url: "https://scan.monad.com",
//     },
//   },
// };

// const metadata = {
//   name: "Name Service dApp",
//   description: "Application avec Name Service",
//   url: "https://votreapp.com",
//   icons: ["https://votre-icone.com/icon.png"],
// };

// export const modal = createAppKit({
//   adapters: [wagmiAdapter],
//   projectId: "71cb70b160a3c0bdf69a9b358d250c4c",
//   networks: [monadTestnet],
//   defaultNetwork: monadTestnet,
//   metadata,
//   features: {
//     analytics: true,
//   },
// });

function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig, cookies);

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
