# Cohold — Software Requirements Specification (SRS)

**Product:** Cohold  
**Document:** Software Requirements Specification  
**Version:** 1.0  
**Status:** MVP Draft  
**Related Document:** `cohold-prd.md`  
**Target Network:** Stellar Testnet  
**Primary Contract Platform:** Stellar Soroban  
**Primary Smart Contract Language:** Rust

---

## 1. Purpose of This SRS

A **Software Requirements Specification (SRS)** defines the exact functional, technical, interface, security, data, and quality requirements that the software must satisfy. It translates the product goals in the Cohold PRD into implementation-ready and testable requirements.

This document specifies the MVP behavior of **Cohold**, a shared treasury application where group funds are controlled by a Stellar Soroban smart contract and may be spent only when a predefined approval threshold is satisfied.

---

## 2. Product Scope

Cohold allows a group to:

1. create a shared treasury;
2. define treasury members;
3. define how many approvals are required for spending;
4. contribute funds into the treasury;
5. create spending proposals;
6. approve proposals;
7. execute approved payments; and
8. view treasury and proposal state.

The core system rule is:

> **Funds may leave a treasury only through a valid proposal that satisfies the treasury's approval threshold.**

The MVP operates on **Stellar Testnet only** and uses test/demo assets. It does not process real Philippine pesos or integrate GCash, banks, cards, or other fiat payment rails.

---

## 3. Intended Users

### 3.1 Treasury Creator

The user who creates a treasury and defines its initial members and approval threshold.

For the MVP, the Creator:
- must also be a treasury member;
- receives no special spending privilege after creation.

### 3.2 Treasury Member

A Stellar address included in the treasury membership set.

Members may:
- contribute funds;
- create spending proposals;
- approve proposals;
- view treasury state.

### 3.3 Payment Recipient

The Stellar address that receives funds from an executed proposal.

The recipient does not need to be a treasury member.

---

## 4. Definitions

| Term | Definition |
|---|---|
| Treasury | A contract-governed pool of shared assets |
| Member | An address authorized to participate in treasury governance |
| Creator | Member who initializes the treasury |
| Contribution | Assets transferred by a member into the treasury |
| Proposal | Request to transfer treasury funds to a recipient |
| Approval | One member's authorization of a proposal |
| Threshold | Minimum number of unique approvals required |
| Recipient | Address that receives an approved payment |
| Soroban | Stellar smart contract platform |
| Freighter | Stellar wallet used by the MVP |
| Testnet | Stellar's non-production network |
| SAC | Stellar Asset Contract |
| Demo Asset | Non-production asset used for MVP transactions |

---

## 5. System Overview

### 5.1 High-Level Architecture

```text
User
 ↓

=======
Next.js App Router
 ↓
Freighter Wallet
 ↓
Stellar SDK / typed contract client
 ↓
Stellar RPC
 ↓
Cohold Soroban contract (one treasury per instance)
 ↓
Stellar Asset Contract / Test Token
 ↓
Stellar Testnet
```

Demo mode may use fixture adapters and a local database. Those paths are not authoritative for funds or approvals.

### 5.2 Component Responsibilities

#### Frontend

Responsible for:
- forms;
- wallet connection;
- treasury and proposal views;
- transaction feedback;
- client-side validation;
- user-readable errors;
- demo vs wallet mode labeling.

#### Wallet Layer

Responsible for:
- identifying the connected Stellar address;
- signing Soroban transactions;
- confirming network selection.

#### Soroban Contract

Authoritative for:
- treasury configuration;
- membership;
- internal treasury balances;
- contributions;
- proposals;
- approvals;
- proposal state;
- payment execution.

#### Token Contract / SAC

Responsible for:
- on-chain asset transfers into and out of the Cohold contract.

---

## 6. Operating Environment

### Client

- Modern browser
- JavaScript enabled
- Internet connection
- Freighter wallet installed for MVP signing

