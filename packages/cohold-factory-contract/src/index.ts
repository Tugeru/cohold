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




export const FactoryError = {
  1: {message:"EmptyMembers"},
  2: {message:"InvalidThreshold"},
  3: {message:"CreatorNotMember"},
  4: {message:"DuplicateMember"},
  5: {message:"InitializeFailed"}
}

export interface Client {
  /**
   * Construct and simulate a create transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deploy a Cohold treasury instance from `wasm_hash`, initialize it with
   * `creator`/`token`/`members`/`threshold`/`name`, and record it so every
   * device can discover it. The creator must authorize and must be a
   * member (the Cohold contract enforces the latter too).
   */
  create: ({wasm_hash, creator, token, members, threshold, name}: {wasm_hash: Buffer, creator: string, token: string, members: Array<string>, threshold: u32, name: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_treasuries transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every treasury instance this factory has created, oldest first.
   */
  get_treasuries: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a treasury_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  treasury_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAADEZhY3RvcnlFcnJvcgAAAAUAAAAAAAAADEVtcHR5TWVtYmVycwAAAAEAAAAAAAAAEEludmFsaWRUaHJlc2hvbGQAAAACAAAAAAAAABBDcmVhdG9yTm90TWVtYmVyAAAAAwAAAAAAAAAPRHVwbGljYXRlTWVtYmVyAAAAAAQAAAAAAAAAEEluaXRpYWxpemVGYWlsZWQAAAAF",
        "AAAAAAAAAQREZXBsb3kgYSBDb2hvbGQgdHJlYXN1cnkgaW5zdGFuY2UgZnJvbSBgd2FzbV9oYXNoYCwgaW5pdGlhbGl6ZSBpdCB3aXRoCmBjcmVhdG9yYC9gdG9rZW5gL2BtZW1iZXJzYC9gdGhyZXNob2xkYC9gbmFtZWAsIGFuZCByZWNvcmQgaXQgc28gZXZlcnkKZGV2aWNlIGNhbiBkaXNjb3ZlciBpdC4gVGhlIGNyZWF0b3IgbXVzdCBhdXRob3JpemUgYW5kIG11c3QgYmUgYQptZW1iZXIgKHRoZSBDb2hvbGQgY29udHJhY3QgZW5mb3JjZXMgdGhlIGxhdHRlciB0b28pLgAAAAZjcmVhdGUAAAAAAAYAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAHbWVtYmVycwAAAAPqAAAAEwAAAAAAAAAJdGhyZXNob2xkAAAAAAAABAAAAAAAAAAEbmFtZQAAABAAAAABAAAD6QAAABMAAAfQAAAADEZhY3RvcnlFcnJvcg==",
        "AAAAAAAAAD9FdmVyeSB0cmVhc3VyeSBpbnN0YW5jZSB0aGlzIGZhY3RvcnkgaGFzIGNyZWF0ZWQsIG9sZGVzdCBmaXJzdC4AAAAADmdldF90cmVhc3VyaWVzAAAAAAAAAAAAAQAAA+oAAAAT",
        "AAAAAAAAAAAAAAAOdHJlYXN1cnlfY291bnQAAAAAAAAAAAABAAAABg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    create: this.txFromJSON<Result<string>>,
        get_treasuries: this.txFromJSON<Array<string>>,
        treasury_count: this.txFromJSON<u64>
  }
}