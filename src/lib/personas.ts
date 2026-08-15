import { Persona } from "@/types";

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "maria-president",
    name: "Maria Santos",
    role: "President",
    address: "GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD",
    avatar: "👩‍💼",
    color: "emerald",
  },
  {
    id: "juan-treasurer",
    name: "Juan Dela Cruz",
    role: "Treasurer",
    address: "GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1",
    avatar: "👨‍💻",
    color: "blue",
  },
  {
    id: "chloe-secretary",
    name: "Chloe Lim",
    role: "Secretary",
    address: "GC4X9K1M3P5R7T9V1X3Z5B7D9F1H3J5L7N9P1R3T5V7X9Z1B3D5F7H9J",
    avatar: "👩‍🔬",
    color: "purple",
  },
  {
    id: "daniel-auditor",
    name: "Daniel Tan",
    role: "Auditor",
    address: "GA9P1R3T5V7X9Z1B3D5F7H9J1L3N5P7R9T1V3X5Z7B9D1F3H5J7L9N1P",
    avatar: "🧑‍⚖️",
    color: "amber",
  },
  {
    id: "alex-partner",
    name: "Alex Rivera",
    role: "Lead Partner",
    address: "GBLX7N2P4R6T8V0X2Z4B6D8F0H2J4L6N8P0R2T4V6X8Z0B2D4F6H8J0L",
    avatar: "👨‍💼",
    color: "indigo",
  },
  {
    id: "samira-cfo",
    name: "Samira Patel",
    role: "CFO",
    address: "GCSM8P0R2T4V6X8Z0B2D4F6H8J0L2N4P6R8T0V2X4Z6B8D0F2H4J6L8N",
    avatar: "👩‍💻",
    color: "rose",
  },
  {
    id: "external-supplier",
    name: "Grand Hall Venue Supplier",
    role: "External Recipient",
    address: "GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1",
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
