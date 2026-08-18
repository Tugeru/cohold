"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import type { WalletStatus } from "@/context/WalletContext";
import type { Persona } from "@/types";
import { Wallet, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

/**
 * Human-readable connect-state line shared by the landing island, the shell
 * gate, and any future connect surface. Maps the wallet status enum plus the
 * provider's message to a single status sentence.
 */
export function connectStatusLabel(status: WalletStatus, message: string | null): string | null {
  if (status === "connecting") return "Waiting for Freighter…";
  if (status === "connected") return message ?? "Wallet connected.";
  if (message) return message;
  if (status === "disconnected") return null;
  return null;
}

function StatusLine({ status, message }: { status: WalletStatus; message: string | null }) {
  const label = connectStatusLabel(status, message);
  if (!label) return null;
  const isError = status === "error" || status === "wrong-network";
  const tone =
    status === "connected"
      ? "text-emerald-400"
      : status === "connecting" || status === "disconnected"
        ? "text-slate-400"
        : isError
          ? "text-rose-300"
          : "text-amber-300";
  const Icon =
    status === "connected"
      ? CheckCircle2
      : status === "connecting"
        ? Loader2
        : isError
          ? AlertTriangle
          : Info;
  // Errors are announced assertively; transitions stay polite so they do not
  // interrupt the reading order of surrounding content.
  const liveRole = isError ? "alert" : "status";
  return (
    <p
      role={liveRole}
      aria-atomic="true"
      className={`flex items-center gap-2 text-xs font-medium ${tone}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "connecting" ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </p>
  );
}

interface ConnectPanelProps {
  title: string;
  description: string;
  status: WalletStatus;
  message: string | null;
  /** Connect action: the wallet button (wallet mode) or persona picker (demo mode). */
  children: ReactNode;
  /** Heading level for the placement context: landing island is h2, the standalone gate is h1. */
  headingLevel?: "h1" | "h2";
}

/** Shared card shell for the identity-first entry screens. */
export function ConnectPanel({
  title,
  description,
  status,
  message,
  children,
  headingLevel = "h2",
}: ConnectPanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const Heading = headingLevel === "h1" ? "h1" : "h2";
  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-xl shadow-black/30"
    >
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
        <Wallet className="h-5 w-5" />
      </div>
      <Heading
        id={titleId}
        className={
          headingLevel === "h1"
            ? "text-2xl font-bold tracking-tight text-white"
            : "text-lg font-bold tracking-tight text-white"
        }
      >
        {title}
      </Heading>
      <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-slate-400">
        {description}
      </p>
      <div className="mt-5">{children}</div>
      <div className="mt-4 border-t border-slate-800 pt-4">
        <StatusLine status={status} message={message} />
      </div>
    </section>
  );
}

interface PersonaPickListProps {
  personas: Persona[];
  activePersona: Persona;
  onPick: (persona: Persona) => void;
}

/** Demo-mode login: the persona list used by the landing island and the gate. */
export function PersonaPickList({ personas, activePersona, onPick }: PersonaPickListProps) {
  return (
    <ul className="grid gap-2">
      {personas.map((persona) => (
        <li key={persona.id}>
          <button
            type="button"
            onClick={() => onPick(persona)}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
              persona.id === activePersona.id
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-slate-700 bg-slate-900 hover:border-slate-500"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-lg">
              {persona.avatar}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold text-white">{persona.name}</span>
              <span className="block truncate text-xs text-slate-400">{persona.role}</span>
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">
              {persona.address.slice(0, 6)}…{persona.address.slice(-4)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}