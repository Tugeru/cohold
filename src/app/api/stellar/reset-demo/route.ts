import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  proposals,
  proposalApprovals,
  contributions,
  auditLogs,
} from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";

export async function POST() {
  try {
    if (!isStateChangingAllowed(coholdConfig)) {
      return NextResponse.json(
        { success: false, error: "Wallet mode setup is incomplete; state changes are disabled" },
        { status: 503 }
      );
    }
    // Delete in cascade order
    await db.delete(proposalApprovals);
    await db.delete(proposals);
    await db.delete(contributions);
    await db.delete(auditLogs);
    await db.delete(treasuryMembers);
    await db.delete(treasuries);

    // Re-seed
    await ensureDatabaseSeeded();

    return NextResponse.json({
      success: true,
      message: "Database successfully reset to demo scenario.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
