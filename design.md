---
version: "alpha"
name: "Cohold Design System"
description: "Governed money visual identity for multi-approval shared treasuries on Stellar Testnet. Calm collaborative fintech, light mineral surfaces, ledger-blue accents, tabular numbers, and the signature approval rail."
colors:
  primary: "#1E3A8A"
  primary-hover: "#1D4ED8"
  primary-container: "#EFF6FF"
  on-primary: "#FFFFFF"
  on-primary-container: "#1E3A8A"
  secondary: "#475569"
  secondary-hover: "#334155"
  secondary-container: "#F1F5F9"
  on-secondary: "#FFFFFF"
  tertiary: "#D97706"
  tertiary-container: "#FEF3C7"
  on-tertiary: "#FFFFFF"
  neutral: "#0F172A"
  surface: "#F8FAFC"
  surface-card: "#FFFFFF"
  surface-elevated: "#FFFFFF"
  surface-subtle: "#F1F5F9"
  surface-dark: "#0B0F19"
  on-surface: "#0F172A"
  on-surface-muted: "#64748B"
  on-surface-subtle: "#94A3B8"
  border: "#E2E8F0"
  border-subtle: "#F1F5F9"
  border-strong: "#CBD5E1"
  success: "#059669"
  success-container: "#ECFDF5"
  on-success: "#FFFFFF"
  warning: "#D97706"
  warning-container: "#FEF3C7"
  on-warning: "#FFFFFF"
  danger: "#DC2626"
  danger-container: "#FEF2F2"
  on-danger: "#FFFFFF"
  pending: "#EAB308"
  pending-container: "#FEFCE8"
  on-pending: "#713F12"
typography:
  display:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  h2:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  h3:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  financial-number:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' on, 'zero' on"
  mono-data:
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "'tnum' on"
  label:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  none: "0px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: "24px"
  approval-rail:
    backgroundColor: "{colors.surface-subtle}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  status-badge-approved:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.success}"
    border: "1px solid {colors.success}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  status-badge-pending:
    backgroundColor: "{colors.pending-container}"
    textColor: "{colors.on-pending}"
    border: "1px solid {colors.warning}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  status-badge-executed:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.primary}"
    border: "1px solid {colors.primary}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  status-badge-cancelled:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.on-surface-muted}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  input-field:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Cohold — Design System & Visual Identity Specification

Shared funds. Shared control.

Cohold is a multi-approval treasury platform built on Stellar Testnet and Soroban smart contracts. It gives groups, student organizations, business partnerships, and community funds a transparent, tamper-proof way to hold and spend funds together without placing unilateral control in one person's hands.

---

## 1. Overview & Brand Philosophy

Cohold is designed as **calm, collaborative fintech**. It avoids the aggressive neon, cyberpunk dark meshes, particle effects, and speculative tropes typical of Web3 tooling. The blockchain stays firmly behind the interface: users see treasuries, members, proposals, thresholds, and approvals—not XDR strings, ScVal structures, or raw invocation logs.

### Core Visual Tenets

1. **Governed Money, Not Speculative Crypto**
   Financial balances, thresholds, and approval tallies are high-priority information elements rendered with tabular numerals, high contrast, and unmistakable visual hierarchy.

2. **The Signature: The Approval Rail**
   Every proposal features an unmistakable, physical-style approval control rail showing threshold requirements, current confirmations, pending votes, and eligibility state in a single glance before any wallet signature is requested.

3. **Restrained Materiality**
   Surfaces use a light mineral canvas (`#F8FAFC`), crisp white cards with fine borders (`#E2E8F0`), and ledger-blue structural accents (`#1E3A8A`). Elevation is minimal and functional, reserving shadows for modals and contextual popovers.

4. **Zero-Ambiguity Confirmation**
   All financial actions (creating a treasury, contributing funds, proposing a spend, signing an approval, executing a transfer) display the exact treasury, token, amount, recipient address, and threshold impact on a dedicated confirmation surface before the user commits.

