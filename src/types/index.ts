export type TreasuryCategory =
  | "student_org"
  | "small_business"
  | "community_fund"
  | "project_team"
  | "other";

export type ProposalStatus = "pending" | "approved" | "executed" | "cancelled";

export interface TreasuryMember {
  id: string;
  treasuryId: string;
  address: string;
  label?: string | null;
  role: string;
  avatar?: string | null;
  joinedAt: string | Date;
}

export interface Contribution {
  id: string;
  treasuryId: string;
  memberAddress: string;
  memberLabel?: string | null;
  amount: string;
  note?: string | null;
  txHash: string;
  createdAt: string | Date;
}

export interface ProposalApproval {
  id: string;
  proposalId: string;
  treasuryId: string;
  approverAddress: string;
  approverLabel?: string | null;
  signature?: string | null;
  txHash?: string | null;
  createdAt: string | Date;
}

export interface Proposal {
  id: string;
  treasuryId: string;
  title: string;
  description: string;
  category?: string | null;
  amount: string;
  proposerAddress: string;
  proposerLabel?: string | null;
  recipientAddress: string;
  recipientLabel?: string | null;
  approvalCount: number;
  threshold: number;
  status: ProposalStatus;
  executedAt?: string | Date | null;
  executedBy?: string | null;
  executionTxHash?: string | null;
  cancelledAt?: string | Date | null;
  cancelledBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  approvals?: ProposalApproval[];
}

export interface AuditLog {
  id: string;
  treasuryId: string;
  action: string;
  actorAddress: string;
  actorLabel?: string | null;
  details?: string | null;
  txHash?: string | null;
  createdAt: string | Date;
}

export interface Treasury {
  id: string;
  name: string;
  description?: string | null;
  category: TreasuryCategory;
  creatorAddress: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  threshold: number;
  memberCount: number;
  balance: string;
  status: string;
  contractAddress: string;
  network: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  members?: TreasuryMember[];
  proposals?: Proposal[];
  contributions?: Contribution[];
  auditLogs?: AuditLog[];
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  address: string;
  avatar: string;
  color: string;
  isFreighter?: boolean;
}

export interface ContractEvent {
  id: string;
  topic: string;
  contractId: string;
  data: Record<string, unknown>;
  txHash: string;
  timestamp: number;
}
