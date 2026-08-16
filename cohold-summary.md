# Cohold — Product, Use Cases & User Flows

Shared funds. Shared control.

This document is the single overview of what Cohold is, who it is for, how people use it, and how the product actually works. It covers the product in two registers (technical and layman), then the use cases, roles, journeys, scenario flows, edge cases, and demo path.

**Sources:** `docs/cohold-prd.md`, `docs/cohold-srs.md`, `docs/cohold-ui-ux-spec.md`, current `src/` implementation, and the `nextjs-mvp-frontend-foundation` OpenSpec change.

---

## 1. What Cohold is

Cohold is a shared-treasury product. A group puts money in one place, agrees how many people must approve a spend, and can only move money out through a proposal that meets that threshold.

The core rule:

> **Funds may leave a treasury only through a valid proposal that satisfies the treasury’s approval threshold.**

The MVP runs on **Stellar Testnet** with test/demo assets. It does not move real Philippine pesos and does not integrate GCash, banks, cards, or other fiat rails.

Cohold is most useful when four things are true at once:

- shared ownership
- meaningful money
- multiple decision-makers
- a need for accountability

---

## 2. Layman’s version

Imagine a group piggy bank that nobody can raid alone.

A barkada planning a trip, a student org paying for a venue, three business partners buying a printer, or a barangay committee paying for street lights all have the same problem: the money is shared, but one person usually holds it. That person can spend it, lose it, or just become a bottleneck. Spreadsheets and group chats do not actually stop a withdrawal.

Cohold gives the group a treasury instead of a treasurer-with-the-wallet.

1. Someone creates a treasury and names the members.
2. The group picks a rule such as “3 of 4 officers must approve.”
3. Members put money in.
4. Anyone in the group can propose a payment: who gets paid, how much, and why.
5. Other members review and approve.
6. When enough people have approved, the payment can go out.
7. Until that happens, the money stays put.

The person who created the treasury does not get special spending power afterward. A supplier can receive money without being a member. Nobody needs to understand blockchains, contracts, or wallets beyond “connect, review, confirm.”

In the current product, the money is still demo/test money on Stellar Testnet. The point of the MVP is to prove the governance, not to replace a bank account yet.

---

## 3. Technical version

Cohold is a Next.js 16 App Router application in front of a single Soroban treasury contract on Stellar Testnet.

