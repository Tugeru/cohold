import {
  coholdConfig,
  isDemoMutationAllowed,
  type CoholdConfig,
} from "@/lib/cohold-config";
import { DEFAULT_PERSONAS } from "@/lib/personas";
import { generateStellarTxHash } from "@/lib/utils";

export const DEMO_PERSONAS = DEFAULT_PERSONAS;

const WALLET_ACTOR: (typeof DEMO_PERSONAS)[number] = {
  id: "wallet-actor",
  name: "Connected wallet",
  role: "Signer",
  address: "",
  avatar: "",
  color: "slate",
};

export function initialDemoActor(config: CoholdConfig): (typeof DEMO_PERSONAS)[number] {
  return demoPersonas(config)[0] ?? WALLET_ACTOR;
}

export const DEMO_MUTATION_ERROR = "This action is only available in demo mode";

export const DEMO_RESET_MESSAGE =
  "Demo fixtures restored. No Testnet balance changed.";

export const DEMO_FIXTURES = {
  treasuryId: "tr-it-society-event-fund",
  venueProposal: {
    id: "prop-venue-deposit-4500",
    amount: "4500",
    approvalCount: 2,
    threshold: 3,
  },
} as const;

export function demoPersonas(config: CoholdConfig): typeof DEMO_PERSONAS {
  return isDemoMutationAllowed(config) ? DEMO_PERSONAS : [];
}

export function demoMutationDenied(
  config: CoholdConfig
): { success: false; error: string } | null {
  if (isDemoMutationAllowed(config)) return null;
  return { success: false, error: DEMO_MUTATION_ERROR };
}

export async function resetDemoFixtures(
  config: CoholdConfig = coholdConfig,
  restore: () => Promise<void>
): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const denied = demoMutationDenied(config);
  if (denied) return { ok: false, error: denied.error };
  await restore();
  return { ok: true, message: DEMO_RESET_MESSAGE };
}

export function syntheticDemoSuccess(): { txHash: string; proof: "demo-synthetic" } {
  return {
    txHash: generateStellarTxHash(),
    proof: "demo-synthetic",
  };
}

export function resolveDemoActor(input: {
  actorAddress?: string;
  signature?: string;
  label?: string;
  members: string[];
}): { allowed: true; actorAddress: string } | { allowed: false; reason: string } {
  void input.signature;
  void input.label;
  const actorAddress = input.actorAddress?.trim().toUpperCase();
  if (!actorAddress) {
    return { allowed: false, reason: "Actor address is required" };
  }
  const members = new Set(input.members.map((address) => address.trim().toUpperCase()));
  if (!members.has(actorAddress)) {
    return { allowed: false, reason: "Address is not a member of this treasury" };
  }
  return { allowed: true, actorAddress };
}
