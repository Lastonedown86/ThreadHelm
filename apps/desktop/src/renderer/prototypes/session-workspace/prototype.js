// PROTOTYPE ONLY — representative local state, no production APIs or process control.
const sessions = [
  {
    id: 'coordinator',
    name: 'Mission coordinator',
    provider: 'Codex CLI',
    status: 'Running',
    activity: 'Planning next handoff',
    tone: 'running',
  },
  {
    id: 'builder',
    name: 'Implementation worker',
    provider: 'Codex CLI',
    status: 'Running · New output',
    activity: '6 lines of new output',
    tone: 'new',
    unread: 6,
  },
  {
    id: 'reviewer',
    name: 'Verification worker',
    provider: 'Claude Code',
    status: 'Stopped',
    activity: 'Exit recorded · 9:42 AM',
    tone: 'stopped',
  },
  {
    id: 'recovery',
    name: 'Recovery fixture',
    provider: 'Codex CLI',
    status: 'Recovery required',
    activity: 'Host ended before outcome was known',
    tone: 'recovery',
  },
  {
    id: 'failed',
    name: 'Failure fixture',
    provider: 'Claude Code',
    status: 'Failed',
    activity: 'Exited with code 1',
    tone: 'failed',
  },
];

const scenarios = {
  normal: {
    label: 'Live output',
    notice: '',
    lines: [
      ['09:46:12', 'Checked the mission brief and approved folder.'],
      ['09:46:18', 'Inspecting the current workspace before making changes.'],
      ['09:46:27', 'Ready to continue with the bounded implementation task.'],
    ],
  },
  truncated: {
    label: 'Truncation',
    notice:
      'Earlier output was removed to keep this terminal responsive. Open session evidence for the retained record.',
    lines: [
      ['09:45:58', '— 2,420 earlier lines omitted —'],
      ['09:46:18', 'The live stream continues from the retained boundary.'],
      ['09:46:27', 'No process output was changed or summarized.'],
    ],
  },
  backpressure: {
    label: 'Backpressure',
    notice:
      'Output is arriving faster than it can be drawn. Input is paused; the session is still running.',
    lines: [
      ['09:46:24', 'Buffering local process output…'],
      ['09:46:25', '2,048 lines waiting to render.'],
      ['09:46:27', 'Interrupt and stop controls remain available.'],
    ],
  },
  wrong: {
    label: 'Wrong selection',
    notice: '',
    lines: [
      ['09:46:12', 'Terminal ownership did not change with the selection.'],
      ['09:46:18', 'Choose “Attach selected session” before sending input.'],
      ['09:46:27', 'Nothing was written to either process.'],
    ],
  },
};

const state = {
  sessionId: 'coordinator',
  scenario: 'normal',
  collapsed: false,
  focusReceipt: '',
};

const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const requestedVariant = params.get('variant')?.toUpperCase();
const variant = ['A', 'B', 'C'].includes(requestedVariant) ? requestedVariant : 'A';
if (scenarios[params.get('state')]) state.scenario = params.get('state');

const variantLabels = {
  A: 'Rail + full terminal',
  B: 'Mission dock',
  C: 'Inspector split',
};

function selectedSession() {
  return sessions.find((session) => session.id === state.sessionId) ?? sessions[0];
}

function statusMark(session) {
  return `<span class="status-mark ${session.tone}" aria-hidden="true"></span>`;
}

function sessionButton(session, mode = 'row') {
  const selected = session.id === state.sessionId;
  return `
    <button class="session-${mode} ${selected ? 'selected' : ''}" data-session="${session.id}"
      aria-pressed="${selected}">
      <span class="session-name">${statusMark(session)}${session.name}</span>
      <span class="session-meta">${session.status} · ${session.provider}</span>
      <span class="session-activity">${session.activity}</span>
      ${session.unread ? `<span class="unread" aria-label="${session.unread} lines of new output">${session.unread}</span>` : ''}
    </button>`;
}

function sessionList(mode = 'row') {
  return `<div class="session-list" aria-label="Sessions">${sessions.map((session) => sessionButton(session, mode)).join('')}</div>`;
}

