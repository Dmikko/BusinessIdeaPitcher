# Kanban

## Backlog

- Add end-to-end browser coverage for the Phase 1-4 UI flow.
- Verify the live OpenAI path with a safe mocked network layer or a gated integration test.
- Decide whether project rename and clipboard actions need more UX safeguards.
- Add release verification for the Windows installer path.

## In Progress

- Keep the Node server, Electron wrapper, and Docker runtime paths aligned.
- Tighten the docs so README, architecture notes, and reference analysis stay consistent.

## Next

- Add the new CI workflows to GitHub and watch the first runs.
- Review the Phase 4 generated agent prompts against a few realistic project examples.
- Decide whether the kanban should stay in Markdown or move into a GitHub Project later.

## Done

- Added automated API contract tests for bootstrap, chat, agent-team, bad JSON, and path traversal.
- Added launcher tests for the Electron wrapper and the `ELECTRON_RUN_AS_NODE` safeguard.
- Added GitHub Actions workflows for Node CI and Docker smoke coverage.
- Fixed the desktop launch path, the Docker env handling, and the stale 3-phase wording.
