import { describe, expect, it, vi } from "vitest";
import {
  connectFreighter,
  signFreighterTransaction,
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  type FreighterApi,
} from "./wallet-adapter";

const address = `G${"A".repeat(55)}`;

function createApi(overrides: Partial<FreighterApi> = {}): FreighterApi {
  return {
    isConnected: vi.fn(async () => ({ isConnected: true })),
    requestAccess: vi.fn(async () => ({ address })),
    getAddress: vi.fn(async () => ({ address })),
    getNetwork: vi.fn(async () => ({
      network: "TESTNET",
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    })),
    signTransaction: vi.fn(async () => ({
      signedTxXdr: "signed-xdr",
      signerAddress: address,
    })),
    ...overrides,
  };
}

describe("Freighter wallet adapter", () => {
  it("connects with the wallet address and Testnet network", async () => {
    const result = await connectFreighter(createApi());

    expect(result).toMatchObject({
      status: "connected",
      address,
      network: "TESTNET",
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    });
  });

  it("requests access when Freighter has not authorized this site yet", async () => {
    const requestAccess = vi.fn(async () => ({ address }));
    const result = await connectFreighter(
      createApi({
        isConnected: vi.fn(async () => ({ isConnected: false })),
        requestAccess,
      })
    );

    expect(result.status).toBe("connected");
    expect(requestAccess).toHaveBeenCalledOnce();
  });

  it("reports a wrong network without dropping the connected address", async () => {
    const result = await connectFreighter(
      createApi({
        getNetwork: vi.fn(async () => ({
          network: "PUBLIC",
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        })),
      })
    );

    expect(result).toMatchObject({
      status: "wrong-network",
      address,
      network: "PUBLIC",
    });
  });

  it("reports a rejected wallet request as cancelled", async () => {
    const result = await connectFreighter(
      createApi({
        requestAccess: vi.fn(async () => ({
          address: "",
          error: { message: "User rejected the request" },
        })),
      })
    );

    expect(result).toEqual({
      status: "cancelled",
      message: "Wallet connection cancelled",
    });
  });

  it("blocks signing before calling Freighter on the wrong network", async () => {
    const signTransaction = vi.fn(async () => ({
      signedTxXdr: "signed-xdr",
      signerAddress: address,
    }));
    const api = createApi({
      getNetwork: vi.fn(async () => ({
        network: "PUBLIC",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      })),
      signTransaction,
    });

    const result = await signFreighterTransaction("unsigned-xdr", api);

    expect(result).toMatchObject({ status: "wrong-network", network: "PUBLIC" });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("reports a rejected signature as cancelled and never successful", async () => {
    const result = await signFreighterTransaction(
      "unsigned-xdr",
      createApi({
        signTransaction: vi.fn(async () => ({
          signedTxXdr: "",
          signerAddress: "",
          error: { message: "User declined transaction" },
        })),
      })
    );

    expect(result).toEqual({
      status: "cancelled",
      message: "Signature cancelled",
    });
  });

  it("rejects a signature produced by a different wallet address", async () => {
    const otherAddress = `G${"B".repeat(55)}`;
    const result = await signFreighterTransaction(
      "unsigned-xdr",
      createApi({
        signTransaction: vi.fn(async () => ({
          signedTxXdr: "signed-xdr",
          signerAddress: otherAddress,
        })),
      }),
      address
    );

    expect(result).toEqual({
      status: "error",
      message: "Freighter signed with a different address",
    });
  });
});
