# Business Idea Pitcher

Local prototype for a 4-phase idea pitcher with separate expert rooms for:

- `Phase 1` Ideation Qualification
- `Phase 2` Spec
- `Phase 3` Dev
- `Phase 4` Agent Team Generator

## Current shape

- Static frontend served by a tiny Node server
- Phase tabs with separate chat context per phase
- `/api/chat` orchestrates one phase turn and returns:
  - one synthesis block for the active phase
  - one response per role in that phase room
- OpenAI Responses API hookup through environment variables
- Mock fallback when no LLM configuration is present
- Phase-specific repo synthesis:
  - `Phase 1`: `kommuniker/worth-building`, `maigentic/stratarts`, `bwerneckm/startup-skills`
  - `Phase 2`: `gsd-build/get-shit-done`, `Fission-AI/OpenSpec`, `github/spec-kit`, `bmad-code-org/BMAD-METHOD`
  - `Phase 3`: `github/spec-kit`, `Azure-Samples/agent-architecture-review-sample`, `joelparkerhenderson/architecture-decision-record`, `humanlayer/12-factor-agents`

## Run locally

1. Optional: copy `.env.example` to `.env` and fill in your OpenAI settings.
2. Start the server:

   ```bash
   node server.js
   ```

3. Open `http://localhost:4173`

You can also use:

```bash
npm start
```

## Run tests

```bash
npm test
```

The test suite uses Node's built-in test runner and covers the local server,
API contracts, and the Electron launcher wrapper.

## Run as a desktop app

1. Install dependencies:

   ```bash
   npm install
   ```

2. Launch the Electron desktop shell:

   ```bash
   npm run desktop
   ```

This starts the existing local Node server inside Electron and opens the app in
a desktop window.

`npm run desktop` now clears `ELECTRON_RUN_AS_NODE` for the Electron child
process, so it still works even if that variable is set globally in your shell.

## Build a Windows installer

After `npm install`, create a Windows installer with:

```bash
npm run dist
```

The packaged output is written to `dist/`.

## Run with Docker

Docker runs the web app server, not the Electron desktop app.

### Option 1: Docker Compose

1. Optional: create `.env` if you want to use your OpenAI settings.
2. Start the app:

   ```bash
   docker compose up --build
   ```

3. Open `http://localhost:4173`
4. Stop it when you are done:

   ```bash
   docker compose down
   ```

### Option 2: Docker only

1. Build the image:

   ```bash
   docker build -t business-idea-pitcher .
   ```

2. Run the container:

   ```bash
   docker run --rm -p 4173:4173 --env-file .env business-idea-pitcher
   ```

3. Open `http://localhost:4173`

If `OPENAI_API_KEY` is not set, the app runs in mock mode.

## Environment variables

- `PORT` optional, defaults to `4173`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to `gpt-5.4`
- `OPENAI_BASE_URL` optional, defaults to `https://api.openai.com/v1`
- `OPENAI_STORE` optional, defaults to `false`

The server uses the OpenAI `Responses API` with Structured Outputs. If
`OPENAI_API_KEY` is missing, the app runs in mock mode.

## OpenAI integration

- Uses `POST /v1/responses`
- Sends the room instruction block through `instructions`
- Uses Structured Outputs with a JSON schema for stable phase-turn parsing
- Defaults to `store=false` so local prototype conversations are not stored
  unless you change it explicitly

## Project map

- `server.js` local server and panel orchestration
- `data/phases.json` phase metadata, examples, and exit criteria
- `data/panelists.json` role registry for the panel
- `data/reference-insights.json` repo synthesis used by the prompt layer
- `KANBAN.md` current backlog, next steps, and completed work
- `docs/reference-analysis.md` what we adopted from each reference repo
- `docs/architecture.md` current local prototype architecture
- `index.html`, `styles.css`, `app.js` frontend

## Product flow

- `Phase 1 - Ideation Qualification`
  Pressure test whether the idea deserves deeper work.
- `Phase 2 - Spec`
  Turn a qualified idea into a product brief, core scenarios, scope boundaries,
  assumptions, and acceptance criteria.
- `Phase 3 - Dev`
  Turn the spec into an engineering plan, ADR-backed stack choices, task
  sequence, architecture risk review, testing, security, and compliance
  expectations.
- `Phase 4 - Agent Team Generator`
  Generate a lean, project-specific team of IDE agent prompts from the Phase
  1-3 context, including shared context, ownership, boundaries, and copy-ready
  prompts.

Each phase has its own team, its own chat history, and its own exit criteria.

## Current prototype direction

- `worth-building` supplies the skeptical decision logic and multi-voice room
  pattern
- `startup-skills` supplies framework-driven workflows and deliverable thinking
- `stratarts` supplies context chaining and structured output discipline
- `get-shit-done` supplies scope boundaries and falsifiable acceptance framing
- `OpenSpec` supplies requirements-plus-scenarios artifact thinking
- `spec-kit` supplies clarification discipline and spec readiness checks
- `BMAD-METHOD` supplies PRD-style product framing and workflow facilitation
- `Azure Architecture Review Agent` supplies architecture risk and recommendation behavior
- `Architecture Decision Record` supplies context, decision, and consequences for stack choices
- `12-Factor Agents` supplies stable agent workflow and tool-boundary principles
