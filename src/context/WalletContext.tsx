"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Persona } from "@/types";
import { coholdConfig } from "@/lib/cohold-config";
import { demoPersonas, initialDemoActor } from "@/lib/demo-adapter";
import {
  fetchStellarAccountBalances,
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
} from "@/lib/stellar";
import {
  connectFreighter as connectWallet,
  restoreFreighter,
  signFreighterTransaction,
  type WalletConnectionResult,
  type WalletSignatureResult,
} from "@/lib/wallet-adapter";

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong-network"
  | "cancelled"
  | "error";

interface WalletContextType {
  activePersona: Persona;
  setActivePersona: (p: Persona) => void;
  personas: Persona[];
  isFreighterConnected: boolean;
  freighterAddress: string | null;
  connectFreighter: () => Promise<void>;
  disconnectFreighter: () => void;
  walletStatus: WalletStatus;
  walletNetwork: string | null;
  walletNetworkPassphrase: string | null;
  walletMessage: string | null;
  isWalletNetworkAllowed: boolean;
  canPerformStateChange: boolean;
  walletActionBlockReason: string | null;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
  testnetBalance: string | null;
  refreshBalance: () => Promise<void>;
  isMemberOf: (memberAddresses: string[]) => boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [personas] = useState<Persona[]>(() => demoPersonas(coholdConfig));
  const [activePersona, setActivePersonaState] = useState<Persona>(
    () => initialDemoActor(coholdConfig)
  );
  const [isFreighterConnected, setIsFreighterConnected] = useState(false);
  const [freighterAddress, setFreighterAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("disconnected");
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [walletNetworkPassphrase, setWalletNetworkPassphrase] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [testnetBalance, setTestnetBalance] = useState<string | null>(null);
  const activePersonaAddress = freighterAddress ?? activePersona?.address;

  const walletPersona = useCallback((address: string): Persona => ({
    id: "wallet-actor",
    name: "Connected wallet",
    role: "Wallet signer",
    address,
    avatar: "◎",
    color: "cyan",
    isFreighter: true,
  }), []);

  const applyConnectionResult = useCallback(
    (result: WalletConnectionResult) => {
      if (result.status === "connected" || result.status === "wrong-network") {
        setFreighterAddress(result.address);
        setIsFreighterConnected(true);
        setWalletNetwork(result.network);
        setWalletNetworkPassphrase(result.networkPassphrase);
        setWalletStatus(result.status);
        setWalletMessage(
          result.status === "wrong-network"
            ? "Switch Freighter to Stellar Testnet before signing."
            : null
  );
        if (coholdConfig.mode === "wallet") {
          setActivePersonaState(walletPersona(result.address));
        }
        return;
      }

      if (result.status === "not-installed" || result.status === "error") {
        setIsFreighterConnected(false);
        setFreighterAddress(null);
        setWalletNetwork(null);
        setWalletNetworkPassphrase(null);
        setTestnetBalance(null);
        if (coholdConfig.mode === "wallet") {
          setActivePersonaState(initialDemoActor(coholdConfig));
        }
      }
      setWalletStatus(result.status === "not-installed" ? "disconnected" : result.status);
      setWalletMessage(result.message);
    },
    [walletPersona]
  );

  const refreshBalance = useCallback(async () => {
    if (!activePersonaAddress) return;
    try {
      const balances = await fetchStellarAccountBalances(activePersonaAddress);
      const native = balances.find((b) => b.asset_type === "native");
      if (native) {
        setTestnetBalance(native.balance);
      } else {
        setTestnetBalance("0.0000000");
      }
    } catch {
      setTestnetBalance(null);
    }
  }, [activePersonaAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshBalance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshBalance]);

  const connectFreighter = useCallback(async () => {
    setWalletStatus("connecting");
    setWalletMessage(null);
    const result = await connectWallet();
    applyConnectionResult(result);
  }, [applyConnectionResult]);

  useEffect(() => {
    let cancelled = false;
    void restoreFreighter().then((result) => {
      if (!cancelled && result.status !== "not-installed") {
        applyConnectionResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyConnectionResult]);

  const disconnectFreighter = useCallback(() => {
    setIsFreighterConnected(false);
    setFreighterAddress(null);
    setWalletStatus("disconnected");
    setWalletNetwork(null);
    setWalletNetworkPassphrase(null);
    setWalletMessage(null);
    setTestnetBalance(null);
    setActivePersonaState(initialDemoActor(coholdConfig));
  }, []);

  const setActivePersona = useCallback((persona: Persona) => {
    if (coholdConfig.mode === "demo" && !isFreighterConnected) {
      setActivePersonaState(persona);
    }
  }, [isFreighterConnected]);

  const signTransaction = useCallback(async (transactionXdr: string) => {
    if (!isFreighterConnected || !freighterAddress) {
      const result: WalletSignatureResult = {
        status: "not-connected",
        message: "Connect Freighter before signing",
      };
      setWalletStatus("error");
      setWalletMessage(result.message);
      return result;
    }

    if (walletNetworkPassphrase !== STELLAR_TESTNET_NETWORK_PASSPHRASE) {
      const result: WalletSignatureResult = {
        status: "wrong-network",
        network: walletNetwork ?? "unknown",
        networkPassphrase: walletNetworkPassphrase ?? "",
      };
      setWalletStatus("wrong-network");
      setWalletMessage("Switch Freighter to Stellar Testnet before signing.");
      return result;
    }

    const result = await signFreighterTransaction(transactionXdr, undefined, freighterAddress);
    if (result.status === "cancelled") {
      setWalletStatus("cancelled");
      setWalletMessage("Signature cancelled");
    } else if (result.status === "signed") {
      setWalletStatus("connected");
      setWalletMessage(null);
    } else if (result.status === "wrong-network") {
      setWalletStatus("wrong-network");
      setWalletMessage("Switch Freighter to Stellar Testnet before signing.");
    } else {
      setWalletStatus("error");
      setWalletMessage(result.message);
    }
    return result;
  }, [freighterAddress, isFreighterConnected, walletNetwork, walletNetworkPassphrase]);

  const isMemberOf = (memberAddresses: string[]): boolean => {
    if (!activePersona?.address || !Array.isArray(memberAddresses)) return false;
    const activeUpper = activePersona.address.toUpperCase();
    return memberAddresses.some((addr) => addr.toUpperCase() === activeUpper);
  };

  const isWalletNetworkAllowed =
    isFreighterConnected &&
    walletNetworkPassphrase === STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const walletActionBlockReason =
    coholdConfig.mode !== "wallet"
      ? null
      : !isFreighterConnected
      ? "Connect Freighter before changing state."
      : !isWalletNetworkAllowed
      ? "Switch Freighter to Stellar Testnet before signing."
      : null;

  return (
    <WalletContext.Provider
      value={{
        activePersona,
        setActivePersona,
        personas,
        isFreighterConnected,
        freighterAddress,
        connectFreighter,
        disconnectFreighter,
        walletStatus,
        walletNetwork,
        walletNetworkPassphrase,
        walletMessage,
        isWalletNetworkAllowed,
        canPerformStateChange: walletActionBlockReason === null,
        walletActionBlockReason,
        signTransaction,
        testnetBalance,
        refreshBalance,
        isMemberOf,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
