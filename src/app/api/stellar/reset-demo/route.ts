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
import { coholdConfig } from "@/lib/cohold-config";
import { resetDemoFixtures } from "@/lib/demo-adapter";

async function restoreCanonicalDemoDataset() {
  await db.delete(proposalApprovals);
  await db.delete(proposals);
  await db.delete(contributions);
  await db.delete(auditLogs);
  await db.delete(treasuryMembers);
  await db.delete(treasuries);
  await ensureDatabaseSeeded();
}

export async function POST() {
  try {
    const result = await resetDemoFixtures(
      coholdConfig,
      restoreCanonicalDemoDataset
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
