/**
 * Opt-in live Testnet matrix: isolation and negatives across the two
 * deployed treasuries (deployments/testnet.json).
 *
 * Skipped unless COHOLD_TESTNET_SECRET_A..D are set. This is the automated
 * form of the readiness-guide blocked flows: it drives the exact flow
 * modules the UI uses against the live contracts, then re-reads state from
 * the contract as the source of truth.
 *
 * Secret-role mapping (never committed):
 *   A = member A (treasury A only)          B = member B (treasuries A+B)
 *   C = outsider (non-member, fee payer)    D = member D (treasuries A+B)
 *
 * Env required to run:
 *   COHOLD_TESTNET_SECRET_A..D   funded keys (S…)
 * Env optional (defaults come from deployments/testnet.json — public ids):
 *   COHOLD_TESTNET_CONTRACT_ID       treasury A override (C…)
 *   COHOLD_TESTNET_CONTRACT_ID_B     treasury B override (C…)
 *   COHOLD_TESTNET_TOKEN_ID          its token contract (SAC, C…)
 *
 * The matrix is append-only and rerun-safe: treasury A refills to a target
 * balance each run, and competing-proposal amounts are derived from the
 * measured balance so later runs cannot silently change the outcome.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import type { ChainProposalRecord, ChainProposalStatus } from "@/lib/contract-adapter";
import { stellarCoholdRpc } from "@/lib/contract-adapter";
import { createContributeFlow, stellarContributeExecutor } from "@/lib/contribute-flow";
import {
  approveFlow,
  createProposalFlow,
  executeFlow,
  stellarProposalExecutor,
  type SignAndSendProposalOutcome,
} from "@/lib/proposal-flow";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "@/lib/stellar";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const XLM = 10_000_000n; // wrapped native, 7 decimals

interface TestnetManifest {
  tokenId: string;
  identities: Record<string, string>;
  treasuries: Array<{
    key: string;
    name: string;
    id: string;
    threshold: number;
    members: string[];
  }>;
}

function readManifest(): TestnetManifest {
  const raw = readFileSync(
    new URL("../../deployments/testnet.json", import.meta.url),
    "utf8",
  );
  const parsed = JSON.parse(raw) as {
    tokenId: string;
    identities: Record<string, string>;
    treasuries: Array<{
      key: string;
      name: string;
      id: string;
      threshold: number;
      members: string[];
    }>;
  };
  return {
    tokenId: parsed.tokenId,
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
const secretC = process.env.COHOLD_TESTNET_SECRET_C ?? "";
const secretD = process.env.COHOLD_TESTNET_SECRET_D ?? "";

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;
const enabled =
  Boolean(secretA) &&
  Boolean(secretB) &&
  Boolean(secretC) &&
  Boolean(secretD) &&
  CONTRACT_ID_RE.test(contractIdA) &&
  CONTRACT_ID_RE.test(contractIdB) &&
  CONTRACT_ID_RE.test(tokenId) &&
  contractIdA !== contractIdB;

/** Compact proposal read used by the flow seams (chain shape after unwrap). */
type FlowProposal = {
  proposalId: number;
  proposer: string;
  approvalCount: number;
  status: ChainProposalStatus;
  amountBaseUnits: string;
  recipient: string;
};

