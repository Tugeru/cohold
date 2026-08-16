# Cohold — Product Requirements Document (PRD)

**Product:** Cohold  
**Tagline:** *Shared funds. Shared control.*  
**Product Type:** Shared treasury and approval-based spending web application  
**Primary Technology:** Stellar + Soroban smart contracts written in Rust  
**MVP Network:** Stellar Testnet  
**MVP Target:** Demo-ready prototype within approximately five days

---

## 1. What This PRD Is

A **Product Requirements Document (PRD)** defines what a product should solve, who it is for, how users should interact with it, what functionality must be included, and the constraints used to determine whether the product is complete. It focuses on **product behavior and requirements**, while leaving low-level implementation details flexible where appropriate.

This PRD defines the MVP scope and product direction for **Cohold**.

---

## 2. Product Summary

Cohold is a shared treasury platform for groups that handle common funds but do not want one person to have unilateral control over the money. Members contribute assets into a shared treasury governed by a Stellar Soroban smart contract. Spending is performed through proposals, and funds can leave the treasury only after a predefined approval threshold is reached.

Example:

```text
Student Organization Fund
Balance: 50,000 demo units

Members: 5
Approval rule: 3 of 5

Proposal:
Venue Reservation
15,000 demo units

President   ✓
Treasurer   ✓
Auditor     ✓

3 / 3 required
→ Payment authorized
```

The core principle is:

> **Shared money should require shared permission.**

---

## 3. Problem Statement

Groups such as student organizations, project teams, clubs, communities, and small businesses often keep shared money in one person's personal bank account, e-wallet, or wallet.

This creates several problems:

- one person becomes the single point of financial control;
- group funds may be mixed with personal funds;
- spending approvals are often informal or undocumented;
- members have limited visibility into current balances and expenses;
- the treasurer or organizer carries disproportionate responsibility;
- agreed financial rules can still be ignored by whoever controls the account.

Cohold replaces individual custody with **rule-based shared custody**.

---

## 4. Product Vision

Cohold should provide a simple way for groups to:

1. create a shared treasury;
2. define who belongs to the group;
3. define how many approvals are required for spending;
4. contribute funds;
5. propose expenses;
6. review and approve proposals;
7. execute payments only when the agreed approval rule is satisfied.

The application provides the user experience, while Soroban provides the enforceable financial rules.

---

## 5. Goals

### MVP Goals

The MVP must allow users to:

- connect a Stellar Testnet wallet;
- create a treasury;
- define members;
- define an approval threshold;
- contribute funds;
- view the treasury balance;
- create spending proposals;
- approve proposals;
- prevent duplicate approvals;
- execute approved proposals;
- prevent unauthorized or duplicate payments;
- view proposal and treasury state.

### Long-Term Goals

Future versions may support:

- embedded/passkey wallets;
- fiat funding through GCash, bank, or card integrations;
- stable-value assets;
- dynamic membership;
- configurable governance templates;
- receipts and attachments;
- notifications;
- audit reports;
- organization dashboards;
- recurring expenses;
- tiered approval rules;
- public transparency for community funds.

---

## 6. Non-Goals for the MVP

The MVP will **not** include:

- real Philippine peso custody;
- GCash, Maya, bank, or card integration;
- Mainnet deployment;
- KYC;
- embedded wallets;
- dynamic member removal/addition;
- weighted voting;
- recurring bills;
- receipt uploads;
- accounting software features;
- dispute resolution;
- fiat conversion;
- native mobile applications;
- advanced analytics;
- a traditional application backend unless a blocking requirement emerges.

---

## 7. Target Users

### 7.1 Student Organizations

Examples:

- student councils;
- academic organizations;
- clubs;
- event committees.

**Need:** Manage organization funds without giving one officer complete control.

Typical rule:

```text
5 officers
3 approvals required
```

### 7.2 Small Businesses and Partnerships

Examples:

- small partnerships;
- project-based businesses;
- jointly owned ventures.

**Need:** Prevent one owner or partner from spending shared operating or project funds without agreed approval.

Typical rule:

```text
3 partners
2 approvals required
```

### 7.3 Community Funds

Examples:

- neighborhood projects;
- nonprofit initiatives;
- community fundraising committees;
- cooperatives.

**Need:** Make fund usage more transparent and collectively governed.

Typical rule:

```text
7 committee members
5 approvals required
```

### 7.4 Project Teams

Examples:

- capstone teams;
- freelance teams;
- temporary project groups.

**Need:** Separate project funds from personal funds and require group approval for important expenses.

Typical rule:

```text
4 members
3 approvals required
```

---

## 8. Core Use Cases

Cohold can support:

- student organization event funds;
- class or project budgets;
- barkada trip funds;
- sports team funds;
- club treasuries;
- shared household budgets;
- community project funds;
- nonprofit spending;
- small-business project budgets;
- cooperative or committee-controlled funds.

Cohold is most useful when there is:

> **shared ownership + meaningful money + multiple decision-makers + a need for accountability.**

---

## 9. Core User Flow

```text
CREATE TREASURY
      ↓
ADD MEMBERS
      ↓
SET APPROVAL THRESHOLD
      ↓
MEMBERS CONTRIBUTE
      ↓
CREATE SPENDING PROPOSAL
      ↓
MEMBERS REVIEW
      ↓
MEMBERS APPROVE
      ↓
THRESHOLD REACHED?
   /          \
 NO            YES
 ↓              ↓
BLOCKED      AUTHORIZED
                ↓
          EXECUTE PAYMENT
                ↓
        UPDATE TREASURY STATE
```

---

## 10. User Flows by Scenario

### Student Organization

```text
Officers create Cohold treasury
        ↓
Add President, Treasurer, Secretary, Auditor
        ↓
Set 3-of-4 approval rule
        ↓
Organization funds are contributed
        ↓
Treasurer proposes "Venue — 15,000"
        ↓
Officers review
        ↓
3 officers approve
        ↓
Soroban verifies threshold
        ↓
Payment executes
        ↓
Balance and activity update
```

### Small Business

```text
3 partners create project treasury
        ↓
Set 2-of-3 approval rule
        ↓
Partners contribute operating funds
        ↓
Partner proposes "Printer — 18,000"
        ↓
Second partner approves
        ↓
2-of-3 reached
        ↓
Payment executes to supplier
```

### Community Fund

```text
Committee creates treasury
        ↓
Add 7 committee members
        ↓
Set 5-of-7 approval rule
        ↓
Residents/donors contribute
        ↓
Member proposes "Street Lights — 45,000"
        ↓
5 committee members approve
        ↓
Contract authorizes payment
        ↓
Supplier receives funds
```

### Project Budget

```text
Project team creates treasury
        ↓
Add 4 members
        ↓
Set 3-of-4 approval rule
        ↓
Members contribute project funds
        ↓
Member proposes "Hosting — 3,000"
        ↓
3 members approve
        ↓
Payment executes
        ↓
Remaining project balance updates
```

---

## 11. Treasury Model

Each treasury should contain:

| Field | Description |
|---|---|
| Treasury ID | Unique identifier |
| Creator | Address that created the treasury |
| Token | Asset used by the treasury |
| Members | Authorized member addresses |
| Approval Threshold | Required number of approvals |
| Balance | Current contract-controlled funds |
| Status | Active/Closed where supported |

For the MVP, **membership and threshold become immutable after creation**.

---

## 12. Proposal Model

Each spending proposal should contain:

| Field | Description |
|---|---|
| Proposal ID | Unique proposal identifier |
| Treasury ID | Associated treasury |
| Proposer | Member who created it |
| Recipient | Payment destination |
| Amount | Amount to transfer |
| Description | Human-readable purpose |
| Approval Count | Number of unique approvals |
| Status | Pending, Approved, Executed, or Cancelled |