```text
User
 ↓
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

The contract is authoritative for balances, members, threshold, proposals, approvals, and execution. Optional Postgres/Drizzle metadata and demo fixtures may exist, but they cannot override financial or governance fields. Demo mode may load deterministic fixtures and persona switching; that path is not authoritative for funds or approvals.

**Stack (as implemented):** Next.js 16, React 19, TypeScript, Tailwind 4, Drizzle + `pg`, `@stellar/stellar-sdk`, `@stellar/freighter-api`.

**Domain objects:**

| Object | Meaning |
|---|---|
| Treasury | Shared pot with members, token, threshold, and isolated balance |
| Member | Address allowed to contribute, propose, and approve |
| Contribution | Member deposit into the treasury |
| Proposal | Immutable spend request: amount + recipient + purpose |
| Approval | One member’s signed yes on a pending proposal |
| Threshold | Number of distinct member approvals required |
| Recipient | Address that receives funds on execute; need not be a member |
| Audit / activity | Record of what happened, for display |

**Proposal states:** `pending` → `approved` → `executed`, or `pending` → `cancelled`.

**MVP routes (specified):** `/`, `/overview`, `/treasuries`, `/treasuries/[id]`, `/proposals`, `/proposals/[id]`, `/activity`, `/wallet`. Current code still concentrates a lot of the interactive shell in `src/app/page.tsx` plus client components; the OpenSpec change is the route-level App Router foundation.

**Invariants that matter:**

- creator cannot bypass governance after creation
- membership and threshold are immutable in the MVP
- proposal amount and recipient are immutable after create
- one approval per member
- execute only when approved and balance is sufficient
- execute is one-shot
- competing approved proposals race on remaining balance
- treasuries do not share balances
- a rejected wallet signature changes nothing
- a failed token transfer leaves the proposal unexecuted

---

## 4. Actors and permissions

### 4.1 Product roles

| Role | Can do | Cannot do |
|---|---|---|
| **Treasury creator** | Create the treasury, name members, set threshold | Extra spending power after creation |
| **Treasury member** | Contribute, create proposals, approve, execute when eligible, cancel pending proposals (MVP), read state | Spend without a passing proposal |
| **Payment recipient** | Receive an executed payment | Govern the treasury; membership is not required |
| **Non-member** | Read-only, if they can see the UI | Contribute (MVP), propose, approve, execute |

### 4.2 Demo personas in the current app

From `src/lib/personas.ts`:

| Persona | Role | Typical use |
|---|---|---|
| Maria Santos | President | Student-org creator / approver |
| Juan Dela Cruz | Treasurer | Creates spend proposals |
| Chloe Lim | Secretary | Approver |
| Daniel Tan | Auditor | Approver / oversight |
| Alex Rivera | Lead Partner | Small-business treasury |
| Samira Patel | CFO | Small-business approver |
| Grand Hall Venue Supplier | External recipient | Gets paid; not a member |

Demo mode can switch personas so one person can walk the multi-member flow without four real wallets.

### 4.3 Target user types

**Student organization officer.** Needs event money that officers jointly control. Typical rule: 3-of-4 (President, Treasurer, Secretary, Auditor).

**Small business partner.** Needs project or operating funds that no single partner can spend. Typical rule: 2-of-3.

**Community fund committee member.** Needs donor/resident money spent only with committee consent. Typical rule: 5-of-7.

**Project team member.** Needs a time-boxed budget with a clear remaining balance. Typical rule: 3-of-4.

---

## 5. Use cases

### 5.1 When Cohold is the right product

Use Cohold when a group must hold money together and prove that spending was authorized.

The product is a fit if:

- more than one person should be able to stop a payment
- the group needs a visible remaining balance
- spend requests should be reviewable before money moves
- “who approved this?” must be answerable later

It is a poor fit if one person should have unilateral control, if the group only needs a chat + spreadsheet, or if the MVP’s Testnet/demo asset constraint is a blocker for real pesos.

### 5.2 Primary use cases (MVP)

These are the jobs the product is built to do now.

| ID | Use case | Actor | Outcome |
|---|---|---|---|
| UC-01 | Connect a wallet and confirm Testnet | Any user | Wallet address and network are known; wrong network blocks actions |
| UC-02 | Create a shared treasury | Creator | Treasury exists with members, token, and threshold |
| UC-03 | View treasuries and empty states | Any connected user | User sees their treasuries or a clear “create first treasury” path |
| UC-04 | Contribute funds | Member | Treasury balance increases by the contributed amount |
| UC-05 | Create a spending proposal | Member | A pending, immutable spend request exists |
| UC-06 | Review a proposal | Member or observer | Amount, recipient, purpose, approvals, and remaining votes are visible |
| UC-07 | Approve a proposal | Member who has not already approved | Approval count increments; status becomes approved at threshold |
| UC-08 | Execute an approved payment | Eligible member | Recipient is paid; treasury balance drops; proposal is executed |
| UC-09 | Cancel a pending proposal | Authorized member / proposer (MVP) | Proposal becomes cancelled; no funds move |
| UC-10 | Inspect treasury state | Any viewer | Balance, members, threshold, proposals, contributions, activity |
| UC-11 | Inspect global proposals and activity | Any viewer | Cross-treasury list of proposals and events |
| UC-12 | Switch demo persona / reset demo | Developer or demo operator | Deterministic fixture state for walkthroughs |
| UC-13 | Request test funds (faucet) | Demo / Testnet user | Wallet can pay fees / hold demo assets |

### 5.3 Domain use cases (who the product is for)

These are the real-world situations the same primitives serve. The contract does not special-case them; the UI and demo data do.

#### Student organization event fund

Officers pool org money and pay venues, shirts, food, or transport only after a majority of officers approve. Stops a single treasurer from disbursing the event budget alone.

#### Class or project budget

A class or capstone team holds a shared pot for printing, hosting, or materials. Remaining balance stays visible after each payment.

#### Barkada / trip fund

Friends contribute to a trip or gift. No one person can empty the pot for a side expense.

#### Sports team or club treasury

Team dues sit in one treasury. Equipment or tournament fees require officer approval.

#### Shared household budget

Roommates or family members keep a joint pot for rent-adjacent or household spends with a 2-of-2 or 2-of-3 rule.

#### Community / barangay project fund

A committee holds resident or donor contributions. A large payment (street lights, cleanup, relief goods) needs a supermajority.

#### Nonprofit or cooperative spend

A small nonprofit or coop pays suppliers from a committee-controlled treasury instead of a single signatory.

#### Small-business project budget

Partners fund a specific project (fit-out, equipment, campaign). A 2-of-3 rule means one partner cannot unilaterally pay a vendor.

### 5.4 Landing-page use-case cards

The UX spec calls for these four cards on the public landing page:

- Student Organizations
- Project Teams
- Community Funds
- Small Businesses

---

## 6. Mental model the UI must teach

```text
Treasury
   ↓
