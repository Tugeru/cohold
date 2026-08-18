# Cohold — MVP Readiness & Acceptance Guide

**Product:** Cohold  
**Version:** 1.0  
**Target Network:** Stellar Testnet  
**Related:** `cohold-prd.md`, `cohold-srs.md`, `cohold-ui-ux-spec.md`

## 1. Purpose

This guide defines the minimum functionality, user flows, authentication behavior, and acceptance conditions Cohold must satisfy before it can be considered to have reached its MVP state.

> **Shared funds. Shared control.**

The MVP must prove that a group can create a shared treasury, add funds, create spending proposals, approve them collectively, and execute payments only after the configured approval threshold is reached.

## 2. Authentication Model

Cohold does not use email/password or social login in the MVP.

```text
Open Cohold
→ Connect Freighter
→ Read public Stellar address
→ Verify Stellar Testnet
→ Wallet address becomes user identity
→ Read treasuries available to that address
```

Authentication has three layers:

```text
Identity
Freighter public address
        ↓
Authentication
User signs an action in Freighter
        ↓
Authorization
Soroban verifies whether that address
may perform the requested action
```

The MVP must:

- connect through Freighter;
- retrieve the connected public address;
- verify Stellar Testnet;
- block state-changing actions while disconnected or on the wrong network;
- request wallet signatures for authenticated operations;
- never request or store private keys or recovery phrases.

## 3. Required MVP Capabilities

The MVP must support:

- connect wallet;
- detect Testnet;
- create a treasury in demo mode;
- open configured wallet-mode treasuries;
- define members and approval thresholds in demo mode;
- contribute Testnet/demo assets;
- view treasury balance;
- create proposal;
- approve proposal;
- track approval progress;
- execute approved proposal;
- prevent duplicate approvals;
- prevent unauthorized approvals;
- prevent under-threshold execution;
- prevent insufficient-balance execution;
- prevent double execution;
- read treasury/proposal state;
- show relevant activity/history.

## 4. First-Time User Flow

Wallet mode:

```text
Landing
→ Connect Wallet
→ Freighter Permission
→ Verify Testnet
→ Open Configured Treasury
→ Dashboard
```

If demo mode has no treasury:

```text
No demo treasuries yet.
[Create Treasury]
```
If the wallet is on the wrong network:

```text
Cohold runs on Stellar Testnet.
Switch to Testnet to continue.
```

## 5. Treasury Creation

Demo mode must allow a user to create a fixture treasury with:

- treasury name;
- member Stellar addresses;
- approval threshold;
- configured demo asset.

Wallet-mode on-chain Create Treasury is deferred in this MVP; wallet mode
opens configured Testnet treasury contracts instead.

Example:

```text
IT Society Event Fund

Members:
Andy
Maria
John
Anne

Approval Rule:
3 of 4
```

Flow:

```text
Create Treasury (demo mode)
→ Enter Details
→ Add Members
→ Set Threshold
→ Review
→ Fixture Treasury Created
→ Treasury Detail
```

Rules:

- creator is also a member;
- creator has no unilateral spending authority;
- membership is fixed after creation;
- threshold is fixed after creation;
- members have equal approval weight.

## 6. Add Funds

A member must be able to contribute Testnet/demo assets.

```text
Treasury Detail
→ Add Funds
→ Enter Amount
→ Review
→ Sign
→ Token Transfer
→ Treasury Balance Updates
```

Once contributed, the assets become shared treasury funds and cannot be individually withdrawn in the MVP.

## 7. Create Proposal

A member must be able to create a spending proposal containing:

- purpose/title;
- recipient Stellar address;
- amount.

Example:

```text
Venue Reservation
4,500 DEMO
Recipient: GXYZ...72PM
```

Flow:

```text
Treasury
→ Create Proposal
→ Enter Purpose
→ Enter Recipient
→ Enter Amount
→ Review
→ Sign
→ Proposal Created
```

Rules:

