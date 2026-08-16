import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  proposals,
  auditLogs,
} from "@/db/schema";
import { parseBaseUnits, parseNonNegativeBaseUnits } from "@/lib/money";
import { coholdConfig } from "@/lib/cohold-config";
import { demoMutationDenied, syntheticDemoSuccess } from "@/lib/demo-adapter";
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
    const { executorAddress = "GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD", executorLabel = "Signer" } = body;

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

    // Invariant 5: Prevent Double Execution
    if (proposal.status === "executed") {
      return NextResponse.json(
        {
          success: false,
          error: "REJECTED: Already executed (Invariant 5: Double execution strictly blocked).",
        },
        { status: 400 }
      );
    }

    if (proposal.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Proposal has been cancelled and cannot execute." },
        { status: 400 }
      );
    }

    // Invariant 3: Threshold Precondition
    if (proposal.approvalCount < proposal.threshold || proposal.status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          error: `REJECTED: Threshold not reached (Requires ${proposal.threshold} approvals, but only has ${proposal.approvalCount}).`,
        },
        { status: 400 }
      );
    }

    // Fetch treasury
    const tList = await db
      .select()
      .from(treasuries)
      .where(eq(treasuries.id, proposal.treasuryId))
      .limit(1);

    if (tList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Treasury not found" },
        { status: 404 }
      );
    }

    const treasury = tList[0];
    let currentBalance: bigint;
    let proposalAmount: bigint;
    try {
      currentBalance = parseNonNegativeBaseUnits(treasury.balance);
      proposalAmount = parseBaseUnits(proposal.amount);
    } catch {
      return NextResponse.json(
        { success: false, error: "Treasury or proposal amount is not a valid base-unit value" },
        { status: 500 }
      );
    }

    // Invariant 6: Solvency & Asset Conservation
    if (currentBalance < proposalAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `REJECTED: Insufficient treasury balance (Available: ${currentBalance} ${treasury.tokenSymbol}, Required: ${proposalAmount} ${treasury.tokenSymbol}).`,
        },
        { status: 400 }
      );
    }

    const newBalance = (currentBalance - proposalAmount).toString();
    const { txHash: executionTxHash } = syntheticDemoSuccess();
    const now = new Date();

    // Deduct treasury balance
    await db
      .update(treasuries)
      .set({
        balance: newBalance,
        updatedAt: now,
      })
      .where(eq(treasuries.id, treasury.id));

    // Update proposal to executed
    await db
      .update(proposals)
      .set({
        status: "executed",
        executedAt: now,
        executedBy: executorAddress,
        executionTxHash,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));

    // Record audit log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId: treasury.id,
      action: "PAYMENT_EXECUTED",
      actorAddress: executorAddress,
      actorLabel: executorLabel,
      details: JSON.stringify({
        proposalId,
        title: proposal.title,
        amount: proposal.amount,
        recipient: proposal.recipientAddress,
        recipientLabel: proposal.recipientLabel,
        previousBalance: currentBalance.toString(),
        newBalance,
        executionTxHash,
      }),
      txHash: executionTxHash,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      newBalance,
      executionTxHash,
      executedAt: now.toISOString(),
      recipientAddress: proposal.recipientAddress,
      amount: proposal.amount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to execute payment";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