### Development

- Rust
- Cargo
- `soroban-sdk`
- Stellar CLI
- Node.js
- npm
- React
- TypeScript
- Next.js App Router

### Network

- Stellar Testnet
- Stellar RPC endpoint
- deployed Cohold contract (wallet mode)

- configured Testnet asset/token contract

---

## 7. MVP Constraints

The MVP shall use the following fixed constraints:

- Stellar Testnet only
- Freighter for wallet interaction
- Stellar address as user identity
- Creator must be included as a member
- Membership is immutable after treasury creation
- Approval threshold is immutable after treasury creation
- All members have equal voting weight
- Creating a proposal counts as the proposer's approval

- Approved proposals may be executed permissionlessly
- Individual contribution withdrawal is not supported
- Treasury funds may move only through approved proposals
- No traditional backend is required for authoritative state
- Wallet mode operates on one or more env-configured contract IDs; each instance is one treasury
- On-chain Create Treasury from the wallet app is deferred
- No real PHP, GCash, Maya, card, or bank integration
- No Mainnet deployment
- No KYC
- No dynamic governance
- No recurring payments
- No receipt management

---

# 8. Functional Requirements

## 8.1 Wallet and Network

### FR-WAL-001
The system shall allow a user to connect a Freighter wallet.

### FR-WAL-002
The system shall retrieve and display the connected public Stellar address.

### FR-WAL-003
The system shall detect whether a wallet is disconnected.

### FR-WAL-004
The system shall prevent state-changing actions when the wallet is not connected to the configured Stellar Testnet network.

### FR-WAL-005
The system shall request wallet authorization for all transactions requiring user authentication.

### FR-WAL-006
If the user rejects a wallet signature request, the application shall report the cancellation and shall not display the transaction as successful.

### FR-WAL-007
After a confirmed transaction, the application shall reload authoritative contract state.

---

## 8.2 Treasury Creation

### FR-TRS-001
The system shall allow a connected user to create a treasury.

### FR-TRS-002
Treasury creation shall require:
- token address;
- member addresses;
- approval threshold.

### FR-TRS-003
The Creator shall be included in the treasury member set.

### FR-TRS-004
The contract shall reject an empty member set.

### FR-TRS-005
The contract shall reject duplicate member addresses.

### FR-TRS-006
The approval threshold shall be greater than zero.

### FR-TRS-007
The approval threshold shall not exceed the number of members.

### FR-TRS-008
Treasury membership shall not be editable after creation in the MVP.

### FR-TRS-009
The treasury approval threshold shall not be editable after creation in the MVP.

---

## 8.3 Membership

### FR-MEM-001
The contract shall maintain authoritative membership for each treasury.

### FR-MEM-002
The system shall be able to determine whether a given address is a member of a treasury.

### FR-MEM-003
A non-member shall not be allowed to create or approve a treasury proposal.

### FR-MEM-004
A treasury creator shall not gain special spending authority solely because they created the treasury.

---

## 8.4 Contributions

### FR-CON-001
A treasury member shall be able to contribute a positive token amount to a treasury.

### FR-CON-002
The contract shall reject zero or negative contribution amounts.

### FR-CON-003
The contributing member shall authorize the contribution.

### FR-CON-004
The token transfer shall complete successfully before contribution accounting is finalized.

### FR-CON-005
If the token transfer fails, no treasury balance or contribution state shall be committed.

### FR-CON-006
The contract shall update the corresponding treasury's internal balance after a successful contribution.

### FR-CON-007
The contract may record each member's cumulative contribution for transparency.

### FR-CON-008
A member shall not have a unilateral right to withdraw their previous contribution in the MVP.

---

## 8.5 Treasury Balance Isolation

### FR-BAL-001
The contract shall maintain an independent internal balance for each treasury.

### FR-BAL-002
A treasury shall not spend assets accounted to another treasury.

