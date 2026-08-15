import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  treasuries,
  treasuryMembers,
  proposals,
  proposalApprovals,
  contributions,
  auditLogs,
} from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { desc, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSeeded();
    const { id } = await props.params;

    const treasuryList = await db
      .select()
      .from(treasuries)
      .where(eq(treasuries.id, id))
      .limit(1);

    if (treasuryList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Treasury not found" },
        { status: 404 }
      );
    }

    const treasury = treasuryList[0];

    const members = await db
      .select()
      .from(treasuryMembers)
      .where(eq(treasuryMembers.treasuryId, id));

    const rawProposals = await db
      .select()
      .from(proposals)
      .where(eq(proposals.treasuryId, id))
      .orderBy(desc(proposals.createdAt));

    // Fetch approvals for each proposal
    const proposalsWithApprovals = await Promise.all(
      rawProposals.map(async (p) => {
        const apps = await db
          .select()
          .from(proposalApprovals)
          .where(eq(proposalApprovals.proposalId, p.id))
          .orderBy(desc(proposalApprovals.createdAt));
        return {
          ...p,
          approvals: apps,
        };
      })
    );

    const contribs = await db
      .select()
      .from(contributions)
      .where(eq(contributions.treasuryId, id))
      .orderBy(desc(contributions.createdAt));

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.treasuryId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      treasury: {
        ...treasury,
        members,
        proposals: proposalsWithApprovals,
        contributions: contribs,
        auditLogs: logs,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load treasury";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
