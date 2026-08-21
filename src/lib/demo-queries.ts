import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { auditLogs, proposalApprovals, proposals, treasuryMembers, treasuries } from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { desc, eq } from "drizzle-orm";

// ponytail: 10s cache for demo fixtures. Upgrade to `use cache` + cacheComponents when that flag lands.
export const getDemoTreasuries = unstable_cache(
  async () => {
    await ensureDatabaseSeeded();
    const all = await db.select().from(treasuries).orderBy(desc(treasuries.createdAt));
    const enriched = await Promise.all(
      all.map(async (t) => {
        const [mems, props] = await Promise.all([
          db.select().from(treasuryMembers).where(eq(treasuryMembers.treasuryId, t.id)),
          db.select().from(proposals).where(eq(proposals.treasuryId, t.id)),
        ]);
        return {
          ...t,
          members: mems,
          proposalsCount: props.length,
          pendingProposalsCount: props.filter((p) => p.status === "pending" || p.status === "approved").length,
        };
      }),
    );
    return enriched;
  },
  ["demo-treasuries"],
  { revalidate: 10, tags: ["demo-treasuries"] },
);

export const getDemoProposals = unstable_cache(
  async () => {
    await ensureDatabaseSeeded();
    const raw = await db
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
    const enriched = await Promise.all(
      raw.map(async (row) => {
        const apps = await db
          .select()
          .from(proposalApprovals)
          .where(eq(proposalApprovals.proposalId, row.proposal.id))
          .orderBy(desc(proposalApprovals.createdAt));
        return { ...row.proposal, treasury: row.treasury, approvals: apps };
      }),
    );
    return enriched;
  },
  ["demo-proposals"],
  { revalidate: 10, tags: ["demo-proposals"] },
);

export const getDemoActivity = unstable_cache(
  async (actionFilter?: string) => {
    await ensureDatabaseSeeded();
    const raw = await db
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
    let enriched = raw.map((r) => ({ ...r.auditLog, treasury: r.treasury }));
    if (actionFilter && actionFilter !== "all") {
      enriched = enriched.filter((item) => {
        if (actionFilter === "contributions") return item.action === "FUNDS_CONTRIBUTED";
        if (actionFilter === "proposals") return item.action === "PROPOSAL_CREATED";
        if (actionFilter === "approvals") return item.action === "PROPOSAL_APPROVED" || item.action === "PROPOSAL_THRESHOLD_REACHED";
        if (actionFilter === "payments") return item.action === "PAYMENT_EXECUTED";
        return true;
      });
    }
    return enriched;
  },
  ["demo-activity"],
  { revalidate: 10, tags: ["demo-activity"] },
);
