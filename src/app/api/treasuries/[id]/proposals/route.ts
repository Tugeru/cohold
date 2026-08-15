import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  proposals,
  proposalApprovals,
  auditLogs,
} from "@/db/schema";
import { generateStellarTxHash } from "@/lib/utils";
import { isValidStellarAddress } from "@/lib/stellar";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: treasuryId } = await props.params;
    const body = await req.json();
    const {
      title,
      description,
      category = "Operations",
      amount,
      proposerAddress,
      proposerLabel,
      recipientAddress,
      recipientLabel,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal title is required" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal description is required" },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Proposal amount must be greater than zero (FR-3)" },
        { status: 400 }
      );
    }

    if (!recipientAddress || !isValidStellarAddress(recipientAddress)) {
      return NextResponse.json(
        { success: false, error: "Valid recipient Stellar address (G...) is required" },
        { status: 400 }
      );
    }

    if (!proposerAddress) {
      return NextResponse.json(
        { success: false, error: "Proposer address is required" },
        { status: 400 }
      );
    }

    // Verify treasury exists
    const tList = await db
      .select()
      .from(treasuries)
      .where(eq(treasuries.id, treasuryId))
      .limit(1);

    if (tList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Treasury not found" },
        { status: 404 }
      );
    }

    const treasury = tList[0];
    const proposerUpper = proposerAddress.trim().toUpperCase();

    // Verify proposer is a member (FR-3 / Non-member proposal rejected)
    const memList = await db
      .select()
      .from(treasuryMembers)
      .where(
        and(
          eq(treasuryMembers.treasuryId, treasuryId),
          eq(treasuryMembers.address, proposerUpper)
        )
      )
      .limit(1);

    if (memList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${proposerAddress} is not a member of this treasury and cannot create proposals.`,
        },
        { status: 403 }
      );
    }

    const member = memList[0];
    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const txHash = generateStellarTxHash();

    // If threshold is 1, it's immediately approved
    const isImmediatelyApproved = treasury.threshold <= 1;
    const initialStatus = isImmediatelyApproved ? "approved" : "pending";

    // Insert proposal
    await db.insert(proposals).values({
      id: proposalId,
      treasuryId,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      amount: numAmount.toString(),
      proposerAddress: proposerUpper,
      proposerLabel: proposerLabel || member.label,
      recipientAddress: recipientAddress.trim().toUpperCase(),
      recipientLabel: recipientLabel ? recipientLabel.trim() : null,
      approvalCount: 1, // Proposer automatic approval
      threshold: treasury.threshold,
      status: initialStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Record proposer's automatic approval
    await db.insert(proposalApprovals).values({
      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId,
      treasuryId,
      approverAddress: proposerUpper,
      approverLabel: proposerLabel || member.label,
      signature: `sig_auto_proposer_${Date.now()}`,
      txHash,
      createdAt: new Date(),
    });

    // Record audit log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId,
      action: "PROPOSAL_CREATED",
      actorAddress: proposerUpper,
      actorLabel: proposerLabel || member.label,
      details: JSON.stringify({
        proposalId,
        title: title.trim(),
        amount: numAmount.toString(),
        recipient: recipientAddress.trim().toUpperCase(),
        initialStatus,
      }),
      txHash,
      createdAt: new Date(),
    });

    if (isImmediatelyApproved) {
      await db.insert(auditLogs).values({
        id: `log-${Date.now()}-approved`,
        treasuryId,
        action: "PROPOSAL_THRESHOLD_REACHED",
        actorAddress: proposerUpper,
        actorLabel: proposerLabel || member.label,
        details: JSON.stringify({
          proposalId,
          approvals: 1,
          threshold: treasury.threshold,
        }),
        txHash,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      proposalId,
      status: initialStatus,
      txHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create proposal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
