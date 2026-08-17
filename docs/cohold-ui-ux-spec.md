# Cohold — UI/UX Design Specification

**Product:** Cohold  
**Document:** UI/UX Design Specification  
**Version:** 1.0  
**Status:** MVP Draft  
**Related Documents:** `cohold-prd.md`, `cohold-srs.md`  
**Target Platform:** Responsive Web Application  
**MVP Network:** Stellar Testnet

---

## 1. Purpose of This Document

This **UI/UX Design Specification** defines how users should experience Cohold across its pages, flows, components, interaction states, responsive layouts, and visual system.

It complements the PRD and SRS:

```text
PRD
What are we building and why?
        ↓
SRS
How must the software behave?
        ↓
UI/UX Specification
How should users experience that behavior?
        ↓
Implementation
```

The UI/UX specification does not override business rules, smart-contract requirements, or security constraints defined in the SRS.

---

## 2. Product Experience Vision

Cohold should feel like a **modern fintech and collaborative SaaS product** for groups that manage shared money.

The experience should be:

- trustworthy;
- calm;
- clear;
- financially transparent;
- collaborative;
- professional but approachable;
- understandable to non-technical users;
- usable without knowledge of Stellar or Soroban.

The interface should reinforce Cohold's core message:

> **Shared funds. Shared control.**

Cohold should not look or feel like a stereotypical cryptocurrency application. Blockchain should remain primarily a trust and settlement layer behind a familiar financial interface.

### Avoid

- neon Web3 styling;
- floating coin imagery;
- excessive gradients;
- cyberpunk visuals;
- overly dense enterprise dashboards;
- unnecessary charts;
- raw blockchain terminology in primary workflows;
- decorative complexity that distracts from financial actions.

---

## 3. Core UX Principles

### UX-01 — Financial Clarity First

Users should always be able to determine:

- how much money is involved;
- which treasury owns the funds;
- who will receive a proposed payment;
- how many approvals are required;
- whether a transaction has actually completed.

### UX-02 — Governance Must Be Visible

Approval rules and proposal state should never be hidden.

```text
Approval rule: 3 of 4 members
Current approvals: 2 of 3 required
You approved: Yes / No
```

### UX-03 — Blockchain Stays Behind the Interface

Prefer:

> Waiting for transaction confirmation.

Avoid:

> Polling Soroban RPC.

Technical details may appear only in secondary developer/debug contexts.

### UX-04 — Financial Actions Are Deliberate

Contributions and payment execution must show the relevant amount, asset, treasury, and recipient before wallet authorization.

### UX-05 — State Is Always Obvious

The UI must clearly distinguish:

- Pending;
- Awaiting Approval;
- Approved;
- Ready to Execute;
- Executed;
- Failed;
- Insufficient Balance.

### UX-06 — Mobile Is a First-Class Experience

Mobile layouts must be intentionally designed rather than being compressed desktop layouts.

---

## 4. User Types

### 4.1 Student Organization Officer

Primary needs:

- understand current organization funds;
- create and review spending proposals;
- see officer approvals;
- maintain accountability.

### 4.2 Small Business Partner

Primary needs:

- see shared operating/project funds;
- review significant expenses;
- verify recipient and amount;
- prevent unilateral spending.

### 4.3 Community Fund Committee Member

Primary needs:

- view shared fund balance;
- participate in transparent approvals;
- understand how money is being used.

### 4.4 Project Team Member

Primary needs:

- contribute project funds;
- request expenses;
- approve team spending;
- view remaining budget.

---

## 5. Core User Mental Model

The interface should teach the following model:

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

Users should not need to understand contract storage, RPC, authorization entries, XDR, SAC internals, or ledger sequencing.

---

## 6. Information Architecture

```text
Cohold
│
├── Overview
├── Treasuries
│   ├── Treasury Detail
│   │   ├── Overview
│   │   ├── Proposals
│   │   ├── Members
│   │   └── Activity
│   └── Create Treasury
├── Proposals
│   ├── Needs My Approval
│   ├── Pending
│   ├── Approved
│   └── Executed
├── Activity
└── Wallet / Settings
```

