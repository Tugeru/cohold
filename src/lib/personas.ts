import { Persona } from "@/types";

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "maria-president",
    name: "Maria Santos",
    role: "President",
    address: "GAICXX4VUPKFFG3HELHEUQ7UJQMEK22VPAICXX4VUPKFFG3HELHEUQ7U",
    avatar: "👩‍💼",
    color: "emerald",
  },
  {
    id: "juan-treasurer",
    name: "Juan Dela Cruz",
    role: "Treasurer",
    address: "GTZ34JPN4BSTVMY6NVTLDACE7JDSSS6JSTZ34JPN4BSTVMY6NVTLDACE",
    avatar: "👨‍💻",
    color: "blue",
  },
  {
    id: "chloe-secretary",
    name: "Chloe Lim",
    role: "Secretary",
    address: "GOJIT67X65BMAOXOAG5LZHGDJ5ISI6ASWOJIT67X65BMAOXOAG5LZHGD",
    avatar: "👩‍🔬",
    color: "purple",
  },
  {
    id: "daniel-auditor",
    name: "Daniel Tan",
    role: "Auditor",
    address: "GGTT3ZLGGH2WKZPBXUFRN4GSYQPHINMSPGTT3ZLGGH2WKZPBXUFRN4GS",
    avatar: "🧑‍⚖️",
    color: "amber",
  },
  {
    id: "alex-partner",
    name: "Alex Rivera",
    role: "Lead Partner",
    address: "GSXM7TY75Q2M6JCZCBUA2XBZP5YLMK2JNSXM7TY75Q2M6JCZCBUA2XBZ",
    avatar: "👨‍💼",
    color: "indigo",
  },
  {
    id: "samira-cfo",
    name: "Samira Patel",
    role: "CFO",
    address: "G344CQW464YBXH2T3QK4FNPQQL5RQSKJR344CQW464YBXH2T3QK4FNPQ",
    avatar: "👩‍💻",
    color: "rose",
  },
  {
    id: "external-supplier",
    name: "Grand Hall Venue Supplier",
    role: "External Recipient",
    address: "GT2AT5KCW272UM34FA7L7NYPRYXEJFGYET2AT5KCW272UM34FA7L7NYP",
    avatar: "🏢",
    color: "slate",
  },
];

export function getPersonaByAddress(address: string): Persona | undefined {
  if (!address) return undefined;
  return DEFAULT_PERSONAS.find(
    (p) => p.address.toLowerCase() === address.toLowerCase()
  );
}

export function getPersonaLabel(address: string, fallback = "Member"): string {
  const p = getPersonaByAddress(address);
  if (p) return `${p.role} (${p.name})`;
  return fallback;
}
