# Architecture Draft

## Product direction

Build a local-first 3-phase idea pitcher where the user moves through
different expert rooms:

1. `Phase 1 - Ideation Qualification`
2. `Phase 2 - Spec`
3. `Phase 3 - Dev`

The prototype optimizes for:

- clear role separation
- phase-specific responsibilities instead of one blended panel
- skeptical but useful feedback
- one concrete next move after every turn
- easy swap from mock mode to live LLM mode

## Runtime shape

### Frontend

- plain HTML, CSS, and browser JavaScript
- phase tabs
- one thread per phase
- one phase team sidebar
- one synthesis card per active phase
- one reference-synthesis card

### Backend

- tiny Node `http` server with no runtime dependencies
- serves static assets
- exposes:
  - `GET /api/bootstrap`
  - `POST /api/chat`

### Data layer

- `data/phases.json` stores phase metadata, examples, and exit criteria
- `data/panelists.json` stores role definitions
- `data/reference-insights.json` stores repo synthesis plus phase assignment

### Model adapter

- OpenAI Responses API request format
- environment-driven OpenAI key, model, and optional base URL
- Structured Outputs via JSON schema for the phase-turn contract
- phase-specific repo filtering before each room prompt is assembled
- mock fallback if config is missing or live call fails

## Phase contract

Each phase defines:

- `id`
- `shortLabel`
- `name`
- `objective`
- `exitCriteria`
- `examplePrompt`
- `defaultSummary`

This lets the UI and the backend stay aligned on what each room is trying to
resolve.

## Panel contract

Each panelist maps to a normalized structure:

- `id`
- `phaseId`
- `name`
- `focus`
- `stance`
- `accent`
- `inspiredBy`
- `promptNotes`

This keeps the UI and the orchestration prompt aligned on one source of truth.

## Turn contract

Every panel turn returns one JSON object with:

- `synthesis`
  - `signal`
  - `focus`
  - `mainRisk`
  - `nextStep`
  - `confidence`
  - `exitCriteria`
- `responses[]`
  - `panelistId`
  - `message`
  - `tags`

This is the thin contract the frontend depends on. Anything beyond this is
optional enrichment.

## Room mapping

### Phase 1 - Ideation Qualification

Roles:

- Business Developer
- Skeptic
- Market Scout
- Validation Coach

### Phase 2 - Spec

Roles:

- Product Manager
- Clarification Lead
- Workflow Designer
- Boundary Keeper

### Phase 3 - Dev

Roles:

- Staff Engineer
- Systems Architect
- QA Lead
- Security and Compliance

Room behavior:

- turns a ready spec into a technical plan and task sequence
- records stack and architecture choices with ADR-style reasoning
- reviews architecture risks, boundaries, data flow, integrations, and trust
  assumptions before implementation starts

## Reference blend

### `Phase 1 sources`

`worth-building`

Adopt:

- skeptical default
- explicit verdict logic
- multi-voice council mentality
- "one concrete first action" discipline

Avoid for v0:

- heavy file-writing workflow inside the chat loop

`startup-skills`

Adopt:

- workflow and deliverable orientation
- framework-driven reasoning
- kill criteria and validation mindset

Avoid for v0:

- very large, phase-heavy skill execution inside every reply

`stratarts`

Adopt:

- context chaining mindset
- reusable output signatures
- structured outputs and optional report generation later

Avoid for v0:

- giant single-skill wizards and HTML report generation as the default UX

### `Phase 2 sources`

`get-shit-done`

Adopt:

- current versus target state framing
- in-scope and out-of-scope discipline
- falsifiable acceptance criteria

Avoid for v0:

- full planning filesystem and command-heavy workflow inside the chat loop

`OpenSpec`

Adopt:

- proposal to spec handoff language
- requirements plus scenarios structure
- artifact-ready but lightweight spec framing

Avoid for v0:

- forcing the whole artifact stack into each answer

`spec-kit`

Adopt:

- clarify before plan discipline
- technology-agnostic spec writing
- readiness checks for ambiguous requirements

Avoid for v0:

- large command workflow dumps in the main chat

`BMAD-METHOD`

Adopt:

- PRD-oriented product framing
- scenario and workflow facilitation
- clean handoff thinking into later architecture work

Avoid for v0:

- full facilitator workflow during normal panel turns

### `Phase 3 sources`

`spec-kit`

Adopt:

- SPEC -> plan -> tasks progression
- stack and architecture choices during the planning handoff
- task breakdown only after spec ambiguity is visible

Avoid for v0:

- exposing slash-command mechanics as the product UX

`Azure Architecture Review Agent`

Adopt:

- architecture review from rough text, YAML, Markdown, or design docs
- component, dependency, data-flow, and risk checks
- severity-aware recommendations

Avoid for v0:

- Azure-specific deployment assumptions unless chosen by the user
- mandatory diagram generation in every chat turn

`Architecture Decision Record`

Adopt:

- context, decision, and consequences framing for stack choices
- explicit tradeoffs for durable architecture decisions

Avoid for v0:

- heavy ADR ceremony for trivial choices

`12-Factor Agents`

Adopt:

- explicit agent state and workflow transitions
- typed tool contracts and recoverable control flow
- human-visible permissions and failure paths

Avoid for v0:

- treating agent behavior as one giant prompt
- adding agent infrastructure before the product needs it

## Near-term next steps

1. Add session persistence.
2. Add a "deep dive with this role" mode.
3. Add exportable report snapshots after a strong panel exchange.
4. Add per-role drill-down workflows inspired by the deeper skill libraries.
5. Add explicit phase handoff artifacts between Phase 1 -> 2 and 2 -> 3.