---

## 2. Color Palette & Semantic Roles

```
Light Canvas       Card Surface       Border             Ink Text           Ledger Blue (Primary)
#F8FAFC            #FFFFFF            #E2E8F0            #0F172A            #1E3A8A
[ Neutral Light ]  [ Pure Surface ]   [ Structural Line ][ High Contrast ]  [ Authority Accent ]
```

### 2.1 Palette Hierarchy

| Token | Hex Value | Role / Usage |
|:---|:---|:---|
| `primary` | `#1E3A8A` | Primary actions, brand authority, active navigation tabs, executed status |
| `primary-hover` | `#1D4ED8` | Hover state for primary interactive elements |
| `primary-container` | `#EFF6FF` | Soft background for primary chips, highlights, and active selection rows |
| `secondary` | `#475569` | Secondary text, inactive tab headers, supporting actions |
| `secondary-container`| `#F1F5F9` | Table header backgrounds, neutral pill containers, skeleton placeholders |
| `tertiary` | `#D97706` | Attention callouts, warnings, pending approval alerts |
| `tertiary-container` | `#FEF3C7` | Warning banner backgrounds, pending approval chips |
| `neutral` | `#0F172A` | Deep ink text, primary headings, dark mode baseline |
| `surface` | `#F8FAFC` | Light mineral application canvas background |
| `surface-card` | `#FFFFFF` | Main container and card backgrounds |
| `border` | `#E2E8F0` | Structural dividers, card borders, input borders |
| `border-strong` | `#CBD5E1` | Table column dividers, active input borders |
| `success` | `#059669` | Confirmed transactions, approved proposals, positive balance changes |
| `success-container` | `#ECFDF5` | Approved status badge background, success toast backgrounds |
| `danger` | `#DC2626` | Destructive actions, rejected/failed transactions, balance deficit |
| `danger-container` | `#FEF2F2` | Error banner backgrounds, cancelled proposal badges |

### 2.2 Accessibility & Color Discipline

- Never communicate state through color alone. Every status badge pairs color with an explicit label and an iconography glyph (e.g., `✓ Approved`, `⏳ Pending`, `✕ Cancelled`).
- All text-to-background combinations maintain a contrast ratio of at least 4.5:1 (WCAG AA).
- Maintain single-theme consistency: the app runs with a unified, high-clarity light canvas with dark modal scims (`rgba(11, 15, 25, 0.6)`).

---

## 3. Typography & Numerical Hierarchy

Cohold uses **Public Sans** (or system sans fallbacks) for clean, unpretentious legibility across headings and body, paired with **JetBrains Mono** for addresses, hashes, and chain identifiers.

### 3.1 Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Purpose |
|:---|:---|:---|:---|:---|:---|
| `display` | 36px | 700 (Bold) | 1.2 | -0.02em | Hero headline, total treasury portfolio value |
| `h1` | 30px | 700 (Bold) | 1.25 | -0.015em | Page titles (Treasury Detail, Overview) |
| `h2` | 24px | 600 (Semibold)| 1.3 | -0.01em | Section headers, card titles |
| `h3` | 18px | 600 (Semibold)| 1.4 | 0 | Modal headers, group titles |
| `body` | 15px | 400 (Regular) | 1.6 | 0 | Descriptions, explanatory paragraphs |
| `body-sm` | 13px | 400 (Regular) | 1.5 | 0 | Metadata labels, timestamps, helper text |
| `financial-number` | 28px | 700 (Bold) | 1.2 | -0.02em | Treasury balance, proposal spend amount (`font-feature-settings: 'tnum' on`) |
| `mono-data` | 12px | 500 (Medium) | 1.4 | 0 | Stellar addresses (`GABC...4XYZ`), tx hashes, contract IDs |
| `label` | 11px | 600 (Semibold)| 1.2 | +0.05em | Micro-labels, table header labels (uppercase) |

### 3.2 Financial Number Rule

