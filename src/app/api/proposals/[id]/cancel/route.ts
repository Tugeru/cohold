import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, auditLogs } from "@/db/schema";
import { generateStellarTxHash } from "@/lib/utils";
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    if (!isStateChangingAllowed(coholdConfig)) {
      return NextResponse.json(
        { success: false, error: "Wallet mode setup is incomplete; state changes are disabled" },
        { status: 503 }
      );
    }
    const { id: proposalId } = await props.params;
    const body = await req.json();
    const { memberAddress, memberLabel } = body;

    const pList = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (pList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    const proposal = pList[0];

    if (proposal.status === "executed") {
      return NextResponse.json(
        { success: false, error: "Cannot cancel an already executed proposal." },
        { status: 400 }
      );
    }

    const txHash = generateStellarTxHash();
    const now = new Date();

    await db
      .update(proposals)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: memberAddress || "Admin",
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId: proposal.treasuryId,
      action: "PROPOSAL_CANCELLED",
      actorAddress: memberAddress || "Proposer",
      actorLabel: memberLabel || "Proposer",
      details: JSON.stringify({
        proposalId,
        title: proposal.title,
      }),
      txHash,
      createdAt: now,
    });

    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel proposal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
