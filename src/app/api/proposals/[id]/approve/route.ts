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
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";
import { eq, and } from "drizzle-orm";

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
    const { approverAddress, approverLabel, signature } = body;

    if (!approverAddress) {
      return NextResponse.json(
        { success: false, error: "Approver address is required" },
        { status: 400 }
      );
    }

    const approverUpper = approverAddress.trim().toUpperCase();

    // Fetch proposal
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

    // Check status
    if (proposal.status === "executed") {
      return NextResponse.json(
        {
          success: false,
          error: "Proposal has already been executed and cannot receive further approvals.",
        },
        { status: 400 }
      );
    }

    if (proposal.status === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: "Proposal has been cancelled.",
        },
        { status: 400 }
      );
    }

    // Verify approver is a treasury member (FR-4)
    const memList = await db
      .select()
      .from(treasuryMembers)
      .where(
        and(
          eq(treasuryMembers.treasuryId, proposal.treasuryId),
          eq(treasuryMembers.address, approverUpper)
        )
      )
      .limit(1);

    if (memList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${approverAddress} is not an authorized member of this treasury.`,
        },
        { status: 403 }
      );
    }

    const member = memList[0];

    // Check duplicate approval (FR-4, Invariant 2: One member can count as only one approval)
    const existingApproval = await db
      .select()
      .from(proposalApprovals)
      .where(
        and(
          eq(proposalApprovals.proposalId, proposalId),
          eq(proposalApprovals.approverAddress, approverUpper)
        )
      )
      .limit(1);

    if (existingApproval.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate approval rejected (Invariant 2: Member has already signed this proposal).",
        },
        { status: 400 }
      );
    }

    // Fetch existing approvals count
    const currentApprovals = await db
      .select()
      .from(proposalApprovals)
      .where(eq(proposalApprovals.proposalId, proposalId));

    const newApprovalCount = currentApprovals.length + 1;
    const txHash = generateStellarTxHash();

    // Record approval
    await db.insert(proposalApprovals).values({
      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      proposalId,
      treasuryId: proposal.treasuryId,
      approverAddress: approverUpper,
      approverLabel: approverLabel || member.label,
      signature: signature || `sig_soroban_auth_${Date.now()}`,
      txHash,
      createdAt: new Date(),
    });

    const isThresholdReached = newApprovalCount >= proposal.threshold;
    const nextStatus = isThresholdReached ? "approved" : "pending";

    // Update proposal
    await db
      .update(proposals)
      .set({
        approvalCount: newApprovalCount,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    // Audit log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId: proposal.treasuryId,
      action: isThresholdReached
        ? "PROPOSAL_THRESHOLD_REACHED"
        : "PROPOSAL_APPROVED",
      actorAddress: approverUpper,
      actorLabel: approverLabel || member.label,
      details: JSON.stringify({
        proposalId,
        title: proposal.title,
        approvalCount: newApprovalCount,
        threshold: proposal.threshold,
        status: nextStatus,
      }),
      txHash,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      approvalCount: newApprovalCount,
      threshold: proposal.threshold,
      status: nextStatus,
      isThresholdReached,
      txHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve proposal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