### FR-BAL-003
Proposal execution shall validate against the target treasury's internal balance, not the Cohold contract's aggregate token balance.

### FR-BAL-004
A treasury balance shall never become negative.

This requirement is mandatory even when several treasuries use the same deployed Cohold contract and token.

---

## 8.6 Proposal Creation

### FR-PRO-001
A treasury member shall be able to create a spending proposal.

### FR-PRO-002
A proposal shall contain at minimum:
- treasury ID;
- proposer;
- recipient;
- amount;
- approval count;
- status.

### FR-PRO-003
A proposal amount shall be greater than zero.

### FR-PRO-004
A proposal shall have a valid recipient address.

### FR-PRO-005
A newly created proposal shall have status `Pending`.

### FR-PRO-006
Proposal amount and recipient shall be immutable after creation.

### FR-PRO-007
Proposal identifiers shall be unique within the treasury.

### FR-PRO-008
The system shall reject proposal creation by a non-member.

---

## 8.7 Proposal Approval

### FR-APR-001
A member shall be able to approve a `Pending` proposal.

### FR-APR-002
Approval shall require authorization from the approving member.

### FR-APR-003
A member shall be able to approve a specific proposal at most once.

### FR-APR-004
A non-member shall not be able to approve a proposal.

### FR-APR-005
Each valid approval shall increment the approval count exactly once.

### FR-APR-006
The proposer may approve their own proposal.

### FR-APR-007
When the number of unique approvals becomes greater than or equal to the treasury threshold, the proposal shall transition from `Pending` to `Approved`.

### FR-APR-008
Approvals shall remain associated with the exact proposal amount and recipient that members reviewed.

---

## 8.8 Proposal Execution

### FR-EXE-001
An `Approved` proposal shall be eligible for execution.

### FR-EXE-002
A `Pending` proposal shall not execute.

### FR-EXE-003
Execution shall be permissionless once the proposal is approved.

### FR-EXE-004
The contract shall verify that the proposal has not previously executed.

### FR-EXE-005
The contract shall verify that the treasury has sufficient internal balance.

### FR-EXE-006
Execution shall transfer the exact proposal amount to the exact proposal recipient.

### FR-EXE-007
After successful transfer, the treasury's internal balance shall decrease by the exact proposal amount.

### FR-EXE-008
After successful transfer, the proposal status shall become `Executed`.

### FR-EXE-009
An `Executed` proposal shall not execute again.

### FR-EXE-010
If the treasury balance is insufficient, execution shall fail without changing the proposal to `Executed`.

### FR-EXE-011
An approved proposal whose treasury later becomes underfunded shall remain approved but unexecuted until sufficient balance exists.

---

## 8.9 Proposal Cancellation

Proposal cancellation is optional for the MVP.

If implemented:

### FR-CAN-001
Only the proposer may cancel their own proposal.

### FR-CAN-002
Only a `Pending` proposal may be cancelled.

### FR-CAN-003
An `Approved` or `Executed` proposal shall not be cancellable by one member.

If cancellation is not implemented, invalid or obsolete pending proposals may remain visible but inactive.

---

## 8.10 Read Operations

The application shall be able to retrieve:

### FR-READ-001
Treasury configuration.

### FR-READ-002
Treasury internal balance.

### FR-READ-003
Treasury membership.

### FR-READ-004
Proposal data.

### FR-READ-005
Proposal status.

### FR-READ-006
Whether a member has approved a proposal.

### FR-READ-007
Member contribution totals where tracked.

Possible contract queries include:

```text
get_treasury()
get_treasury_balance()
is_member()
get_proposal()
has_approved()
get_contribution_total()
```

---

# 9. Smart Contract Requirements

## 9.1 Suggested Contract Types

Illustrative structures:

```rust
struct Treasury {
    id: u64,
    creator: Address,
    token: Address,
    threshold: u32,
    member_count: u32,
    balance: i128,
}
```

