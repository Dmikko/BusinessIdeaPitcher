const state = {
  phases: [],
  panelists: [],
  repoInsights: [],
  runtime: {
    mode: "booting",
    label: "Booting...",
    note: "Loading panel configuration.",
  },
  activePhaseId: null,
  selectedPanelId: null,
  phaseSessions: {},
  pending: false,
};

const phaseTabs = document.querySelector("#phaseTabs");
const thread = document.querySelector("#thread");
const panelList = document.querySelector("#panelList");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const seedPromptButton = document.querySelector("#seedPrompt");
const summaryCard = document.querySelector("#summaryCard");
const phaseCard = document.querySelector("#phaseCard");
const selectedRoleCard = document.querySelector("#selectedRoleCard");
const runtimeCard = document.querySelector("#runtimeCard");
const runtimePill = document.querySelector("#runtimePill");
const runtimeNote = document.querySelector("#runtimeNote");
const sendButton = document.querySelector("#sendButton");
const stageEyebrow = document.querySelector("#stageEyebrow");
const stageTitle = document.querySelector("#stageTitle");
const composerLabel = document.querySelector("#composerLabel");
const summaryTitle = document.querySelector("#summaryTitle");

bootstrap();

phaseTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-phase-id]");
  if (!button || state.pending) {
    return;
  }

  switchPhase(button.dataset.phaseId);
});

panelList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-panel-id]");
  if (!button) {
    return;
  }

  state.selectedPanelId = button.dataset.panelId;
  renderPanelList();
  renderSelectedRole();
});

seedPromptButton.addEventListener("click", () => {
  const phase = getActivePhase();
  if (!phase) {
    return;
  }

  promptInput.value = phase.examplePrompt;
  promptInput.focus();
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleSubmit();
});

async function bootstrap() {
  try {
    const payload = await fetchJson("/api/bootstrap");
    state.phases = payload.phases;
    state.panelists = payload.panelists;
    state.repoInsights = payload.repoInsights;
    state.runtime = payload.runtime;

    renderRuntime();
    switchPhase(payload.defaultPhaseId || state.phases[0]?.id);
  } catch (error) {
    state.runtime = {
      mode: "fallback",
      label: "Load issue",
      note: "Could not load bootstrap data from the local server.",
    };
    renderRuntime();
    thread.innerHTML = "";
    thread.append(
      createMessageElement({
        type: "system",
        speaker: "Runtime",
        body: "The frontend could not reach /api/bootstrap. Start the local server and reload.",
      }),
    );
  }
}

async function handleSubmit() {
  if (state.pending) {
    return;
  }

  const requestPhaseId = state.activePhaseId;
  const prompt = promptInput.value.trim();
  if (!prompt || !requestPhaseId) {
    return;
  }

  appendMessage({
    type: "user",
    title: "You",
    body: prompt,
  }, requestPhaseId);

  promptInput.value = "";
  setPending(true);

  try {
    const payload = await fetchJson("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phaseId: requestPhaseId,
        message: prompt,
        thread: buildThreadPayload(requestPhaseId),
      }),
    });

    state.runtime = payload.runtime;
    renderRuntime();
    const resolvedPhaseId = payload.phaseId || requestPhaseId;
    const session = ensurePhaseSession(resolvedPhaseId);
    session.summary = payload.synthesis;

    payload.responses.forEach((entry) => {
      const panelist = state.panelists.find((item) => item.id === entry.panelistId);
      if (!panelist) {
        return;
      }

      appendMessage({
        type: "panel",
        title: panelist.name,
        body: entry.message,
        tags: entry.tags,
        accent: panelist.accent,
        meta: panelist.focus,
      }, resolvedPhaseId);
    });

    if (payload.runtime?.fallbackReason) {
      appendMessage({
        type: "system",
        title: "Runtime",
        body: `Live call failed, so the server used the mock panel instead. Reason: ${payload.runtime.fallbackReason}`,
      }, resolvedPhaseId);
    }

    if (state.activePhaseId === resolvedPhaseId) {
      renderThread();
      updateSummary(session.summary);
    }
  } catch (error) {
    appendMessage({
      type: "system",
      title: "Runtime",
      body: "The panel request failed. Check the local server and try again.",
    }, requestPhaseId);
  } finally {
    setPending(false);
  }
}