holds shared funds

Proposal
   ↓
requests use of those funds

Members
   ↓
review and approve

Approval threshold reached
   ↓
payment becomes executable
```

Users should not need contract storage, RPC, authorization entries, XDR, SAC internals, or ledger sequencing to complete a flow.

Preferred words: treasury, members, proposal, approve, execute, add funds, remaining balance.  
Avoid in primary UX: contract, Soroban, XDR, RPC, ledger, authorization entry.

---

## 7. End-to-end product flow

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

## 8. Core user journeys

These are the product journeys, independent of industry scenario.

### 8.1 First-time user

```text
Landing
 ↓
Connect Wallet
 ↓
Check Network
 ↓
Overview / Empty State
 ↓
Create Treasury
   Step 1 — Treasury name, description, category
   Step 2 — Members
   Step 3 — Governance & review
 ↓
Sign Transaction
 ↓
Confirm on Network
 ↓
Treasury Dashboard
```

Empty-state intent: the user should understand they have no treasury yet and that creating one is the next action.

### 8.2 Add funds

```text
Treasury Detail
 ↓
Add Funds
 ↓
Enter Amount
 ↓
Review
 ↓
Confirm in Wallet
 ↓
Submit
 ↓
Wait for Confirmation
 ↓
Refresh Treasury
 ↓
Updated Balance
```

Required warning: contributed funds go into the shared treasury and leave only through approved proposals.

### 8.3 Create proposal

```text
Treasury Detail
 ↓
Create Proposal
 ↓
Enter Purpose
 ↓
Enter Recipient
 ↓
Enter Amount
 ↓
Review Immutable Details
 ↓
Sign
 ↓
Confirm
 ↓
Proposal Created (Pending)
```

Required warning: amount and recipient cannot be edited later.

### 8.4 Approve proposal

```text
Proposal Detail
 ↓
Review Amount + Recipient
 ↓
Approve
 ↓
Wallet Signature
 ↓
Network Confirmation
 ↓
Refresh Proposal
 ↓
Approval Progress Updates
```

### 8.5 Execute proposal

```text
Threshold Reached
 ↓
Execute Payment
 ↓
Review Exact Payment
 ↓
Confirm
 ↓
Wallet Signature
 ↓
Network Confirmation
 ↓
Proposal Executed
 ↓
Treasury Balance Updated
```

### 8.6 Insufficient approval

```text
Proposal
 ↓
Threshold Not Reached
 ↓
Execution Disabled
 ↓
Show Remaining Approval Count
```

### 8.7 Insufficient treasury balance

```text
Approved Proposal
 ↓
Balance Too Low
 ↓
Execution Blocked
 ↓
Show Required vs Available Amount
```

### 8.8 Cancel pending proposal

```text
Pending Proposal
 ↓
Cancel
 ↓
Confirm
 ↓
Wallet Signature (live) / demo mutation
 ↓
Status = Cancelled
 ↓
No funds moved
```

Only a `pending` proposal can be cancelled. Approved or executed proposals cannot.

### 8.9 Read-only observer

```text
Open Treasury or Proposal
 ↓
Wallet missing, wrong network, or not a member
 ↓
See balances, members, proposal details
 ↓
Mutating actions disabled or hidden
```

### 8.10 Demo operator

```text
Start app in demo mode
 ↓
Shell shows Demo / Testnet simulation
 ↓
Load fixture treasuries and proposals
 ↓
Switch persona (President, Treasurer, …)
 ↓
Walk contribute / propose / approve / execute
 ↓
Reset demo to deterministic start
```

---

## 9. Detailed approval decision tree

```text
Open Proposal
      ↓
Wallet connected?
   /            \
 No             Yes
 ↓               ↓
