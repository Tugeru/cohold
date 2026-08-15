import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  contributions,
  auditLogs,
} from "@/db/schema";
import { generateStellarTxHash } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: treasuryId } = await props.params;
    const body = await req.json();
    const { memberAddress, memberLabel, amount, note } = body;

    if (!memberAddress) {
      return NextResponse.json(
        { success: false, error: "Member address is required" },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Contribution amount must be greater than zero (FR-2)" },
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

    // Verify member exists in treasury (FR-2 / MVP constraint: Non-member contribution rejected)
    const memList = await db
      .select()
      .from(treasuryMembers)
      .where(
        and(
          eq(treasuryMembers.treasuryId, treasuryId),
          eq(treasuryMembers.address, memberAddress.trim().toUpperCase())
        )
      )
      .limit(1);

    if (memList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${memberAddress} is not an authorized member of this treasury.`,
        },
        { status: 403 }
      );
    }

    const member = memList[0];
    const currentBalance = parseFloat(treasury.balance) || 0;
    const newBalance = (currentBalance + numAmount).toString();
    const txHash = generateStellarTxHash();

    // Update treasury balance
    await db
      .update(treasuries)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(treasuries.id, treasuryId));

    // Record contribution
    await db.insert(contributions).values({
      id: `con-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId,
      memberAddress: member.address,
      memberLabel: memberLabel || member.label,
      amount: numAmount.toString(),
      note: note ? note.trim() : null,
      txHash,
      createdAt: new Date(),
    });

    // Record audit log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      treasuryId,
      action: "FUNDS_CONTRIBUTED",
      actorAddress: member.address,
      actorLabel: memberLabel || member.label,
      details: JSON.stringify({
        amount: numAmount.toString(),
        tokenSymbol: treasury.tokenSymbol,
        previousBalance: currentBalance.toString(),
        newBalance,
        note: note || "",
      }),
      txHash,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      newBalance,
      txHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Contribution failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
