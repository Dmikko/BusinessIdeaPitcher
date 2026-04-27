const STORAGE_KEY = "business-idea-pitcher.projects.v1";

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
  projects: [],
  activeProjectId: null,
  drawerOpen: false,
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
const projectDrawer = document.querySelector("#projectDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const openProjectDrawerButton = document.querySelector("#openProjectDrawer");
const closeProjectDrawerButton = document.querySelector("#closeProjectDrawer");
const newProjectButton = document.querySelector("#newProjectButton");
const renameProjectButton = document.querySelector("#renameProjectButton");
const projectList = document.querySelector("#projectList");
const activeProjectLabel = document.querySelector("#activeProjectLabel");

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
  saveActiveProject();
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

openProjectDrawerButton.addEventListener("click", () => {
  setDrawerOpen(true);
});

closeProjectDrawerButton.addEventListener("click", () => {
  setDrawerOpen(false);
});

drawerBackdrop.addEventListener("click", () => {
  setDrawerOpen(false);
});

projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-id]");
  if (!button || state.pending) {
    return;
  }

  switchProject(button.dataset.projectId);
});

newProjectButton.addEventListener("click", () => {
  if (state.pending) {
    return;
  }

  createProject();
  setDrawerOpen(false);
});

renameProjectButton.addEventListener("click", () => {
  if (state.pending) {
    return;
  }

  renameActiveProject();
});

async function bootstrap() {
  try {
    const payload = await fetchJson("/api/bootstrap");
    state.phases = payload.phases;
    state.panelists = payload.panelists;
    state.repoInsights = payload.repoInsights;
    state.runtime = payload.runtime;
    loadProjects();

    renderRuntime();
    switchProject(state.activeProjectId, {
      fallbackPhaseId: payload.defaultPhaseId || state.phases[0]?.id,
    });
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
        projectContext: buildProjectContextPayload(requestPhaseId),
      }),
    });

    state.runtime = payload.runtime;
    renderRuntime();
    const resolvedPhaseId = payload.phaseId || requestPhaseId;
    const session = ensurePhaseSession(resolvedPhaseId);
    session.summary = payload.synthesis;
    saveActiveProject();

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
    saveActiveProject();
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
  saveActiveProject();

  renderPhaseTabs();
  renderPhaseCard();
  renderPanelList();
  renderSelectedRole();
  renderStageCopy();
  renderThread();
  updateSummary(getActiveSession().summary);
  renderProjectShell();
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

  saveActiveProject();
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

function buildProjectContextPayload(currentPhaseId) {
  return {
    projectId: state.activeProjectId,
    projectName: getActiveProject()?.name || "Untitled pitch",
    currentPhaseId,
    phases: state.phases.map((phase) => {
      const session = ensurePhaseSession(phase.id);
      return {
        phaseId: phase.id,
        shortLabel: phase.shortLabel,
        name: phase.name,
        summary: session.summary,
        recentThread: session.thread
          .filter((entry) => entry.type !== "system")
          .slice(-8)
          .map((entry) => ({
            type: entry.type,
            speaker: entry.speaker,
            body: entry.body,
            tags: entry.tags,
          })),
      };
    }),
  };
}

function loadProjects() {
  const stored = safeParseJson(localStorage.getItem(STORAGE_KEY));
  const projects = Array.isArray(stored?.projects) ? stored.projects : [];
  state.projects = projects
    .map(normalizeProject)
    .filter(Boolean)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const storedActiveId = typeof stored?.activeProjectId === "string" ? stored.activeProjectId : null;
  state.activeProjectId =
    state.projects.find((project) => project.id === storedActiveId)?.id ||
    state.projects[0]?.id ||
    null;

  if (!state.activeProjectId) {
    createProject({ skipSave: true });
  }
}