Connect        Is member?
              /       \
            No        Yes
            ↓          ↓
         Read-only   Already approved?
                    /               \
                  Yes               No
                   ↓                 ↓
              Show status        Approve
                                     ↓
                                Confirmation
                                     ↓
                              Wallet signature
                                     ↓
                               Transaction
                                     ↓
                              Confirmed?
                               /      \
                             No       Yes
                             ↓         ↓
                           Error    Refresh state
                                      ↓
                               Count >= threshold?
                                /            \
                              No             Yes
                              ↓               ↓
                         Still pending    Approved
                                          Execute enabled
                                          (if balance enough)
```

---

## 10. Scenario flows

These are the same primitives applied to the four target contexts.

### 10.1 Student organization

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

**Why this flow exists:** student orgs routinely concentrate money with one treasurer. The 3-of-4 rule makes the event budget a group decision.

### 10.2 Small business

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

**Why this flow exists:** partnerships fail when one partner can spend the pot. The supplier can be paid without being a member.

### 10.3 Community fund

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

**Why this flow exists:** community money needs a higher bar than a 2-person partnership. Supermajority is the product expression of that.

### 10.4 Project budget

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

**Why this flow exists:** project money is finite and time-boxed. The remaining balance after each execution is the main feedback loop.

### 10.5 Other situations that reuse the same flow

These are not separate product features. They are the same create → contribute → propose → approve → execute path with different labels.

| Situation | Typical members | Typical threshold | Typical proposal |
|---|---|---|---|
| Barkada trip | 4–8 friends | 3-of-4 or majority | Van rental, Airbnb, tickets |
| Sports team | Officers + coach | 3-of-4 | Uniforms, league fee |
| Household | 2–3 roommates | 2-of-2 or 2-of-3 | Appliances, deposit |
| Nonprofit / coop | Board or committee | Supermajority | Supplier, relief goods |
| Class fund | Officers + adviser | 3-of-4 | Printing, venue, tokens |

---

## 11. Screen-level flows

### 11.1 Pages

| Page | Job |
|---|---|
| Landing `/` | Explain the product, show use-case cards, start create/connect |
| Overview `/overview` | Balances, pending approvals, recent activity, empty state |
| Treasuries `/treasuries` | List treasuries; open or create |
| Create treasury | 3-step form: treasury → members → governance & review |
| Treasury detail `/treasuries/[id]` | Balance, members, proposals, contributions, audit |
| Proposals `/proposals` | Global list with pending / approved / executed / cancelled filters |
| Proposal detail `/proposals/[id]` | Amount, recipient, progress, approve / execute / cancel |
| Activity `/activity` | Cross-treasury event history |
| Wallet / settings `/wallet` | Address, network badge, demo persona, reset |

### 11.2 Create-treasury steps

1. **Treasury** — name, description, category.
2. **Members** — one or more addresses; no duplicates; creator is typically included.
3. **Governance & review** — threshold vs member count; confirm token/network; sign.

Validation that must fail closed: empty members, duplicate members, threshold `0`, threshold greater than member count.

### 11.3 Proposal detail states

| State | What the user sees |
|---|---|
| Pending, user can approve | Approve action + remaining count |
| Pending, user already approved | Status only; no second approve |
| Pending, not a member | Read-only |
| Approved, balance enough | Execute payment |
| Approved, balance too low | Blocked; required vs available |
| Executed | Amount sent, recipient, remaining treasury balance |
| Cancelled | No payment; historical record |

---

## 12. Acceptance and edge-case scenarios

These are the scenarios the product must get right. They are both test cases and user-visible flows.

### Scenario A — Successful proposal

```text
Members: 4
Threshold: 3
Treasury Balance: 10,000

Proposal: 4,500 → Venue

Member A approves
Member B approves
Member C approves

→ Proposal Approved
→ Execute succeeds
→ Recipient receives 4,500
→ Treasury balance becomes 5,500
```

### Scenario B — Insufficient approvals

```text
Threshold: 3
Approvals: 2

Execute
→ Rejected

Treasury balance unchanged
Proposal remains Pending
```

### Scenario C — Duplicate approval

```text
Member A approves
Member A approves again

→ Second approval rejected
→ Approval count unchanged
```

### Scenario D — Double execution

```text
Approved proposal executes
Same proposal executes again

→ Rejected: already executed
→ Recipient is not paid twice
→ Treasury balance unchanged the second time
```

### Scenario E — Competing approved proposals

```text
Balance: 10,000
Proposal 1 approved for 7,000
Proposal 2 approved for 6,000

