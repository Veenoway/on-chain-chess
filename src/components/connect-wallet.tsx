"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { WalletModal } from "./connect-modal";

export function WalletConnection({ className }: { className?: string }) {
  // const { open } = useAppKit();
  const [open, setOpen] = useState(false);
  const { address, isConnecting, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (address) {
      setIsInitialLoading(false);
    }
  }, [address]);

  const getDisplayText = () => {
    if (isConnecting || isInitialLoading) return "Loading...";
    return `${address?.slice(0, 6)}...${address?.slice(-4)}`;
  };
  const isWrongNetwork = chainId !== 10143;

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({
        chainId: 10143,
      });
    } catch (err) {
      console.error("Failed to switch network:", err);
    }
  };

  const handleDisconnect = async () => {
    console.log("disconnecting");
    try {
      disconnect();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  if (address && isWrongNetwork) {
    return (
      <button
        onClick={handleSwitchNetwork}
        className={cn(
          `bg-[#836EF9]
          flex items-center rounded-lg uppercase h-[40px] sm:h-[50px] w-fit justify-center border border-borderColor px-2.5 sm:px-6 py-5
           text-sm sm:text-lg text-white font-medium transition-all duration-300 ease-in-out
          disabled:opacity-50 disabled:cursor-not-allowed`,
          className
        )}
      >
        Wrong Network
      </button>
    );
  }

  return (
    <div className="">
      {!address && (
        <WalletModal open={open} setOpen={setOpen}>
          <button
            onClick={() => setOpen(true)}
            className={cn(
              `bg-[#836EF9]
             flex items-center justify-center rounded-lg mx-auto w-fit h-[40px] sm:h-[50px] px-2.5 sm:px-6 py-5
             text-sm sm:text-lg text-white font-medium transition-all duration-300 ease-in-out
             ${isConnecting ? "opacity-50 cursor-not-allowed" : ""}`,
              className
            )}
          >
            Connect Wallet
          </button>
        </WalletModal>
      )}
      {address && !isWrongNetwork && (
        <div className="flex items-center gap-4 w-full">
          <button
            onClick={handleDisconnect}
            className={cn(
              `bg-[#836EF9]
                flex items-center rounded-lg mx-auto h-[40px] sm:h-[50px] w-fit px-2.5 sm:px-6 py-5
                text-sm sm:text-lg text-white font-semibold justify-center transition-all duration-300 ease-in-out
                `,
              className
            )}
          >
            {getDisplayText()}
          </button>
        </div>
      )}
    </div>
  );
}
