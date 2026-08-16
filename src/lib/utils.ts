import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatBaseUnits, type BaseUnitInput } from "@/lib/money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatAmount(amount: BaseUnitInput, symbol = "DEMO_UNITS"): string {
  try {
    return `${formatBaseUnits(amount)} ${symbol}`;
  } catch {
    return `0 ${symbol}`;
  }
}

export function formatNumber(amount: string | number): string {
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(date: string | Date | undefined | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function generateStellarTxHash(): string {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function generateStellarAddress(prefix = "G"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let addr = prefix;
  for (let i = 0; i < 55; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

export function generateContractAddress(): string {
  return generateStellarAddress("C");
}