- only members may create proposals;
- amount must be greater than zero;
- recipient must be valid;
- proposal starts as Pending (creating it records the proposer's approval
  as #1, so a 1-of-1 threshold proposal is Approved immediately);
- amount and recipient are immutable after creation.

## 8. Approval Flow

For a 3-of-4 treasury (creation records the proposer's approval as #1):

```text
1 / 3
→ 2 / 3
→ 3 / 3
→ Approved
```

Interaction:

```text
Open Proposal
→ Review Amount + Recipient
→ Approve
→ Sign in Freighter
→ Soroban Checks Authorization
→ Approval Recorded
→ Refresh Progress
```

The contract must verify that:

- caller is a member;
- caller authorized the action;
- caller has not already approved;
- proposal is eligible for approval.

The proposer may approve their own proposal. Each member may approve only once.

## 9. Execute Proposal

When the threshold is reached:

```text
3 of 3 approvals
✓ Ready to Execute
```

Before payment, show the exact treasury, amount, and recipient.

Execution flow:

```text
Execute
→ Check Proposal
→ Check Threshold
→ Check Not Already Executed
→ Check Treasury Balance
→ Transfer Exact Amount
→ Mark Executed
→ Update Treasury Balance
```

Example:

```text
Treasury:
10,000 → 5,500 DEMO

Recipient:
+4,500 DEMO
```

Execution may be permissionless after approval. The caller may trigger execution but cannot change the amount, recipient, or approvals.

## 10. Required Blocked Flows

The MVP must reject:

### Insufficient Approvals

```text
Threshold: 3
Approvals: 2
Execute → BLOCKED
```

### Duplicate Approval

```text
Member already approved
Approve again → BLOCKED
```

### Non-Member Approval

```text
Unknown wallet
Approve → BLOCKED
```

### Insufficient Balance

```text
Proposal: 4,500 DEMO
Available: 2,000 DEMO
Execute → BLOCKED
```

### Double Execution

```text
Proposal already executed
Execute again → BLOCKED
```

### Wrong Network

```text
Wallet not on Testnet
State-changing action → BLOCKED
```

## 11. Dashboard

After wallet connection, the dashboard should show:

- accessible treasuries;
- relevant balances;
- proposals requiring the user's approval;
- recent executed proposals;
- recent activity.

Example:

```text
Total Treasury Balance: 15,500 DEMO
Active Treasuries: 2
Needs My Approval: 2
```

## 12. Activity / Transparency

The MVP should expose useful activity such as:

```text
Andy contributed 2,000 DEMO
Maria approved Venue Deposit
John approved Venue Deposit
Venue Deposit reached its threshold
Venue Deposit executed
4,500 DEMO → GXYZ...72PM
```

This is a lightweight transparency view, not a full accounting system.

## 13. Transaction UX

Use a consistent lifecycle:

```text
Preparing
→ Awaiting Wallet Signature
→ Submitted
→ Confirming
→ Confirmed
```

Failure states:

```text
Cancelled
Failed
```

**Wallet signing is not transaction success.** Success must only be shown after confirmation.

## 14. User-Facing Errors

Translate technical errors into plain language:

```text
AlreadyApproved
→ You have already approved this proposal.

NotMember
→ Only treasury members can perform this action.

InsufficientBalance
→ This treasury does not have enough funds to execute this proposal.

Wrong Network
→ Switch your wallet to Stellar Testnet to continue.
```

Raw contract/host errors should not be the main user-facing message.

## 15. Security and Financial Rules

The MVP must preserve:

1. Funds leave only through an approved proposal.
2. One member may approve each proposal only once.
3. A proposal cannot execute before its threshold is reached.
4. Proposal amount and recipient cannot change after creation.
5. An executed proposal cannot execute again.
6. A treasury cannot spend more than its available balance.
7. One treasury cannot spend another treasury's accounted funds.
8. The creator cannot bypass governance.
9. Contributed funds cannot be individually withdrawn.
10. Cohold never stores wallet private keys.

## 16. Explicit MVP Exclusions

The MVP does not require:

- email/password authentication;
- Google login;
- real PHP;
- GCash or Maya;
- bank or card payments;
- Mainnet;
- KYC;
- embedded wallets;
- dynamic membership;
- threshold changes;
- individual withdrawals;
- weighted voting;
- recurring payments;
- receipts;
- dispute resolution;
- advanced accounting.

## 17. Canonical Demo Scenario

```text
Treasury:
IT Society Event Fund

Members:
Andy
Maria
John
Anne

Approval Rule:
3 of 4

Balance:
10,000 DEMO
```

Create:

```text
Venue Deposit
4,500 DEMO
```

Verify:

```text
Approval 1 ✓
Approval 2 ✓

Attempt Execute
→ REJECTED
→ 3 approvals required

Approval 3 ✓
→ APPROVED

Execute
→ 4,500 DEMO transferred
→ Treasury balance = 5,500 DEMO

Execute Again
→ REJECTED
→ Already executed
```

## 18. MVP Acceptance Checklist

### Wallet & Identity

- [ ] Freighter connects successfully.
- [ ] Public address is available to the app.
- [ ] Testnet is verified.
- [ ] Wrong-network actions are blocked.
- [ ] Private keys are never requested or stored.

### Treasury

- [ ] Demo user can create a fixture treasury.
- [ ] Wallet mode can open each configured Testnet treasury.
- [ ] Members are stored correctly in demo/on-chain mode as applicable.
- [ ] Approval threshold is stored correctly in demo/on-chain mode as applicable.
- [ ] Creator is a member with no special spending authority.
- [ ] Treasury balance is readable.
### Funds

- [ ] Member can contribute demo/Testnet assets.
- [ ] Contribution updates treasury balance.
- [ ] Contributions cannot be individually withdrawn.

### Proposals

- [ ] Member can create a proposal.
- [ ] Amount and recipient remain immutable.
- [ ] Non-members cannot create proposals.

### Approvals

- [ ] Members can approve.
- [ ] Duplicate approvals are rejected.
- [ ] Non-member approvals are rejected.
- [ ] Threshold state updates correctly.

### Execution

- [ ] Under-threshold execution is rejected.
- [ ] Approved proposal executes successfully.
- [ ] Exact amount reaches exact recipient.
- [ ] Treasury balance decreases correctly.
- [ ] Insufficient balance is rejected.
- [ ] Double execution is rejected.
- [ ] Cross-treasury spending is impossible.

### UX

- [ ] Signing and confirmation are separate states.
- [ ] Errors are understandable.
- [ ] Approval progress is visible.
- [ ] Testnet/demo assets are clearly labeled.
- [ ] Core flow works on desktop and mobile.

## 19. MVP Definition of Done

Demo mode has reached its local MVP when a user can complete:

```text
OPEN DEMO
→ CREATE TREASURY
→ ADD FUNDS
→ CREATE PROPOSAL
→ APPROVE
→ REACH THRESHOLD
→ EXECUTE
→ VERIFY RESULT
```

Wallet mode begins with Connect Wallet and Open Configured Treasury; wallet
Create Treasury is deferred in this MVP.

and the system correctly rejects:

```text
NON-MEMBER ACTIONS
DUPLICATE APPROVALS
UNDER-APPROVED EXECUTION
INSUFFICIENT BALANCE
DOUBLE EXECUTION
CROSS-TREASURY SPENDING
```

The MVP is successful when Cohold proves that **shared treasury funds are governed by predefined group rules rather than by any single individual**.