All currency amounts, balances, and numerical counts must have `font-variant-numeric: tabular-nums` (`'tnum' on`) enabled to prevent layout shifting during polling or data updates.

---

## 4. Layout, Grid & Spatial System

### 4.1 Layout Shell Structure

```
+-------------------------------------------------------------------------+
| [Header] Logo "Cohold" | Nav Links | Testnet Badge | Wallet / Persona   |
+-------------------------------------------------------------------------+
| [Main Content Area - max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8]       |
|                                                                         |
|  +--------------------------------+  +-------------------------------+  |
|  | Primary Card (Treasury / Prop) |  | Sidebar / Approval Rail       |  |
|  | - Balance: 10,000 DEMO         |  | - Threshold: 3 of 4 reached   |  |
|  | - Members: 4 officers          |  | - Action: [Execute Payment]   |  |
|  +--------------------------------+  +-------------------------------+  |
+-------------------------------------------------------------------------+
```

### 4.2 Spacing & Padding Tokens

- **Component internal padding:** `16px` (sm) to `24px` (lg).
- **Card grid gaps:** `16px` on mobile, `24px` on desktop.
- **Section vertical margins:** `32px` (`my-8`) to `48px` (`my-12`).
- **Page container width:** `max-w-7xl` (1280px) centered with responsive horizontal padding (`px-4 sm:px-6 lg:px-8`).

---

## 5. Signature Component: The Approval Rail

The **Approval Rail** is the signature interaction element of Cohold. It makes multi-signature governance tangible, understandable, and reassuring.

### 5.1 Rail Anatomy

```text
+-----------------------------------------------------------------------+
| APPROVAL STATUS                                      3 of 4 required  |
+-----------------------------------------------------------------------+
| [==== Progress Bar: 75% Filled (3/4 Approved) ==================---] |
+-----------------------------------------------------------------------+
|  [✓] Maria Santos (President)    • Approved    (08/15 14:32)          |
|  [✓] Juan Dela Cruz (Treasurer)  • Approved    (08/15 15:10)          |
|  [✓] Chloe Lim (Secretary)       • Approved    (08/16 09:20)          |
|  [ ] Daniel Tan (Auditor)        • Awaiting Signature                 |
+-----------------------------------------------------------------------+
|  [✓ Threshold Reached - Ready to Execute Payment]                     |
+-----------------------------------------------------------------------+
```

### 5.2 Rail States

1. **Pending Approval (Below Threshold):** Shows empty/filled indicators, lists remaining required signers, enables `[Approve Proposal]` button for eligible connected members.
2. **Current User Approved:** Displays `✓ You approved this proposal` chip; disables further sign attempts.
3. **Threshold Reached (Ready to Execute):** Turns border and accent to Success Green (`#059669`); displays primary `[Execute Payment]` button.
4. **Executed:** Displays confirmation receipt with exact transaction hash link to Stellar Expert.
5. **Insufficient Treasury Balance:** Warning banner indicates threshold was reached but available balance (`X DEMO`) is lower than proposed amount (`Y DEMO`).

---

## 6. Component Guidelines

### 6.1 Buttons

- **Primary (`button-primary`):** Solid ledger blue background (`#1E3A8A`), white text, 8px radius. Used exclusively for forward-progress actions: *Create Treasury*, *Submit Proposal*, *Approve*, *Execute Payment*.
- **Secondary (`button-secondary`):** White background, subtle border (`#E2E8F0`), ink text (`#0F172A`). Used for dismissals, filter toggles, cancel buttons, and secondary links.
- **Danger (`button-danger`):** Red background (`#DC2626`), white text. Used only for irreversible actions: *Cancel Proposal*, *Reject*.
- **Micro-Physics Rule:** On `:active`, all buttons apply `transform: scale(0.98)` with a `150ms ease-out` transition for tactile responsiveness.

### 6.2 Status Badges