function createProject(options = {}) {
  const now = new Date().toISOString();
  const project = {
    id: `pitch-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `Idea pitch ${state.projects.length + 1}`,
    createdAt: now,
    updatedAt: now,
    activePhaseId: state.phases[0]?.id || null,
    selectedPanelId: null,
    phaseSessions: createDefaultPhaseSessions(),
  };

  state.projects.unshift(project);
  state.activeProjectId = project.id;
  applyProject(project);

  if (!options.skipSave) {
    persistProjects();
    renderAll();
  }

  return project;
}

function switchProject(projectId, options = {}) {
  let project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    project = state.projects[0] || createProject({ skipSave: true });
  }

  state.activeProjectId = project.id;
  applyProject(project, options.fallbackPhaseId);
  persistProjects();
  renderAll();
}

function applyProject(project, fallbackPhaseId) {
  state.phaseSessions = clone(project.phaseSessions || {});
  state.activePhaseId = getPhase(project.activePhaseId)?.id || fallbackPhaseId || state.phases[0]?.id || null;
  state.selectedPanelId = project.selectedPanelId || null;

  state.phases.forEach((phase) => {
    ensurePhaseSession(phase.id);
  });
}

function renameActiveProject() {
  const project = getActiveProject();
  if (!project) {
    return;
  }

  const nextName = window.prompt("Project name", project.name);
  if (!nextName || !nextName.trim()) {
    return;
  }

  project.name = nextName.trim().slice(0, 80);
  project.updatedAt = new Date().toISOString();
  persistProjects();
  renderProjectShell();
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

function saveActiveProject() {
  const project = getActiveProject();
  if (!project || state.phases.length === 0) {
    return;
  }

  project.activePhaseId = state.activePhaseId;
  project.selectedPanelId = state.selectedPanelId;
  project.phaseSessions = clone(state.phaseSessions);
  project.updatedAt = new Date().toISOString();
  state.projects = [
    project,
    ...state.projects.filter((item) => item.id !== project.id),
  ];
  persistProjects();
  renderProjectShell();
}

function persistProjects() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeProjectId: state.activeProjectId,
      projects: state.projects,
    }),
  );
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: typeof project.id === "string" ? project.id : `pitch-${Date.now()}`,
    name: typeof project.name === "string" && project.name.trim() ? project.name.trim() : "Untitled pitch",
    createdAt: typeof project.createdAt === "string" ? project.createdAt : now,
    updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : now,
    activePhaseId: typeof project.activePhaseId === "string" ? project.activePhaseId : state.phases[0]?.id || null,
    selectedPanelId: typeof project.selectedPanelId === "string" ? project.selectedPanelId : null,
    phaseSessions: normalizePhaseSessions(project.phaseSessions),
  };
}

function normalizePhaseSessions(phaseSessions) {
  const normalized = {};

  state.phases.forEach((phase) => {
    const session = phaseSessions?.[phase.id];
    normalized[phase.id] = {
      summary: session?.summary ? { ...clone(phase.defaultSummary), ...clone(session.summary) } : clone(phase.defaultSummary),
      thread:
        Array.isArray(session?.thread) && session.thread.length > 0
          ? session.thread.map(normalizeThreadEntry).filter(Boolean)
          : createDefaultPhaseThread(phase),
    };
  });

  return normalized;
}

function normalizeThreadEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.body !== "string") {
    return null;
  }

  return {
    type: typeof entry.type === "string" ? entry.type : "system",
    speaker: typeof entry.speaker === "string" ? entry.speaker : entry.title || "System",
    body: entry.body,
    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag) => typeof tag === "string") : [],
    accent: typeof entry.accent === "string" ? entry.accent : undefined,
    meta: typeof entry.meta === "string" ? entry.meta : undefined,
  };
}

function createDefaultPhaseSessions() {
  return Object.fromEntries(
    state.phases.map((phase) => [
      phase.id,
      {
        summary: clone(phase.defaultSummary),
        thread: createDefaultPhaseThread(phase),
      },
    ]),
  );
}

function createDefaultPhaseThread(phase) {
  return [
    {
      type: "system",
      speaker: phase.shortLabel,
      body: phase.intro,
      tags: [],
    },
  ];
}

function renderAll() {
  const phase = getActivePhase();
  if (!phase) {
    return;
  }

  const phasePanelists = getPanelistsForPhase(phase.id);
  if (!phasePanelists.some((panelist) => panelist.id === state.selectedPanelId)) {
    state.selectedPanelId = phasePanelists[0]?.id || null;
  }

  renderProjectShell();
  renderPhaseTabs();
  renderPhaseCard();
  renderPanelList();
  renderSelectedRole();
  renderStageCopy();
  renderThread();
  updateSummary(getActiveSession().summary);
}

function renderProjectShell() {
  const project = getActiveProject();
  activeProjectLabel.textContent = project ? project.name : "No pitch selected";
  renderProjectList();
}

function renderProjectList() {
  projectList.innerHTML = "";

  state.projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
    button.dataset.projectId = project.id;

    if (project.id === state.activeProjectId) {
      button.classList.add("active");
    }

    const title = document.createElement("span");
    title.className = "project-title";
    title.textContent = project.name;

    const meta = document.createElement("span");
    meta.className = "project-meta";
    meta.textContent = describeProjectProgress(project);

    button.append(title, meta);
    projectList.append(button);
  });
}

function describeProjectProgress(project) {
  const activePhase = getPhase(project.activePhaseId);
  const messageCount = Object.values(project.phaseSessions || {}).reduce(
    (sum, session) =>
      sum +
      (Array.isArray(session.thread)
        ? session.thread.filter((entry) => entry.type !== "system").length
        : 0),
    0,
  );

  return `${activePhase?.shortLabel || "Phase"} · ${messageCount} messages`;
}

function setDrawerOpen(isOpen) {
  state.drawerOpen = isOpen;
  projectDrawer.classList.toggle("open", isOpen);
  projectDrawer.setAttribute("aria-hidden", String(!isOpen));
  drawerBackdrop.hidden = !isOpen;
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

function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
