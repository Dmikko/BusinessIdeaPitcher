const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = __dirname;
const PHASES_PATH = path.join(ROOT_DIR, "data", "phases.json");
const PANELISTS_PATH = path.join(ROOT_DIR, "data", "panelists.json");
const REFERENCE_INSIGHTS_PATH = path.join(
  ROOT_DIR,
  "data",
  "reference-insights.json",
);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      return sendJson(response, 200, buildBootstrapPayload());
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(request);
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const thread = Array.isArray(body?.thread) ? body.thread : [];
      const phaseId = typeof body?.phaseId === "string" ? body.phaseId : "";

      if (!message) {
        return sendJson(response, 400, { error: "Missing message" });
      }

      const payload = await buildPanelTurn({ phaseId, message, thread });
      return sendJson(response, 200, payload);
    }

    if (request.method === "GET") {
      return serveStaticAsset(url.pathname, response);
    }

    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(response, 500, {
      error: "Server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Business Idea Pitcher running at http://localhost:${PORT}`);
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function buildBootstrapPayload() {
  const phases = readJsonFile(PHASES_PATH);
  const panelists = readJsonFile(PANELISTS_PATH);
  const repoInsights = readJsonFile(REFERENCE_INSIGHTS_PATH);
  const runtime = getRuntimeState();

  return {
    phases,
    panelists,
    repoInsights,
    runtime,
    defaultPhaseId: phases[0]?.id || null,
  };
}

async function buildPanelTurn({ phaseId, message, thread }) {
  const phases = readJsonFile(PHASES_PATH);
  const panelists = readJsonFile(PANELISTS_PATH);
  const repoInsights = readJsonFile(REFERENCE_INSIGHTS_PATH);
  const runtimeState = getRuntimeState();
  const phase = phases.find((entry) => entry.id === phaseId) || phases[0];
  const phasePanelists = panelists.filter((panelist) => panelist.phaseId === phase.id);
  const phaseRepoInsights = getRepoInsightsForPhase(repoInsights, phase.id);

  let result;
  let runtime = runtimeState;

  if (runtimeState.llmConfigured) {
    try {
      result = await callLiveModel({
        phase,
        message,
        thread,
        panelists: phasePanelists,
        repoInsights: phaseRepoInsights,
      });
      runtime = {
        ...runtimeState,
        mode: "live",
        label: "Live LLM",
        note: `Live ${phase.shortLabel} orchestration via ${process.env.OPENAI_MODEL || "gpt-5.4"}.`,
      };
    } catch (error) {
      result = buildMockPanelTurn({ phase, message, panelists: phasePanelists });
      runtime = {
        ...runtimeState,
        mode: "fallback",
        label: "Mock fallback",
        note:
          "Live model call failed, so the panel fell back to the local mock engine.",
        fallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    result = buildMockPanelTurn({ phase, message, panelists: phasePanelists });
  }

  return {
    phaseId: phase.id,
    runtime,
    synthesis: result.synthesis,
    responses: result.responses,
  };
}

async function callLiveModel({ phase, message, thread, panelists, repoInsights }) {
  const response = await fetch(getOpenAIResponsesUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildOpenAIRequestBody({
        phase,
        message,
        thread,
        panelists,
        repoInsights,
      }),
    ),
  });

  if (!response.ok) {
    const errorBody = await safeReadText(response);
    throw new Error(`OpenAI request failed with ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();
  const content = extractOpenAIOutputText(payload);
  const parsed = tryParseJson(content);

  if (!parsed) {
    throw new Error("Could not parse JSON from model response");
  }

  return normalizeModelPayload(parsed, phase, panelists, message);
}

function buildSystemPrompt(phase, panelists, repoInsights) {
  const repoLines =
    repoInsights.length > 0
      ? repoInsights.map(
          (repo) =>
            `- ${repo.name}: strength=${repo.strength}; adopt ${repo.adopt.join(", ")}; avoid ${repo.avoid.join(", ")}`,
        )
      : ["- No room-specific reference repos are assigned yet. Use the phase objective and panel roles as the primary guide."];

  return [
    "You orchestrate one room in a 3-phase business idea pitcher app.",
    `Current room: ${phase.shortLabel} - ${phase.name}.`,
    `Objective: ${phase.objective}`,
    `Exit criteria: ${phase.exitCriteria}`,
    "Blend these repo ideas for the current room only:",
    ...repoLines,
    "Panel behavior rules:",
    "- Default to constructive skepticism.",
    "- Separate evidence from inference.",
    "- Make each role sound distinct.",
    "- Keep each role to 2-4 sentences.",
    "- Avoid filler and praise-first phrasing.",
    "- End with one concrete next move or forcing question for this phase.",
    "- If the idea, spec, or dev plan is weak or vague, say so directly.",
    "- Optimize for the current room's job, not generic startup advice.",
    "- In Phase 2, stay technology-agnostic and focus on product brief, scenarios, scope, assumptions, and acceptance criteria.",
    "Panelists:",
    ...panelists.map(
      (panelist) =>
        `- ${panelist.id}: ${panelist.name}. Focus=${panelist.focus}. Stance=${panelist.stance}. Notes=${panelist.promptNotes.join(" | ")}`,
    ),
    "Return valid JSON only.",
    "Schema:",
    JSON.stringify(
      {
        synthesis: {
          signal: "short phase-specific signal",
          confidence: "Low | Medium | High",
          focus: "short string",
          mainRisk: "short string",
          nextStep: "short string",
          exitCriteria: "short string",
        },
        responses: panelists.map((panelist) => ({
          panelistId: panelist.id,
          message: "2-4 sentences in that role's voice",
          tags: ["short tag", "short tag"],
        })),
      },
      null,
      2,
    ),
  ].join("\n");
}

function buildUserPrompt(phase, thread, message, panelists) {
  const transcript = thread
    .slice(-10)
    .map((entry) => `[${entry.speaker || entry.type}] ${entry.body}`)
    .join("\n");

  return [
    `Current phase: ${phase.shortLabel} - ${phase.name}`,
    `Phase objective: ${phase.objective}`,
    `Phase exit criteria: ${phase.exitCriteria}`,
    "",
    "Conversation transcript so far:",
    transcript || "(empty)",
    "",
    "Latest user message:",
    message,
    "",
    "Every panelist must answer in this turn:",
    ...panelists.map((panelist) => `- ${panelist.id}: ${panelist.name}`),
  ].join("\n");
}

function buildOpenAIRequestBody({ phase, message, thread, panelists, repoInsights }) {
  return {
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    store: parseBooleanEnv(process.env.OPENAI_STORE, false),
    instructions: buildSystemPrompt(phase, panelists, repoInsights),
    input: [
      {
        role: "user",
        content: buildUserPrompt(phase, thread, message, panelists),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "phase_panel_turn",
        strict: true,
        schema: buildPanelTurnSchema(panelists),
      },
    },
  };
}

function buildPanelTurnSchema(panelists) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["synthesis", "responses"],
    properties: {
      synthesis: {
        type: "object",
        additionalProperties: false,
        required: ["signal", "confidence", "focus", "mainRisk", "nextStep", "exitCriteria"],
        properties: {
          signal: { type: "string" },
          confidence: { type: "string", enum: ["Low", "Medium", "High"] },
          focus: { type: "string" },
          mainRisk: { type: "string" },
          nextStep: { type: "string" },
          exitCriteria: { type: "string" },
        },
      },
      responses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["panelistId", "message", "tags"],
          properties: {
            panelistId: {
              type: "string",
              enum: panelists.map((panelist) => panelist.id),
            },
            message: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

function normalizeModelPayload(payload, phase, panelists, message) {
  const mockPayload = buildMockPanelTurn({ phase, message, panelists });
  const responseMap = new Map(
    Array.isArray(payload?.responses)
      ? payload.responses
          .filter((item) => item && typeof item.panelistId === "string")
          .map((item) => [item.panelistId, item])
      : [],
  );

  return {
    synthesis: {
      signal: cleanText(payload?.synthesis?.signal) || mockPayload.synthesis.signal,
      confidence:
        cleanText(payload?.synthesis?.confidence) ||
        mockPayload.synthesis.confidence,
      focus: cleanText(payload?.synthesis?.focus) || mockPayload.synthesis.focus,
      mainRisk:
        cleanText(payload?.synthesis?.mainRisk) ||
        mockPayload.synthesis.mainRisk,
      nextStep:
        cleanText(payload?.synthesis?.nextStep) ||
        mockPayload.synthesis.nextStep,
      exitCriteria:
        cleanText(payload?.synthesis?.exitCriteria) ||
        mockPayload.synthesis.exitCriteria,
    },
    responses: panelists.map((panelist) => {
      const liveItem = responseMap.get(panelist.id);
      const mockItem = mockPayload.responses.find(
        (item) => item.panelistId === panelist.id,
      );

      return {
        panelistId: panelist.id,
        message: cleanText(liveItem?.message) || mockItem.message,
        tags:
          normalizeTags(liveItem?.tags).length > 0
            ? normalizeTags(liveItem?.tags)
            : mockItem.tags,
      };
    }),
  };
}

function buildMockPanelTurn({ phase, message, panelists }) {
  const frame = inferPhaseFrame(phase.id, message);

  return {
    synthesis: {
      signal: frame.signal,
      confidence: frame.confidence,
      focus: frame.focus,
      mainRisk: frame.mainRisk,
      nextStep: frame.nextStep,
      exitCriteria: frame.exitCriteria,
    },
    responses: panelists.map((panelist) => ({
      panelistId: panelist.id,
      message: buildMockResponse(panelist.id, frame),
      tags: frame.tagsByPanel[panelist.id] || frame.defaultTags,
    })),
  };
}

function inferPhaseFrame(phaseId, message) {
  if (phaseId === "phase-2-spec") {
    return inferSpecFrame(message);
  }

  if (phaseId === "phase-3-dev") {
    return inferDevFrame(message);
  }

  return inferIdeationFrame(message);
}

function inferIdeationFrame(message) {
  const lower = message.toLowerCase();

  if (
    lower.includes("ai") ||
    lower.includes("assistant") ||
    lower.includes("copilot")
  ) {
    return {
      signal: "validate-first",
      confidence: "Medium",
      focus:
        "There is room if the product owns one painful workflow instead of sounding like another generic AI wrapper.",
      mainRisk:
        "Differentiation will collapse if the buyer, trigger, and workflow stay broad.",
      nextStep:
        "Interview five target users around one specific workflow and test whether the pain is urgent enough to change behavior now.",
      exitCriteria:
        "You can name one buyer, one painful workflow, one switch trigger, and one cheap validation move.",
      defaultTags: ["AI workflow", "narrow the wedge"],
      tagsByPanel: {
        "business-developer": ["wedge", "buyer clarity"],
        skeptic: ["thin moat", "weak urgency"],
        "market-scout": ["beachhead", "switching"],
        "validation-coach": ["smallest proof", "2-week test"],
      },
    };
  }

  if (
    lower.includes("marketplace") ||
    lower.includes("community") ||
    lower.includes("network")
  ) {
    return {
      signal: "park",
      confidence: "Medium",
      focus:
        "A network business can become strong if one side gets immediate standalone value before the network effect arrives.",
      mainRisk:
        "Cold start and split focus will kill momentum if both sides must show up at once.",
      nextStep:
        "Pick the first side to serve and define the standalone value they get even if the other side is still tiny.",
      exitCriteria:
        "You can explain which side gets immediate value before any network effect exists.",
      defaultTags: ["network play", "cold start"],
      tagsByPanel: {
        "business-developer": ["one side first", "value exchange"],
        skeptic: ["cold start", "fake liquidity"],
        "market-scout": ["first channel", "beachhead side"],
        "validation-coach": ["manual first", "ops load"],
      },
    };
  }

  if (
    lower.includes("saas") ||
    lower.includes("software") ||
    lower.includes("platform")
  ) {
    return {
      signal: "validate-first",
      confidence: "Medium",
      focus:
        "A focused B2B software wedge can work if the first buyer gets a clear before-and-after without a long implementation cycle.",
      mainRisk:
        "Adoption will stall if switching cost and internal approval are higher than the promised value.",
      nextStep:
        "Write the one-sentence transformation for the first buyer, then test it on live calls before building deeper features.",
      exitCriteria:
        "You can name the first buyer, their current alternative, and the smallest proof that would earn spec work.",
      defaultTags: ["B2B software", "switching"],
      tagsByPanel: {
        "business-developer": ["commercial path", "pricing logic"],
        skeptic: ["slow switching", "approval risk"],
        "market-scout": ["first 10 customers", "message test"],
        "validation-coach": ["walking skeleton", "scope cut"],
      },
    };
  }

  return {
    signal: "too-early",
    confidence: "Low",
    focus:
      "The concept may have room, but only after it is tightened around one user, one painful trigger, and one measurable outcome.",
    mainRisk:
      "Right now the positioning is probably too loose to tell whether this is a business or just an interesting concept.",
    nextStep:
      "Rewrite the idea around one buyer, one painful moment, and one reason they would pay this quarter.",
    exitCriteria:
      "The room can describe a narrow wedge, a target buyer, and the riskiest assumption to test.",
    defaultTags: ["new concept", "clarify"],
    tagsByPanel: {
      "business-developer": ["tighten the wedge", "business case"],
      skeptic: ["too vague", "hidden assumption"],
      "market-scout": ["who buys first", "channel reality"],
      "validation-coach": ["testable scope", "first proof"],
    },
  };
}

function inferSpecFrame(message) {
  const lower = message.toLowerCase();

  if (lower.includes("marketplace") || lower.includes("community")) {
    return {
      signal: "spec-risk",
      confidence: "Medium",
      focus:
        "The spec should define one side of the market first, spell out the core scenarios, and make that workflow stand on its own.",
      mainRisk:
        "The spec will drift if it tries to satisfy both sides of a network before either side has standalone value or acceptance boundaries.",
      nextStep:
        "Write a v1 product brief for only the first side of the market, list the opposite side as future scope, and define the acceptance scenarios for that first workflow.",
      exitCriteria:
        "The user, workflow, v1 scope, assumptions, and explicit out-of-scope list are clear for the first side only.",
      defaultTags: ["single-side v1", "spec discipline"],
      tagsByPanel: {
        "product-manager": ["product brief", "single side"],
        "clarification-lead": ["open questions", "ambiguity"],
        "workflow-designer": ["workflow map", "handoffs"],
        "boundary-keeper": ["scope lock", "acceptance criteria"],
      },
    };
  }

  return {
    signal: "spec-sharpening",
    confidence: "Medium",
    focus:
      "Define the product brief, the critical user scenarios, the open assumptions, and the v1 boundary that planning can actually inherit.",
    mainRisk:
      "The spec will bloat if the team mixes multiple users, workflows, and success metrics into the same v1 without explicit exclusions.",
    nextStep:
      "Write a one-page brief covering the problem, target user, current and target workflow, v1 scope, non-goals, unresolved assumptions, and acceptance criteria.",
    exitCriteria:
      "The room agrees on problem, user, scenarios, v1 scope, non-goals, assumptions, and what must be true before dev starts.",
    defaultTags: ["product brief", "acceptance ready"],
    tagsByPanel: {
      "product-manager": ["product brief", "outcome"],
      "clarification-lead": ["assumptions", "clarify"],
      "workflow-designer": ["before-after", "key scenarios"],
      "boundary-keeper": ["non-goals", "acceptance criteria"],
    },
  };
}

function getRepoInsightsForPhase(repoInsights, phaseId) {
  return repoInsights.filter((repo) => {
    if (!Array.isArray(repo.phaseIds) || repo.phaseIds.length === 0) {
      return true;
    }

    return repo.phaseIds.includes(phaseId);
  });
}

function inferDevFrame(message) {
  const lower = message.toLowerCase();

  if (
    lower.includes("health") ||
    lower.includes("clinic") ||
    lower.includes("patient") ||
    lower.includes("compliance")
  ) {
    return {
      signal: "guardrail-heavy",
      confidence: "High",
      focus:
        "This build needs explicit technical and governance defaults before coding starts because the trust model is part of the product.",
      mainRisk:
        "Security, data handling, and auditability will become expensive rework if they are not defined alongside the architecture.",
      nextStep:
        "Freeze auth, data classification, logging, test coverage expectations, and the core system boundaries before implementation.",
      exitCriteria:
        "Stack, architecture, testing, security controls, and compliance assumptions are explicit enough for tickets and PRs.",
      defaultTags: ["trust surface", "guardrails"],
      tagsByPanel: {
        "staff-engineer": ["boring stack", "repo defaults"],
        "systems-architect": ["boundaries", "data flow"],
        "qa-lead": ["release gates", "test plan"],
        "security-compliance": ["data class", "audit trail"],
      },
    };
  }

  return {
    signal: "delivery-planning",
    confidence: "Medium",
    focus:
      "Pick boring defaults, clear system boundaries, and explicit quality gates before the team writes code.",
    mainRisk:
      "Implicit tech choices and undefined quality standards will create avoidable rework during build.",
    nextStep:
      "Decide stack, repo conventions, architectural boundaries, test strategy, and security baseline in one shared build brief.",
    exitCriteria:
      "The team can start implementation with clear engineering defaults and guardrails instead of assumptions.",
    defaultTags: ["build brief", "engineering defaults"],
    tagsByPanel: {
      "staff-engineer": ["stack", "coding standards"],
      "systems-architect": ["service boundaries", "integration map"],
      "qa-lead": ["test matrix", "release quality"],
      "security-compliance": ["auth", "privacy baseline"],
    },
  };
}

function buildMockResponse(panelistId, frame) {
  switch (panelistId) {
    case "business-developer":
      return `The useful question is not whether the idea sounds interesting. It is whether you can name one buyer, one painful trigger, and one commercial path that feels expensive to ignore. ${frame.focus}`;
    case "skeptic":
      return `I would assume the current version of the idea breaks on contact with the market. ${frame.mainRisk} If you cannot answer the buyer, urgency, and switching questions concretely, you should not treat this as a build candidate yet.`;
    case "market-scout":
      return `Distribution has to work before the market story matters. I want to know who the first 10 customers are, why they would switch now, and what channel reaches them cheaply. ${frame.nextStep}`;
    case "validation-coach":
      return `Cut the scope hard and prove one thing. Build the smallest version that either confirms the pain is urgent or kills the premise quickly. ${frame.nextStep}`;
    case "product-manager":
      return `The spec should read like a product brief with intent, not a wishlist of features. ${frame.focus} I want the problem, the user, the business outcome, and a disciplined v1 to be obvious on first read.`;
    case "clarification-lead":
      return `I am looking for the hidden assumptions that will force replanning later. Name the open questions, the decisions still unresolved, and which ambiguities actually change scope or user experience. ${frame.exitCriteria}`;
    case "workflow-designer":
      return `Describe the workflow before you add features to it. I want the trigger, the current steps, the handoffs, the output, and the target scenario the product must support. ${frame.mainRisk}`;
    case "boundary-keeper":
      return `The spec is not ready until scope is locked and acceptance language is testable. I want explicit non-goals, crisp requirements, and scenario-level criteria that define what done means for v1. ${frame.nextStep}`;
    case "staff-engineer":
      return `Pick boring defaults on purpose. I want the stack, repo conventions, and implementation style written down before the first ticket exists so the team is not improvising architecture through PRs. ${frame.focus}`;
    case "systems-architect":
      return `Define boundaries before code makes them sticky. I want the main components, data flow, integration points, and where state lives so the system shape is explicit rather than accidental. ${frame.mainRisk}`;
    case "qa-lead":
      return `Quality needs a strategy before delivery starts. State what gets unit tests, integration tests, end-to-end coverage, and what release gates are non-negotiable for this product. ${frame.nextStep}`;
    case "security-compliance":
      return `Security and compliance should be designed into the build brief, not retrofitted later. Classify the data, define auth, logging, privacy expectations, and the compliance assumptions that could shape the system. ${frame.exitCriteria}`;
    default:
      return frame.focus;
  }
}

function getRuntimeState() {
  const llmConfigured = Boolean(process.env.OPENAI_API_KEY);

  return {
    llmConfigured,
    mode: llmConfigured ? "live-ready" : "mock",
    label: llmConfigured ? "OpenAI ready" : "Mock mode",
    note: llmConfigured
      ? `OpenAI settings detected for ${process.env.OPENAI_MODEL || "gpt-5.4"}.`
      : "No OpenAI API key detected. The app will answer with the local mock engine.",
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

function serveStaticAsset(urlPath, response) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT_DIR, requestedPath);

  if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath)) {
    return sendJson(response, 404, { error: "Not found" });
  }

  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const content = fs.readFileSync(filePath);

  response.writeHead(200, { "Content-Type": contentType });
  response.end(content);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function extractOpenAIOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload?.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((contentItem) => {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function tryParseJson(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch (innerError) {
      return null;
    }
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => cleanText(tag))
    .filter(Boolean)
    .slice(0, 3);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getOpenAIResponsesUrl() {
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  return `${baseUrl}/responses`;
}

function parseBooleanEnv(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return fallback;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (error) {
    return "";
  }
}