Navigation should remain shallow. The most common depth should be:

```text
Overview
→ Treasury
→ Proposal
```

---

## 7. Navigation

### 7.1 Desktop

Use a persistent left sidebar.

```text
Cohold

Overview
Treasuries
Proposals
Activity

────────────

Wallet
Settings
```

The top header should support:

- page title;
- current treasury context where applicable;
- network badge;
- connected wallet;
- contextual primary action.

### 7.2 Tablet

- sidebar may collapse;
- secondary panels move below primary content;
- multi-column layouts reduce to one or two columns.

### 7.3 Mobile

Recommended primary navigation:

```text
Home
Treasuries
Proposals
Activity
```

Use bottom navigation or a compact mobile navigation pattern. Wallet and settings should be available from the top bar or profile menu.

---

## 8. Core User Journeys

### 8.1 First-Time User

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
 ↓
Add Members
 ↓
Set Approval Threshold
 ↓
Review
 ↓
Sign Transaction
 ↓
Confirm on Network
 ↓
Treasury Dashboard
```

### 8.2 Add Funds

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

### 8.3 Create Proposal

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
Proposal Created
```

### 8.4 Approve Proposal

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

### 8.5 Execute Proposal

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

### 8.6 Insufficient Approval

```text
Proposal
 ↓
Threshold Not Reached
 ↓
Execution Disabled
 ↓
Show Remaining Approval Count
```

### 8.7 Insufficient Treasury Balance

```text
Approved Proposal
 ↓
Balance Too Low
 ↓
Execution Blocked
 ↓
Show Required vs Available Amount
```

---

## 9. Detailed Approval Flow

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
```

---

## 10. Page Inventory

### Public
1. Landing Page

### Application
2. Overview / Dashboard  
3. Treasuries  
4. Create Treasury  
5. Treasury Detail  
6. Add Funds Flow  
7. Proposals  
8. Create Proposal  
9. Proposal Detail  
10. Activity  
11. Wallet / Settings

Add Funds and transaction confirmations may use dialogs or sheets instead of dedicated routes.

---

# 11. Page Specifications

## 11.1 Landing Page


**Purpose:** Explain Cohold clearly and encourage the user to explore a treasury or try the demo.

### Primary Message

```text
Cohold

Shared funds.
Shared control.
```

Supporting copy should explain that shared money can be governed collectively instead of sitting under one person's unilateral control.

### Primary Actions


Mode-dependent:

- **Demo mode:** Create Treasury, View Demo; persona switching and a demo
  reset restore the canonical fixture dataset without touching Testnet.
- **Wallet mode:** Connect wallet, Open the configured Testnet treasury;
  fixture personas and synthetic success paths are unavailable.

Do not present wallet-mode Create Treasury as a working on-chain action in this MVP slice.


### Required Sections

- Hero
- How Cohold Works
- Use Cases
- Governance / Trust explanation

### Use-Case Cards

- Student Organizations
- Project Teams
- Community Funds
- Small Businesses

### Responsive Behavior

Desktop may use split hero content and a supporting product visual. Mobile should stack content and keep the primary CTA prominent.

---

## 11.2 Overview / Dashboard

**Purpose:** Provide an actionable summary of the user's Cohold activity.

### Primary Cards

```text
Total Treasury Balance
Active Treasuries
Needs My Approval
Recently Executed
```

### Main Sections

- Treasuries
- Needs My Approval
- Recent Activity

### Primary Action

**Create Treasury**

Actionable content, especially proposals needing approval, should receive higher priority than passive statistics.

### Empty State

```text
No treasuries yet.

Create a shared treasury to start
managing funds together.

[Create Treasury]
```

---

## 11.3 Treasuries Page

**Purpose:** Show all treasuries available to the connected user.

### Treasury Card Content

- treasury name;
- balance;
- asset;
- member count;
- approval rule;
- pending proposal count.

Example:

```text
IT Society Event Fund

