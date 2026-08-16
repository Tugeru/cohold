/**
 * Opt-in Testnet integration for the proposal flow seam.
 *
 * Skipped unless COHOLD_TESTNET_CONTRACT_ID is set. This is the automated
 * form of AGENTS.md's "Manual Testnet check": it drives the exact flow
 * modules the UI uses (createProposalFlow / approveFlow /
 * stellarProposalExecutor) against a live contract, then re-reads state
 * from the contract as the source of truth.
 *
 * Env required to run:
 *   COHOLD_TESTNET_CONTRACT_ID   deployed Cohold contract (C…)
 *   COHOLD_TESTNET_TOKEN_ID      its token contract (SAC, C…)
 *   COHOLD_TESTNET_SECRET_A      funded member (S…)
 *   COHOLD_TESTNET_SECRET_B      funded member (S…, threshold covers both)
 *   COHOLD_TESTNET_SECRET_C      a funded non-member (S…)
 */
import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import {
  approveFlow,
  createProposalFlow,
  stellarProposalExecutor,
} from "@/lib/proposal-flow";
import { stellarCoholdRpc } from "@/lib/contract-adapter";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "@/lib/stellar";

const contractId = process.env.COHOLD_TESTNET_CONTRACT_ID ?? "";
const tokenId = process.env.COHOLD_TESTNET_TOKEN_ID ?? "";
const secretA = process.env.COHOLD_TESTNET_SECRET_A ?? "";
const secretB = process.env.COHOLD_TESTNET_SECRET_B ?? "";
const secretC = process.env.COHOLD_TESTNET_SECRET_C ?? "";

const enabled =
  Boolean(contractId) && Boolean(tokenId) && Boolean(secretA) && Boolean(secretB) && Boolean(secretC);

