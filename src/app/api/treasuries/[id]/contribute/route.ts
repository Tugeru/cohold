import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  contributions,
  auditLogs,
} from "@/db/schema";
import { parseBaseUnits, parseNonNegativeBaseUnits } from "@/lib/money";
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
    const { id: treasuryId } = await props.params;
    const body = await req.json();
    const { memberAddress, memberLabel, amount, note } = body;

    if (!memberAddress) {
      return NextResponse.json(
        { success: false, error: "Member address is required" },
        { status: 400 }
      );
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseBaseUnits(amount);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Contribution amount must be a positive integer base-unit value (FR-2)",
        },
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

    const members = await db
      .select()
      .from(treasuryMembers)
      .where(eq(treasuryMembers.treasuryId, treasuryId));
    const actor = resolveDemoActor({
      actorAddress: memberAddress,
      signature: body.signature,
      label: memberLabel,
      members: members.map((row) => row.address),
    });
    if (!actor.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${memberAddress} is not an authorized member of this treasury.`,
        },
        { status: 403 }
      );
    }

    const member = members.find(
      (row) => row.address.toUpperCase() === actor.actorAddress
    );
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: `Address ${memberAddress} is not an authorized member of this treasury.`,
        },
        { status: 403 }
      );
    }

    let currentBalance: bigint;
    try {
      currentBalance = parseNonNegativeBaseUnits(treasury.balance);
    } catch {
      return NextResponse.json(
        { success: false, error: "Treasury balance is not a valid base-unit value" },
        { status: 500 }
      );
    }
    const newBalance = (currentBalance + amountUnits).toString();
    const { txHash } = syntheticDemoSuccess();

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
      amount: amountUnits.toString(),
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
        amount: amountUnits.toString(),
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
