"use client";

import { NFT_ABI, NFT_ADDRESS } from "@/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { readContract, waitForTransactionReceipt } from "viem/actions";
import { formatUnits, parseUnits } from "viem/utils";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

interface NFTMetadata {
  tokenId: bigint;
  metadataId: bigint;
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

interface UserNFTDetailed {
  tokenId: bigint;
  metadataId: bigint;
  tokenURI: string;
  metadata?: NFTMetadata;
  normalizedImage?: string;
}

export function useNFT() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { connect, connectors } = useConnect();
  const publicClient = usePublicClient();
  const [lastMintedTokenId, setLastMintedTokenId] = useState<bigint | null>(
    null
  );
  const isFirstMount = useRef(true);
  const [mintPrice, setMintPrice] = useState<bigint>(BigInt(0));
  const [userNFTs, setUserNFTs] = useState<UserNFTDetailed[]>([]);
  const [nftMetadata, setNftMetadata] = useState<NFTMetadata[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: maxSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "MAX_SUPPLY",
  });

  const { data: totalMinted } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "totalMinted",
  });

  const { data: price } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "PRICE",
  });

  const { data: remainingSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "remainingSupply",
  });

  const { data: isPaused } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "paused",
  });

  const { data: userMintStatus } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "getUserMintStatus",
    args: address ? [address] : undefined,
  });

  const { data: mintPhaseInfo } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "getMintPhaseInfo",
  });

  const { data: isUserWL } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isWhitelisted",
    args: address ? [address] : undefined,
  });

  const { data: isUserOG } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isOG",
    args: address ? [address] : undefined,
  });

  const { data: isUserFCFS } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isFCFS",
    args: address ? [address] : undefined,
  });

  const { data: isUserTeam } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isTeamMember",
    args: address ? [address] : undefined,
  });

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isMintLoading, isSuccess: isMintSuccess } =
    useWaitForTransactionReceipt({ hash });

  const refreshUserNFTs = async () => {
    if (!address || !publicClient) {
      return null;
    }

    if (isLoadingNFTs) {
      return null;
    }

    setIsLoadingNFTs(true);

    try {
      (await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "totalMinted",
      })) as bigint;

      const result = await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "getUserNFTsDetailed",
        args: [address],
      });
      console.log("result", result);

      if (!result || !Array.isArray(result) || result.length < 4) {
        setUserNFTs([]);
        setNftMetadata([]);
        setIsLoadingNFTs(false);
        return [];
      }

      const [userTokensArray, metadataArray, tokenURIsArray] = result;

      const userTokens = userTokensArray as readonly bigint[];
      const metadataIds = metadataArray as readonly bigint[];
      const tokenURIs = tokenURIsArray as readonly string[];

      if (!userTokens.length) {
        setUserNFTs([]);
        setNftMetadata([]);
        setIsLoadingNFTs(false);
        return [];
      }

      const nftCall: Promise<UserNFTDetailed>[] = Array.from(
        { length: userTokens.length },
        async (_, i) => {
          const tokenId = userTokens[i];
          const existingNFT = userNFTs.find((nft) => nft.tokenId === tokenId);
          const response = await fetch(
            tokenURIs[i]
              .replace("ipfs://", "https://ipfs.io/ipfs/")
              .split(".json")[0],
            { cache: "no-store" }
          );

          const metadata = await response.json();

          const normalizedImage = metadata.image.replace(
            "ipfs://",
            "https://ipfs.io/ipfs/"
          );

          return {
            tokenId,
            metadataId: metadataIds[i],
            tokenURI: tokenURIs[i] || "",
            metadata: existingNFT?.metadata || metadata,
            normalizedImage: existingNFT?.normalizedImage || normalizedImage,
          };
        }
      );

      const nftDetails = await Promise.all(nftCall);

      setUserNFTs(nftDetails);

      setIsLoadingNFTs(false);
      return nftDetails;
    } catch (error) {
      console.error("Error while refreshing NFTs:", error);
      setIsLoadingNFTs(false);
      return null;
    }
  };

  const formatMON = (weiAmount: bigint | undefined): string => {
    if (!weiAmount) return "0";
    return formatUnits(weiAmount, 18);
  };

  const parseMON = (monAmount: string): bigint => {
    try {
      return parseUnits(monAmount, 18);
    } catch (error) {
      console.error("Error parsing MON amount:", error);
      return BigInt(0);
    }
  };

  useEffect(() => {
    getMintPrice();
  }, [mintPhaseInfo]);

  const getMintPrice = (): bigint => {
    const currentPhase = formatMintPhaseInfo()?.currentPhase;

    if (
      typeof isUserTeam !== "undefined" &&
      isUserTeam !== null &&
      Boolean(isUserTeam)
    ) {
      return BigInt(0);
    }

    switch (currentPhase) {
      case "Team Only": {
        setMintPrice(BigInt(0));
        return BigInt(0);
      }
      case "Whitelist": {
        setMintPrice(BigInt(1 * 10 ** 18));
        return BigInt(1 * 10 ** 18);
      }
      case "First Come First Served": {
        setMintPrice(BigInt(3 * 10 ** 18));
        return BigInt(3 * 10 ** 18);
      }
      case "Public Mint": {
        setMintPrice(BigInt(50 * 10 ** 18));
        return BigInt(50 * 10 ** 18);
      }
      default:
        return BigInt(0);
    }
  };

  const getFormattedPrice = (): string => {
    const mintPrice = getMintPrice();
    return formatMON(mintPrice);
  };

  const mint = async (isOG: boolean = false) => {
    if (!isConnected) {
      await connect({ connector: connectors[0] });
      return null;
    }

    if (!publicClient) {
      throw new Error("Client unavailable");
    }

    const mintPrice = getMintPrice();

    try {
      const txHash = await writeContract({
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "mint",
        args: [isOG],
        value: mintPrice,
        account: address,
        gas: BigInt(300000),
      });

      if (typeof txHash === "string") {
        await waitForTransactionReceipt(publicClient, {
          hash: txHash as `0x${string}`,
          confirmations: 1,
        });

        invalidateQueries();

        try {
          const currentTotalMinted = (await readContract(publicClient, {
            address: NFT_ADDRESS,
            abi: NFT_ABI,
            functionName: "totalMinted",
          })) as bigint;

          const newTokenId = currentTotalMinted - BigInt(1);
          setLastMintedTokenId(newTokenId);
        } catch (err) {
          console.error("Error retrieving totalMinted:", err);
        }

        return { success: true, hash: txHash };
      } else {
        throw new Error("Invalid transaction hash");
      }
    } catch (error) {
      console.error("Error during mint:", error);
      throw new Error("Transaction failed. Check parameters and try again.");
    }
  };

  const invalidateQueries = () => {
    if (!queryClient) return;

    const queries = [
      "totalMinted",
      "MAX_SUPPLY",
      "getUserMintStatus",
      "remainingSupply",
      "getMintPhaseInfo",
      "getUserNFTsDetailed",
    ].map((functionName) => ({
      queryKey: [
        "readContract",
        {
          address: NFT_ADDRESS,
          functionName,
        },
      ],
    }));

    queries.forEach((query) => queryClient.invalidateQueries(query));
  };

  useEffect(() => {
    if (address && publicClient) {
      if (isFirstMount.current) {
        refreshUserNFTs();
        isFirstMount.current = false;
      }

      refreshIntervalRef.current = setInterval(() => {
        refreshUserNFTs();
        invalidateQueries();
      }, 10000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (isMintSuccess) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      invalidateQueries();

      const refreshSequence = [
        {
          delay: 1000,
          message: "First refresh after mint",
        },
        {
          delay: 3000,
          message: "Second refresh to check metadata",
        },
        {
          delay: 8000,
          message: "Third refresh to confirm all NFTs",
        },
        {
          delay: 15000,
          message: "Final refresh for complete validation",
        },
      ];

      let totalDelay = 0;

      refreshSequence.forEach((step, index) => {
        totalDelay += step.delay;

        setTimeout(async () => {
          try {
            await refreshUserNFTs();

            if (
              index === refreshSequence.length - 1 &&
              address &&
              publicClient
            ) {
              refreshIntervalRef.current = setInterval(() => {
                refreshUserNFTs();
                invalidateQueries();
              }, 10000);
            }
          } catch (error) {
            console.error(`Error during refresh #${index + 1}:`, error);
          }
        }, totalDelay);
      });
    }
  }, [isMintSuccess, address, publicClient]);

  const formatUserMintStatus = () => {
    if (
      !userMintStatus ||
      !Array.isArray(userMintStatus) ||
      userMintStatus.length < 5
    ) {
      return null;
    }

    return {
      canCurrentlyMint: Boolean(userMintStatus[0]),
      mintsDone: Number(userMintStatus[1]),
      mintsAllowed: Number(userMintStatus[2]),
      mintsRemaining: Number(userMintStatus[3]),
      userStatus: String(userMintStatus[4]),
    };
  };

  const formatMintPhaseInfo = () => {
    if (
      !mintPhaseInfo ||
      !Array.isArray(mintPhaseInfo) ||
      mintPhaseInfo.length < 5
    ) {
      return null;
    }

    return {
      currentPhase: String(mintPhaseInfo[0]),
      isActive: Boolean(mintPhaseInfo[1]),
      totalSupply: Number(mintPhaseInfo[2]),
      mintedCount: Number(mintPhaseInfo[3]),
      remainingCount: Number(mintPhaseInfo[4]),
    };
  };

  return {
    maxSupply: Number(maxSupply ?? 0),
    totalMinted: Number(totalMinted ?? 0),
    price,
    remainingSupply: Number(remainingSupply ?? 0),
    isPaused: Boolean(isPaused),

    mint,
    isLoading: isMintLoading,
    isSuccess: isMintSuccess,
    error,
    refreshUserNFTs,
    lastMintedTokenId,
    isLoadingNFTs,

    getMintPrice,
    getFormattedPrice,
    formatMON,
    parseMON,

    isConnected,
    userMintStatus: formatUserMintStatus(),
    isUserWL: Boolean(isUserWL),
    isUserOG: Boolean(isUserOG),
    isUserFCFS: Boolean(isUserFCFS),
    isUserTeam: Boolean(isUserTeam),

    mintPhaseInfo: formatMintPhaseInfo(),

    mintPrice,
    nftMetadata,
    userNFTs,
  };
}
