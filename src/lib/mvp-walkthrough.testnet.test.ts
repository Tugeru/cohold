/**
 * Opt-in live Testnet acceptance walkthrough: the canonical happy path the
 * readiness guide documents (connect → fund → propose → approve to 2/3 →
 * execute rejected → approve to 3/3 → execute → verify → double execute
 * rejected), driven against treasury A of deployments/testnet.json with the
 * exact flow modules the UI uses.
 *
 * Skipped unless COHOLD_TESTNET_SECRET_A..D are set (same gate as the
 * isolation matrix). On success it writes the secret-free evidence record to
 * deployments/walkthrough.json: contract ids, token id, members, threshold,
 * every transaction hash, rejection reasons, and before/after balances.
 * docs/mvp-acceptance.md quotes that record, so a reviewer can re-run
 * `npm run test:walkthrough` and diff the captured evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { Address, Keypair, contract as stellarContract } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { stellarCoholdRpc, type ChainProposalRecord, type ChainProposalStatus } from "@/lib/contract-adapter";
import { createContributeFlow, stellarContributeExecutor } from "@/lib/contribute-flow";
import {
  approveFlow,
  createProposalFlow,
  executeFlow,
  stellarProposalExecutor,
} from "@/lib/proposal-flow";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "@/lib/stellar";
import { resolveMatrixGate } from "@/lib/testnet-matrix-gate";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";

const XLM = 10_000_000n; // wrapped native, 7 decimals

interface TestnetManifest {
  rpc: string;
  tokenId: string;
  gitSha: string;
  wasmSha256: string;
  identities: Record<string, string>;
  treasuries: Array<{
    key: string;
    name: string;
    id: string;
    threshold: number;
    members: string[];
  }>;
}

interface EvidenceStep {
  step: string;
  detail: string;
  outcome: string;
  txHash?: string;
  proposalId?: number;
  approvalCount?: number;
  proposalStatus?: string;
  treasuryBalanceBaseUnits?: string;
  treasuryBalanceXlm?: string;
  recipientBalanceBaseUnits?: string;
  recipientBalanceXlm?: string;
  rejectedReason?: string;
}

interface EvidenceRecord {
  network: string;
  rpc: string;
  deploymentGitSha: string;
  wasmSha256: string;
  generatedBy: string;
  timestamp: string;
  tokenId: string;
  treasuries: Array<{
    key: string;
    name: string;
    id: string;
    members: string[];
    threshold: number;
  }>;
  wallet: {
    proposer: string;
    approver2: string;
    approver3: string;
    executor: string;
    recipient: string;
  };
  steps: EvidenceStep[];
}

function readManifest(): TestnetManifest {
  const raw = readFileSync(
    new URL("../../deployments/testnet.json", import.meta.url),
    "utf8",
  );
  const parsed = JSON.parse(raw) as TestnetManifest;
  return {
    rpc: parsed.rpc,
    tokenId: parsed.tokenId,
    gitSha: parsed.gitSha,
    wasmSha256: parsed.wasmSha256,
    identities: Object.fromEntries(
      Object.entries(parsed.identities).map(([key, value]) => [
        key,
        String(value).toUpperCase(),
      ]),
    ),
    treasuries: parsed.treasuries,
  };
}

const manifest = readManifest();
const treasurySpec = (key: "A" | "B") =>
  manifest.treasuries.find((t) => t.key === key)!;

const contractIdA = (process.env.COHOLD_TESTNET_CONTRACT_ID ?? treasurySpec("A").id)
  .trim()
  .toUpperCase();
const contractIdB = (process.env.COHOLD_TESTNET_CONTRACT_ID_B ?? treasurySpec("B").id)
  .trim()
  .toUpperCase();
const tokenId = (process.env.COHOLD_TESTNET_TOKEN_ID ?? manifest.tokenId)
  .trim()
  .toUpperCase();

const secretA = process.env.COHOLD_TESTNET_SECRET_A ?? "";
const secretB = process.env.COHOLD_TESTNET_SECRET_B ?? "";
const secretD = process.env.COHOLD_TESTNET_SECRET_D ?? "";

const enabled = resolveMatrixGate(process.env, {
  contractIdA,
  contractIdB,
  tokenId,
}).enabled;

const EVIDENCE_PATH = new URL("../../deployments/walkthrough.json", import.meta.url);

/**
 * Bounded confirm retry: Testnet inclusion can lag one or two ledgers
 * (pollTransaction returns NOT_FOUND → flows report "confirmation-pending").
 * The UI keeps polling; the evidence capture retries a few times before
 * failing loudly, so a slow ledger never voids an evidence run.
 */
