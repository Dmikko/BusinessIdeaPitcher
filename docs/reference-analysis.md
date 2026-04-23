# Reference Analysis

This document captures what was inspected in the reference repositories and
what the local prototype now borrows from each phase set.

## Current phase mapping

| Phase | Assigned repos | What they drive |
| --- | --- | --- |
| `Phase 1 - Ideation Qualification` | `worth-building`, `startup-skills`, `stratarts` | Qualification pressure, multi-voice sparring, validation bias, structured output |
| `Phase 2 - Spec` | `get-shit-done`, `OpenSpec`, `spec-kit`, `BMAD-METHOD` | Product briefing, clarification discipline, workflow/spec structure, scope boundaries |
| `Phase 3 - Dev` | none assigned yet | Uses the local phase contract and role prompts until dedicated repos are added |

## Phase 1 references

### `worth-building`

Key files inspected:

- `README.md`
- `AGENTS.md`
- `.claude/commands/qualify.md`
- `project.manifest.yaml`
- `core/prompts/workflows/qualify-idea.md`
- `core/prompts/workflows/council-deliberation.md`
- `core/prompts/workflows/business-opportunity-advisor.md`
- `core/prompts/roles/competitive-analyst.md`
- `.claude/agents/market-researcher/agent.md`

Adopt:

- skeptical default tone
- explicit verdict logic
- distinct council voices
- one concrete next move

Avoid:

- long artifact-writing flow in the main chat
- mandatory long intake before any useful sparring

### `startup-skills`

Key files inspected:

- `README.md`
- `CLAUDE.md`
- `.claude/skills/validating-ideas/SKILL.md`
- `.claude/skills/shaping-product-strategy/SKILL.md`

Adopt:

- framework-backed business reasoning
- deliverable-oriented advice
- kill-criteria and validation bias

Avoid:

- full template dumps in chat
- multi-phase workflow execution inside each turn

### `stratarts`

Key files inspected:

- `README.md`
- `QUICK-START.md`
- `stratarts/commands/business-idea-validator.md`
- `stratarts/.claude-plugin/plugin.json`

Adopt:

- context carry-over mindset
- structured output discipline
- future report/export path

Avoid:

- wizard-heavy prompts
- HTML-first UX for the main room

## Phase 2 references

### `get-shit-done`

Key files inspected:

- `README.md`
- `get-shit-done/templates/spec.md`
- workflow and template listings under `get-shit-done/templates/` and
  `get-shit-done/workflows/`

What stands out:

- Strong `current` versus `target` framing
- Explicit `in scope` and `out of scope` boundaries
- Falsifiable acceptance criteria instead of soft product prose

Adopt:

- scope-locking behavior
- boundary language
- testable acceptance framing

Avoid:

- full `.planning/` filesystem model
- command-heavy planning loop in the main UI

### `OpenSpec`

Key files inspected:

- `README.md`
- `schemas/spec-driven/templates/spec.md`
- repo listings for proposal, design, tasks, and change workflows

What stands out:

- Clean proposal -> spec -> design -> tasks progression
- Lightweight requirements-plus-scenarios structure
- Strong artifact language without forcing heavyweight process

Adopt:

- requirements plus scenario thinking
- artifact-ready handoff language
- change-oriented spec mindset

Avoid:

- exposing the full artifact stack in every panel reply

### `spec-kit`

Key files inspected:

- `README.md`
- `templates/commands/specify.md`
- template listings for `spec-template.md`, `plan-template.md`, and
  `checklist-template.md`

What stands out:

- Separation of `what` from `how`
- Clarification discipline before planning
- Spec readiness and quality-check mindset

Adopt:

- ambiguity hunting
- technology-agnostic requirement writing
- readiness gating before Phase 3

Avoid:

- large slash-command workflow dumps in the room chat

### `BMAD-METHOD`

Key files inspected:

- `README.md`
- `src/bmm-skills/2-plan-workflows/bmad-create-prd/SKILL.md`
- skill listings around PRD, UX design, validation, epics, and architecture

What stands out:

- Strong PRD-first product framing
- Workflow facilitation for product and UX thinking
- Clear bridge from product brief into later architecture and delivery work

Adopt:

- PRD-style room behavior
- scenario and workflow facilitation
- handoff-ready spec language

Avoid:

- full step-file facilitator workflow in normal chat turns

## Product decision

The prototype now uses two distinct source stacks:

1. `Phase 1` is a qualification room.
2. `Phase 2` is a spec room.
3. `Phase 3` remains a local handoff room until dedicated dev repos are added.

That means the backend should:

- filter reference repos by active phase before building the LLM prompt
- keep the panel roles phase-specific
- preserve one thin JSON turn contract across all phases

## Resulting Phase 2 room shape

The `Spec` room now behaves as a product-definition panel, not as a business
ideation panel. Its roles are:

- `Product Manager`
- `Clarification Lead`
- `Workflow Designer`
- `Boundary Keeper`

Together they should pressure-test:

- the product brief
- the target user and context
- the current and target workflow
- v1 scope and non-goals
- open assumptions
- acceptance criteria needed before Phase 3