10,000 DEMO

4 members
3 of 4 approvals

2 pending proposals
```

### Required States

- loading;
- normal;
- empty;
- error.

Desktop may use a card grid. Mobile should use a single-column card list.

---

## 11.4 Create Treasury

**Purpose:** Guide the user through treasury setup without overwhelming them.

### Step 1 — Treasury

- Name
- Optional description
- Configured asset

### Step 2 — Members

- Creator address
- Additional Stellar addresses
- Member count

### Step 3 — Governance & Review

- approval threshold;
- member summary;
- asset;
- network;
- final confirmation.

Example:

```text
Treasury
IT Society Event Fund

Members
4

Approval Rule
3 of 4

Network
Stellar Testnet
```

Required explanatory copy:

> At least 3 of the 4 members must approve before treasury funds can be spent.

### Validation

Show inline errors for duplicate members, invalid Stellar addresses, invalid thresholds, and missing required values.

---

## 11.5 Treasury Detail

**Purpose:** Provide a complete view of one treasury and its current financial/governance state.

### Information Hierarchy

Primary:
- Treasury name
- Available balance

Secondary:
- Add Funds
- Create Proposal

Governance:
- member count;
- approval rule.

Operational:
- pending proposals;
- member preview;
- recent activity.

### Suggested Desktop Layout

```text
Treasury Header

┌────────────────┐ ┌────────────────┐
│ Balance        │ │ Governance     │
│ 10,000 DEMO    │ │ 3 of 4        │
└────────────────┘ └────────────────┘

[Add Funds] [Create Proposal]

Pending Proposals

Members

Recent Activity
```

### Mobile Layout

Use a single column with balance and governance visible near the top. A sticky action region may contain:

```text
[Add Funds] [New Proposal]
```

---

## 11.6 Add Funds Flow

**Purpose:** Allow a member to contribute assets safely.

### Required Information

- Treasury name
- Current treasury balance
- Connected wallet balance where available
- Contribution amount
- Asset
- Resulting treasury balance preview

### Required Warning

> Funds added to this treasury become shared treasury funds and cannot be individually withdrawn in the MVP.

### Transaction States

```text
Enter Amount
 ↓
Review
 ↓
Awaiting Wallet Signature
 ↓
Submitting
 ↓
Confirming
 ↓
Confirmed / Failed
```

---

## 11.7 Create Proposal

**Purpose:** Create a request to spend treasury funds.

### Required Fields

- proposal title/purpose;
- recipient Stellar address;
- amount.

### Supporting Information

- treasury balance;
- approval rule;
- member count.

### Required Warning

> The proposal amount and recipient cannot be changed after submission.

### Automatic Proposer Approval

Creating a proposal counts as the proposer's approval. After submission the
proposal shows the proposer as already approved, and approval progress starts
at 1 of N required.

### Review Summary

```text
Venue Reservation

Recipient
GABC...4XYZ

Amount
4,500 DEMO

Approval Rule
3 of 4 members
```

---

## 11.8 Proposal Detail

**Purpose:** Make proposal review, approval, and execution easy to understand.

### Primary Information

- title;
- amount;
- recipient;
- proposer;
- status;
- approval progress.

### Approval Progress

The proposer's approval is recorded automatically at creation, so a new
proposal already shows the proposer checked and 1 of N required.

```text
2 of 3 approvals

Andy       ✓ Approved
Maria      ✓ Approved
John       Awaiting
Anne       Awaiting
```

Before approval:

```text
[Approve Proposal]
```

After approval:

```text
✓ You approved this proposal
```

### Ready-to-Execute State

```text
✓ Approval threshold reached

This proposal is ready to execute.

[Execute Payment]
```

### Executed State

```text
✓ Executed

4,500 DEMO sent to GABC...4XYZ
```

### Insufficient Balance State

```text
Approved, but not executable

