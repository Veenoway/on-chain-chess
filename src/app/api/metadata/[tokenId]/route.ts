import { NextRequest, NextResponse } from "next/server";

const NEW_IPFS_CID =
  "bafybeihvx432go6nhbmrmxubdzvodqn5vcbjtdynpeo74b6tf76gcn6iyi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const resolvedParams = await params;
    const tokenId = resolvedParams.tokenId;

    if (!tokenId) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    const metadataUrl = `https://ipfs.io/ipfs/${NEW_IPFS_CID}/${tokenId}.json`;

    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const metadata = await response.json();

    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch metadata",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
