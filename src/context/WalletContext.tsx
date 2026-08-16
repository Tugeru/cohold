"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Persona } from "@/types";
import { DEFAULT_PERSONAS } from "@/lib/personas";
import {
  fetchStellarAccountBalances,
  isValidStellarAddress,
} from "@/lib/stellar";

interface WalletContextType {
  activePersona: Persona;
  setActivePersona: (p: Persona) => void;
  personas: Persona[];
  isFreighterConnected: boolean;
  freighterAddress: string | null;
  connectFreighter: () => Promise<void>;
  disconnectFreighter: () => void;
  testnetBalance: string | null;
  refreshBalance: () => Promise<void>;
  isMemberOf: (memberAddresses: string[]) => boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [personas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [activePersona, setActivePersona] = useState<Persona>(DEFAULT_PERSONAS[0]); // Maria (President) by default
  const [isFreighterConnected, setIsFreighterConnected] = useState(false);
  const [freighterAddress, setFreighterAddress] = useState<string | null>(null);
  const [testnetBalance, setTestnetBalance] = useState<string | null>(null);
  const activePersonaAddress = activePersona?.address;

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

  const connectFreighter = async () => {
    try {
      // Check if freighter api is in browser window
      const freighter = (window as unknown as { freighter?: { getPublicKey: () => Promise<string>; isConnected: () => Promise<boolean> } }).freighter;
      if (freighter) {
        const isConn = await freighter.isConnected();
        if (isConn) {
          const pubKey = await freighter.getPublicKey();
          if (pubKey && isValidStellarAddress(pubKey)) {
            setFreighterAddress(pubKey);
            setIsFreighterConnected(true);
            const freighterPersona: Persona = {
              id: "freighter-connected",
              name: "Freighter Wallet",
              role: "Hardware / Extension Signer",
              address: pubKey,
              avatar: "🚀",
              color: "cyan",
              isFreighter: true,
            };
            setActivePersona(freighterPersona);
            return;
          }
        }
      }
      // If Freighter not available, simulate connecting a custom user wallet
      alert(
        "Freighter extension not detected in this browser session. You can use any of the pre-configured multi-party signer personas (Maria, Juan, Chloe, Daniel, etc.) or install Freighter."
      );
    } catch (err) {
      console.warn("Freighter connection error:", err);
    }
  };

  const disconnectFreighter = () => {
    setIsFreighterConnected(false);
    setFreighterAddress(null);
    setActivePersona(DEFAULT_PERSONAS[0]);
  };

  const isMemberOf = (memberAddresses: string[]): boolean => {
    if (!activePersona?.address || !Array.isArray(memberAddresses)) return false;
    const activeUpper = activePersona.address.toUpperCase();
    return memberAddresses.some((addr) => addr.toUpperCase() === activeUpper);
  };

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
