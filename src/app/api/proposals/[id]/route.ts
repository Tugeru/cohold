import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, proposalApprovals, treasuries } from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { desc, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDatabaseSeeded();
    const { id } = await props.params;

    const rows = await db
      .select({
        proposal: proposals,
        treasury: {
          id: treasuries.id,
          name: treasuries.name,
          category: treasuries.category,
          tokenSymbol: treasuries.tokenSymbol,
          balance: treasuries.balance,
          threshold: treasuries.threshold,
          memberCount: treasuries.memberCount,
          contractAddress: treasuries.contractAddress,
        },
      })
      .from(proposals)
      .leftJoin(treasuries, eq(proposals.treasuryId, treasuries.id))
      .where(eq(proposals.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 },
      );
    }

    const row = rows[0];
    const approvals = await db
      .select()
      .from(proposalApprovals)
      .where(eq(proposalApprovals.proposalId, row.proposal.id))
      .orderBy(desc(proposalApprovals.createdAt));

    return NextResponse.json({
      success: true,
      proposal: {
        ...row.proposal,
        treasury: row.treasury,
        approvals,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load proposal";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
