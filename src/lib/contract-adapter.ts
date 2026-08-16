import * as StellarSdk from "@stellar/stellar-sdk";
import { contract } from "@stellar/stellar-sdk";
import { Err, Ok } from "@stellar/stellar-sdk/contract";
import {
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
  isValidContractAddress,
  isValidStellarAddress,
} from "@/lib/stellar";

// ---------------------------------------------------------------------------
// Chain view models. These are the only shapes wallet-mode UI may consume;
// raw ScVal/XDR/DB rows never cross this seam.
// ---------------------------------------------------------------------------

export type ChainProposalStatus = "pending" | "approved" | "executed" | "cancelled";

/**
 * Whether the connected wallet has approved a proposal. `unknown` is an
 * explicit state: no wallet connected, membership unverified, membership
 * read failed, or approval read failed. It is never inferred as
 * "approved" or "can still approve".
 */
export type CurrentUserApproval = "approved" | "not-approved" | "unknown";

export interface ChainTreasuryConfig {
  name: string;
  creator: string;
  tokenAddress: string;
  threshold: number;
  memberCount: number;
}

export interface ChainTokenInfo {
  symbol: string;
  decimals: number;
}

export interface ChainProposalRecord {
  id: number;
  proposer: string;
  recipient: string;
  amount: bigint;
  description: string;
  approvalCount: number;
  status: ChainProposalStatus;
  createdAt: number;
}

export interface ChainTreasuryView {
  contractId: string;
  name: string;
  creator: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  /** Contract balance in integer base units, as a decimal string. Null when the read failed. */
  balance: string | null;
  threshold: number;
  memberCount: number;
  members: string[];
  /** False when the member list could not be read on-chain. */
  membersAuthoritative: boolean;
  /** Optional local metadata, never authoritative. */
  metadata?: {
    source: "local-metadata";
    fields: Record<string, unknown>;
    /** Authoritative fields dropped because local metadata disagreed. */
    droppedFields: string[];
  };
}

export interface ChainProposalView {
  treasuryId: string;
  id: number;
  description: string;
  proposer: string;
  recipient: string;
  /** Proposal amount in integer base units, as a decimal string. */
  amount: string;
  /** Asset metadata, null when the token contract could not be read. */
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  approvalCount: number;
  threshold: number;
  status: ChainProposalStatus;
  /** Ledger timestamp (seconds). */
  createdAt: number;
  currentUserApproval: CurrentUserApproval;
}

// ---------------------------------------------------------------------------
// Read seam. Wallet-mode reads go through this interface; nothing else in the
// app talks to the contract or raw RPC for treasury state.
// ---------------------------------------------------------------------------

export interface CoholdRpc {
  getConfig(contractId: string): Promise<ChainTreasuryConfig | null>;
  getBalance(contractId: string): Promise<bigint | null>;
  getProposalCount(contractId: string): Promise<number | null>;
  getProposal(contractId: string, proposalId: number): Promise<ChainProposalRecord | null>;
  getMemberList(contractId: string): Promise<string[] | null>;
  isMember(contractId: string, address: string): Promise<boolean>;
  hasApproved(contractId: string, proposalId: number, address: string): Promise<boolean>;
  getTokenInfo(tokenAddress: string): Promise<ChainTokenInfo>;
}

const STATUS_BY_NUMBER: Record<number, ChainProposalStatus> = {
  0: "pending",
  1: "approved",
  2: "executed",
  3: "cancelled",
};

const STATUS_NAMES: Record<string, ChainProposalStatus> = {
  pending: "pending",
  approved: "approved",
  executed: "executed",
  cancelled: "cancelled",
};