First valid execute succeeds
Second execute fails if remaining balance is insufficient
```

### Scenario F — Cross-treasury isolation

```text
Treasury A has 10,000
Treasury B has 2,000

Executing a Treasury A proposal cannot spend Treasury B
```

### Scenario G — Official demo walkthrough

```text
IT Society Event Fund
Members: 4
Approval rule: 3 of 4
Balance: 10,000 demo units

Create: Venue Deposit — 4,500 demo units

Approval 1 ✓
Approval 2 ✓
Attempt Execute → REJECTED: 3 approvals required
Approval 3 ✓ → APPROVED
Execute → 4,500 transferred
Remaining balance 5,500
Execute again → REJECTED: Already executed
```

This one walkthrough covers authorization, governance, state transitions, contract-controlled assets, and financial safety.

### Other closed-door cases

| Scenario | Expected result |
|---|---|
| Empty member list | Reject create |
| Duplicate member | Reject create |
| Threshold = 0 | Reject create |
| Threshold > members | Reject create |
| Zero contribution | Reject |
| Non-member contribution | Reject in MVP |
| Non-member proposal | Reject |
| Zero-value proposal | Reject |
| User rejects wallet signature | No state change |
| Token transfer fails | Proposal remains unexecuted |
| Wrong Stellar network | Block action |
| RPC temporarily unavailable | Show retry / error |
| Membership edit after create | Not allowed in MVP |
| Proposal amount/recipient edit | Not allowed |

Suggested user-facing translations:

| Contract-level error | User should see something like |
|---|---|
| `AlreadyApproved` | You have already approved this proposal. |
| `ThresholdNotReached` | This payment still needs more approvals. |
| `AlreadyExecuted` | This payment has already been sent. |
| `InsufficientBalance` | The treasury does not have enough funds. |
| `NotMember` | Only members of this treasury can do that. |
| `InvalidAmount` | Enter an amount greater than zero. |

---

## 13. Demo data the flows should reuse

Primary treasury (student org):

- IT Society / event fund
- 4 officers
- 3-of-4
- seeded balance and activity

Seeded proposals (UX spec):

| Proposal | Amount | Status |
|---|---|---|
| Venue / event deposit | 4,500 DEMO | Walkthrough target (pending → approved → executed) |
| Second live proposal | — | Pending or approved, to show in-progress UI |
| Cloud Hosting | 800 DEMO | Executed, to show history |

Secondary treasury: small-business or project pot, so the treasuries list and isolation story are visible.

---

## 14. What the current codebase implements

This is the implementation shape as of this overview, not a second product spec.

**App shell:** `src/app/page.tsx` plus `Header`, `Navigation`, and view components (`OverviewView`, `TreasuryList`, `TreasuryDetail`, `GlobalProposalsView`, `GlobalActivityView`, `WalletSettingsView`).

**Mutations:** Next.js route handlers under `src/app/api/`:

- treasuries create / read / contribute
- proposals create / list / approve / cancel / execute
- activity
- stellar faucet and demo reset

**State helpers:** `src/lib/soroban-contract.ts`, `src/lib/stellar.ts`, `src/db/*`, `src/lib/db-seed.ts`, `src/lib/personas.ts`.

**Modes:** demo fixtures can drive the UI; live Stellar/Freighter is the intended production path. Chain state wins when the two disagree.

---

## 15. Out of scope for the MVP

These are real needs, but they are not current use cases:

- real PHP, GCash, banks, cards, or other fiat on/off-ramps
- editable membership or threshold after create
- proposal amendment
- notifications, receipts, audit exports, spending categories
- public read-only transparency pages
- multi-treasury contract instances as a first-class product surface
- neon/Web3 chrome, charts-for-their-own-sake, or raw chain jargon in primary flows

Post-MVP phases in the PRD: better consumer onboarding, fiat funding, dynamic governance, organization features (receipts, reports, notifications, exports), then advanced policies.

---

## 16. One-page map

```text
Who            Student org · Partners · Committee · Project team · Household
Why            Shared money should need shared permission
Object         Treasury (members + threshold + isolated balance)
Action         Contribute → Propose → Approve → Execute
Blockers       Not a member · already approved · under threshold
               insufficient balance · already executed · wrong network
Proof          Activity / audit trail + remaining balance
Authority      Soroban contract on Stellar Testnet
MVP money      Demo / test assets only
```