function scenarioControl() {
  return `<div class="scenario-control" aria-label="Terminal state examples">
    <span>Show safety state</span>
    ${Object.entries(scenarios)
      .map(
        ([key, scenario]) =>
          `<button class="scenario-pill ${state.scenario === key ? 'selected' : ''}" data-scenario="${key}" aria-pressed="${state.scenario === key}">${scenario.label}</button>`,
      )
      .join('')}
  </div>`;
}

function controls(compact = false) {
  const session = selectedSession();
  const running = ['running', 'new'].includes(session.tone);
  return `<div class="session-controls ${compact ? 'compact' : ''}" aria-label="Controls for ${session.name}">
    <span class="control-target">Controls affect <strong>${session.name}</strong></span>
    <button id="interrupt-control" ${running ? '' : 'disabled'}>Interrupt</button>
    <button ${running ? '' : 'disabled'}>Stop</button>
    <button class="danger" ${running ? '' : 'disabled'}>Force stop</button>
  </div>`;
}

function terminal() {
  const session = selectedSession();
  const scenario = scenarios[state.scenario];
  const wrongTarget = session.id === 'coordinator' ? sessions[1] : sessions[0];
  const notice =
    state.scenario === 'wrong'
      ? `Input not accepted. This terminal belongs to ${session.name}, but the attempted route names ${wrongTarget.name}.`
      : scenario.notice;
  return `<section class="terminal-shell ${state.scenario}" aria-label="Terminal for ${session.name}">
    <header class="terminal-head">
      <div>
        <span class="eyebrow">Terminal attached to</span>
        <strong>Feature 003 · ${session.name}</strong>
        <span>${session.provider} · ${session.status}</span>
      </div>
      <span class="ownership"><span></span>Input route verified</span>
    </header>
    ${notice ? `<div class="terminal-notice" role="status"><strong>${scenario.label}</strong><span>${notice}</span></div>` : ''}
    <div class="terminal-canvas" tabindex="0" data-terminal>
      <p class="terminal-path">C:\\Users\\Bill\\Documents\\ThreadHelm</p>
      ${scenario.lines.map(([time, line]) => `<p><time>${time}</time><span>${line}</span></p>`).join('')}
      <p class="prompt"><span>›</span><span class="cursor" aria-hidden="true"></span></p>
    </div>
    <footer class="terminal-foot">
      <span>Press <kbd>F6</kbd> to move from terminal input to session controls</span>
      <span>Local session · UTF-8 · stream bounded</span>
    </footer>
  </section>`;
}

function lifecycleEvidence() {
  const session = selectedSession();
  return `<section class="evidence-card">
    <span class="eyebrow">Lifecycle evidence</span>
    <h3>${session.status}</h3>
    <dl>
      <div><dt>Mission</dt><dd>Feature 003 · Session workspace</dd></div>
      <div><dt>Session</dt><dd>${session.name}</dd></div>
      <div><dt>Provider</dt><dd>${session.provider}</dd></div>
      <div><dt>Last event</dt><dd>${session.activity}</dd></div>
    </dl>
    ${session.tone === 'recovery' ? '<p class="evidence-warning">Outcome is unknown. Review evidence before choosing a manual recovery action.</p>' : ''}
    ${session.tone === 'failed' ? '<p class="evidence-warning">The process exited. Inspect retained output before starting replacement work.</p>' : ''}
  </section>`;
}

function workspaceHeader() {
  return `<header class="workspace-header">
    <div>
      <span class="eyebrow">Active mission</span>
      <h1>Feature 003 · Session workspace</h1>
      <p>Review local workers, follow output, and act on the exact selected process.</p>
    </div>
    <div class="mission-state"><span></span>Mission running</div>
  </header>`;
}

function renderA() {
  return `<main class="workspace variant-a">
    ${workspaceHeader()}
    ${scenarioControl()}
    <div class="a-layout">
      <aside class="session-rail">
        <div class="section-title"><span>Mission sessions</span><small>5 total</small></div>
        ${sessionList()}
      </aside>
      <div class="terminal-column">
        ${controls()}
        ${terminal()}
      </div>
    </div>
  </main>`;
}

