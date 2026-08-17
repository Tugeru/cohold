//! Contract source of truth: `contracts/cohold/src/lib.rs` (Rust crate).
//! The Inspector reads the file at request time via `GET /api/contract-source`;
//! there is no embedded string copy to keep in sync.

export const CONTRACT_SECURITY_INVARIANTS = [
  {
    id: "INV-1",
    name: "Zero Unilateral Withdrawals",
    rule: "Funds can leave the treasury ONLY through a valid approved proposal with cryptographic threshold consensus.",
    status: "Enforced",
  },
  {
    id: "INV-2",
    name: "Strict One-Member One-Vote",
    rule: "One member can count as only one approval per proposal. Duplicate approvals are strictly rejected.",
    status: "Enforced",
  },
  {
    id: "INV-3",
    name: "Threshold Precondition",
    rule: "A proposal cannot execute before the required threshold of approvals is satisfied.",
    status: "Enforced",
  },
  {
    id: "INV-4",
    name: "Immutable Proposal Terms",
    rule: "Proposal amount, recipient, and parameters cannot change after creation.",
    status: "Enforced",
  },
  {
    id: "INV-5",
    name: "Double-Execution Prevention",
    rule: "An executed proposal can NEVER be executed again (prevent double-spend attacks).",
    status: "Enforced",
  },
  {
    id: "INV-6",
    name: "Solvency & Asset Conservation",
    rule: "A proposal cannot transfer more than the available treasury balance.",
    status: "Enforced",
  },
  {
    id: "INV-7",
    name: "Member Authorization Boundary",
    rule: "Only verified members may create proposals, contribute, or approve.",
    status: "Enforced",
  },
  {
    id: "INV-8",
    name: "Immutable Creator Constraints",
    rule: "The creator receives no unilateral backdoors and cannot bypass group consensus rules.",
    status: "Enforced",
  },
];