export function normalizeStatus(value: unknown): ChainProposalStatus | null {
  if (typeof value === "number") {
    return STATUS_BY_NUMBER[value] ?? null;
  }
  if (typeof value === "string") {
    return STATUS_NAMES[value.trim().toLowerCase()] ?? null;
  }
  return null;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value === "bigint") {
    return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : null;
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? BigInt(value) : null;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

/**
 * The SDK wraps Result-typed contract returns in Ok/Err instances: a
 * contract rejection (Err) is a successful simulation carrying a value,
 * not a thrown host error. Unwrap Ok and null Err so the normalizers see
 * raw values and a rejection reads as "absent".
 */
function unwrapResultValue(value: unknown): unknown {
  if (value instanceof Ok) return value.unwrap();
  if (value instanceof Err) return null;
  return value;
}

/**
 * Read a struct-shaped result either as the spec-driven object
 * ({ field: value }) or as the positional array produced by a raw
 * ScVal conversion. Returns null when the shape is malformed.
 */
function extractFields(
  value: unknown,
  keys: readonly string[],
): unknown[] | null {
  if (Array.isArray(value)) {
    if (value.length < keys.length) return null;
    return keys.map((_, index) => value[index]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (!keys.every((key) => key in obj)) return null;
    return keys.map((key) => obj[key]);
  }
  return null;
}

export function normalizeTreasuryConfigResult(
  value: unknown,
): ChainTreasuryConfig | null {
  const fields = extractFields(value, [
    "creator",
    "token",
    "threshold",
    "member_count",
    "name",
  ]);
  if (!fields) return null;
  const [creator, token, threshold, memberCount, name] = fields;

  if (typeof creator !== "string" || !isValidStellarAddress(creator)) return null;
  if (typeof token !== "string" || !isValidContractAddress(token)) return null;
  const thresholdValue = toNonNegativeInt(threshold);
  const memberCountValue = toNonNegativeInt(memberCount);
  if (thresholdValue === null || memberCountValue === null) return null;
  if (thresholdValue <= 0 || memberCountValue <= 0) return null;
  if (typeof name !== "string") return null;

  return {
    name: name.trim(),
    creator: creator.toUpperCase(),
    tokenAddress: token.toUpperCase(),
    threshold: thresholdValue,
    memberCount: memberCountValue,
  };
}

export function normalizeProposalResult(
  value: unknown,
): ChainProposalRecord | null {
  const fields = extractFields(value, [
    "id",
    "proposer",
    "recipient",
    "amount",
    "description",
    "approval_count",
    "status",
    "created_at",
  ]);
  if (!fields) return null;
  const [id, proposer, recipient, amount, description, approvalCount, status, createdAt] =
    fields;

  const idValue = toNonNegativeInt(id);
  if (idValue === null) return null;
  if (typeof proposer !== "string" || !isValidStellarAddress(proposer)) return null;
  if (typeof recipient !== "string" || !isValidStellarAddress(recipient)) return null;
  const amountValue = toBigInt(amount);
  if (amountValue === null || amountValue <= 0n) return null;
  if (typeof description !== "string") return null;
  const approvalCountValue = toNonNegativeInt(approvalCount);
  if (approvalCountValue === null) return null;
  const statusValue = normalizeStatus(status);
  if (!statusValue) return null;
  const createdAtValue = toNonNegativeInt(createdAt);
  if (createdAtValue === null) return null;

  return {
    id: idValue,
    proposer: proposer.toUpperCase(),
    recipient: recipient.toUpperCase(),
    amount: amountValue,
    description,
    approvalCount: approvalCountValue,
    status: statusValue,
    createdAt: createdAtValue,
  };
}

export function buildTreasuryView(input: {
  contractId: string;
  config: ChainTreasuryConfig;
  balance: bigint | null;
  members: string[] | null;
  token: ChainTokenInfo | null;
}): ChainTreasuryView {
  const { contractId, config, balance, members, token } = input;
  return {
    contractId,
    name: config.name,
    creator: config.creator,
    tokenAddress: config.tokenAddress,
    tokenSymbol: token?.symbol ?? null,
    tokenDecimals: token?.decimals ?? null,
    balance: balance === null ? null : balance.toString(),
    threshold: config.threshold,
    memberCount: config.memberCount,
    members: members ?? [],
    membersAuthoritative: members !== null,
  };
}

const AUTHORITATIVE_FIELDS = [
  "name",
  "creator",
  "tokenAddress",
  "tokenSymbol",
  "tokenDecimals",
  "balance",
  "threshold",
  "memberCount",
  "members",
] as const;

function valuesAgree(chainValue: unknown, localValue: unknown): boolean {
  if (Array.isArray(chainValue) && Array.isArray(localValue)) {
    return chainValue.join("\u0000") === localValue.join("\u0000");
  }
  return String(chainValue) === String(localValue);
}

/**
 * Merge optional local metadata into a chain view. The chain always wins:
 * any authoritative field that disagrees is dropped from the output and
 * recorded in `metadata.droppedFields`; agreeing or non-authoritative fields
 * are kept under `metadata.fields` with an explicit `local-metadata` source.
 */
export function mergeTreasuryMetadata(
  view: ChainTreasuryView,
  metadata: Record<string, unknown>,
): ChainTreasuryView {
  const droppedFields: string[] = [];
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if ((AUTHORITATIVE_FIELDS as readonly string[]).includes(key)) {
      const chainValue = view[key as (typeof AUTHORITATIVE_FIELDS)[number]];
      if (!valuesAgree(chainValue, value)) {
        droppedFields.push(key);
        continue;
      }
    }
    fields[key] = value;
  }
  return { ...view, metadata: { source: "local-metadata", fields, droppedFields } };
}

export function currentUserApprovalState(input: {
  userAddress: string | null;
  isMember: boolean | null;
  hasApproved: boolean | null;
}): CurrentUserApproval {
  const { userAddress, isMember, hasApproved } = input;
  if (!userAddress || isMember !== true || hasApproved === null) {
    return "unknown";
  }
  return hasApproved ? "approved" : "not-approved";
}

export function buildProposalView(input: {
  treasuryId: string;
  record: ChainProposalRecord;
  threshold: number;
  token: ChainTokenInfo | null;
  currentUserApproval: CurrentUserApproval;
}): ChainProposalView {
  const { treasuryId, record, threshold, token, currentUserApproval } = input;
  return {
    treasuryId,
    id: record.id,
    description: record.description,
    proposer: record.proposer,
    recipient: record.recipient,
    amount: record.amount.toString(),
    tokenSymbol: token?.symbol ?? null,
    tokenDecimals: token?.decimals ?? null,
    approvalCount: record.approvalCount,
    threshold,
    status: record.status,
    createdAt: record.createdAt,
    currentUserApproval,
  };
}

// ---------------------------------------------------------------------------
// Assembled read flows.
// ---------------------------------------------------------------------------

async function readTokenMetadata(
  rpc: CoholdRpc,
  tokenAddress: string,
): Promise<ChainTokenInfo | null> {
  try {
    return await rpc.getTokenInfo(tokenAddress);
  } catch {
    return null;
  }
}

export async function loadWalletTreasury(
  rpc: CoholdRpc,
  contractId: string,
): Promise<ChainTreasuryView | null> {
  const config = await rpc.getConfig(contractId);
  if (!config) return null;
  let balance: bigint | null = null;
  try {
    balance = await rpc.getBalance(contractId);
  } catch {
    balance = null;
  }
  let members: string[] | null = null;
  try {
    members = await rpc.getMemberList(contractId);
  } catch {
    members = null;
  }
  const token = await readTokenMetadata(rpc, config.tokenAddress);
  return buildTreasuryView({ contractId, config, balance, members, token });
}

export async function loadWalletProposalViews(
  rpc: CoholdRpc,
  contractId: string,
  userAddress: string | null = null,
): Promise<ChainProposalView[]> {
  const config = await rpc.getConfig(contractId);
  if (!config) {
    // An uninitialized/missing contract must not render as "no proposals".
    throw new Error(
      "The configured contract is not initialized or is not a Cohold treasury on this network.",
    );
  }
  const count = await rpc.getProposalCount(contractId);
  if (count === null) {
    // An unreadable count must not masquerade as "no proposals".
    throw new Error("The contract's proposal count could not be read.");
  }
  const token = await readTokenMetadata(rpc, config.tokenAddress);
  let isMember: boolean | null = null;
  if (userAddress) {
    try {
      isMember = await rpc.isMember(contractId, userAddress);
    } catch {
      isMember = null;
    }
  }
  const views: ChainProposalView[] = [];
  for (let proposalId = 1; proposalId <= count; proposalId += 1) {
    let record: ChainProposalRecord | null = null;
    try {
      record = await rpc.getProposal(contractId, proposalId);
    } catch {
      record = null;
    }
    if (!record) continue;
    let hasApproved: boolean | null = null;
    if (userAddress && isMember) {
      try {
        hasApproved = await rpc.hasApproved(contractId, proposalId, userAddress);
      } catch {
        hasApproved = null;
      }
    }
    views.push(
      buildProposalView({
        treasuryId: contractId,
        record,
        threshold: config.threshold,
        token,
        currentUserApproval: currentUserApprovalState({
          userAddress,
          isMember,
          hasApproved,
        }),
      }),
    );
  }
  return views;
}

export async function loadWalletProposal(
  rpc: CoholdRpc,
  contractId: string,
  proposalId: number,
  userAddress: string | null = null,
): Promise<ChainProposalView | null> {
  const config = await rpc.getConfig(contractId);
  if (!config) return null;
  let record: ChainProposalRecord | null = null;
  try {
    record = await rpc.getProposal(contractId, proposalId);
  } catch {
    record = null;
  }
  if (!record) return null;
  const token = await readTokenMetadata(rpc, config.tokenAddress);
  let isMember: boolean | null = null;
  if (userAddress) {
    try {
      isMember = await rpc.isMember(contractId, userAddress);
    } catch {
      isMember = null;
    }
  }
  let hasApproved: boolean | null = null;
  if (userAddress && isMember) {
    try {
      hasApproved = await rpc.hasApproved(contractId, proposalId, userAddress);
    } catch {
      hasApproved = null;
    }
  }
  return buildProposalView({
    treasuryId: contractId,
    record,
    threshold: config.threshold,
    token,
    currentUserApproval: currentUserApprovalState({
      userAddress,
      isMember,
      hasApproved,
    }),
  });
}

// ---------------------------------------------------------------------------
// Stellar SDK implementation. Read-only calls use the NULL_ACCOUNT source, so
// they work before any wallet is connected.
// ---------------------------------------------------------------------------

type ReadTransaction = contract.AssembledTransaction<unknown>;

interface CoholdClientSpec {
  get_config: (options?: contract.MethodOptions) => Promise<ReadTransaction>;
  get_balance: (options?: contract.MethodOptions) => Promise<ReadTransaction>;
  get_proposal: (
    args: { proposal_id: bigint },
    options?: contract.MethodOptions,
  ) => Promise<ReadTransaction>;
  is_member: (
    args: { address: string },
    options?: contract.MethodOptions,
  ) => Promise<ReadTransaction>;
  has_approved: (
    args: { proposal_id: bigint; member: string },
    options?: contract.MethodOptions,
  ) => Promise<ReadTransaction>;
}

interface SacClientSpec {
  symbol: (options?: contract.MethodOptions) => Promise<ReadTransaction>;
  decimals: (options?: contract.MethodOptions) => Promise<ReadTransaction>;
}

export interface CoholdRpcOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
}

