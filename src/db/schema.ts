import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const treasuries = pgTable("treasuries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("student_org"),
  creatorAddress: text("creator_address").notNull(),
  tokenSymbol: text("token_symbol").notNull().default("DEMO_UNITS"),
  tokenAddress: text("token_address").notNull().default("CDEMO_XLM_SAC_CONTRACT_TESTNET"),
  tokenDecimals: integer("token_decimals").notNull().default(7),
  threshold: integer("threshold").notNull(),
  memberCount: integer("member_count").notNull(),
  balance: text("balance").notNull().default("0"),
  status: text("status").notNull().default("active"),
  contractAddress: text("contract_address").notNull(),
  network: text("network").notNull().default("testnet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const treasuryMembers = pgTable("treasury_members", {
  id: text("id").primaryKey(),
  treasuryId: text("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  label: text("label"),
  role: text("role").notNull().default("Member"),
  avatar: text("avatar"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const contributions = pgTable("contributions", {
  id: text("id").primaryKey(),
  treasuryId: text("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  memberAddress: text("member_address").notNull(),
  memberLabel: text("member_label"),
  amount: text("amount").notNull(),
  note: text("note"),
  txHash: text("tx_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const proposals = pgTable("proposals", {
  id: text("id").primaryKey(),
  treasuryId: text("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").default("Operations"),
  amount: text("amount").notNull(),
  proposerAddress: text("proposer_address").notNull(),
  proposerLabel: text("proposer_label"),
  recipientAddress: text("recipient_address").notNull(),
  recipientLabel: text("recipient_label"),
  approvalCount: integer("approval_count").notNull().default(0),
  threshold: integer("threshold").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'executed' | 'cancelled'
  executedAt: timestamp("executed_at"),
  executedBy: text("executed_by"),
  executionTxHash: text("execution_tx_hash"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: text("cancelled_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proposalApprovals = pgTable("proposal_approvals", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  treasuryId: text("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  approverAddress: text("approver_address").notNull(),
  approverLabel: text("approver_label"),
  signature: text("signature"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  treasuryId: text("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actorAddress: text("actor_address").notNull(),
  actorLabel: text("actor_label"),
  details: text("details"), // JSON serialized string
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const treasuriesRelations = relations(treasuries, ({ many }) => ({
  members: many(treasuryMembers),
  contributions: many(contributions),
  proposals: many(proposals),
  auditLogs: many(auditLogs),
}));

export const treasuryMembersRelations = relations(treasuryMembers, ({ one }) => ({
  treasury: one(treasuries, {
    fields: [treasuryMembers.treasuryId],
    references: [treasuries.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  treasury: one(treasuries, {
    fields: [proposals.treasuryId],
    references: [treasuries.id],
  }),
  approvals: many(proposalApprovals),
}));

export const proposalApprovalsRelations = relations(proposalApprovals, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalApprovals.proposalId],
    references: [proposals.id],
  }),
}));
