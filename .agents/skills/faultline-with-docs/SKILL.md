---
name: faultline-with-docs
description: >
  Find material gaps in a plan, design, or specification while sharpening and
  recording the project's domain model. Uses Faultline for targeted gap
  discovery and Domain Modeling for terminology, domain boundaries, CONTEXT.md,
  and sparing ADR creation.
disable-model-invocation: true
---

# Faultline with Docs

Run a `/faultline` session using the `/domain-modeling` skill.

Faultline governs **what deserves questioning**.

Domain Modeling governs **domain terminology, domain boundaries, scenarios,
CONTEXT.md, and ADRs**.

## Combined behavior

Before asking questions:

1. Inspect the plan, specification, design, code, tests, existing `CONTEXT.md`,
   `CONTEXT-MAP.md`, ADRs, and other available project evidence.
2. Resolve discoverable facts yourself.
3. Compare the proposed design against the existing domain language and code.
4. Identify only material unresolved gaps according to Faultline's rules.

During each Faultline wave:

- Ask only high-value questions that materially affect the plan.
- Challenge terminology when it conflicts with the existing domain model.
- Sharpen vague or overloaded domain terms when that ambiguity matters.
- Use concrete domain scenarios when they expose a material gap.
- Cross-reference claims against existing code and documentation.
- Do not introduce domain-modeling questions merely to make the glossary more
  complete.

## Documentation exception

Faultline normally prohibits modifying project artifacts before shared
understanding is confirmed.

For this combined skill, make one narrow exception:

### `CONTEXT.md`

When the user explicitly resolves a domain term, relationship, or boundary,
update the appropriate `CONTEXT.md` immediately using the Domain Modeling
format.

Only record settled domain language.

Do not write:

- unresolved possibilities
- implementation details
- speculative terminology
- temporary assumptions
- requirements or acceptance criteria

`CONTEXT.md` remains a glossary, not a specification.

### ADRs

Offer or create an ADR only when Domain Modeling's three conditions all hold:

1. Hard to reverse
2. Surprising without context
3. Result of a real trade-off

Do not create ADRs for routine implementation choices.

If the user settles an ADR-worthy decision during Faultline, it may be recorded
before the entire Faultline session finishes because that individual decision
has already been explicitly resolved.

## Authority

When instructions overlap:

1. **Faultline decides whether a question is worth asking.**
2. **Domain Modeling decides whether resolved knowledge belongs in
   `CONTEXT.md` or an ADR.**
3. **Faultline's stop conditions and question budget remain authoritative.**

Domain Modeling must not expand the interview beyond Faultline's materiality
threshold or question budget.

## Boundaries

This skill may modify only:

- `CONTEXT.md`
- context-specific `CONTEXT.md` files
- `CONTEXT-MAP.md` when genuinely required by the domain structure
- ADR files justified by Domain Modeling rules

It must not implement the plan or modify application code, schemas,
migrations, tests, or implementation specifications before the user confirms
shared understanding.

When Faultline stops, summarize:

- Confirmed decisions
- Domain terminology established or changed
- ADRs created
- Agent defaults
- Deferred or residual risks

Then ask for confirmation before implementation begins.