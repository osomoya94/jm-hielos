---
name: jm-hielos-backend
description: Use when implementing or reviewing backend features in JM Hielos. Follow ERS 1.4, confirmed role decisions, current NestJS, Prisma, PostgreSQL and TypeScript patterns, validation rules, and tests. The current delivery priority is the Cash Flow backend.
---

# JM Hielos Backend

## Purpose

Work on the JM Hielos backend while preserving the existing project style,
business rules, and understandable code structure.

Do not redesign the architecture unless the user explicitly requests it.

## Current reference and delivery context

The current functional reference is ERS JM Hielos, version 1.4, dated 28/10/2026:
[docs/ERS_JM_Hielos_v1_4_Cash_Flow.docx](../../../docs/ERS_JM_Hielos_v1_4_Cash_Flow.docx).

The user is developing the project through progressive academic deliveries.
The current priority is backend work related to Cash Flow and its dependencies:
financial accounts, opening balances, movements, collections, payments,
internal transfers, traceability and reconciliation.

Use this priority within the requested task's scope. Do not implement the entire
MVP automatically. Distinguish pending requirements from implemented and verified
behavior; an academic delivery does not imply acceptance of the complete system.

## Before working

1. Understand the requested feature or problem.
2. Check the relevant requirements in [references/ers-rules.md](references/ers-rules.md).
3. Read [references/existing-patterns.md](references/existing-patterns.md) and look for a similar implementation already present in the project.
4. Prefer the existing project pattern over introducing a new pattern.
5. If the current code conflicts with the ERS, report the conflict instead of deciding silently.

## Existing project style

Prefer simple NestJS code using the existing structure:

- Controller
- Service
- DTO
- Prisma
- Tests

Use Clientes and Productos as reference patterns when they are relevant.

Avoid:

- unnecessary abstractions
- large refactors
- new architectural patterns without justification
- unnecessary dependencies
- overly complex or "senior-looking" code that makes the project harder to understand

## Business rules

Use ERS 1.4 together with confirmed subsequent project decisions, including
the read-only LECTOR role described in `references/ers-rules.md`.

For Cash Flow, consult ERS sections 6.18, 9.1 to 9.3, 10.4, 14 and 15.2
when the summary in the reference is insufficient. Cash Flow is a read-only report
derived from confirmed financial movements; writes belong to the source operations.

Important business behavior must not be invented.

When necessary, read:

`references/ers-rules.md`

If a requirement is unclear or contradicts the current implementation,
stop and report the difference.

## Working with existing code

Before creating something new:

1. Search for a similar module or behavior.
2. Understand how it currently works.
3. Reuse the same style when appropriate.
4. Modify only the scope required by the task.

Do not change unrelated files just to improve them.

## Validation and errors

Keep validations explicit and understandable.

Use clear NestJS exceptions and messages.

Do not silently accept invalid business data.

## Testing

When implementing backend functionality:

1. Add or update relevant tests.
2. Run the focused tests first.
3. Run the complete test suite when appropriate.
4. Run the build.
5. Report what was verified and what was not verified.

Do not claim something works without evidence.

## Git and repository safety

Do not commit or push unless the user explicitly asks.

Do not modify unrelated files.

Do not read or expose `.env`, passwords, tokens, secrets, or private credentials.

## Review mode

If the user asks only for a review:

- do not modify files
- identify the exact file or code involved
- separate real errors from optional improvements
- explain the reason
- explain how to verify the finding

A suggestion without evidence must be treated as a hypothesis.
