import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, proposalApprovals, treasuries } from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseSeeded();
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");

    let query = db
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
      .orderBy(desc(proposals.createdAt));

    const rawResults = await query;

    // Fetch approvals for each proposal
    const enriched = await Promise.all(
      rawResults.map(async (row) => {
        const apps = await db
          .select()
          .from(proposalApprovals)
          .where(eq(proposalApprovals.proposalId, row.proposal.id))
          .orderBy(desc(proposalApprovals.createdAt));
        return {
          ...row.proposal,
          treasury: row.treasury,
          approvals: apps,
        };
      })
    );

    let filtered = enriched;
    if (status && status !== "all") {
      filtered = enriched.filter((p) => p.status === status);
    }

    return NextResponse.json({ success: true, proposals: filtered });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load proposals";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