function switchPhase(phaseId) {
  const phase = getPhase(phaseId);
  if (!phase) {
    return;
  }

  state.activePhaseId = phase.id;
  ensurePhaseSession(phase.id);

  const phasePanelists = getPanelistsForPhase(phase.id);
  if (!phasePanelists.some((panelist) => panelist.id === state.selectedPanelId)) {
    state.selectedPanelId = phasePanelists[0]?.id || null;
  }

  renderPhaseTabs();
  renderPhaseCard();
  renderPanelList();
  renderSelectedRole();
  renderStageCopy();
  renderThread();
  updateSummary(getActiveSession().summary);
}

function ensurePhaseSession(phaseId) {
  if (!state.phaseSessions[phaseId]) {
    const phase = getPhase(phaseId);
    state.phaseSessions[phaseId] = {
      summary: clone(phase.defaultSummary),
      thread: [
        {
          type: "system",
          title: phase.shortLabel,
          body: phase.intro,
          tags: [],
        },
      ],
    };
  }

  return state.phaseSessions[phaseId];
}

function getActiveSession() {
  return ensurePhaseSession(state.activePhaseId);
}

function getPhase(phaseId) {
  return state.phases.find((phase) => phase.id === phaseId);
}

function getActivePhase() {
  return getPhase(state.activePhaseId);
}

function getPanelistsForPhase(phaseId) {
  return state.panelists.filter((panelist) => panelist.phaseId === phaseId);
}

function renderPhaseTabs() {
  phaseTabs.innerHTML = "";

  state.phases.forEach((phase) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-tab";
    button.dataset.phaseId = phase.id;

    if (phase.id === state.activePhaseId) {
      button.classList.add("active");
    }

    const title = document.createElement("div");
    title.className = "phase-tab-title";
    title.innerHTML = `<span class="panel-chip" style="background:${phase.accent}"></span><span>${phase.shortLabel} - ${phase.name}</span>`;

    const copy = document.createElement("div");
    copy.className = "phase-tab-copy";
    copy.textContent = phase.objective;

    button.append(title, copy);
    phaseTabs.append(button);
  });
}

function renderPhaseCard() {
  const phase = getActivePhase();
  if (!phase) {
    phaseCard.textContent = "No phase selected.";
    return;
  }

  phaseCard.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = `${phase.shortLabel} - ${phase.name}`;

  const objective = document.createElement("p");
  objective.className = "muted";
  objective.textContent = phase.objective;

  const exit = document.createElement("div");
  exit.className = "role-stance";
  exit.textContent = `Exit: ${phase.exitCriteria}`;

  phaseCard.append(title, objective, exit);
}

function renderPanelList() {
  panelList.innerHTML = "";

  getPanelistsForPhase(state.activePhaseId).forEach((panelist) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "panel-button";
    button.dataset.panelId = panelist.id;

    if (panelist.id === state.selectedPanelId) {
      button.classList.add("active");
    }

    const title = document.createElement("div");
    title.className = "panel-title";
    title.innerHTML = `<span>${panelist.name}</span><span class="panel-chip" style="background:${panelist.accent}"></span>`;

    const copy = document.createElement("div");
    copy.className = "panel-copy";
    copy.textContent = panelist.focus;

    button.append(title, copy);
    panelList.append(button);
  });
}

function renderSelectedRole() {
  selectedRoleCard.innerHTML = "";
  const panelist = getPanelistsForPhase(state.activePhaseId).find(
    (item) => item.id === state.selectedPanelId,
  );

  if (!panelist) {
    selectedRoleCard.textContent = "No role selected yet.";
    return;
  }

  const title = document.createElement("h3");
  title.textContent = panelist.name;

  const stance = document.createElement("div");
  stance.className = "role-stance";
  stance.textContent = panelist.stance;

  const focus = document.createElement("p");
  focus.className = "muted";
  focus.textContent = panelist.focus;

  const sourceRow = document.createElement("div");
  sourceRow.className = "chip-row";

  panelist.inspiredBy.forEach((source) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = source;
    sourceRow.append(chip);
  });

  selectedRoleCard.append(title, stance, focus, sourceRow);
}

