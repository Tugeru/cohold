import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, treasuries } from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseSeeded();
    const searchParams = req.nextUrl.searchParams;
    const actionFilter = searchParams.get("action");

    const query = db
      .select({
        auditLog: auditLogs,
        treasury: {
          id: treasuries.id,
          name: treasuries.name,
          category: treasuries.category,
          tokenSymbol: treasuries.tokenSymbol,
        },
      })
      .from(auditLogs)
      .leftJoin(treasuries, eq(auditLogs.treasuryId, treasuries.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    const raw = await query;
    let enriched = raw.map((r) => ({
      ...r.auditLog,
      treasury: r.treasury,
    }));

    if (actionFilter && actionFilter !== "all") {
      enriched = enriched.filter((item) => {
        if (actionFilter === "contributions") return item.action === "FUNDS_CONTRIBUTED";
        if (actionFilter === "proposals") return item.action === "PROPOSAL_CREATED";
        if (actionFilter === "approvals") return item.action === "PROPOSAL_APPROVED" || item.action === "PROPOSAL_THRESHOLD_REACHED";
        if (actionFilter === "payments") return item.action === "PAYMENT_EXECUTED";
        return true;
      });
    }

    return NextResponse.json({ success: true, activities: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load activity";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
