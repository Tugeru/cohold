import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  proposals,
  contributions,
  auditLogs,
} from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { generateContractAddress } from "@/lib/utils";
import { isValidStellarAddress } from "@/lib/stellar";
import { parseNonNegativeBaseUnits } from "@/lib/money";
import { coholdConfig } from "@/lib/cohold-config";
import { demoMutationDenied, syntheticDemoSuccess } from "@/lib/demo-adapter";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDatabaseSeeded();
    const allTreasuries = await db
      .select()
      .from(treasuries)
      .orderBy(desc(treasuries.createdAt));

    // Fetch members and proposals count for each treasury
    const enriched = await Promise.all(
      allTreasuries.map(async (t) => {
        const mems = await db
          .select()
          .from(treasuryMembers)
          .where(eq(treasuryMembers.treasuryId, t.id));
        const props = await db
          .select()
          .from(proposals)
          .where(eq(proposals.treasuryId, t.id));
        return {
          ...t,
          members: mems,
          proposalsCount: props.length,
          pendingProposalsCount: props.filter(
            (p) => p.status === "pending" || p.status === "approved"
          ).length,
        };
      })
    );

    return NextResponse.json({ success: true, treasuries: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load treasuries";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = demoMutationDenied(coholdConfig);
    if (denied) {
      return NextResponse.json(denied, { status: 403 });
    }
    await ensureDatabaseSeeded();
    const body = await req.json();
    const {
      name,
      description,
      category = "student_org",
      creatorAddress,
      creatorLabel = "Creator",
      tokenSymbol = "DEMO_UNITS",
      tokenAddress = "CDEMO_XLM_SAC_CONTRACT_TESTNET",
      threshold,
      members, // Array of { address: string, label?: string, role?: string, avatar?: string }
      initialDeposit = "0",
    } = body;

    // Validation FR-TRS-001 through FR-TRS-007
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Treasury name is required" },
        { status: 400 }
      );
    }

    if (!creatorAddress || !isValidStellarAddress(creatorAddress)) {
      return NextResponse.json(
        { success: false, error: "Valid creator Stellar address (G...) is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one member is required (FR-TRS-004)" },
        { status: 400 }
      );
    }

    // Check duplicate members (FR-TRS-005)
    const rawAddresses = members.map((m: { address: string }) =>
      (m.address || "").trim().toUpperCase()
    );
    const uniqueAddresses = new Set(rawAddresses);
    if (uniqueAddresses.size !== rawAddresses.length) {
      return NextResponse.json(
        { success: false, error: "Duplicate member addresses are rejected (FR-TRS-005)" },
        { status: 400 }
      );
    }

    // Check all addresses valid
    for (const addr of rawAddresses) {
      if (!isValidStellarAddress(addr)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid Stellar address format: ${addr}. Must start with 'G' and be 56 characters.`,
          },
          { status: 400 }
        );
      }
    }

    // Creator must be included in members (FR-TRS-003)
    const creatorUpper = creatorAddress.trim().toUpperCase();
    if (!uniqueAddresses.has(creatorUpper)) {
      return NextResponse.json(
        {
          success: false,
          error: "Creator must be included as a member of the treasury (FR-TRS-003)",
        },
        { status: 400 }
      );
    }

    const numThreshold = Number(threshold);
    if (isNaN(numThreshold) || numThreshold <= 0) {
      return NextResponse.json(
        { success: false, error: "Approval threshold must be greater than zero (FR-TRS-006)" },
        { status: 400 }
      );
    }

    if (numThreshold > members.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Approval threshold (${numThreshold}) cannot exceed member count (${members.length}) (FR-TRS-007)`,
        },
        { status: 400 }
      );
    }

    let initialDepositUnits: bigint;
    try {
      initialDepositUnits = parseNonNegativeBaseUnits(initialDeposit);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Initial deposit must be a non-negative integer base-unit value",
        },
        { status: 400 }
      );
    }
    const initialBalanceStr = initialDepositUnits.toString();
    const treasuryId = `tr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const contractAddress = generateContractAddress();
    const { txHash: creationTx } = syntheticDemoSuccess();

    // Insert treasury
    await db.insert(treasuries).values({
      id: treasuryId,
      name: name.trim(),
      description: description ? description.trim() : null,
      category,
      creatorAddress: creatorUpper,
      tokenSymbol: tokenSymbol.trim().toUpperCase(),
      tokenAddress: tokenAddress.trim(),
      tokenDecimals: 7,
      threshold: numThreshold,
      memberCount: members.length,
      balance: initialBalanceStr,
      status: "active",
      contractAddress,
      network: "testnet",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert members
    const memberRows = members.map((m: { address: string; label?: string; role?: string; avatar?: string }, idx: number) => {
      const isCreator = m.address.trim().toUpperCase() === creatorUpper;
      return {
        id: `mem-${treasuryId}-${idx + 1}`,
        treasuryId,
        address: m.address.trim().toUpperCase(),
        label: m.label || (isCreator ? `${creatorLabel} (Creator)` : `Member ${idx + 1}`),
        role: m.role || (isCreator ? "Creator / Admin" : "Member"),
        avatar: m.avatar || (isCreator ? "👑" : "👤"),
        joinedAt: new Date(),
      };
    });

    await db.insert(treasuryMembers).values(memberRows);

    // Initial deposit if provided
    if (initialDepositUnits > 0n) {
      await db.insert(contributions).values({
        id: `con-${Date.now()}`,
        treasuryId,
        memberAddress: creatorUpper,
        memberLabel: creatorLabel,
        amount: initialBalanceStr,
        note: "Initial Treasury Seed Contribution",
        txHash: creationTx,
        createdAt: new Date(),
      });
    }

    // Record creation in audit log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}`,
      treasuryId,
      action: "TREASURY_CREATED",
      actorAddress: creatorUpper,
      actorLabel: creatorLabel,
      details: JSON.stringify({
        name: name.trim(),
        threshold: numThreshold,
        memberCount: members.length,
        contractAddress,
        initialDeposit: initialBalanceStr,
      }),
      txHash: creationTx,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      treasuryId,
      contractAddress,
      txHash: creationTx,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create treasury";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
