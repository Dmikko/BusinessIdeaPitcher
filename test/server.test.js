const test = require("node:test");
const assert = require("node:assert/strict");

const { startServer } = require("../server");

async function withServer(run) {
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";

  const handle = await startServer(0);

  try {
    await run(handle.url);
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
    await new Promise((resolve) => handle.server.close(resolve));
  }
}

test("GET /api/bootstrap returns the app contract in mock mode", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/bootstrap`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.defaultPhaseId, "phase-1-ideation");
    assert.equal(payload.runtime.mode, "mock");
    assert.equal(payload.phases.length, 4);
    assert.equal(payload.phases[3].id, "phase-4-agent-team");
    assert.ok(payload.panelists.length >= 13);
  });
});

test("POST /api/chat returns a phase turn with one response per panelist", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phaseId: "phase-2-spec",
        message: "Help define a v1 product brief for an AI scribe for PT clinics.",
        thread: [],
        projectContext: null,
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.phaseId, "phase-2-spec");
    assert.equal(payload.runtime.mode, "mock");
    assert.equal(payload.responses.length, 4);
    assert.deepEqual(
      payload.responses.map((entry) => entry.panelistId),
      [
        "product-manager",
        "clarification-lead",
        "workflow-designer",
        "boundary-keeper",
      ],
    );
    assert.equal(typeof payload.synthesis.focus, "string");
    assert.equal(typeof payload.synthesis.exitCriteria, "string");
  });
});

test("POST /api/agent-team returns a practical mock team", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/agent-team`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectContext: {
          projectId: "clinic-scribe",
          projectName: "Clinic Scribe",
          currentPhaseId: "phase-4-agent-team",
          phases: [
            {
              phaseId: "phase-1-ideation",
              shortLabel: "Phase 1",
              name: "Ideation Qualification",
              summary: {
                signal: "validate-first",
                confidence: "Medium",
                focus: "AI scribe for physical therapy clinics",
                mainRisk: "The wedge is still too broad.",
                nextStep: "Narrow to one workflow.",
                exitCriteria: "One buyer and one validation move are explicit.",
              },
              recentThread: [],
            },
            {
              phaseId: "phase-3-dev",
              shortLabel: "Phase 3",
              name: "Dev",
              summary: {
                signal: "guardrail-heavy",
                confidence: "High",
                focus: "Freeze auth, audit logs, and trust boundaries before coding.",
                mainRisk: "Compliance assumptions are still implicit.",
                nextStep: "Write ADRs and define controls.",
                exitCriteria: "Security controls and tasks are explicit.",
              },
              recentThread: [],
            },
          ],
        },
        constraints: {
          teamSize: "recommended",
          targetFormat: "IDE prompt blocks",
          detailLevel: "practical",
        },
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.runtime.mode, "mock");
    assert.ok(payload.agentTeam.recommendedAgents.length >= 3);
    assert.ok(payload.agentTeam.recommendedAgents.length <= 6);
    assert.match(payload.agentTeam.sharedContextPrompt, /Clinic Scribe/);
  });
});

test("POST /api/chat rejects missing messages with 400", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phaseId: "phase-1-ideation",
        message: "   ",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, "Missing message");
  });
});

test("POST /api/chat rejects malformed JSON with 400", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{bad json",
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, "Bad request");
  });
});

test("private files are not served as static assets", async () => {
  await withServer(async (url) => {
    const hiddenFileResponse = await fetch(`${url}/.env`);
    const hiddenFilePayload = await hiddenFileResponse.json();
    const backendFileResponse = await fetch(`${url}/server.js`);
    const backendFilePayload = await backendFileResponse.json();

    assert.equal(hiddenFileResponse.status, 404);
    assert.equal(hiddenFilePayload.error, "Not found");
    assert.equal(backendFileResponse.status, 404);
    assert.equal(backendFilePayload.error, "Not found");
  });
});