Proposal amount and recipient must be immutable after creation.

---

## 13. Proposal Lifecycle

```text
PENDING
   │
   ├── enough approvals
   ▼
APPROVED
   │
   ▼
EXECUTED
```

Optional cancellation:

```text
PENDING
   ↓
CANCELLED
```

Suggested Rust representation:

```rust
enum ProposalStatus {
    Pending,
    Approved,
    Executed,
    Cancelled,
}
```

---

## 14. Functional Requirements

### FR-1 — Create Treasury

A user must be able to create a treasury with:

- token/asset;
- member addresses;
- approval threshold.

Validation:

- at least one member;
- no duplicate members;
- threshold greater than zero;
- threshold not greater than member count.

### FR-2 — Contribute

A member must be able to contribute an amount greater than zero.

The contribution is transferred into the Soroban-controlled treasury.

### FR-3 — Create Proposal

A member must be able to create a proposal specifying:

- recipient;
- amount;
- description/purpose.

### FR-4 — Approve Proposal

A member must be able to approve a pending proposal.

The contract must:

- verify membership;
- require authorization;
- reject duplicate approvals;
- increment approval count.

### FR-5 — Approve at Threshold

When the required approval threshold is reached:

```text
Pending → Approved
```

### FR-6 — Execute Proposal

An approved proposal may be executed only when:

- the threshold has been reached;
- the proposal has not already executed;
- treasury balance is sufficient.

Execution transfers the configured amount to the configured recipient.

### FR-7 — Prevent Double Execution

An executed proposal must never be executable again.

### FR-8 — Read State

The frontend must be able to retrieve:

- treasury configuration;
- balance;
- membership;
- proposal data;
- approval status.

---

## 15. Authorization and Permissions

### Creator

Can:

- create the treasury.

Does **not** receive special spending authority after creation.

### Member

Can:

- contribute;
- create proposals;
- approve proposals;
- view treasury state.

Cannot:

- directly withdraw treasury funds;
- approve twice;
- change another member's approval;
- bypass the threshold.

### Recipient

Can receive funds from an executed proposal.

The recipient does not need to be a treasury member.

---

## 16. Smart Contract Flow

### Layman's Version

The contract acts like a digital treasurer that follows the group's rules exactly.

```text
Someone asks to spend money
        ↓
Contract checks the proposal
        ↓
Enough members approved?
        ↓
Enough money available?
        ↓
Already paid?
        ↓
If all checks pass:
Send money
```

### Technical Version

```text
create_treasury()
      ↓
contribute()
      ↓
create_proposal()
      ↓
approve()
      ↓
approval_count >= threshold
      ↓
proposal = Approved
      ↓
execute()
      ↓
validate state + balance
      ↓
token transfer
      ↓
proposal = Executed
```

Soroban authorization should use authenticated member addresses, such as `require_auth()` where appropriate.

---

## 17. Suggested Smart Contract Interface

Conceptually:

```text
create_treasury()
contribute()

create_proposal()
approve()
execute()

cancel_proposal()       # optional

get_treasury()
is_member()
get_proposal()
has_approved()
get_contribution_total()
```

---

## 18. Suggested On-Chain Data Structures

Illustrative only:

```rust
struct Treasury {
    id: u64,
    creator: Address,
    token: Address,
    threshold: u32,
    member_count: u32,
}
```

```rust
struct Proposal {
    id: u64,
    treasury_id: u64,
    proposer: Address,
    recipient: Address,
    amount: i128,
    approval_count: u32,
    status: ProposalStatus,
}
```

Suggested keyed state:

```text
Member(treasury_id, address) → bool
Approval(treasury_id, proposal_id, address) → bool
Contribution(treasury_id, address) → amount
Proposal(treasury_id, proposal_id) → Proposal
```

---

## 19. Financial Model

