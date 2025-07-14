"use client";

import { NFT_ABI, NFT_ADDRESS } from "@/contract";
import { useState } from "react";
import { readContract } from "viem/actions";
import { useAccount, usePublicClient } from "wagmi";

export default function WalletChecker() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [inputAddress, setInputAddress] = useState("");
  const [checkResult, setCheckResult] = useState<{
    address: string;
    status: string;
    mintsDone: number;
    mintsAllowed: number;
    mintsRemaining: number;
    statusText: string;
    canMint: boolean;
    currentPhase: string;
    isPhaseActive: boolean;
    isTeamMember: boolean;
    isWhitelisted: boolean;
    isFCFS: boolean;
    isOG: boolean;
    isPublic: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = async (addressToCheck: string) => {
    if (!addressToCheck) {
      addressToCheck = address || "";
    }

    setIsLoading(true);

    try {
      if (!publicClient) {
        throw new Error("Client unavailable");
      }

      const phaseInfoResult = await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "getMintPhaseInfo",
      });

      let currentPhase = "";
      let isPhaseActive = false;

      if (
        phaseInfoResult &&
        Array.isArray(phaseInfoResult) &&
        phaseInfoResult.length >= 2
      ) {
        currentPhase = String(phaseInfoResult[0]);
        isPhaseActive = Boolean(phaseInfoResult[1]);
      }

      let isTeamMember = false;
      let isWhitelisted = false;
      let isFCFS = false;
      let isOG = false;
      let isPublic = false;

      try {
        const isTeamMemberResult = await readContract(publicClient, {
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: "isTeamMember",
          args: [addressToCheck],
        });
        isTeamMember = Boolean(isTeamMemberResult);
      } catch {
        console.log("isTeamMember function not available or failed");
      }

      try {
        const isWhitelistedResult = await readContract(publicClient, {
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: "isWhitelisted",
          args: [addressToCheck],
        });
        isWhitelisted = Boolean(isWhitelistedResult);
      } catch {
        console.log("isWhitelisted function not available or failed");
      }

      try {
        const isFCFSResult = await readContract(publicClient, {
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: "isFCFS",
          args: [addressToCheck],
        });
        isFCFS = Boolean(isFCFSResult);
      } catch {
        console.log("isFCFS function not available or failed");
      }

      try {
        const isOGResult = await readContract(publicClient, {
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: "isOG",
          args: [addressToCheck],
        });
        isOG = Boolean(isOGResult);
      } catch {
        console.log("isOG function not available or failed");
      }

      const result = await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "getUserMintStatus",
        args: [addressToCheck],
      });

      if (!result || !Array.isArray(result) || result.length < 5) {
        throw new Error("Invalid response from contract");
      }

      const [
        canCurrentlyMint,
        mintsDone,
        mintsAllowed,
        mintsRemaining,
        userStatus,
      ] = result;

      const userTrueStatus = String(userStatus);

      console.log(userTrueStatus);

      let statusText;

      switch (userTrueStatus) {
        case "OG":
          statusText = "OG Whitelist";
          isOG = true;
          break;
        case "WHITELIST":
          statusText = "Whitelist";
          isWhitelisted = true;
          break;
        case "Team Member":
          statusText = "Team Member";
          isTeamMember = true;
          break;
        case "PREMINT":
          statusText = "Pre-mint Access";
          break;
        case "FCFS":
          statusText = "First Come First Serve";
          isFCFS = true;
          break;
        case "PUBLIC":
          statusText = "Public Sale";
          isPublic = true;
          break;
        default:
          // Si les fonctions spécifiques ont renvoyé true, utiliser ce statut
          if (isOG) statusText = "OG Whitelist";
          else if (isTeamMember) statusText = "Team Member";
          else if (isWhitelisted) statusText = "Whitelist";
          else if (isFCFS) statusText = "First Come First Serve";
          else if (isPublic) statusText = "Public Sale";
          else statusText = "Not Whitelisted";
      }

      setCheckResult({
        address: addressToCheck,
        status: userTrueStatus,
        mintsDone: Number(mintsDone),
        mintsAllowed: Number(mintsAllowed),
        mintsRemaining: Number(mintsRemaining),
        statusText,
        canMint: Boolean(canCurrentlyMint),
        currentPhase,
        isPhaseActive,
        isTeamMember,
        isWhitelisted,
        isFCFS,
        isOG,
        isPublic,
      });
    } catch (error) {
      console.error("Error checking wallet status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-5 lg:mt-10 p-4 lg:p-6 bg-[rgba(255,255,255,0.05)] rounded-xl border border-[rgba(255,255,255,0.1)]">
      <h2 className="text-2xl lg:text-4xl uppercase font-bold text-white mb-3 lg:mb-4">
        Whitelist Checker
      </h2>

      <div>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder={address || "Enter wallet address (0x...)"}
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            className="flex-grow px-4 py-3 rounded-lg uppercase text-xl bg-[rgba(255,255,255,0.05)] text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => handleCheck(inputAddress)}
            disabled={isLoading}
            className="px-5 py-2 bg-brandColor uppercase hover:bg-brandColor/80 text-white rounded-lg text-xl font-bold transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? "Checking..." : "Check Status"}
          </button>
        </div>
      </div>
      {checkResult && (
        <div className="bg-[rgba(0,0,0,0.2)] mt-5 p-5 rounded-lg uppercase">
          <h3 className="text-3xl font-semibold text-white mb-4">Results</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-[rgba(255,255,255,0.05)] p-4 rounded-lg">
              <p className="text-gray-400 text-xl">Wallet Address</p>
              <p className="text-white text-lg break-all">
                {checkResult.address}
              </p>
            </div>
            <div className="bg-[rgba(255,255,255,0.05)] p-4 rounded-lg">
              <p className="text-gray-400 text-xl">Status</p>
              <div className="flex items-center mt-1">
                <div
                  className={`w-3 h-3 mr-2 ${
                    checkResult.statusText !== "Not Whitelisted"
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />
                <p className="text-white text-xl font-semibold">
                  {checkResult?.isWhitelisted
                    ? "Whitelist"
                    : checkResult?.isFCFS
                    ? "FCFS"
                    : checkResult?.isOG
                    ? "OG"
                    : "Not Whitelisted"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
