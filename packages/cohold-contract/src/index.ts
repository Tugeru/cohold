import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export type DataKey = {tag: "Config", values: void} | {tag: "Member", values: readonly [string]} | {tag: "MemberList", values: void} | {tag: "Proposal", values: readonly [u64]} | {tag: "ProposalCount", values: void} | {tag: "Approval", values: readonly [u64, string]} | {tag: "TotalContributed", values: readonly [string]} | {tag: "ContractBalance", values: void};


export interface Proposal {
  amount: i128;
  approval_count: u32;
  created_at: u64;
  description: string;
  id: u64;
  proposer: string;
  recipient: string;
  status: ProposalStatus;
}

export const CoholdError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotMember"},
  4: {message:"InvalidThreshold"},
  5: {message:"EmptyMembers"},
  6: {message:"DuplicateMember"},
  7: {message:"ThresholdNotReached"},
  8: {message:"AlreadyApproved"},
  9: {message:"ProposalNotFound"},
  10: {message:"ProposalNotPending"},
  11: {message:"AlreadyExecuted"},
  12: {message:"InsufficientBalance"},
  13: {message:"ZeroAmount"},
  14: {message:"Unauthorized"},
  15: {message:"InvalidRecipient"}
}

export enum ProposalStatus {
  Pending = 0,
  Approved = 1,
  Executed = 2,
  Cancelled = 3,
}


export interface TreasuryConfig {
  creator: string;
  member_count: u32;
  name: string;
  threshold: u32;
  token: string;
}