For the MVP, Cohold uses **Stellar Testnet assets only**.

No real Philippine pesos are used.

Conceptually:

```text
Members
   ↓
Stellar Testnet asset
   ↓
Cohold Soroban contract
   ↓
Approved proposal
   ↓
Recipient
```

In a future production version, a fiat on/off-ramp could allow users to see and fund balances through familiar payment methods such as GCash or bank transfer while the contract controls an on-chain asset underneath.

---

## 20. Critical Security Invariants

1. **Funds can leave the treasury only through a valid approved proposal.**
2. One member can count as only one approval per proposal.
3. A proposal cannot execute before the threshold is reached.
4. Proposal amount and recipient cannot change after creation.
5. A proposal cannot execute more than once.
6. A proposal cannot transfer more than the available treasury balance.
7. Only authorized members may create or approve proposals.
8. The creator cannot bypass the governance rule.
9. Contract accounting must not create, lose, or duplicate assets.

---

## 21. Important Edge Cases

| Scenario | Expected Result |
|---|---|
| Empty member list | Reject |
| Duplicate member | Reject |
| Threshold = 0 | Reject |
| Threshold > members | Reject |
| Zero contribution | Reject |
| Non-member contribution | Reject for MVP |
| Non-member proposal | Reject |
| Zero-value proposal | Reject |
| Duplicate approval | Reject |
| Threshold not reached | Execution blocked |
| Approved but insufficient balance | Execution blocked |
| Execute twice | Reject |
| User rejects wallet signature | No state change |
| Token transfer fails | Proposal remains unexecuted |
| Wrong Stellar network | Block action |
| RPC temporarily unavailable | Show retry/error |
| Two proposals compete for the same funds | First valid execution succeeds; later execution fails if balance is insufficient |

---

## 22. Technical Architecture

```text
React + Vite + TypeScript
          │
          ▼
      Freighter
          │
          ▼
Generated Soroban Client
          │
          ▼
     Stellar RPC
          │
          ▼
Rust / Soroban Cohold Contract
          │
          ▼
Stellar Asset Contract / Test Token
          │
          ▼
     Stellar Testnet
```

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- react-hook-form
- Zod
- `@hookform/resolvers`
- Sonner
- Lucide React

### Stellar Integration

- `@stellar/stellar-sdk`
- `@stellar/freighter-api`
- generated TypeScript contract client
- Freighter wallet

### Smart Contract

- Rust
- `soroban-sdk`
- Soroban authorization
- token interface/client
- contract storage
- explicit contract errors
- contract events
- Soroban test utilities

### Traditional Backend

**None for MVP.**

A future backend may support:

- profiles;
- images;
- notifications;
- receipts;
- search;
- analytics;
- audit reports.

It must not be able to bypass Soroban governance rules.

---

## 23. MVP Screens

### Landing

```text
Cohold

Shared funds. Shared control.

Create a treasury where spending
requires group approval.

[Create Treasury]
```

### Create Treasury

- treasury name;
- member addresses;
- approval threshold.

### Treasury Dashboard

- balance;
- member count;
- threshold;
- contribution action;
- active proposals.

### Create Proposal

- description;
- amount;
- recipient.

### Proposal Detail

- amount;
- recipient;
- proposer;
- member approvals;
- current threshold progress;
- approve/execute action.

---

## 24. Contract Testing Requirements

Minimum tests:

- valid treasury creation;
- invalid thresholds;
- duplicate members;
- member contribution;
- unauthorized contribution;
- member proposal creation;
- unauthorized proposal;
- valid approval;
- duplicate approval rejection;
- below-threshold execution rejection;
- exact-threshold approval;
- valid execution;
- correct recipient and amount;
- treasury balance reduction;
- insufficient balance rejection;
- double execution rejection;
- creator cannot bypass governance;
- financial asset conservation.

Contract correctness has priority over frontend unit-test coverage for the MVP.

---

## 25. MVP Acceptance Criteria