function toFlowProposal(record: ChainProposalRecord): FlowProposal {
  return {
    proposalId: record.id,
    proposer: record.proposer,
    approvalCount: record.approvalCount,
    status: record.status,
    amountBaseUnits: record.amount.toString(),
    recipient: record.recipient,
  };
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

/** A wallet that refuses the signature, like Freighter's cancel button. */
const cancelledSigner = async (): Promise<WalletSignatureResult> => ({
  status: "cancelled",
  message: "Signature cancelled",
});

/**
 * Submit an already-prepared flow through sign+submit and require an RPC
 * acceptance. Returns the transaction hash; the caller confirms next.
 */
type SignableFlow = {
  signAndSend(preparedTxXdr: string): Promise<SignAndSendProposalOutcome>;
};

async function signAndSendSubmitted(flow: SignableFlow, preparedTxXdr: string): Promise<string> {
  const sent = await flow.signAndSend(preparedTxXdr);
  expect(sent.status).toBe("submitted");
  if (sent.status !== "submitted" || !sent.hash) {
    throw new Error(`Expected submitted, got ${JSON.stringify(sent)}`);
  }
  return sent.hash;
}

/** Submit and require the wallet/RPC gate to reject without changing state. */
async function expectRejectedSubmission(
  flow: SignableFlow,
  preparedTxXdr: string,
  kind: "send-failed" | "sign-failed" | "wallet-rejected",
): Promise<void> {
  const sent = await flow.signAndSend(preparedTxXdr);
  if (sent.status === "submitted" || !("error" in sent)) {
    // Fail loudly with the actual outcome instead of the expected kind.
    expect(sent.status).toBe(kind);
    return;
  }
  expect(sent.status).toBe(kind === "wallet-rejected" ? "sign-failed" : kind);
  expect(sent.error.kind).toBe(kind);
}

/**
 * One treasury's guardrail: an approved proposal that is over the measured
 * balance must stay Approved, and every mutation attempt must leave the
 * balance and proposal terms unchanged.
 */

describe.skipIf(!enabled)("Testnet readiness matrix: isolation and negatives", () => {
  const rpc = stellarCoholdRpc();
  const memberA = Keypair.fromSecret(secretA).publicKey().toUpperCase();
  const memberB = Keypair.fromSecret(secretB).publicKey().toUpperCase();
  const outsider = Keypair.fromSecret(secretC).publicKey().toUpperCase();
  const memberD = Keypair.fromSecret(secretD).publicKey().toUpperCase();
  const recipient = manifest.identities.recipient;

  it("proves treasury A governance negatives, over-balance, and competing proposals", async () => {
    expect(contractIdA.startsWith("C")).toBe(true);
    expect(contractIdB.startsWith("C")).toBe(true);

    const asset = {
      contractId: tokenId,
      symbol: "XLM",
      decimals: 7,
    };
    const tokenInfo = await rpc.getTokenInfo(tokenId);
    expect(tokenInfo.decimals).toBe(7);
    // The wrapped-native SAC reports its classic asset code ("native").
    expect(["XLM", "native"]).toContain(tokenInfo.symbol);

    // Deployment drift guard: live config must match the manifest, so the
    // matrix never asserts against a misconfigured treasury.
    const configA = await rpc.getConfig(contractIdA);
    expect(configA).not.toBeNull();
    expect(configA!.threshold).toBe(treasurySpec("A").threshold);
    expect(configA!.name).toBe(treasurySpec("A").name);
    expect(configA!.tokenAddress.toUpperCase()).toBe(tokenId);
    const liveMembers = (await rpc.getMemberList(contractIdA)) ?? [];
    expect([...liveMembers].sort()).toEqual(
      [...treasurySpec("A").members.map((m) => m.toUpperCase())].sort(),
    );
    expect(await rpc.isMember(contractIdA, memberA)).toBe(true);
    expect(await rpc.isMember(contractIdA, memberB)).toBe(true);
    expect(await rpc.isMember(contractIdA, memberD)).toBe(true);
    expect(await rpc.isMember(contractIdA, outsider)).toBe(false);

    const readProposal = async (proposalId: number): Promise<FlowProposal | null> => {
      const record = await rpc.getProposal(contractIdA, proposalId);
      return record ? toFlowProposal(record) : null;
    };
    const readLatestProposalId = () => rpc.getProposalCount(contractIdA);
    const readBalance = () => rpc.getBalance(contractIdA);

    // Isolation baseline: treasury B is untouched by everything below.
    const bStartBalance = await rpc.getBalance(contractIdB);
    const bStartCount = await rpc.getProposalCount(contractIdB);
    const startCountRead = await rpc.getProposalCount(contractIdA);
    expect(startCountRead).not.toBeNull();
    const startCount = startCountRead!;

    // --- Balance setup: refill A toward the same target every run so the
    // scenario math below is rerun-safe (append-only residues converge).
    const balanceBefore = await readBalance();
    expect(balanceBefore).not.toBeNull();
    const targetBalance = 12n * XLM;
    const refill = targetBalance - (balanceBefore! < targetBalance ? balanceBefore! : targetBalance);
    if (refill > 0n) {
      const contribute = createContributeFlow({
        executor: stellarContributeExecutor(),
        contractId: contractIdA,
        memberAddress: memberA,
        asset,
        currentBalanceBaseUnits: balanceBefore!.toString(),
        isMember: () => rpc.isMember(contractIdA, memberA),
        readBalance,
        signTransaction: signWith(secretA),
      });
      const preparedContribute = await contribute.prepare(refill);
      expect(preparedContribute.status).toBe("ready");
      if (preparedContribute.status !== "ready") return;
      const sentContribute = await contribute.signAndSend(preparedContribute.preparedTxXdr);
      expect(sentContribute.status).toBe("submitted");
      if (sentContribute.status !== "submitted") return;
      const confirmedContribute = await contribute.confirm(sentContribute.hash);
      if (confirmedContribute.status !== "confirmed") {
        throw new Error(`Contribution did not confirm: ${JSON.stringify(confirmedContribute)}`);
      }
      expect(confirmedContribute.balanceBaseUnits).toBe(targetBalance.toString());
    }
    const balanceAfter = await readBalance();
    expect(balanceAfter).toBe(
      balanceBefore! < targetBalance ? targetBalance : balanceBefore,
    );

    /** A proposal whose amount is measured relative to the current balance. */
    async function createApprovedProposal(opts: {
      amount: bigint;
      proposer: string;
      recipientAddress: string;
      description: string;
      expectedId: number;
    }): Promise<number> {
      const create = createProposalFlow({
        executor: stellarProposalExecutor(),
        contractId: contractIdA,
        treasuryName: treasurySpec("A").name,
        memberAddress: opts.proposer,
        asset,
        treasuryBalanceBaseUnits: balanceAfter!.toString(),
        isMember: () => rpc.isMember(contractIdA, opts.proposer),
        readProposal,
        readLatestProposalId,
        signTransaction: signWith(secretA),
      });
      const prepared = await create.prepare({
        amountBaseUnits: opts.amount,
        recipient: opts.recipientAddress,
        description: opts.description,
      });
      expect(prepared.status).toBe("ready");
      if (prepared.status !== "ready") throw new Error(String(prepared));
      expect(prepared.previewProposalId).toBe(opts.expectedId);
      const hash = await signAndSendSubmitted(create, prepared.preparedTxXdr);
      const created = await create.confirm(hash, prepared.previewProposalId);
      expect(created.status).toBe("confirmed");
      if (created.status !== "confirmed") throw new Error(String(created));
      expect(created.proposalId).toBe(opts.expectedId);
      expect(created.approvalCount).toBe(1);
      expect(created.proposalStatus).toBe("pending");
      const record = await readProposal(opts.expectedId);
      expect(record).not.toBeNull();
      expect(record!.amountBaseUnits).toBe(opts.amount.toString());
      expect(record!.recipient).toBe(opts.recipientAddress);
      expect(record!.proposer).toBe(opts.proposer);
      return opts.expectedId;
    }

    async function approveAs(proposalId: number, secret: string): Promise<void> {
      const member = Keypair.fromSecret(secret).publicKey().toUpperCase();
      const current = await readProposal(proposalId);
      expect(current).not.toBeNull();
      const approve = approveFlow({
        executor: stellarProposalExecutor(),
        contractId: contractIdA,
        treasuryName: treasurySpec("A").name,
        memberAddress: member,
        proposalId,
        reviewed: {
          amountBaseUnits: current!.amountBaseUnits,
          recipient: current!.recipient,
          description: "matrix approval",
          assetSymbol: "XLM",
          assetDecimals: 7,
          approvalCount: current!.approvalCount,
          threshold: treasurySpec("A").threshold,
        },
        isMember: () => rpc.isMember(contractIdA, member),
        readProposal: async (id) => {
          const record = await readProposal(id);
          if (!record) return null;
          return { approvalCount: record.approvalCount, status: record.status };
        },
        signTransaction: signWith(secret),
      });
      const approvedPrep = await approve.prepare();
      expect(approvedPrep.status).toBe("ready");
      if (approvedPrep.status !== "ready") throw new Error(String(approvedPrep));
      const hash = await signAndSendSubmitted(approve, approvedPrep.preparedTxXdr);
      const outcome = await approve.confirm(hash);
      expect(outcome.status).toBe("confirmed");
      if (outcome.status !== "confirmed") throw new Error(String(outcome));
      expect(outcome.proposalStatus).toBe(current!.approvalCount + 1 >= treasurySpec("A").threshold ? "approved" : "pending");
    }

    // --- P_OB: fully approved but over the balance → execute must fail and
    // the proposal must stay Approved.
    const overAmount = balanceAfter! + 100n * XLM;
    const p1Amount = balanceAfter! / 2n; // floor — solvent; leaves < P2
    const pObId = startCount + 1;
    await createApprovedProposal({
      amount: overAmount,
      proposer: memberA,
      recipientAddress: recipient,
      description: `Matrix over-balance probe ${startCount}`,
      expectedId: pObId,
    });

    // one approval per member: A is #1 (create), B is #2 → still pending.
    await approveAs(pObId, secretB);
    await expect(
      stellarProposalExecutor().simulateApprove({
        contractId: contractIdA,
        memberAddress: outsider,
        proposalId: pObId,
      }),
    ).rejects.toThrow(/Error\(Contract, #3\)/); // NotMember — outsider write
    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberB,
        proposalId: pObId,
      }),
    ).rejects.toThrow(/Error\(Contract, #7\)/); // ThresholdNotReached at 2/3
    await approveAs(pObId, secretD);

    const pObAfterApproval = await readProposal(pObId);
    expect(pObAfterApproval).not.toBeNull();
    expect(pObAfterApproval!.status).toBe("approved");
    expect(pObAfterApproval!.approvalCount).toBe(3);
    expect(pObAfterApproval!.amountBaseUnits).toBe(overAmount.toString());
    expect(pObAfterApproval!.recipient).toBe(recipient);

    // The over-balance execute is blocked by the app seam (local preview)
    // and by the contract (InsufficientBalance) — and leaves the proposal
    // Approved with the balance unchanged.
    const overExecute = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      callerAddress: memberD,
      proposalId: pObId,
      reviewed: {
        status: "approved",
        amountBaseUnits: overAmount.toString(),
        recipient,
        description: "Matrix over-balance probe",
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
        treasuryBalanceBaseUnits: balanceAfter!.toString(),
      },
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance,
      signTransaction: signWith(secretD),
    });
    const overReady = await overExecute.prepare();
    expect(overReady.status).toBe("insufficient-balance");
    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberD,
        proposalId: pObId,
      }),
    ).rejects.toThrow(/Error\(Contract, #12\)/); // InsufficientBalance
    expect((await readProposal(pObId))!.status).toBe("approved");
    expect(await readBalance()).toBe(balanceAfter);

    // Approving an already-approved proposal → ProposalNotPending.
    const staleApprove = approveFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      memberAddress: memberB,
      proposalId: pObId,
      reviewed: {
        amountBaseUnits: overAmount.toString(),
        recipient,
        description: "Matrix over-balance probe",
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
      },
      isMember: () => rpc.isMember(contractIdA, memberB),
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      signTransaction: signWith(secretB),
    });
    const stale = await staleApprove.prepare();
    expect(stale.status).toBe("proposal-not-pending");

    // --- Competing proposals on A: both fully approved and individually
    // solvent; the first execution wins, the second is rejected and stays
    // Approved. Amounts are derived from the measured balance so reruns
    // cannot make the loser solvent.
    const p2Amount = p1Amount + 2n * XLM; // solvent now, impossible after P1
    const p1Id = startCount + 2;
    const p2Id = startCount + 3;

    await createApprovedProposal({
      amount: p1Amount,
      proposer: memberA,
      recipientAddress: recipient,
      description: `Matrix competitor 1 `,
      expectedId: p1Id,
    });

    // Duplicate approval by the proposer (approval #1 already recorded).
    const duplicate = approveFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      memberAddress: memberA,
      proposalId: p1Id,
      reviewed: {
        amountBaseUnits: p1Amount.toString(),
        recipient,
        description: "Matrix competitor 1",
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: treasurySpec("A").threshold,
      },
      isMember: () => rpc.isMember(contractIdA, memberA),
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      signTransaction: signWith(secretA),
    });
    const duplicateOutcome = await duplicate.prepare();
    expect(duplicateOutcome.status).toBe("already-approved");
    await expect(
      stellarProposalExecutor().simulateApprove({
        contractId: contractIdA,
        memberAddress: memberA,
        proposalId: p1Id,
      }),
    ).rejects.toThrow(/Error\(Contract, #8\)/); // AlreadyApproved

    await approveAs(p1Id, secretB);
    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberD,
        proposalId: p1Id,
      }),
    ).rejects.toThrow(/Error\(Contract, #7\)/); // ThresholdNotReached at 2/3
    await approveAs(p1Id, secretD);

    const p1Approved = await readProposal(p1Id);
    expect(p1Approved!.status).toBe("approved");
    expect(p1Approved!.approvalCount).toBe(3);

    // P1 executes exactly: recipient/amount immutable, balance debits P1.
    // P1 is fully approved and solvent, so every rejection below must come
    // from the wallet/RPC layer, never from solvency or threshold rules.
    const rejected = (
      executor: ReturnType<typeof stellarProposalExecutor>,
      signer: (xdr: string) => Promise<WalletSignatureResult>,
    ) => {
      return executeFlow({
        executor,
        contractId: contractIdA,
        treasuryName: treasurySpec("A").name,
        callerAddress: memberD,
        proposalId: p1Id,
        reviewed: {
          status: "approved",
          amountBaseUnits: p1Amount.toString(),
          recipient,
          description: "Matrix competitor 1",
          assetContractId: tokenId,
          assetSymbol: "XLM",
          assetDecimals: 7,
          approvalCount: 3,
          threshold: treasurySpec("A").threshold,
          treasuryBalanceBaseUnits: balanceAfter!.toString(),
        },
        readProposal: async (id) => {
          const record = await readProposal(id);
          if (!record) return null;
          return { approvalCount: record.approvalCount, status: record.status };
        },
        readBalance,
        signTransaction: signer,
      });
    };

    // Wrong network: a Mainnet-passphrase signature is rejected by Testnet
    // RPC before inclusion and changes nothing.
    const wrongNetwork = rejected(
      stellarProposalExecutor({ networkPassphrase: MAINNET_PASSPHRASE }),
      (xdr) => signWith(secretD, MAINNET_PASSPHRASE)(xdr),
    );
    const wrongNetworkReady = await wrongNetwork.prepare();
    expect(wrongNetworkReady.status).toBe("ready");
    if (wrongNetworkReady.status === "ready") {
      await expectRejectedSubmission(wrongNetwork, wrongNetworkReady.preparedTxXdr, "send-failed");
    }
    expect((await readProposal(p1Id))!.status).toBe("approved");
    expect(await readBalance()).toBe(balanceAfter);

    // Rejected signature: signer is member B (fee-payer stays D), so Testnet
    // rejects the malformed envelope before inclusion.
    const wrongActor = rejected(
      stellarProposalExecutor(),
      (xdr) => signWith(secretB)(xdr),
    );
    const wrongActorReady = await wrongActor.prepare();
    expect(wrongActorReady.status).toBe("ready");
    if (wrongActorReady.status === "ready") {
      await expectRejectedSubmission(wrongActor, wrongActorReady.preparedTxXdr, "send-failed");
    }
    expect((await readProposal(p1Id))!.status).toBe("approved");
    expect(await readBalance()).toBe(balanceAfter);

    // Wallet cancel: no signature is produced, nothing is submitted.
    const cancelled = rejected(stellarProposalExecutor(), cancelledSigner);
    const cancelledReady = await cancelled.prepare();
    expect(cancelledReady.status).toBe("ready");
    if (cancelledReady.status === "ready") {
      await expectRejectedSubmission(cancelled, cancelledReady.preparedTxXdr, "wallet-rejected");
    }
    expect((await readProposal(p1Id))!.status).toBe("approved");
    expect(await readBalance()).toBe(balanceAfter);

    const executeP1 = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      callerAddress: memberD,
      proposalId: p1Id,
      reviewed: {
        status: "approved",
        amountBaseUnits: p1Amount.toString(),
        recipient,
        description: "Matrix competitor 1",
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
        treasuryBalanceBaseUnits: balanceAfter!.toString(),
      },
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance,
      signTransaction: signWith(secretD),
    });
    const executeP1Ready = await executeP1.prepare();
    expect(executeP1Ready.status).toBe("ready");
    if (executeP1Ready.status === "ready") {
      const hash = await signAndSendSubmitted(executeP1, executeP1Ready.preparedTxXdr);
      const executedP1 = await executeP1.confirm(hash);
      expect(executedP1.status).toBe("confirmed");
      if (executedP1.status === "confirmed") {
        expect(executedP1.proposalStatus).toBe("executed");
        expect(executedP1.treasuryBalanceBaseUnits).toBe(
          (balanceAfter! - p1Amount).toString(),
        );
      }
    }
    const p1Record = await readProposal(p1Id);
    expect(p1Record!).toMatchObject({
      status: "executed",
      amountBaseUnits: p1Amount.toString(),
      recipient,
    });
    const balanceAfterP1 = await readBalance();
    expect(balanceAfterP1).toBe(balanceAfter! - p1Amount);
    expect(await rpc.hasApproved(contractIdA, p1Id, memberA)).toBe(true);

    await createApprovedProposal({
      amount: p2Amount,
      proposer: memberA,
      recipientAddress: outsider, // non-member recipient
      description: `Matrix competitor 2 `,
      expectedId: p2Id,
    });
    await approveAs(p2Id, secretB);
    await approveAs(p2Id, secretD);

    const p2Approved = await readProposal(p2Id);
    expect(p2Approved).not.toBeNull();
    expect(p2Approved!.status).toBe("approved");
    expect(p2Approved!.approvalCount).toBe(3);
    // P2 is individually solvent at approval time: only the earlier P1
    // execution makes it unpayable.
    expect(p2Amount).toBeLessThan(balanceAfter!);
    expect(p2Amount).toBeGreaterThan(balanceAfterP1!);

    const executeP2 = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdA,
      treasuryName: treasurySpec("A").name,
      callerAddress: memberD,
      proposalId: p2Id,
      reviewed: {
        status: "approved",
        amountBaseUnits: p2Amount.toString(),
        recipient: outsider,
        description: "Matrix competitor 2",
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 3,
        threshold: treasurySpec("A").threshold,
        treasuryBalanceBaseUnits: balanceAfterP1!.toString(),
      },
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance,
      signTransaction: signWith(secretD),
    });
    const executeP2Ready = await executeP2.prepare();
    expect(executeP2Ready.status).toBe("insufficient-balance");
    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: contractIdA,
        callerAddress: memberD,
        proposalId: p2Id,
      }),
    ).rejects.toThrow(/Error\(Contract, #12\)/); // contract-level rejection
    const p2After = await readProposal(p2Id);
    expect(p2After!.status).toBe("approved");
    expect(p2After!.amountBaseUnits).toBe(p2Amount.toString());
    expect(p2After!.recipient).toBe(outsider);
    expect(await readBalance()).toBe(balanceAfterP1);

    // Proposal ids advanced exactly as created: nothing extra landed.
    expect(await rpc.getProposalCount(contractIdA)).toBe(startCount + 3);

    // Isolation: all treasury A churn (including the successful P1 payment)
    // left treasury B completely untouched.
    expect(await rpc.getBalance(contractIdB)).toBe(bStartBalance);
    expect(await rpc.getProposalCount(contractIdB)).toBe(bStartCount);
  }, 900_000);

  it("proves treasury B funding isolation and permissionless execute by a non-member", async () => {
    const asset = {
      contractId: tokenId,
      symbol: "XLM",
      decimals: 7,
    };

    // Deployment drift guard for B.
    const configB = await rpc.getConfig(contractIdB);
    expect(configB).not.toBeNull();
    expect(configB!.threshold).toBe(treasurySpec("B").threshold);
    expect(configB!.name).toBe(treasurySpec("B").name);
    expect(configB!.tokenAddress.toUpperCase()).toBe(tokenId);
    const liveMembersB = (await rpc.getMemberList(contractIdB)) ?? [];
    expect([...liveMembersB].sort()).toEqual(
      [...treasurySpec("B").members.map((m) => m.toUpperCase())].sort(),
    );
    expect(await rpc.isMember(contractIdB, memberB)).toBe(true);
    expect(await rpc.isMember(contractIdB, memberD)).toBe(true);
    expect(await rpc.isMember(contractIdB, outsider)).toBe(false);

    const readProposal = async (proposalId: number): Promise<FlowProposal | null> => {
      const record = await rpc.getProposal(contractIdB, proposalId);
      return record ? toFlowProposal(record) : null;
    };
    const readLatestProposalId = () => rpc.getProposalCount(contractIdB);
    const readBalance = () => rpc.getBalance(contractIdB);

    // Snapshot the treasury A state this run produced; A must not move
    // while B funds flow.
    const aBalanceBefore = await rpc.getBalance(contractIdA);
    const aCountBefore = await rpc.getProposalCount(contractIdA);
    const { pObStatus, p2Status, p2Amount, p2Recipient } = await (async () => {
      const count = await rpc.getProposalCount(contractIdA);
      const p2 = await rpc.getProposal(contractIdA, count!);
      const pOb = await rpc.getProposal(contractIdA, count! - 2);
      return {
        pObStatus: pOb?.status ?? null,
        p2Status: p2?.status ?? null,
        p2Amount: p2?.amount.toString() ?? null,
        p2Recipient: p2?.recipient ?? null,
      };
    })();

    // B is funded by member B.
    const bBalanceBefore = await readBalance();
    expect(bBalanceBefore).not.toBeNull();
    const contributeB = createContributeFlow({
      executor: stellarContributeExecutor(),
      contractId: contractIdB,
      memberAddress: memberB,
      asset,
      currentBalanceBaseUnits: bBalanceBefore!.toString(),
      isMember: () => rpc.isMember(contractIdB, memberB),
      readBalance,
      signTransaction: signWith(secretB),
    });
    const fundAmount = 5n * XLM;
    const preparedB = await contributeB.prepare(fundAmount);
    expect(preparedB.status).toBe("ready");
    if (preparedB.status !== "ready") return;
    const sentB = await contributeB.signAndSend(preparedB.preparedTxXdr);
    expect(sentB.status).toBe("submitted");
    if (sentB.status !== "submitted") return;
    const confirmedB = await contributeB.confirm(sentB.hash);
    expect(confirmedB.status).toBe("confirmed");

    const bBalanceAfter = await readBalance();
    expect(bBalanceAfter).toBe(bBalanceBefore! + fundAmount);

    // Proposal P_B: 2 XLM to a non-member recipient, approved by B and D.
    const pBAmount = 2n * XLM;
    const pBId = (await rpc.getProposalCount(contractIdB))! + 1;
    const createB = createProposalFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdB,
      treasuryName: treasurySpec("B").name,
      memberAddress: memberB,
      asset,
      treasuryBalanceBaseUnits: bBalanceAfter!.toString(),
      isMember: () => rpc.isMember(contractIdB, memberB),
      readProposal,
      readLatestProposalId,
      signTransaction: signWith(secretB),
    });
    const createBPrepared = await createB.prepare({
      amountBaseUnits: pBAmount,
      recipient,
      description: `Matrix permissionless execute ${pBId}`,
    });
    expect(createBPrepared.status).toBe("ready");
    if (createBPrepared.status !== "ready") return;
    expect(createBPrepared.previewProposalId).toBe(pBId);
    const createBSent = await createB.signAndSend(createBPrepared.preparedTxXdr);
    expect(createBSent.status).toBe("submitted");
    if (createBSent.status !== "submitted") return;
    const createBConfirmed = await createB.confirm(createBSent.hash, createBPrepared.previewProposalId);
    expect(createBConfirmed.status).toBe("confirmed");

    const approveB = approveFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdB,
      treasuryName: treasurySpec("B").name,
      memberAddress: memberD,
      proposalId: pBId,
      reviewed: {
        amountBaseUnits: pBAmount.toString(),
        recipient,
        description: `Matrix permissionless execute ${pBId}`,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: treasurySpec("B").threshold,
      },
      isMember: () => rpc.isMember(contractIdB, memberD),
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      signTransaction: signWith(secretD),
    });
    const approveBPrepared = await approveB.prepare();
    expect(approveBPrepared.status).toBe("ready");
    if (approveBPrepared.status !== "ready") return;
    const approveBSent = await approveB.signAndSend(approveBPrepared.preparedTxXdr);
    expect(approveBSent.status).toBe("submitted");
    if (approveBSent.status !== "submitted") return;
    const approveBConfirmed = await approveB.confirm(approveBSent.hash);
    if (approveBConfirmed.status !== "confirmed") {
      throw new Error(`Approval did not confirm: ${JSON.stringify(approveBConfirmed)}`);
    }
    expect(approveBConfirmed.proposalStatus).toBe("approved");

    // Permissionless execute: the outsider is not a member of B, pays the
    // fee, and cannot change the amount, recipient, or approvals.
    const executeB = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdB,
      treasuryName: treasurySpec("B").name,
      callerAddress: outsider,
      proposalId: pBId,
      reviewed: {
        status: "approved",
        amountBaseUnits: pBAmount.toString(),
        recipient,
        description: `Matrix permissionless execute ${pBId}`,
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 2,
        threshold: treasurySpec("B").threshold,
        treasuryBalanceBaseUnits: bBalanceAfter!.toString(),
      },
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance,
      signTransaction: signWith(secretC),
    });
    const executeBPrepared = await executeB.prepare();
    expect(executeBPrepared.status).toBe("ready");
    if (executeBPrepared.status === "ready") {
      expect(executeBPrepared.review.amountBaseUnits).toBe(pBAmount.toString());
      expect(executeBPrepared.review.recipient).toBe(recipient);
      const executeBHash = await signAndSendSubmitted(executeB, executeBPrepared.preparedTxXdr);
      const executeBConfirmed = await executeB.confirm(executeBHash);
      expect(executeBConfirmed.status).toBe("confirmed");
      if (executeBConfirmed.status === "confirmed") {
        expect(executeBConfirmed.proposalStatus).toBe("executed");
        expect(executeBConfirmed.treasuryBalanceBaseUnits).toBe(
          (bBalanceAfter! - pBAmount).toString(),
        );
      }
    }
    const pBRecord = await readProposal(pBId);
    expect(pBRecord!).toMatchObject({
      status: "executed",
      amountBaseUnits: pBAmount.toString(),
      recipient,
      approvalCount: 2,
    });
    expect(await readBalance()).toBe(bBalanceAfter! - pBAmount);

    // Double execute: the flow and the contract both reject, balance holds.
    const doubleB = executeFlow({
      executor: stellarProposalExecutor(),
      contractId: contractIdB,
      treasuryName: treasurySpec("B").name,
      callerAddress: memberD,
      proposalId: pBId,
      reviewed: {
        status: "executed",
        amountBaseUnits: pBAmount.toString(),
        recipient,
        description: `Matrix permissionless execute ${pBId}`,
        assetContractId: tokenId,
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 2,
        threshold: treasurySpec("B").threshold,
        treasuryBalanceBaseUnits: (bBalanceAfter! - pBAmount).toString(),
      },
      readProposal: async (id) => {
        const record = await readProposal(id);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance,
      signTransaction: signWith(secretD),
    });
    const doubleBReady = await doubleB.prepare();
    expect(doubleBReady.status).toBe("already-executed");
    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: contractIdB,
        callerAddress: memberD,
        proposalId: pBId,
      }),
    ).rejects.toThrow(/Error\(Contract, #11\)/); // AlreadyExecuted
    expect(await readBalance()).toBe(bBalanceAfter! - pBAmount);

    // Isolation verdict: B's funding and execution did not move A, and A's
    // over-balance/competing proposals remain exactly as test 1 left them.
    expect(await rpc.getBalance(contractIdA)).toBe(aBalanceBefore);
    expect(await rpc.getProposalCount(contractIdA)).toBe(aCountBefore);
    const aCountNow = await rpc.getProposalCount(contractIdA);
    const p2Now = await rpc.getProposal(contractIdA, aCountNow!);
    expect(p2Now?.status ?? null).toBe(p2Status);
    expect(p2Now?.amount.toString() ?? null).toBe(p2Amount);
    expect(p2Now?.recipient ?? null).toBe(p2Recipient);
    const pObNow = await rpc.getProposal(contractIdA, aCountNow! - 2);
    expect(pObNow?.status ?? null).toBe(pObStatus);
  }, 900_000);
});