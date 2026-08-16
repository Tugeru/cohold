import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, treasuryMembers, auditLogs } from "@/db/schema";
import { coholdConfig } from "@/lib/cohold-config";
import {
  demoMutationDenied,
  resolveDemoActor,
  syntheticDemoSuccess,
} from "@/lib/demo-adapter";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const denied = demoMutationDenied(coholdConfig);
    if (denied) {
      return NextResponse.json(denied, { status: 403 });
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

    const members = await db
      .select()
      .from(treasuryMembers)
      .where(eq(treasuryMembers.treasuryId, proposal.treasuryId));
    const actor = resolveDemoActor({
      actorAddress: memberAddress,
      label: memberLabel,
      members: members.map((row) => row.address),
    });

    if (!actor.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${memberAddress ?? "unknown"} is not an authorized member of this treasury.`,
        },
        { status: 403 }
      );
    }

    const member = members.find(
      (row) => row.address.toUpperCase() === actor.actorAddress
    );
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Cancelling actor is not an authorized member of this treasury." },
        { status: 403 }
      );
    }

    if (proposal.status === "executed") {
      return NextResponse.json(
        { success: false, error: "Cannot cancel an already executed proposal." },
        { status: 400 }
      );
    }

    const { txHash } = syntheticDemoSuccess();
    const now = new Date();

    await db
      .update(proposals)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: actor.actorAddress,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId: proposal.treasuryId,
      action: "PROPOSAL_CANCELLED",
      actorAddress: actor.actorAddress,
      actorLabel: memberLabel || member.label || "Member",
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