async function confirmUntilDone<T extends { status: string }>(
  attempt: () => Promise<T>,
  expectConfirmed: (outcome: T) => void,
  maxAttempts = 4,
): Promise<Extract<T, { status: "confirmed" }>> {
  let outcome = await attempt();
  for (let attemptNumber = 1; outcome.status === "confirmation-pending" && attemptNumber < maxAttempts; attemptNumber += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    outcome = await attempt();
  }
  expectConfirmed(outcome);
  return outcome as Extract<T, { status: "confirmed" }>;
}

/** Compact proposal read used by the flow seams (chain shape after unwrap). */
type FlowProposal = {
  proposalId: number;
  proposer: string;
  approvalCount: number;
  status: ChainProposalStatus;
  amountBaseUnits: string;
  recipient: string;
};

function toFlowProposal(record: ChainProposalRecord | null): FlowProposal | null {
  if (!record) return null;
  return {
    proposalId: record.id,
    proposer: record.proposer,
    approvalCount: record.approvalCount,
    status: record.status,
    amountBaseUnits: record.amount.toString(),
    recipient: record.recipient,
  };
}

function xlm(units: bigint | string): string {
  const n = typeof units === "string" ? BigInt(units) : units;
  return `${n / XLM}.${String(n % XLM).padStart(7, "0")}`;
}

function signWith(secret: string, passphrase = STELLAR_TESTNET_NETWORK_PASSPHRASE) {
  const keypair = Keypair.fromSecret(secret);
  const signer = basicNodeSigner(keypair, passphrase);
  return async (transactionXdr: string): Promise<WalletSignatureResult> => {
    const result = await signer.signTransaction(transactionXdr);
    if (result.error) {
      return { status: "error", message: result.error.message ?? "Signing failed" };
    }
    if (!result.signedTxXdr) return { status: "cancelled", message: "Not signed" };
    return {
      status: "signed",
      signedTxXdr: result.signedTxXdr,
      signerAddress: result.signerAddress ?? keypair.publicKey(),
    };
  };
}