Required: 4,500 DEMO
Available: 2,000 DEMO
```

---

## 11.9 Proposals Page

**Purpose:** Provide a consolidated proposal view across treasuries.

### Filters / Tabs

- Needs My Approval
- Pending
- Approved
- Executed

Each list item should show:
- proposal title;
- treasury;
- amount;
- approval progress;
- status;
- relevant action.

**Needs My Approval** should be the most prominent actionable view.

---

## 11.10 Activity Page

**Purpose:** Provide a readable audit-style history.

Examples:

```text
Maria approved "Venue Deposit"
2 minutes ago

Andy contributed 2,000 DEMO
1 hour ago

"Cloud Hosting" executed
800 DEMO → GABC...92FK
Yesterday
```

Optional filters:
- Treasury
- Contributions
- Proposals
- Approvals
- Payments

---

## 11.11 Wallet / Settings

**Purpose:** Provide wallet/network context without making blockchain configuration central to the product.

Display:
- connected address;
- network;
- wallet status;
- disconnect action;
- Testnet indicator.

The application shall never request or display private keys or recovery phrases.

---

# 12. Component Architecture

### Application Shell

```text
AppShell
├── AppSidebar
├── AppHeader
├── MobileNavigation
└── PageContainer
```

### Wallet

```text
WalletButton
WalletAddress
WalletStatus
NetworkBadge
```

### Treasury

```text
TreasuryCard
TreasuryHeader
TreasuryBalanceCard
GovernanceSummary
TreasuryActions
TreasuryList
```

### Proposal

```text
ProposalCard
ProposalList
ProposalTable
ProposalStatusBadge
ApprovalProgress
ApprovalMemberList
ProposalActionBar
```

### Members

```text
MemberAvatar
MemberList
MemberAddress
MemberStatus
```

### Forms

```text
CreateTreasuryForm
MemberAddressInput
ThresholdSelector
ContributionForm
CreateProposalForm
```

### Transactions

```text
TransactionDialog
TransactionSummary
TransactionProgress
TransactionSuccess
TransactionError
ConfirmationDialog
```

### Shared States

```text
EmptyState
ErrorState
LoadingSkeleton
StatusBadge
```

---

# 13. Component States

Important interactive components should account for:

- default;
- hover;
- focus;
- pressed;
- disabled;
- loading;
- success;
- error.

Example:

```text
Approve Proposal

Default
[Approve Proposal]

Awaiting Wallet
[Confirm in Freighter…]

Confirming
[Confirming…]

Success
[✓ Approved]

Already Approved
[✓ You Approved]
```

Disabled states should include an explanation where useful.

---

# 14. Financial Interaction UX

Before any financial action, show exact context.

```text
Execute Payment?

4,500 DEMO

From
IT Society Event Fund

To
GABC...4XYZ

Approval
3 of 3 reached

[Cancel] [Execute Payment]
```

Users must not need to navigate elsewhere to verify the amount or recipient immediately before execution.

---

# 15. Wallet and Transaction UX

Use one shared lifecycle:

```text
Idle
 ↓
Preparing
 ↓
Awaiting Signature
 ↓
Submitted
 ↓
Confirming
 ↓
Confirmed
```

Failure branches:

```text
Cancelled
Failed
```

Wallet signing does **not** equal transaction success. The UI shall not show a financial action as successful until network confirmation is received.

### Recommended Copy

**Awaiting Signature**

> Confirm this transaction in Freighter.

**Submitted**

> Transaction submitted. Waiting for network confirmation…

**Confirmed**

> Transaction confirmed.

**Cancelled**

> Transaction cancelled. No changes were made.

---

# 16. Empty States

### No Treasuries

```text
No treasuries yet.

Create a shared treasury to start
managing funds together.

[Create Treasury]
```

### No Proposals

```text
No spending proposals yet.

When your group needs to use treasury funds,
create a proposal for members to review.

[Create Proposal]
```

### No Pending Approvals

```text
You're all caught up.

