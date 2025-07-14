import { NFT_ADDRESS } from "@/contract";
import { NextRequest, NextResponse } from "next/server";
import {
  encodePacked,
  keccak256,
  recoverMessageAddress,
  SignableMessage,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function POST(req: NextRequest) {
  try {
    const { address, totalMinted } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      throw new Error("Signer private key not configured");
    }

    const account = privateKeyToAccount(signerPrivateKey as `0x${string}`);
    console.log("Signer address:", account.address);

    const currentTotalMinted = totalMinted || 0;

    const message = encodePacked(
      ["address", "uint256", "address", "uint256"],
      [
        address as `0x${string}`,
        BigInt(10143), // chainId
        NFT_ADDRESS as `0x${string}`,
        BigInt(currentTotalMinted),
      ]
    );

    const messageHash = keccak256(message);

    const signature = await account.signMessage({
      message: { raw: messageHash } as SignableMessage,
    });

    const recoveredAddress = await recoverMessageAddress({
      message: { raw: messageHash } as SignableMessage,
      signature,
    });

    console.log({
      userAddress: address,
      chainId: 10143,
      contractAddress: NFT_ADDRESS,
      totalMinted: currentTotalMinted,
      messageHash,
      signature,
      signer: account.address,
    });

    if (recoveredAddress.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error("The generated signature could not be verified");
    }

    return NextResponse.json({
      signature,
      debug: {
        message: toHex(message),
        messageHash,
        signer: account.address,
        recoveredAddress,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