export interface Client {
  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve a pending proposal.
   */
  approve: ({member, proposal_id}: {member: string, proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute an approved proposal.
   */
  execute: ({caller, proposal_id}: {caller: string, proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if address is a member.
   */
  is_member: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a contribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Contribute funds to the shared treasury (Member only).
   */
  contribute: ({member, amount}: {member: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get treasury config.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<TreasuryConfig>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize a shared treasury with immutable members and threshold.
   */
  initialize: ({creator, token, members, threshold, name}: {creator: string, token: string, members: Array<string>, threshold: u32, name: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current treasury contract balance.
   */
  get_balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_members transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the immutable member list.
   */
  get_members: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get proposal by id.
   */
  get_proposal: ({proposal_id}: {proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Proposal>>>

  /**
   * Construct and simulate a has_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if member approved proposal.
   */
  has_approved: ({proposal_id, member}: {proposal_id: u64, member: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a create_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a spending proposal. Proposer automatically approves.
   */
  create_proposal: ({proposer, recipient, amount, description}: {proposer: string, recipient: string, amount: i128, description: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a get_proposal_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the number of proposals created.
   */
  get_proposal_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_contribution_total transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the total amount a member has contributed.
   */
  get_contribution_total: ({member}: {member: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAQAAAAAAAAAGTWVtYmVyAAAAAAABAAAAEwAAAAAAAAAAAAAACk1lbWJlckxpc3QAAAAAAAEAAAAAAAAACFByb3Bvc2FsAAAAAQAAAAYAAAAAAAAAAAAAAA1Qcm9wb3NhbENvdW50AAAAAAAAAQAAAAAAAAAIQXBwcm92YWwAAAACAAAABgAAABMAAAABAAAAAAAAABBUb3RhbENvbnRyaWJ1dGVkAAAAAQAAABMAAAAAAAAAAAAAAA9Db250cmFjdEJhbGFuY2UA",
        "AAAAAQAAAAAAAAAAAAAACFByb3Bvc2FsAAAACAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA5hcHByb3ZhbF9jb3VudAAAAAAABAAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAACaWQAAAAAAAYAAAAAAAAACHByb3Bvc2VyAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlByb3Bvc2FsU3RhdHVzAAA=",
        "AAAABAAAAAAAAAAAAAAAC0NvaG9sZEVycm9yAAAAAA8AAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAACU5vdE1lbWJlcgAAAAAAAAMAAAAAAAAAEEludmFsaWRUaHJlc2hvbGQAAAAEAAAAAAAAAAxFbXB0eU1lbWJlcnMAAAAFAAAAAAAAAA9EdXBsaWNhdGVNZW1iZXIAAAAABgAAAAAAAAATVGhyZXNob2xkTm90UmVhY2hlZAAAAAAHAAAAAAAAAA9BbHJlYWR5QXBwcm92ZWQAAAAACAAAAAAAAAAQUHJvcG9zYWxOb3RGb3VuZAAAAAkAAAAAAAAAElByb3Bvc2FsTm90UGVuZGluZwAAAAAACgAAAAAAAAAPQWxyZWFkeUV4ZWN1dGVkAAAAAAsAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAADAAAAAAAAAAKWmVyb0Ftb3VudAAAAAAADQAAAAAAAAAMVW5hdXRob3JpemVkAAAADgAAAAAAAAAQSW52YWxpZFJlY2lwaWVudAAAAA8=",
        "AAAAAwAAAAAAAAAAAAAADlByb3Bvc2FsU3RhdHVzAAAAAAAEAAAAAAAAAAdQZW5kaW5nAAAAAAAAAAAAAAAACEFwcHJvdmVkAAAAAQAAAAAAAAAIRXhlY3V0ZWQAAAACAAAAAAAAAAlDYW5jZWxsZWQAAAAAAAAD",
        "AAAAAQAAAAAAAAAAAAAADlRyZWFzdXJ5Q29uZmlnAAAAAAAFAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAADG1lbWJlcl9jb3VudAAAAAQAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAAAAABtBcHByb3ZlIGEgcGVuZGluZyBwcm9wb3NhbC4AAAAAB2FwcHJvdmUAAAAAAgAAAAAAAAAGbWVtYmVyAAAAAAATAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAAGAAAAAQAAA+kAAAACAAAH0AAAAAtDb2hvbGRFcnJvcgA=",
        "AAAAAAAAAB1FeGVjdXRlIGFuIGFwcHJvdmVkIHByb3Bvc2FsLgAAAAAAAAdleGVjdXRlAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAALcHJvcG9zYWxfaWQAAAAABgAAAAEAAAPpAAAAAgAAB9AAAAALQ29ob2xkRXJyb3IA",
        "AAAAAAAAAB1DaGVjayBpZiBhZGRyZXNzIGlzIGEgbWVtYmVyLgAAAAAAAAlpc19tZW1iZXIAAAAAAAABAAAAAAAAAAdhZGRyZXNzAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAADZDb250cmlidXRlIGZ1bmRzIHRvIHRoZSBzaGFyZWQgdHJlYXN1cnkgKE1lbWJlciBvbmx5KS4AAAAAAApjb250cmlidXRlAAAAAAACAAAAAAAAAAZtZW1iZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAALQ29ob2xkRXJyb3IA",
        "AAAAAAAAABRHZXQgdHJlYXN1cnkgY29uZmlnLgAAAApnZXRfY29uZmlnAAAAAAAAAAAAAQAAA+kAAAfQAAAADlRyZWFzdXJ5Q29uZmlnAAAAAAfQAAAAC0NvaG9sZEVycm9yAA==",
        "AAAAAAAAAEJJbml0aWFsaXplIGEgc2hhcmVkIHRyZWFzdXJ5IHdpdGggaW1tdXRhYmxlIG1lbWJlcnMgYW5kIHRocmVzaG9sZC4AAAAAAAppbml0aWFsaXplAAAAAAAFAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAHbWVtYmVycwAAAAPqAAAAEwAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAEbmFtZQAAABAAAAABAAAD6QAAAAIAAAfQAAAAC0NvaG9sZEVycm9yAA==",
        "AAAAAAAAACZHZXQgY3VycmVudCB0cmVhc3VyeSBjb250cmFjdCBiYWxhbmNlLgAAAAAAC2dldF9iYWxhbmNlAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAB5HZXQgdGhlIGltbXV0YWJsZSBtZW1iZXIgbGlzdC4AAAAAAAtnZXRfbWVtYmVycwAAAAAAAAAAAQAAA+oAAAAT",
        "AAAAAAAAABNHZXQgcHJvcG9zYWwgYnkgaWQuAAAAAAxnZXRfcHJvcG9zYWwAAAABAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAAGAAAAAQAAA+kAAAfQAAAACFByb3Bvc2FsAAAH0AAAAAtDb2hvbGRFcnJvcgA=",
        "AAAAAAAAACJDaGVjayBpZiBtZW1iZXIgYXBwcm92ZWQgcHJvcG9zYWwuAAAAAAAMaGFzX2FwcHJvdmVkAAAAAgAAAAAAAAALcHJvcG9zYWxfaWQAAAAABgAAAAAAAAAGbWVtYmVyAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAADxDcmVhdGUgYSBzcGVuZGluZyBwcm9wb3NhbC4gUHJvcG9zZXIgYXV0b21hdGljYWxseSBhcHByb3Zlcy4AAAAPY3JlYXRlX3Byb3Bvc2FsAAAAAAQAAAAAAAAACHByb3Bvc2VyAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAQAAA+kAAAAGAAAH0AAAAAtDb2hvbGRFcnJvcgA=",
        "AAAAAAAAACRHZXQgdGhlIG51bWJlciBvZiBwcm9wb3NhbHMgY3JlYXRlZC4AAAASZ2V0X3Byb3Bvc2FsX2NvdW50AAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAAC5HZXQgdGhlIHRvdGFsIGFtb3VudCBhIG1lbWJlciBoYXMgY29udHJpYnV0ZWQuAAAAAAAWZ2V0X2NvbnRyaWJ1dGlvbl90b3RhbAAAAAAAAQAAAAAAAAAGbWVtYmVyAAAAAAATAAAAAQAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    approve: this.txFromJSON<Result<void>>,
        execute: this.txFromJSON<Result<void>>,
        is_member: this.txFromJSON<boolean>,
        contribute: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Result<TreasuryConfig>>,
        initialize: this.txFromJSON<Result<void>>,
        get_balance: this.txFromJSON<i128>,
        get_members: this.txFromJSON<Array<string>>,
        get_proposal: this.txFromJSON<Result<Proposal>>,
        has_approved: this.txFromJSON<boolean>,
        create_proposal: this.txFromJSON<Result<u64>>,
        get_proposal_count: this.txFromJSON<u64>,
        get_contribution_total: this.txFromJSON<i128>
  }
}