No proposals currently need your approval.
```

---

# 17. Loading States

Use skeletons for page-level loading rather than generic full-screen spinners.

Recommended skeletons:
- TreasuryCard
- BalanceCard
- ProposalCard
- ActivityItem

Transaction operations should show descriptive states:
- Preparing transaction
- Waiting for wallet confirmation
- Submitting
- Confirming
- Refreshing treasury state

---

# 18. Error UX

Technical errors must be translated into product language.

```text
AlreadyApproved
→
You have already approved this proposal.
```

```text
InsufficientBalance
→
This treasury does not currently have enough funds to execute this proposal.
```

```text
NotMember
→
Only treasury members can perform this action.
```

```text
Wrong Network
→
Cohold is currently running on Stellar Testnet. Switch your wallet to Testnet to continue.
```

Raw host errors should never be the primary user-facing message.

---

# 19. Responsive Design

## Desktop

Use:
- persistent sidebar;
- top header;
- multi-column sections where useful;
- tables for dense proposal/activity views.

## Tablet

Use:
- collapsible sidebar;
- one- or two-column content;
- stacked secondary panels;
- reduced visual density.

## Mobile

Use:
- single-column layout;
- mobile navigation;
- card-based lists;
- sticky primary actions where useful;
- full-width dialogs/sheets for financial confirmations.

Avoid required horizontal scrolling for core workflows.

### Table Transformation

Desktop:

```text
Proposal | Amount | Approvals | Status | Action
```

Mobile:

```text
┌────────────────────────┐
│ Venue Deposit          │
│ 4,500 DEMO             │
│                        │
│ 2 of 3 approvals       │
│ Awaiting approval      │
│                        │
│ [Review]               │
└────────────────────────┘
```

---

# 20. Mobile Financial UX

For Treasury Detail:

```text
IT Society Event Fund

10,000 DEMO
Available Balance

3 of 4 approvals required

Pending Proposals
...

────────────────────
[Add Funds] [Proposal]
```

Payment confirmations should use a full-width modal or bottom sheet where amount and recipient remain visible.

---

# 21. Visual Design Direction

### Style

**Modern fintech + collaborative SaaS**

Use:
- clean typography;
- generous spacing;
- subtle borders;
- moderate radius;
- restrained shadows;
- clear numerical hierarchy.

### Typography Roles

```text
Display
Page Title
Section Heading
Body
Caption
Financial Number
```

Balances and proposal amounts should receive strong visual emphasis.

### Surfaces

Prefer neutral surfaces, subtle card separation, consistent borders, and restrained elevation.

### Color

Use semantic roles:

```text
Primary
Neutral
Success
Warning
Danger
Pending
```

Do not communicate state through color alone.

### Icons

Use Lucide icons consistently. Icons should support meaning rather than decorate every element.

---

# 22. Lightweight Design Tokens

Recommended initial scale:

```text
Spacing
4
8
12
16
24
32
48

Radius
sm
md
lg

Semantic States
neutral
primary
success
warning
danger
pending
```

Exact implementation values may be defined through Tailwind/shadcn theme variables.

---

# 23. Content and Terminology

### Use

- Treasury
- Member
- Proposal
- Approval
- Recipient
- Approval Rule
- Add Funds
- Execute Payment
- Available Balance

### Avoid in Primary UX

- multisig;
- XDR;
- ScVal;
- contract invocation;
- auth entry;
- RPC;
- SAC;
- ledger.

### Tone

Copy should be concise, calm, clear, and direct.

Avoid:

> Transaction invocation failed.

Prefer:

> The payment could not be completed. Treasury funds were not changed.

---

# 24. Accessibility

The interface should support:

- semantic HTML;
- keyboard navigation;
- visible focus indicators;
- properly labeled form fields;
- accessible dialogs and sheets;
- sufficient contrast;
- readable validation messages;
- screen-reader-friendly status updates;
- status indicators that do not rely only on color;
- appropriate mobile touch targets.

Financial confirmation dialogs should preserve logical keyboard focus.

---

# 25. Demo Data

Use a consistent dataset across the application.

## Primary Treasury

```text
IT Society Event Fund