```rust
enum ProposalStatus {
    Pending,
    Approved,
    Executed,
    Cancelled,
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

Suggested keyed storage:

```text
Treasury(treasury_id)
Member(treasury_id, address)
Contribution(treasury_id, address)
Proposal(treasury_id, proposal_id)
Approval(treasury_id, proposal_id, address)
```

Exact storage representation remains an implementation decision as long as all SRS requirements are satisfied.

---

## 9.2 Suggested Contract Interface

```text
create_treasury()
contribute()

create_proposal()
approve()
execute()

cancel_proposal()     # optional

get_treasury()
get_treasury_balance()
is_member()
get_proposal()
has_approved()
get_contribution_total()
```

---

## 9.3 Authorization Requirements

### SCR-AUTH-001
Treasury creation shall require authorization from the Creator.

### SCR-AUTH-002
Contribution shall require authorization from the contributing member.

### SCR-AUTH-003
Proposal creation shall require authorization from the proposer.

### SCR-AUTH-004
Proposal approval shall require authorization from the approving member.

### SCR-AUTH-005
One address shall not be able to submit authorization on behalf of another member.

Soroban-native authorization such as `require_auth()` shall be used where appropriate.

---

## 9.4 Proposal State Transitions

Legal transitions:

```text
Pending
   ↓ threshold reached
Approved
   ↓ valid execution
Executed
```

Optional:

```text
Pending
   ↓ proposer cancellation