function renderB() {
  if (state.collapsed) {
    return `<main class="workspace variant-b">
      ${workspaceHeader()}
      <section class="mission-course-placeholder">
        <span class="course-number">03</span><div><span class="eyebrow">Current course</span><h2>Implement the approved session workspace</h2><p>The terminal remains attached while its dock is collapsed.</p></div>
      </section>
      <button class="collapsed-dock" data-collapse aria-expanded="false">
        <span>${statusMark(selectedSession())}<strong>${selectedSession().name}</strong> · ${selectedSession().status}</span>
        <span>Terminal collapsed · session continues <b>Open dock</b></span>
      </button>
    </main>`;
  }
  return `<main class="workspace variant-b">
    ${workspaceHeader()}
    <section class="mission-course-placeholder compact-course">
      <span class="course-number">03</span><div><span class="eyebrow">Current course</span><h2>Implement the approved session workspace</h2></div>
      <span class="course-progress">2 of 4 workers active</span>
    </section>
    <section class="terminal-dock">
      <header class="dock-header">
        <div><span class="eyebrow">Mission terminal</span><strong>Feature 003</strong></div>
        <div class="dock-actions">${controls(true)}<button data-collapse aria-expanded="true">Collapse dock</button></div>
      </header>
      <div class="session-tabs" role="tablist" aria-label="Mission sessions">
        ${sessions.map((session) => sessionButton(session, 'tab')).join('')}
      </div>
      ${scenarioControl()}
      ${terminal()}
    </section>
  </main>`;
}

function renderC() {
  return `<main class="workspace variant-c">
    ${workspaceHeader()}
    <div class="c-layout">
      <aside class="inspector">
        <div class="section-title"><span>Session inspector</span><small>Exact target</small></div>
        ${sessionList('compact')}
        ${lifecycleEvidence()}
      </aside>
      <div class="terminal-column">
        ${scenarioControl()}
        ${controls()}
        ${terminal()}
      </div>
    </div>
  </main>`;
}

function chrome() {
  return `<div class="prototype-chrome">
    <div class="brand"><span class="helm">TH</span><span>ThreadHelm</span><small>Session design lab</small></div>
    <nav aria-label="Prototype variants">
      ${Object.entries(variantLabels)
        .map(
          ([key, label]) =>
            `<a class="${variant === key ? 'active' : ''}" href="?variant=${key}"><b>${key}</b>${label}</a>`,
        )
        .join('')}
    </nav>
    <div class="prototype-note"><strong>Prototype only</strong><span>No process commands are sent.</span></div>
  </div>`;
}

function render() {
  const content = variant === 'A' ? renderA() : variant === 'B' ? renderB() : renderC();
  app.innerHTML = `<div class="app-frame">${chrome()}${content}</div><div class="focus-receipt" aria-live="polite">${state.focusReceipt}</div>`;
  bind();
}

function bind() {
  document.querySelectorAll('[data-session]').forEach((button) => {
    button.addEventListener('click', () => {
      state.sessionId = button.dataset.session;
      state.focusReceipt = `Terminal identity changed to ${selectedSession().name}.`;
      render();
    });
  });
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      state.scenario = button.dataset.scenario;
      render();
    });
  });
  document.querySelectorAll('[data-collapse]').forEach((button) => {
    button.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      state.focusReceipt = state.collapsed
        ? `${selectedSession().name} continues while the terminal is collapsed.`
        : `Terminal reopened for ${selectedSession().name}.`;
      render();
    });
  });
  document.querySelector('[data-terminal]')?.addEventListener('keydown', (event) => {
    if (event.key === 'F6') {
      event.preventDefault();
      state.focusReceipt = `Focus moved to controls for ${selectedSession().name}.`;
      document.querySelector('#interrupt-control')?.focus();
      document.querySelector('.focus-receipt').textContent = state.focusReceipt;
    }
  });
}

render();