Balance
10,000 DEMO

Members
Andy
Maria
John
Anne

Approval Rule
3 of 4
```

### Proposal 1

```text
Venue Deposit
4,500 DEMO
2 of 3 required approvals
Pending
```

### Proposal 2

```text
Printing Materials
1,200 DEMO
3 of 3 approvals
Approved
```

### Proposal 3

```text
Cloud Hosting
800 DEMO
Executed
```

## Secondary Treasury

```text
Capstone Project Fund
```

This data should remain consistent across cards, detail pages, activity, and proposal views.

---

# 26. UX Acceptance Criteria

### UX-AC-001
A first-time user shall be able to understand Cohold's core purpose from the landing page without knowledge of Stellar or Soroban.

### UX-AC-002
A member shall be able to identify treasury balance and approval threshold from Treasury Detail without navigating elsewhere.

### UX-AC-003
A member shall be able to determine whether they personally approved a proposal.

### UX-AC-004
Before payment execution, the exact amount, treasury, asset, and recipient shall be visible.

### UX-AC-005
The UI shall distinguish wallet signing, transaction submission, confirmation, cancellation, and failure.

### UX-AC-006
All core workflows shall remain usable on mobile without required horizontal scrolling.

### UX-AC-007
Technical contract errors shall be translated into actionable user-facing messages.

### UX-AC-008
Users shall be able to identify whether a proposal is Pending, Approved, Executed, or blocked by insufficient balance.

### UX-AC-009
The interface shall clearly indicate that the MVP uses Stellar Testnet/demo assets.

### UX-AC-010
The treasury creator shall not be visually represented as having unilateral spending authority.

---

# 27. Product Rules the UI Must Respect

1. Treasury funds require the configured approval threshold before spending.
2. Each member may approve a proposal only once.
3. Proposal amount and recipient are immutable after creation.
4. Proposal creators may approve their own proposals.
5. Approved proposals may be executed by any caller.
6. Executed proposals cannot execute again.
7. Approved proposals cannot execute without sufficient treasury balance.
8. Contributions become treasury funds and cannot be individually withdrawn in the MVP.
9. Membership is fixed after treasury creation.
10. Approval threshold is fixed after treasury creation.
11. The creator has no unilateral spending privilege.
12. The MVP uses Testnet/demo funds only.

---

# 28. Explicit UX Boundaries

The MVP does not require UI or UX flows for:

- GCash;
- Maya;
- bank transfers;
- cards;
- fiat conversion;
- KYC;
- Mainnet;
- embedded wallets;
- dynamic membership;
- changing approval thresholds;
- individual contribution withdrawal;
- weighted governance;
- recurring expenses;
- receipt uploads;
- dispute resolution;
- enterprise accounting;
- advanced audit reporting.

Do not design or implement screens for excluded functionality unless product scope is formally updated.

---

# 29. Recommended Frontend Component Stack

The UI implementation should use:

- React
- TypeScript
- Next.js App Router
- Tailwind CSS
- shadcn/ui
- Lucide React
- React Hook Form
- Zod
- `@hookform/resolvers`
- Sonner

The component architecture should remain compatible with later integration of:

- `@stellar/stellar-sdk`
- `@stellar/freighter-api`
- generated Soroban TypeScript contract clients.

---

# 30. Definition of UX Completion

The Cohold MVP user experience is complete when a user can clearly and confidently complete:

```text
CONNECT
→ CREATE TREASURY
→ FUND
→ CREATE PROPOSAL
→ REVIEW
→ APPROVE
→ REACH THRESHOLD
→ EXECUTE
→ VERIFY RESULT
```

while also understanding:

```text
WHO controls the treasury
HOW MUCH money is available
WHAT is being proposed
WHO receives the payment
HOW MANY approvals are required
WHETHER the current user approved
WHETHER the payment actually executed
```

The final interface should make Cohold feel like a credible shared-finance product rather than a blockchain demo, while preserving the financial and governance rules enforced by the Soroban contract.