describe.skipIf(!enabled)("proposal flow on Testnet", () => {
  it("creates, approves, and rejects abuse on a live contract", async () => {
    expect(contractId.startsWith("C")).toBe(true);
    expect(tokenId.startsWith("C")).toBe(true);
    const memberA = Keypair.fromSecret(secretA).publicKey().toUpperCase();
    const memberB = Keypair.fromSecret(secretB).publicKey().toUpperCase();
    const nonMemberC = Keypair.fromSecret(secretC).publicKey().toUpperCase();

    // All reads go through the app's own adapter, so the Ok/Err unwrapping
    // fixes are exercised live.
    const rpc = stellarCoholdRpc();
    const isMember = (address: string) => rpc.isMember(contractId, address);
    const readProposal = async (proposalId: number) => {
      const record = await rpc.getProposal(contractId, proposalId);
      if (!record) return null;
      return {
        proposalId: record.id,
        proposer: record.proposer,
        approvalCount: record.approvalCount,
        status: record.status,
        amountBaseUnits: record.amount.toString(),
        recipient: record.recipient,
      };
    };
    const readLatestProposalId = () => rpc.getProposalCount(contractId);
    const signWith = (secret: string) => {
      const keypair = Keypair.fromSecret(secret);
      const signer = basicNodeSigner(keypair, STELLAR_TESTNET_NETWORK_PASSPHRASE);
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
    };

    // Preconditions: config normalizes despite the Ok wrapper, and the
    // deployed contract has A and B as members, C is not.
    const config = await rpc.getConfig(contractId);
    expect(config).not.toBeNull();
    expect(config!.threshold).toBe(2);
    expect(await isMember(memberA)).toBe(true);
    expect(await isMember(memberB)).toBe(true);
    expect(await isMember(nonMemberC)).toBe(false);
    // A missing proposal surfaces as null (Err unwrap), not a throw.
    expect(await rpc.getProposal(contractId, 9_999_999)).toBeNull();

    const recipient = nonMemberC;
    const amount = 1_0000000n; // 1 XLM in base units (wrapped native, 7 decimals)

    const createFlow = createProposalFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: "Testnet integration treasury",
      memberAddress: memberA,
      asset: { contractId: tokenId, symbol: "XLM", decimals: 7 },
      treasuryBalanceBaseUnits: null,
      isMember: () => isMember(memberA),
      readProposal,
      readLatestProposalId,
      signTransaction: signWith(secretA),
    });

    // 1. Create: validate → simulate → sign → submit → confirm.
    const prepared = await createFlow.prepare({
      amountBaseUnits: amount,
      recipient,
      description: "Integration check: one-off spend",
    });
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") return;
    expect(prepared.previewProposalId).not.toBeNull();

    const sent = await createFlow.signAndSend(prepared.preparedTxXdr);
    expect(sent.status).toBe("submitted");
    if (sent.status !== "submitted") return;

    const created = await createFlow.confirm(sent.hash, prepared.previewProposalId);
    expect(created.status).toBe("confirmed");
    if (created.status !== "confirmed") return;
    expect(created.proposalId).toBe(prepared.previewProposalId);
    expect(created.approvalCount).toBe(1);
    expect(created.proposalStatus).toBe("pending");

    // Authoritative re-read from the contract.
    const createRecord = await rpc.getProposal(contractId, created.proposalId ?? -1);
    expect(createRecord).not.toBeNull();
    expect(createRecord!.proposer).toBe(memberA);
    expect(createRecord!.amount).toBe(amount);
    expect(createRecord!.recipient).toBe(recipient);
    expect(createRecord!.approvalCount).toBe(1);
    expect(createRecord!.status).toBe("pending");

    // 2. Duplicate approval by A while the proposal is still pending →
    //    contract AlreadyApproved (#8), mapped by the flow. This runs before
    //    B's approval so the proposal is still Pending (the status check
    //    precedes the AlreadyApproved check in the contract).
    const approveFlowA = approveFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: "Testnet integration treasury",
      memberAddress: memberA,
      proposalId: created.proposalId ?? -1,
      reviewed: {
        amountBaseUnits: amount.toString(),
        recipient,
        description: "Integration check: one-off spend",
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: 2,
      },
      isMember: () => isMember(memberA),
      readProposal: async (proposalId) => {
        const record = await readProposal(proposalId);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      signTransaction: signWith(secretA),
    });
    const duplicate = await approveFlowA.prepare();
    expect(duplicate.status).toBe("already-approved");
    if (duplicate.status === "already-approved") {
      expect(duplicate.error.kind).toBe("already-approved");
    }

    // 3. Approve as the second member: threshold 2 flips the proposal.
    const approveFlowB = approveFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: "Testnet integration treasury",
      memberAddress: memberB,
      proposalId: created.proposalId ?? -1,
      reviewed: {
        amountBaseUnits: amount.toString(),
        recipient,
        description: "Integration check: one-off spend",
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: 2,
      },
      isMember: () => isMember(memberB),
      readProposal: async (proposalId) => {
        const record = await readProposal(proposalId);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status ?? "pending" };
      },
      signTransaction: signWith(secretB),
    });

    const approvePrepared = await approveFlowB.prepare();
    expect(approvePrepared.status).toBe("ready");
    if (approvePrepared.status !== "ready") return;

    const approveSent = await approveFlowB.signAndSend(approvePrepared.preparedTxXdr);
    expect(approveSent.status).toBe("submitted");
    if (approveSent.status !== "submitted") return;

    const approved = await approveFlowB.confirm(approveSent.hash);
    expect(approved.status).toBe("confirmed");
    if (approved.status !== "confirmed") return;
    expect(approved.approvalCount).toBe(2);
    expect(approved.proposalStatus).toBe("approved");

    const approveRecord = await readProposal(created.proposalId ?? -1);
    expect(approveRecord!.approvalCount).toBe(2);
    expect(approveRecord!.status).toBe("approved");

    // 3a. Approving an already-approved proposal → ProposalNotPending (#10),
    //    because the status check precedes the AlreadyApproved check.
    const stale = await approveFlowB.prepare();
    expect(stale.status).toBe("proposal-not-pending");
    if (stale.status === "proposal-not-pending") {
      expect(stale.error.kind).toBe("proposal-not-pending");
    }

    // 3b. Non-member cannot create.
    const nonMemberFlow = createProposalFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: "Testnet integration treasury",
      memberAddress: nonMemberC,
      asset: { contractId: tokenId, symbol: "XLM", decimals: 7 },
      treasuryBalanceBaseUnits: null,
      isMember: () => isMember(nonMemberC),
      readProposal,
      readLatestProposalId,
      signTransaction: signWith(secretC),
    });
    const notMember = await nonMemberFlow.prepare({
      amountBaseUnits: 10_0000000n,
      recipient: memberA,
      description: "Should be rejected",
    });
    expect(notMember.status).toBe("not-member");
    if (notMember.status === "not-member") {
      expect(notMember.error.kind).toBe("not-member");
    }

    // 3c. Member validation failures never reach the chain.
    const zero = await createFlow.prepare({
      amountBaseUnits: 0n,
      recipient,
      description: "Should be rejected",
    });
    expect(zero.status).toBe("invalid-amount");
    const badRecipient = await createFlow.prepare({
      amountBaseUnits: 1n,
      recipient: "not-an-address",
      description: "Should be rejected",
    });
    expect(badRecipient.status).toBe("invalid-recipient");

    // 3d. Approving a proposal that does not exist → contract ProposalNotFound.
    const ghostFlow = approveFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: "Testnet integration treasury",
      memberAddress: memberA,
      proposalId: 9_999_999,
      reviewed: {
        amountBaseUnits: "1",
        recipient,
        description: "ghost",
        assetSymbol: "XLM",
        assetDecimals: 7,
        approvalCount: 0,
        threshold: 2,
      },
      isMember: () => isMember(memberA),
      readProposal: async () => null,
      signTransaction: signWith(secretA),
    });
    const ghost = await ghostFlow.prepare();
    expect(ghost.status).toBe("proposal-not-found");
    if (ghost.status === "proposal-not-found") {
      expect(ghost.error.kind).toBe("proposal-not-found");
    }
  }, 120_000);
});