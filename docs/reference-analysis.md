# Reference Analysis

This document captures what was inspected in the reference repositories and
what the local prototype now borrows from each phase set.

## Current phase mapping

| Phase | Assigned repos | What they drive |
| --- | --- | --- |
| `Phase 1 - Ideation Qualification` | `worth-building`, `startup-skills`, `stratarts` | Qualification pressure, multi-voice sparring, validation bias, structured output |
| `Phase 2 - Spec` | `get-shit-done`, `OpenSpec`, `spec-kit`, `BMAD-METHOD` | Product briefing, clarification discipline, workflow/spec structure, scope boundaries |
| `Phase 3 - Dev` | `spec-kit`, `Azure Architecture Review Agent`, `Architecture Decision Record`, `12-Factor Agents` | SPEC -> plan/tasks, architecture risk review, ADR-backed stack decisions, stable agent/workflow guardrails |

## Phase 1 references

### `worth-building`

Key files inspected:

- `.sources/phase3-spec-kit/README.md`
- `.sources/phase3-spec-kit/spec-driven.md`
- `.sources/phase3-spec-kit/workflows/speckit/workflow.yml`
- `.sources/phase3-spec-kit/templates/plan-template.md`
- `.sources/phase3-spec-kit/templates/tasks-template.md`
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

- `.sources/phase3-azure-architecture-review-agent/README.md`
- `.sources/phase3-azure-architecture-review-agent/tools.py`
- `.sources/phase3-azure-architecture-review-agent/run_local.py`
- `.sources/phase3-azure-architecture-review-agent/scenarios/healthcare_platform.yaml`
- `.sources/phase3-azure-architecture-review-agent/tests/test_tools.py`
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

- `.sources/phase3-architecture-decision-record/README.md`
- `.sources/phase3-architecture-decision-record/locales/en/templates/index.md`
- `.sources/phase3-architecture-decision-record/locales/en/templates/decision-record-template-by-michael-nygard/index.md`
- `.sources/phase3-architecture-decision-record/locales/en/templates/decision-record-template-of-the-madr-project/index.md`
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

- `.sources/phase3-12-factor-agents/README.md`
- `.sources/phase3-12-factor-agents/content/factor-04-tools-are-structured-outputs.md`
- `.sources/phase3-12-factor-agents/content/factor-05-unify-execution-state.md`
- `.sources/phase3-12-factor-agents/content/factor-08-own-your-control-flow.md`
- `.sources/phase3-12-factor-agents/content/factor-10-small-focused-agents.md`
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

## Phase 3 references

### `spec-kit`

Key files inspected:

- `README.md`

What stands out:

- Explicit `/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks` -> `/speckit.implement` flow
- `/speckit.plan` is where tech stack and architecture choices belong
- Planning should follow a ready spec instead of being mixed into product discovery

Adopt:

- SPEC -> plan -> tasks discipline
- stack and architecture choices inside the planning handoff
- task breakdown only after unresolved spec questions are visible

Avoid:

- exposing slash-command mechanics in every panel reply
- treating the command workflow as a UI requirement

### `Azure Architecture Review Agent`

Key files inspected:

- `README.md`

What stands out:

- Accepts YAML, Markdown, plaintext, code, and design docs as architecture input
- Infers components and connections when the architecture is unstructured
- Produces risk analysis, prioritized recommendations, and component/dependency review

Adopt:

- architecture-review persona that can work from rough text
- severity-aware risk and recommendation language
- component, dependency, data-flow, and failure-mode checks

Avoid:

- Azure-specific deployment defaults unless the product calls for Azure
- making generated diagrams mandatory in the normal chat turn

### `Architecture Decision Record`

Key files inspected:

- `README.md`

What stands out:

- ADRs make architecture choices durable by recording context, decision, and consequences
- Useful for stack choices that otherwise become ungrounded preference debates

Adopt:

- context -> decision -> consequences framing for major stack and architecture choices
- visible tradeoffs for choices the team will pay for later

Avoid:

- creating heavy ADR ceremony for trivial implementation details

### `12-Factor Agents`

Key files inspected:

- `README.md`

What stands out:

- Production agent workflows need explicit state, control flow, tool contracts, and recovery paths
- Agent systems should not be one giant prompt with hidden behavior

Adopt:

- structured state and explicit transitions for agent-heavy products
- tool calls as typed contracts
- human-visible control flow, permissions, and recovery paths

Avoid:

- adding agent infrastructure before the product needs it
- relying on prompt-only behavior for critical workflow guarantees

## Product decision

The prototype now uses two distinct source stacks:

1. `Phase 1` is a qualification room.
2. `Phase 2` is a spec room.
3. `Phase 3` is a dev-planning room that turns a ready SPEC into plan,
   ADR-backed decisions, tasks, review risks, tests, and guardrails.

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

## Resulting Phase 3 room shape

The `Dev` room now behaves as an implementation-readiness panel, not a generic
engineering advice panel. Its roles are:

- `Staff Engineer`
- `Systems Architect`
- `QA Lead`
- `Security and Compliance`

Together they should pressure-test:

- whether the Phase 2 SPEC is ready to plan from
- stack choices with ADR-style context, decision, and consequences
- architecture boundaries, data flow, integrations, and risk severity
- task sequence and implementation slices
- acceptance-to-test mapping and release gates
- data classification, auth, auditability, tool permissions, and compliance assumptions
