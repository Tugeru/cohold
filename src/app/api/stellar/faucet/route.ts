import { NextRequest, NextResponse } from "next/server";
import { requestFriendbotFunding } from "@/lib/stellar";
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";

export async function POST(req: NextRequest) {
  try {
    if (!isStateChangingAllowed(coholdConfig)) {
      return NextResponse.json(
        { success: false, error: "Wallet mode setup is incomplete; state changes are disabled" },
        { status: 503 }
      );
    }
    const body = await req.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Stellar address is required" },
        { status: 400 }
      );
    }

    const res = await requestFriendbotFunding(address);
    return NextResponse.json(res);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Faucet request failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