The MVP is complete when:

### Treasury

- a Testnet wallet can create a valid treasury;
- membership and threshold are stored on-chain;
- funds can be contributed;
- no direct unilateral withdrawal exists.

### Proposals

- members can create proposals;
- members can approve once;
- approval progress is accurate;
- below-threshold execution fails;
- threshold-approved execution succeeds;
- payment goes to the exact recipient;
- the same proposal cannot execute twice.

### UI

Users can clearly understand:

- treasury balance;
- membership;
- approval requirement;
- proposal amount;
- recipient;
- approval progress;
- execution status.

---

## 26. Demo Scenario

Use a simple student-organization example:

```text
IT Society Event Fund

Members: 4
Approval rule: 3 of 4
Balance: 10,000 demo units
```

Create:

```text
Venue Deposit
4,500 demo units
```

Demo:

```text
Approval 1 ✓
Approval 2 ✓

Attempt Execute
→ REJECTED: 3 approvals required

Approval 3 ✓
→ APPROVED

Execute
→ 4,500 transferred

Remaining balance
5,500

Execute again
→ REJECTED: Already executed
```

This demonstrates authorization, governance, state transitions, contract-controlled assets, and financial safety in one short flow.

---

## 27. Key Risks

### User Onboarding

Freighter and Testnet are acceptable for the MVP but unsuitable for mainstream users.

**Future mitigation:** embedded wallets, passkeys, sponsored fees.

### Fiat Funding

Ordinary groups generally use GCash, banks, or cash rather than crypto.

**Future mitigation:** regulated fiat on/off-ramp integrations and stable-value assets.

### Long-Term Treasury Security

Persistent organizational funds create higher security requirements than one-time transactions.

**Future mitigation:** contract audits, recovery mechanisms, stronger governance, limits, and Mainnet hardening.

### Governance Deadlock

If required members become unavailable, money may become difficult to move.

**Future mitigation:** configurable recovery and membership-change proposals.

---

## 28. Post-MVP Roadmap

### Phase 2 — Better Consumer Onboarding

- embedded wallets;
- passkeys;
- sponsored transaction fees.

### Phase 3 — Fiat Funding

- stable-value assets;
- GCash/bank/card on-ramp through supported providers.

### Phase 4 — Dynamic Governance

- add/remove members;
- change approval threshold;
- governance changes through proposals.

### Phase 5 — Organization Features

- receipts;
- activity reports;
- notifications;
- audit exports;
- read-only public transparency;
- spending categories.

### Phase 6 — Advanced Policies

Examples:

```text
≤ 5,000
2 approvals

5,001–50,000
3 approvals

> 50,000
4 approvals
```

Potential templates:

- Student Organization
- Small Business
- Project Budget
- Community Fund
- Trip Fund

---

## 29. Product Success Criteria

For the MVP, success means users can complete the full governance loop:

```text
CREATE
→ FUND
→ PROPOSE
→ APPROVE
→ REACH THRESHOLD
→ EXECUTE
```

while the contract reliably rejects:

```text
UNAUTHORIZED
UNDER-APPROVED
DUPLICATE
OVER-BALANCE
```

transactions.

The most important product requirement is:

> **At no point should one person be able to spend shared treasury funds outside the rules accepted by the group.**

---

## 30. Core Product Thesis

**Cohold is a programmable shared treasury for groups that need collective control over common funds.** Members contribute assets into a Stellar Soroban smart contract, spending is represented as transparent proposals, and funds can leave the treasury only when the predefined approval threshold is satisfied. The MVP focuses on student organizations, project teams, community groups, and small partnerships, using Stellar Testnet and a simple web interface to demonstrate shared custody, threshold approval, and contract-controlled payments. It deliberately excludes real fiat integration, dynamic governance, advanced accounting, and other functionality so the core product—**shared funds governed by shared permission**—can be implemented, tested, and presented reliably within the available development window.
