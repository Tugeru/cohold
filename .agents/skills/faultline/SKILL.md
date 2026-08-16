---
name: faultline
description: >
  Stress-test a plan, design, or specification by identifying material gaps
  that could change implementation, scope, domain behavior, architecture,
  security/privacy, data modeling, UX, migration behavior, or acceptance
  criteria. Use before building when the user wants a plan challenged,
  reviewed for gaps, pressure-tested, or uses any "grill" trigger.
---

# Faultline

Find the few unresolved decisions where the plan could crack.

Do not interrogate for completeness. Ask only questions whose answers could
meaningfully change what gets built or how correctness is judged.

## First: Investigate

Before asking anything, inspect all available evidence:

- Current conversation and previously stated decisions
- Plan, specification, and design artifacts
- Relevant code and tests
- Schemas, migrations, configuration, and existing conventions
- Issues, PRs, documentation, and other available project sources
- Available external system state when relevant

If a fact can be discovered, discover it. Do not ask the user.

Do not ask about something already decided or clearly implied by an existing
invariant, specification, project convention, or implementation.

## What Deserves a Question

Ask only when an unresolved decision materially affects one or more of:

- Product or domain behavior
- Scope or requirements
- User workflow or permissions
- Data model or lifecycle
- Security, privacy, or authorization
- Public or API contracts
- Migration or backward compatibility
- Failure and recovery behavior
- Acceptance criteria
- A difficult-to-reverse architectural decision

Do not ask about low-risk implementation details the agent can resolve from
existing conventions.

For low-risk, reversible choices, choose the recommended default and record the
assumption instead of asking.

## Waves

Ask **up to 4 questions per wave**.

Maximum: **4 waves / 16 questions**.

Before each wave, rank unresolved gaps by:

1. Implementation blockers
2. Correctness, security, privacy, or data-integrity risk
3. Scope or specification ambiguity
4. Cost or difficulty of changing the decision later

Ask only the highest-value gaps.

If one answer determines whether several downstream questions matter, ask that
question first and defer dependent questions until the answer is known.

A wave may contain fewer than 4 questions. Never pad a wave.

Carry unresolved material gaps into later waves. Never re-ask settled decisions.

## Question Format

For each question:

### N. [Decision being resolved]

**Technical:** Precise formulation using appropriate domain terminology.

**Plain:** Same decision in plain language, with an example when useful.
Omit this section when the technical version is already obvious.

**Recommended:** Recommended choice and brief rationale.

Prefer questions that can be answered by accepting the recommendation or
choosing between a small number of concrete alternatives.

Avoid broad questions such as:

- "How should this work?"
- "What do you want to do here?"
- "Have you considered edge cases?"

Instead identify the exact unresolved branch and present concrete options.

## Ownership

**Facts belong to investigation.**

The agent should independently resolve:

- Existing implementation details
- Established repository conventions
- Routine framework or library choices
- Low-risk, reversible technical choices
- Details directly implied by existing architecture or specifications

The user should resolve:

- Product and domain rules
- Significant UX behavior
- Scope changes
- Security and privacy boundaries
- Authorization semantics
- Important business invariants
- Meaningful tradeoffs
- Difficult-to-reverse architectural decisions

Do not turn routine implementation decisions into user questions.

## Recommendations Are Required

Do not merely expose a gap.

For every question, provide the choice you recommend based on:

- Existing architecture
- Project conventions
- Simplicity
- Correctness
- Security and privacy
- Maintainability
- Cost of future change

The user should be able to answer with something as short as:

> Accept recommendation.

## Stop Condition

Stop when no **material** unresolved gaps remain.

Minor unknowns, implementation details, and reversible choices do not justify
another wave.

When stopping, summarize:

### Confirmed Decisions
Decisions explicitly resolved by the user.

### Agent Defaults
Low-risk assumptions or implementation choices the agent selected without
requiring user input.

### Deferred / Residual Risks
Material issues intentionally left unresolved, if any.

Then ask the user to confirm shared understanding before implementation begins.

## Budget Exhaustion

If the 4-wave budget is exhausted:

1. Stop asking questions.
2. List remaining material gaps.
3. State the risk of leaving each one unresolved.
4. Give the recommended default for each where possible.
5. Ask whether to proceed with those gaps open.

Do not silently continue interrogating beyond the budget.

## Boundaries

Faultline examines the plan. It does not implement it.

Do not modify code, schemas, specifications, or other project artifacts until
the user confirms shared understanding.

Do not manufacture gaps merely to appear thorough.

Success means finding the **minimum set of consequential decisions needed to
make the plan safe and clear enough to build**.