Cancelled
```

Illegal transitions include:

```text
Executed → Pending
Executed → Approved
Executed → Cancelled
Cancelled → Approved
Cancelled → Executed
```

---

## 9.5 Financial Invariants

The implementation shall preserve all of the following:

### INV-001
Treasury assets may leave a treasury only through valid proposal execution.

### INV-002
A proposal shall execute at most once.

### INV-003
Each member contributes at most one approval per proposal.

### INV-004
The executed transfer amount shall exactly equal the proposal amount.

### INV-005
The executed recipient shall exactly equal the proposal recipient.

### INV-006
A treasury balance shall never become negative.

### INV-007
A treasury shall never spend another treasury's accounted balance.

### INV-008
The contract shall not create, duplicate, or silently lose accounted token value.

### INV-009
The aggregate accounting for a given token shall remain consistent with assets held and valid transfers executed by the contract.

---

# 10. External Interface Requirements

## 10.1 User Interface

The MVP shall include:

1. Landing page
2. Create Treasury view
3. Treasury Dashboard
4. Add Funds flow
5. Create Proposal view
6. Proposal Detail view

### Treasury Dashboard shall display:
- treasury identity/name where stored;
- current balance;
- member count;
- approval threshold;
- active proposals;
- executed proposals where available.

### Proposal Detail shall display:
- proposal amount;
- recipient;
- proposer;
- approval count;
- required threshold;
- proposal status;
- current user's approval status.

---

## 10.2 Wallet Interface

The application shall:

- connect through Freighter;
- retrieve public wallet address;
- request transaction signatures;
- detect wrong network;
- never request or store wallet private keys or recovery phrases.

---

## 10.3 Stellar Interface

Configuration shall centralize:

```text
NETWORK
RPC_URL
NETWORK_PASSPHRASE
COHOLD_CONTRACT_ID
TOKEN_CONTRACT_ID
```

The application shall not hardcode deployment-specific values throughout UI components.

---

## 10.4 Token Interface

The Cohold contract shall interact with a supported Soroban token/SAC-compatible asset.

Financial values shall use integer/base-unit arithmetic.

The frontend shall not use floating-point arithmetic for authoritative financial calculations.

---

# 11. Data Requirements

## 11.1 Authoritative On-Chain Data

The following shall be contract-authoritative:

- treasury ID;
- creator address;
- member addresses;
- token address;
- approval threshold;
- treasury internal balance;
- contribution totals where tracked;
- proposal ID;
- proposer;
- recipient;
- proposal amount;
- approval count;
- member approvals;
- proposal status.

## 11.2 Persistent Metadata

Because the MVP has no traditional backend, any metadata that must survive reloads must either:

- be stored on-chain; or
- be deterministically derived from on-chain data.

Treasury names and proposal descriptions may be stored on-chain if needed for the MVP user experience.

---

# 12. Error Handling

Suggested contract errors:

```text
TreasuryNotFound
InvalidThreshold
DuplicateMember
NotMember
InvalidAmount
ProposalNotFound
AlreadyApproved
ProposalNotPending
ThresholdNotReached
AlreadyExecuted
InsufficientBalance
InvalidRecipient
```

The frontend shall convert contract-level errors into understandable messages.

Example:

```text
AlreadyApproved
```

shall display similar to:

> You have already approved this proposal.

Raw contract host errors should not be the primary user-facing error state.

---

# 13. Non-Functional Requirements

## 13.1 Security

### NFR-SEC-001
Cohold shall never store wallet private keys.

### NFR-SEC-002
All security-critical rules shall be enforced by the Soroban contract, not only by the frontend.

### NFR-SEC-003
The contract shall prevent duplicate approvals.

### NFR-SEC-004
The contract shall prevent double execution.

### NFR-SEC-005
Treasury accounting shall isolate funds between separate treasuries.

### NFR-SEC-006
Proposal amount and recipient shall remain immutable after proposal creation.

---

## 13.2 Reliability

### NFR-REL-001
The UI shall not display a state-changing transaction as successful until the transaction is confirmed.

### NFR-REL-002
After confirmed transactions, the frontend shall reload authoritative contract state.

### NFR-REL-003
Failed contract operations shall not produce partially committed financial state.

---

## 13.3 Usability

### NFR-USA-001
The interface shall minimize blockchain-specific terminology.

### NFR-USA-002
Financial actions shall clearly display amount and recipient before authorization.

### NFR-USA-003
Approval progress shall be clearly visible.

### NFR-USA-004
Wrong-network and wallet errors shall use human-readable messages.

### NFR-USA-005
The UI shall clearly identify Testnet/demo funds.

---

## 13.4 Accessibility

The frontend should:

- provide semantic labels;
- support keyboard interaction;
- maintain readable contrast;
- remain responsive on common desktop and mobile widths;
- not communicate status through color alone.

---

## 13.5 Maintainability

The implementation should separate:

- UI logic;
- wallet/network integration;
- generated contract-client usage;
- contract types;
- contract storage;
- contract errors;
- contract events;
- tests.

Rust contract logic should remain modular and explicitly typed.

---

# 14. Testing Requirements

Contract testing is mandatory and has priority over frontend unit-test coverage.

At minimum, automated tests shall verify:

1. valid treasury creation;
2. invalid threshold rejection;
3. duplicate member rejection;
4. creator membership;
5. valid contribution;
6. unauthorized contribution rejection;
7. independent treasury balance accounting;
8. valid proposal creation;
9. non-member proposal rejection;
10. valid approval;
11. duplicate approval rejection;
12. non-member approval rejection;
13. exact-threshold state transition;
14. below-threshold execution rejection;
15. successful execution;
16. exact recipient transfer;
17. exact amount transfer;
18. correct treasury balance reduction;
19. insufficient balance rejection;
20. double execution rejection;
21. creator cannot bypass governance;
22. one treasury cannot spend another treasury's balance;
23. financial asset-conservation invariants.

Frontend integration/manual tests should verify:

- wallet connection;
- wrong-network handling;
- rejected signature handling;
- state refresh after transaction;
- readable contract errors;
- loading and success states.

---

# 15. Acceptance Scenarios

## Scenario A — Successful Proposal

```text
Members: 4
Threshold: 3
Treasury Balance: 10,000

Proposal:
4,500 → Venue