function renderStageCopy() {
  const phase = getActivePhase();
  if (!phase) {
    return;
  }

  stageEyebrow.textContent = `${phase.shortLabel} Room`;
  stageTitle.textContent = `Chat with ${phase.name}`;
  composerLabel.textContent = `Pitch your question to the ${phase.name} team.`;
  promptInput.placeholder = phase.examplePrompt;
  summaryTitle.textContent = `What ${phase.shortLabel} should resolve`;
}

function renderRuntime() {
  runtimePill.textContent = state.runtime.label;
  runtimePill.className = `status-pill ${state.runtime.mode}`;
  runtimeNote.textContent = state.runtime.note;

  runtimeCard.innerHTML = "";

  const strong = document.createElement("div");
  strong.className = "runtime-strong";
  strong.textContent = state.runtime.mode === "live" ? "Live orchestration" : "Local-safe runtime";

  const copy = document.createElement("p");
  copy.className = "muted";
  copy.textContent = state.runtime.note;

  runtimeCard.append(strong, copy);
}

function appendMessage({ type, title, body, tags = [], accent, meta }, phaseId = state.activePhaseId) {
  const session = ensurePhaseSession(phaseId);

  session.thread.push({
    type,
    speaker: title,
    body,
    tags,
    accent,
    meta,
  });

  if (phaseId === state.activePhaseId) {
    renderThread();
  }
}

function renderThread() {
  thread.innerHTML = "";

  getActiveSession().thread.forEach((entry) => {
    thread.append(createMessageElement(entry));
  });

  thread.scrollTop = thread.scrollHeight;
}

function createMessageElement({ type, speaker, body, tags = [], accent, meta }) {
  const article = document.createElement("article");
  article.className = `message ${type}`;

  const head = document.createElement("div");
  head.className = "message-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "message-title";

  if (accent) {
    const chip = document.createElement("span");
    chip.className = "panel-chip";
    chip.style.background = accent;
    titleWrap.append(chip);
  }

  const titleText = document.createElement("span");
  titleText.textContent = speaker;
  titleWrap.append(titleText);

  head.append(titleWrap);

  if (meta) {
    const metaText = document.createElement("div");
    metaText.className = "message-meta";
    metaText.textContent = meta;
    head.append(metaText);
  }

  const bodyNode = document.createElement("div");
  bodyNode.className = "message-body";
  bodyNode.textContent = body;

  article.append(head, bodyNode);

  if (tags.length > 0) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "message-tags";

    tags.forEach((tag) => {
      const tagNode = document.createElement("span");
      tagNode.className = "message-tag";
      tagNode.textContent = tag;
      tagWrap.append(tagNode);
    });

    article.append(tagWrap);
  }

  return article;
}

function buildThreadPayload(phaseId) {
  return ensurePhaseSession(phaseId).thread
    .filter((entry) => entry.type !== "system")
    .slice(-10)
    .map((entry) => ({
      type: entry.type,
      speaker: entry.speaker,
      body: entry.body,
      tags: entry.tags,
    }));
}

function setPending(isPending) {
  state.pending = isPending;
  promptInput.disabled = isPending;
  sendButton.disabled = isPending;
  seedPromptButton.disabled = isPending;
  sendButton.textContent = isPending ? "Thinking..." : "Send to panel";
}

function updateSummary(summary) {
  summaryCard.innerHTML = "";

  const items = [
    {
      title: "Phase signal",
      copy: `${summary.signal} (${summary.confidence || "Unknown"})`,
    },
    {
      title: "Focus",
      copy: summary.focus,
    },
    {
      title: "Main risk",
      copy: summary.mainRisk,
    },
    {
      title: "Next step",
      copy: summary.nextStep,
    },
    {
      title: "Exit criteria",
      copy: summary.exitCriteria,
    },
  ];

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "summary-item";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const copy = document.createElement("p");
    copy.textContent = item.copy;

    card.append(title, copy);
    summaryCard.append(card);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