| Status | Background | Text | Icon | Meaning |
|:---|:---|:---|:---|:---|
| `Pending` | `#FEFCE8` | `#713F12` | Clock / ⏳ | Awaiting required threshold approvals |
| `Approved` | `#ECFDF5` | `#059669` | Check / ✓ | Threshold reached, eligible for execution |
| `Executed` | `#EFF6FF` | `#1E3A8A` | ArrowUpRight | Payment executed on Stellar Testnet |
| `Cancelled`| `#F1F5F9` | `#64748B` | XMark / ✕ | Proposal cancelled by proposer/creator |

### 6.3 Financial Confirmation Modals

Every financial transaction uses a structured confirmation dialog before invoking wallet simulation or signing:

```text
+-----------------------------------------------------------------------+
| Confirm Payment Execution                                         [✕] |
+-----------------------------------------------------------------------+
| Amount to Transfer:                                                   |
|   4,500.00 DEMO_UNITS                                                 |
|                                                                       |
| Source Treasury:                                                      |
|   IT Society Event Fund (Balance: 10,000.00 DEMO)                     |
|                                                                       |
| Recipient Address:                                                    |
|   GABC...4XYZ (Grand Hall Venue Supplier)                             |
|                                                                       |
| Approvals:                                                            |
|   3 of 3 Required Signatures Verified                                 |
|                                                                       |
| [Cancel]                                        [Sign & Execute via Freighter] |
+-----------------------------------------------------------------------+
```

---

## 7. Motion & Micro-Interactions

Cohold follows Emil Kowalski's craft engineering principles: unseen details compound, beauty is leverage, and animations remain snappy and purpose-driven.

### 7.1 Motion Rules

1. **Duration Cap:** All UI transitions must complete in under **250ms**.
2. **Custom Easings:**
   - Standard UI ease-out: `cubic-bezier(0.23, 1, 0.32, 1)`
   - Modal/Drawer curve: `cubic-bezier(0.32, 0.72, 0, 1)`
3. **No `scale(0)` Entrances:** Modals and tooltips scale in from `scale(0.95)` with simultaneous opacity fade.
4. **Hardware Acceleration:** Animate only `transform` and `opacity`. Never animate `width`, `height`, `margin`, or `padding`.
5. **Accessibility (`prefers-reduced-motion`):** When reduced motion is requested, all transform animations collapse to instant or gentle 150ms opacity fades.

---

## 8. Tone, Terminology & Content

### 8.1 Plain Language Mapping

| Avoid in UI | Use in Cohold |
|:---|:---|
| Multisig / Multi-sig | Multi-approval treasury |
| Smart Contract Invocation | Execute Payment / Confirm Action |
| ScVal / Raw XDR | Amount / Recipient Address |
| SAC Token Bridge | Asset / Treasury Token |
| Auth Entry / Footprint | Member Approval |
| Ledger Sequence | Transaction Date / Time |

### 8.2 Error Message Tone

Error messages must be calm, direct, and actionable. They never blame the user and never dump raw blockchain stack traces.

- **Bad:** `Contract invocation failed with host error 12: InsufficientBalance (ScVal error)`
- **Good:** `Payment cannot be executed. The treasury balance (2,000 DEMO) is less than the proposal amount (4,500 DEMO).`
- **Bad:** `Freighter rejected with error: user declined signature`
- **Good:** `Transaction cancelled. Your wallet signature was not submitted and treasury funds were not changed.`

---

## 9. Accessibility & Quality Floor

- **Keyboard Navigation:** Full focus-trap in all modals, escape-key dismissal, visible 2px focus rings (`focus-visible:ring-2 focus-visible:ring-primary`).
- **Touch Target Floor:** Minimum interactive touch target of `44x44px` on mobile devices.
- **Screen Reader Readiness:** ARIA attributes for progress meters (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`) on the Approval Rail, and descriptive labels on all icon-only buttons.
- **Mobile Financial Density:** On mobile viewports (< 768px), financial tables transform into stacked card units where balance, status, and actions remain visible above the fold.