Member A approves
Member B approves
Member C approves

→ Proposal Approved
→ Execute succeeds
→ Recipient receives 4,500
→ Treasury balance becomes 5,500
```

---

## Scenario B — Insufficient Approvals

```text
Threshold: 3
Approvals: 2

Execute
→ Rejected

Treasury balance unchanged
Proposal remains Pending
```

---

## Scenario C — Duplicate Approval

```text
Member A approves
Member A approves again

→ Second approval rejected
→ Approval count unchanged
```

---

## Scenario D — Double Execution

```text
Approved proposal executes once
Execute called again

→ Rejected
→ Recipient does not receive second payment
```

---

## Scenario E — Competing Approved Proposals

```text
Treasury Balance: 10,000

Proposal A: 8,000 Approved
Proposal B: 6,000 Approved

Execute A
→ Balance = 2,000

Execute B
→ Rejected: Insufficient balance
```

---

## Scenario F — Cross-Treasury Isolation

```text
Treasury A Balance: 10,000
Treasury B Balance: 20,000

Treasury A Proposal:
12,000

→ Execution rejected

The contract's total physical token balance
must not allow Treasury A to consume
Treasury B's accounted funds.
```

---

# 16. Deployment and Configuration

## Smart Contract

- Build Rust contract to Wasm
- Deploy with Stellar CLI
- Target Stellar Testnet
- Record deployed contract ID

## Frontend

Recommended:
- Vercel
- Cloudflare Pages
- Netlify

No wallet secrets shall exist in frontend environment variables.

---

# 17. Assumptions and Dependencies

The MVP assumes:

- Stellar Testnet is operational;
- configured RPC is reachable;
- Freighter is installed by demo users;
- users possess suitable Testnet funds;
- the configured test asset/token is available;
- the Cohold contract is deployed;
- browser wallet signing is functional.

External Testnet or wallet outages are environmental dependencies, not necessarily Cohold application defects.

---

# 18. Explicit MVP Exclusions

The system is not required to support:

- real money;
- PHP settlement;
- GCash;
- Maya;
- bank transfers;
- cards;
- Mainnet;
- KYC;
- embedded wallets;
- dynamic membership;
- threshold updates;
- individual contribution withdrawal;
- weighted voting;
- recurring expenses;
- accounting reports;
- receipt uploads;
- dispute resolution;
- traditional application backend services.

---

# 19. Requirements Traceability Summary

| Product Capability | Primary Requirements |
|---|---|
| Connect wallet | FR-WAL |
| Create treasury | FR-TRS |
| Enforce membership | FR-MEM |
| Add funds | FR-CON |
| Isolate treasury balances | FR-BAL |
| Create proposals | FR-PRO |
| Approve spending | FR-APR |
| Execute payments | FR-EXE |
| Read treasury state | FR-READ |
| Enforce authorization | SCR-AUTH |
| Protect funds | INV / NFR-SEC |
| Handle wallet/network states | NFR-REL / NFR-USA |

---

# 20. Definition of Done

The Cohold MVP is complete when a user can successfully perform the following end-to-end flow on Stellar Testnet:

```text
CREATE TREASURY
      ↓
ADD MEMBERS + THRESHOLD
      ↓
CONTRIBUTE FUNDS
      ↓
CREATE PROPOSAL
      ↓
MEMBERS APPROVE
      ↓
THRESHOLD REACHED
      ↓
EXECUTE PAYMENT
      ↓
VERIFY BALANCE + RECIPIENT
```

The system must also correctly reject:

```text
NON-MEMBER ACTIONS
DUPLICATE APPROVALS
UNDER-APPROVED EXECUTION
INSUFFICIENT BALANCE
DOUBLE EXECUTION
CROSS-TREASURY SPENDING
```

The most important requirement is:

> **No individual user, including the treasury creator, can move shared funds outside the governance rules enforced by the Soroban contract.**