export function stellarCoholdRpc(
  options: CoholdRpcOptions = {},
): CoholdRpc {
  const rpcUrl = options.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const server = new StellarSdk.rpc.Server(rpcUrl);

  const clientOptions: contract.ClientOptions = {
    contractId: "",
    rpcUrl,
    networkPassphrase,
    publicKey: "",
  };
  const coholdClients = new Map<string, Promise<contract.Client & CoholdClientSpec>>();
  const tokenClients = new Map<string, Promise<contract.Client & SacClientSpec>>();

  function coholdClient(contractId: string) {
    let pending = coholdClients.get(contractId);
    if (!pending) {
      pending = contract.Client.from<CoholdClientSpec>({
        ...clientOptions,
        contractId,
      });
      coholdClients.set(contractId, pending);
    }
    return pending;
  }

  function tokenClient(tokenAddress: string) {
    let pending = tokenClients.get(tokenAddress);
    if (!pending) {
      pending = contract.Client.from<SacClientSpec>({
        ...clientOptions,
        contractId: tokenAddress,
      });
      tokenClients.set(tokenAddress, pending);
    }
    return pending;
  }

  function storageKeySymbol(name: string): StellarSdk.xdr.ScVal {
    return StellarSdk.xdr.ScVal.scvVec([StellarSdk.xdr.ScVal.scvSymbol(name)]);
  }

  async function readLedgerValue(
    contractId: string,
    key: StellarSdk.xdr.ScVal,
    durability: StellarSdk.xdr.ContractDataDurability,
  ): Promise<unknown> {
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(contractId).toScAddress(),
        key,
        durability,
      }),
    );
    const response = await server.getLedgerEntries(ledgerKey);
    const entry = response.entries[0];
    if (!entry) return null;
    return StellarSdk.scValToNative(entry.val.contractData().val());
  }

  return {
    async getConfig(contractId) {
      try {
        const client = await coholdClient(contractId);
        const tx = await client.get_config();
        const result = unwrapResultValue(tx.result);
        if (result === null) return null;
        return normalizeTreasuryConfigResult(result);
      } catch {
        return null;
      }
    },

    async getBalance(contractId) {
      try {
        const client = await coholdClient(contractId);
        const tx = await client.get_balance();
        const value = toBigInt(tx.result);
        // A negative i128 is malformed for a treasury balance; treat it as
        // unreadable rather than displaying a fabricated figure.
        return value === null || value < 0n ? null : value;
      } catch {
        return null;
      }
    },

    async getProposalCount(contractId) {
      try {
        // ProposalCount lives in instance storage (DataKey::ProposalCount,
        // env.storage().instance()), which contractData ledger keys cannot
        // address; read the contract instance storage map instead.
        const instance = await server.getContractInstance(contractId);
        const entries = instance.storage();
        if (!entries) return null;
        const expectedKey = storageKeySymbol("ProposalCount").toXDR("base64");
        const entry = entries.find(
          (candidate) => candidate.key().toXDR("base64") === expectedKey,
        );
        if (!entry) return null;
        return toNonNegativeInt(StellarSdk.scValToNative(entry.val()));
      } catch {
        return null;
      }
    },

    async getProposal(contractId, proposalId) {
      try {
        const client = await coholdClient(contractId);
        const tx = await client.get_proposal({ proposal_id: BigInt(proposalId) });
        const result = unwrapResultValue(tx.result);
        if (result === null) return null;
        return normalizeProposalResult(result);
      } catch {
        return null;
      }
    },

    async getMemberList(contractId) {
      try {
        const value = await readLedgerValue(
          contractId,
          storageKeySymbol("MemberList"),
          StellarSdk.xdr.ContractDataDurability.persistent(),
        );
        if (!Array.isArray(value)) return null;
        const members = value
          .filter(
            (address): address is string =>
              typeof address === "string" && isValidStellarAddress(address),
          )
          .map((address) => address.toUpperCase());
        return members;
      } catch {
        return null;
      }
    },

    async isMember(contractId, address) {
      const client = await coholdClient(contractId);
      const tx = await client.is_member({ address });
      return tx.result === true;
    },

    async hasApproved(contractId, proposalId, address) {
      const client = await coholdClient(contractId);
      const tx = await client.has_approved({
        proposal_id: BigInt(proposalId),
        member: address,
      });
      return tx.result === true;
    },

    async getTokenInfo(tokenAddress) {
      const client = await tokenClient(tokenAddress);
      const [symbolTx, decimalsTx] = await Promise.all([
        client.symbol(),
        client.decimals(),
      ]);
      const symbol = typeof symbolTx.result === "string" ? symbolTx.result : "";
      const decimals = toNonNegativeInt(decimalsTx.result);
      if (decimals === null) {
        throw new Error("Token contract returned invalid decimals");
      }
      return { symbol, decimals };
    },
  };
}