describe.skipIf(!enabled)("Testnet MVP acceptance walkthrough (treasury A)", () => {
  if (!enabled) return; // collection guard: no Keypair/RPC at module scope
  const rpc = stellarCoholdRpc();
  const memberA = Keypair.fromSecret(secretA).publicKey().toUpperCase();
  const memberB = Keypair.fromSecret(secretB).publicKey().toUpperCase();
  const memberD = Keypair.fromSecret(secretD).publicKey().toUpperCase();
  const recipient = manifest.identities.recipient;

  async function recipientBalance(): Promise<bigint> {
    const sac = await stellarContract.Client.from<{
      balance: (opts: { id: Address }) => Promise<{ result: bigint }>;
    }>({
      contractId: tokenId,
      rpcUrl: manifest.rpc,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
      publicKey: recipient,
    });
    const tx = await sac.balance({ id: new Address(recipient) });
    return tx.result;
  }

  it("records the canonical walkthrough: fund, propose, 2/3 blocked, 3/3 execute, double execute blocked", async () => {
    expect(contractIdA.startsWith("C")).toBe(true);

    const asset = { contractId: tokenId, symbol: "XLM", decimals: 7 };
    const config = await rpc.getConfig(contractIdA);
    expect(config).not.toBeNull();
    expect(config!.threshold).toBe(treasurySpec("A").threshold);
    const members = (await rpc.getMemberList(contractIdA)) ?? [];
    expect([...members].sort()).toEqual(
      [...treasurySpec("A").members.map((m) => m.toUpperCase())].sort(),
    );

    const steps: EvidenceStep[] = [];

    // ---- 1. Fund: member A tops treasury A toward the walkthrough target.
    const balanceBefore = await rpc.getBalance(contractIdA);
    expect(balanceBefore).not.toBeNull();
    const treasuryStart = balanceBefore!;
    const targetBalance = 12n * XLM;
    const refill = treasuryStart < targetBalance ? targetBalance - treasuryStart : 0n;
    if (refill > 0n) {
      const contribute = createContributeFlow({
        executor: stellarContributeExecutor(),
        contractId: contractIdA,
        memberAddress: memberA,
        asset,
        currentBalanceBaseUnits: balanceBefore!.toString(),
        isMember: () => rpc.isMember(contractIdA, memberA),
        readBalance: () => rpc.getBalance(contractIdA),
        signTransaction: signWith(secretA),
      });
      const prepared = await contribute.prepare(refill);
      expect(prepared.status).toBe("ready");
      if (prepared.status !== "ready") throw new Error(String(prepared));
      const sent = await contribute.signAndSend(prepared.preparedTxXdr);
      expect(sent.status).toBe("submitted");
      if (sent.status !== "submitted" || !sent.hash) throw new Error(String(sent));
      const confirmed = await confirmUntilDone(
        () => contribute.confirm(sent.hash),
        (outcome) => {
          expect(outcome.status).toBe("confirmed");
          if (outcome.status !== "confirmed") throw new Error(String(outcome));
        },
      );
      steps.push({
        step: "fund",
        detail: `${memberA} contributes ${xlm(refill)} XLM`,
        outcome: "confirmed",
        txHash: sent.hash,
        treasuryBalanceBaseUnits: confirmed.balanceBaseUnits!,
        treasuryBalanceXlm: xlm(confirmed.balanceBaseUnits!),
      });
    } else {
      steps.push({
        step: "fund",
        detail: `treasury already at target (${xlm(treasuryStart)} XLM); no contribution needed`,
        outcome: "skipped",
        treasuryBalanceBaseUnits: treasuryStart.toString(),
        treasuryBalanceXlm: xlm(treasuryStart),
      });
    }
    const balanceAfterFund = (await rpc.getBalance(contractIdA))!;
    expect(balanceAfterFund).toBe(targetBalance);

    // ---- 2. Propose: member A creates a 2.5 XLM proposal to a non-member.
    const proposalAmount = 25_000_000n; // 2.5 XLM
    const recipientBefore = await recipientBalance();
    const proposalId = (await rpc.getProposalCount(contractIdA))! + 1;
    const create = createProposalFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      memberAddress: memberA,
      asset,
      treasuryBalanceBaseUnits: balanceAfterFund!.toString(),
      isMember: () => rpc.isMember(contractIdA, memberA),
      readProposal: (id) => rpc.getProposal(contractIdA, id).then(toFlowProposal),
      readLatestProposalId: () => rpc.getProposalCount(contractIdA),
      signTransaction: signWith(secretA),
    });
    const createPrepared = await create.prepare({
      amountBaseUnits: proposalAmount,
      recipient,
      description: `MVP acceptance walkthrough ${proposalId}`,
    });
    expect(createPrepared.status).toBe("ready");
    if (createPrepared.status !== "ready") throw new Error(String(createPrepared));
    expect(createPrepared.previewProposalId).toBe(proposalId);
    const createSent = await create.signAndSend(createPrepared.preparedTxXdr);
    expect(createSent.status).toBe("submitted");
    if (createSent.status !== "submitted" || !createSent.hash) {
      throw new Error(String(createSent));
    }
    const created = await confirmUntilDone(
      () => create.confirm(createSent.hash, proposalId),
      (outcome) => {
        expect(outcome.status).toBe("confirmed");
        if (outcome.status !== "confirmed") throw new Error(String(outcome));
      },
    );
    expect(created.proposalId).toBe(proposalId);
    expect(created.approvalCount).toBe(1);
    expect(created.proposalStatus).toBe("pending");
    steps.push({
      step: "propose",
      detail: `${memberA} creates proposal ${proposalId}: ${xlm(proposalAmount)} XLM → ${recipient}`,
      outcome: "confirmed (approval #1 recorded)",
      txHash: createSent.hash,
      proposalId,
      approvalCount: created.approvalCount!,
      proposalStatus: created.proposalStatus!,
      treasuryBalanceBaseUnits: balanceAfterFund.toString(),
      treasuryBalanceXlm: xlm(balanceAfterFund),
    });

    // ---- 3. Approve to 2/3 (member B); execute must be rejected.
    const readForApprove = async (id: number) => {
      const record = await rpc.getProposal(contractIdA, id);
      if (!record) return null;
      return { approvalCount: record.approvalCount, status: record.status };
    };
    const approveAs = async (secret: string): Promise<{ hash: string; status: string }> => {
      const member = Keypair.fromSecret(secret).publicKey().toUpperCase();
      const currentRecord = await rpc.getProposal(contractIdA, proposalId);
      expect(currentRecord).not.toBeNull();
      const current = currentRecord!;
      const approve = approveFlow({
        executor: stellarProposalExecutor(),
        contractId: contractIdA,
        treasuryName: treasurySpec("A").name,
        memberAddress: member,
        proposalId,
        reviewed: {
          amountBaseUnits: current.amount.toString(),
          recipient: current.recipient,
          description: `MVP acceptance walkthrough ${proposalId}`,
          assetSymbol: "XLM",
          assetDecimals: 7,
          approvalCount: current!.approvalCount,
          threshold: treasurySpec("A").threshold,
        },
        isMember: () => rpc.isMember(contractIdA, member),
        readProposal: readForApprove,
        signTransaction: signWith(secret),
      });
      const prepared = await approve.prepare();
      expect(prepared.status).toBe("ready");
      if (prepared.status !== "ready") throw new Error(String(prepared));
      const sent = await approve.signAndSend(prepared.preparedTxXdr);
      expect(sent.status).toBe("submitted");
      if (sent.status !== "submitted" || !sent.hash) throw new Error(String(sent));
      const confirmed = await confirmUntilDone(
        () => approve.confirm(sent.hash),
        (outcome) => {
          expect(outcome.status).toBe("confirmed");
          if (outcome.status !== "confirmed") throw new Error(String(outcome));
        },
      );
      return { hash: sent.hash, status: confirmed.proposalStatus! };
    };

    const approval2 = await approveAs(secretB);
    expect(approval2.status).toBe("pending"); // 2/3 still pending
    steps.push({
      step: "approve",
      detail: `${memberB} approves → ${approval2.status} (2/3)`,
      outcome: "confirmed",
      txHash: approval2.hash,
      proposalId,
      approvalCount: 2,
      proposalStatus: approval2.status,
    });

    let underThresholdRejected = false;
    try {
      await stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberD,
        proposalId,
      });
    } catch (err) {
      underThresholdRejected = /Error\(Contract, #7\)/.test(String(err));
    }
    steps.push({
      step: "execute",
      detail: `${memberD} attempts execute at 2/3`,
      outcome: underThresholdRejected ? "rejected" : "unexpected",
      rejectedReason: "ThresholdNotReached (contract #7)",
      proposalId,
    });
    expect(underThresholdRejected).toBe(true);
    expect((await rpc.getProposal(contractIdA, proposalId))!.status).toBe("pending");
    expect(await rpc.getBalance(contractIdA)).toBe(balanceAfterFund);

    // ---- 4. Approve to 3/3 (member D) → Approved, balance unchanged.
    const approval3 = await approveAs(secretD);
    expect(approval3.status).toBe("approved");
    steps.push({
      step: "approve",
      detail: `${memberD} approves → ${approval3.status} (3/3)`,
      outcome: "confirmed",
      txHash: approval3.hash,
      proposalId,
      approvalCount: 3,
      proposalStatus: approval3.status,
    });
    const approved = (await rpc.getProposal(contractIdA, proposalId))!;
    expect(approved.status).toBe("approved");
    expect(approved.approvalCount).toBe(3);
    expect(approved.amount.toString()).toBe(proposalAmount.toString());
    expect(approved.recipient).toBe(recipient);

    // ---- 5. Execute (permissionless; member D pays the fee).
    const execute = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      callerAddress: memberD,
      proposalId,
      reviewed: {
        status: "approved",
        amountBaseUnits: proposalAmount.toString(),
        recipient,
        description: `MVP acceptance walkthrough ${proposalId}`,
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
        treasuryBalanceBaseUnits: balanceAfterFund!.toString(),
      },
      readProposal: readForApprove,
      readBalance: () => rpc.getBalance(contractIdA),
      signTransaction: signWith(secretD),
    });
    const executePrepared = await execute.prepare();
    expect(executePrepared.status).toBe("ready");
    if (executePrepared.status !== "ready") throw new Error(String(executePrepared));
    const executeSent = await execute.signAndSend(executePrepared.preparedTxXdr);
    expect(executeSent.status).toBe("submitted");
    if (executeSent.status !== "submitted" || !executeSent.hash) {
      throw new Error(String(executeSent));
    }
    const executed = await confirmUntilDone(
      () => execute.confirm(executeSent.hash),
      (outcome) => {
        expect(outcome.status).toBe("confirmed");
        if (outcome.status !== "confirmed") throw new Error(String(outcome));
      },
    );
    expect(executed.proposalStatus).toBe("executed");
    const recipientAfterExecute = await recipientBalance();
    steps.push({
      step: "execute",
      detail: `${memberD} executes ${xlm(proposalAmount)} XLM → ${recipient}`,
      outcome: "confirmed",
      txHash: executeSent.hash,
      proposalId,
      proposalStatus: executed.proposalStatus!,
      treasuryBalanceBaseUnits: executed.treasuryBalanceBaseUnits!,
      treasuryBalanceXlm: xlm(executed.treasuryBalanceBaseUnits!),
      recipientBalanceBaseUnits: recipientAfterExecute.toString(),
      recipientBalanceXlm: xlm(recipientAfterExecute),
    });

    // Verify: exact amount reached the exact recipient.
    const balanceAfterExecute = (await rpc.getBalance(contractIdA))!;
    expect(balanceAfterExecute).toBe(balanceAfterFund! - proposalAmount);
    expect(recipientAfterExecute).toBe(recipientBefore + proposalAmount);

    // ---- 6. Double execute must be rejected and nothing moves.
    const doubleExecute = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      callerAddress: memberD,
      proposalId,
      reviewed: {
        status: "executed",
        amountBaseUnits: proposalAmount.toString(),
        recipient,
        description: `MVP acceptance walkthrough ${proposalId}`,
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
        treasuryBalanceBaseUnits: balanceAfterExecute!.toString(),
      },
      readProposal: readForApprove,
      readBalance: () => rpc.getBalance(contractIdA),
      signTransaction: signWith(secretD),
    });
    const doublePrepared = await doubleExecute.prepare();
    expect(doublePrepared.status).toBe("already-executed");
    let doubleRejected = false;
    try {
      await stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberD,
        proposalId,
      });
    } catch (err) {
      doubleRejected = /Error\(Contract, #11\)/.test(String(err));
    }
    expect(doubleRejected).toBe(true);
    steps.push({
      step: "execute",
      detail: `${memberD} attempts execute again`,
      outcome: "rejected",
      rejectedReason: "AlreadyExecuted (contract #11)",
      proposalId,
      treasuryBalanceBaseUnits: balanceAfterExecute!.toString(),
      treasuryBalanceXlm: xlm(balanceAfterExecute),
      recipientBalanceBaseUnits: recipientAfterExecute.toString(),
      recipientBalanceXlm: xlm(recipientAfterExecute),
    });

    const evidence: EvidenceRecord = {
      network: "testnet",
      rpc: manifest.rpc,
      deploymentGitSha: manifest.gitSha,
      wasmSha256: manifest.wasmSha256,
      generatedBy: "src/lib/mvp-walkthrough.testnet.test.ts",
      timestamp: new Date().toISOString(),
      tokenId,
      treasuries: manifest.treasuries.map((t) => ({
        key: t.key,
        name: t.name,
        id: t.id,
        members: t.members,
        threshold: t.threshold,
      })),
      wallet: {
        proposer: memberA,
        approver2: memberB,
        approver3: memberD,
        executor: memberD,
        recipient,
      },
      steps,
    };
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`MVP walkthrough evidence written to deployments/walkthrough.json`);
    console.log(JSON.stringify(steps, null, 2));
  }, 900_000);
});