// PROTOTYPE ONLY — read-only sample state; no production APIs or mutations.
export const reviewStates = {
  empty: { mission: null, attention: 'none', sessions: [] },
  active: { mission: 'feature-003', attention: 'decision', sessions: ['ui-discovery'] },
  waiting: { mission: 'operator-guide', attention: 'owner', sessions: [] },
  recovery: { mission: 'interrupted-run', attention: 'recovery', sessions: [] },
  uncertain: { mission: 'unknown-effect', attention: 'inspect', sessions: [] },
  complete: { mission: 'feature-002', attention: 'none', sessions: [] },
};

const missions = [
  {
    id: 'release',
    name: 'Prepare Feature 003',
    state: 'active',
    detail: 'Define the next verified coordination slice',
  },
  {
    id: 'docs',
    name: 'Refresh operator guide',
    state: 'waiting',
    detail: 'Waiting for mission workflow decisions',
  },
  {
    id: 'perf',
    name: 'Calibrate idle footprint',
    state: 'deferred',
    detail: 'Deferred from the preview release',
  },
];

const variants = {
  A: { name: 'Mission Ledger', render: renderLedger },
  B: { name: 'Flight Deck', render: renderDeck },
  C: { name: 'Quiet Focus', render: renderFocus },
  D: { name: 'Mission Course', render: renderHybrid },
};

const state = { selected: 'release', terminal: false, context: true };
const app = document.querySelector('#app');

function shell(content, variant) {
  return `
    <main class="prototype variant-${variant.toLowerCase()}">
      <div class="prototype-flag">DESIGN PROTOTYPE · READ ONLY</div>
      ${content}
    </main>
    <nav class="variant-switcher" aria-label="Prototype variants">
      <button data-cycle="-1" aria-label="Previous design">←</button>
      <span><b>${variant}</b> — ${variants[variant].name}</span>
      <button data-cycle="1" aria-label="Next design">→</button>
    </nav>`;
}

function stateDot(value) {
  return `<span class="state-dot ${value}" aria-hidden="true"></span>`;
}

function missionQueue(compact = false) {
  return `<div class="mission-queue ${compact ? 'compact' : ''}">
    ${missions
      .map(
        (mission) => `
      <button class="mission-row ${state.selected === mission.id ? 'selected' : ''}" data-mission="${mission.id}">
        ${stateDot(mission.state)}
        <span><b>${mission.name}</b>${compact ? '' : `<small>${mission.detail}</small>`}</span>
        <em>${mission.state}</em>
      </button>`,
      )
      .join('')}
  </div>`;
}

function brand() {
  return `<div class="brand"><div class="helm-mark">T</div><div><b>ThreadHelm</b><span>Local mission workspace</span></div></div>`;
}

function missionHeader() {
  return `<header class="mission-header">
    <div><span class="eyebrow">ACTIVE MISSION · LOCAL</span><h1>Prepare Feature 003</h1><p>Define the next verified coordination slice without weakening local authority.</p></div>
    <div class="mission-actions"><button class="quiet-button">Pause</button><button class="primary-button">Continue mission</button></div>
  </header>`;
}

function steps() {
  return `<ol class="steps">
    <li class="done"><span>✓</span><div><b>Feature 002 integrated</b><small>PR #17 merged into main · evidence retained</small></div><time>Done</time></li>
    <li class="current"><span>2</span><div><b>Choose the next feature boundary</b><small>Compare mission focus, delegation visibility, and operator attention.</small></div><time>Now</time></li>
    <li><span>3</span><div><b>Write the approved specification</b><small>Translate the chosen boundary into testable outcomes.</small></div><time>Next</time></li>
    <li><span>4</span><div><b>Plan implementation</b><small>Preserve Electron authority and the single SQLite writer.</small></div><time>Later</time></li>
  </ol>`;
}

function attentionPanel() {
  return `<aside class="attention-panel ${state.context ? '' : 'collapsed'}">
    <div class="panel-heading"><span>Mission context</span><button data-context aria-label="Collapse context">${state.context ? '×' : '+'}</button></div>
    ${
      state.context
        ? `<section><span class="eyebrow">NEEDS YOUR DECISION</span><h3>What should Feature 003 prove?</h3><p>Choose one bounded outcome before implementation begins.</p><button class="decision-button">Review choices <span>→</span></button></section>
    <section><span class="eyebrow">CREW</span><div class="crew"><span class="avatar">C</span><div><b>Codex</b><small>Drafting feature boundary</small></div><i>working</i></div><div class="crew"><span class="avatar muted">—</span><div><b>No delegate</b><small>Work remains unassigned</small></div></div></section>
    <section><span class="eyebrow">AUTHORITY</span><div class="authority"><span>Local coordinator</span><b>sole writer</b></div><div class="authority"><span>External actions</span><b>approval required</b></div></section>`
        : ''
    }
  </aside>`;
}

function terminalDock() {
  return `<section class="terminal-dock ${state.terminal ? 'open' : ''}">
    <button class="terminal-tab" data-terminal><span>›_</span> Shell · Feature 003 <i>${state.terminal ? '⌄' : '⌃'}</i></button>
    ${state.terminal ? `<div class="terminal-body"><span class="prompt">PS C:\\ThreadHelm&gt;</span> <span>git status --short --branch</span><br/><span class="output">## codex/ui-ux-discovery</span><br/><span class="prompt">PS C:\\ThreadHelm&gt;</span><span class="cursor"></span></div>` : ''}
  </section>`;
}

function renderLedger() {
  return shell(
    `<div class="ledger-shell">
    <aside class="left-rail">${brand()}<button class="new-mission">＋ New mission</button><div class="rail-label">MISSIONS</div>${missionQueue()}<nav class="app-nav"><button class="active">◎ Missions</button><button>▱ Sessions <i>2</i></button><button>◇ Agents</button><button>▦ Templates</button><button>≋ Memory</button></nav><button class="settings">⚙ Settings</button></aside>
    <section class="ledger-main">${missionHeader()}<div class="focus-label"><span>Mission spine</span><b>1 decision pending</b></div>${steps()}<div class="work-note"><span class="eyebrow">LATEST RESULT</span><h2>The release boundary is closed.</h2><p>Feature 002 is merged. The next move is to name one outcome for Feature 003 and keep deferred performance work visible without pulling it into the new scope.</p><button>Open evidence</button></div>${terminalDock()}</section>
    ${attentionPanel()}
  </div>`,
    'A',
  );
}

function renderDeck() {
  return shell(
    `<div class="deck-shell">
    <header class="deck-top">${brand()}<nav><button>Missions</button><button>Sessions</button><button>Agents</button><button>Memory</button></nav><div class="local-badge">● Local authority</div></header>
    <div class="mission-tabs">${missions.map((m) => `<button data-mission="${m.id}" class="${state.selected === m.id ? 'selected' : ''}">${stateDot(m.state)}${m.name}<small>${m.state}</small></button>`).join('')}<button class="add-tab">＋</button></div>
    <section class="deck-stage"><div class="deck-title"><span class="eyebrow">MISSION CONTROL · FEATURE 003</span><h1>One outcome. Clear authority.</h1><div class="mission-actions"><button class="quiet-button">Mission details</button><button class="primary-button">Continue mission</button></div></div>
      <div class="execution-track"><div class="track-line"></div><article class="complete"><span>✓</span><small>MERGED</small><h3>Feature 002</h3><p>Profile authoring and bounded supervisor missions.</p></article><article class="live"><span>2</span><small>IN FOCUS</small><h3>Set the boundary</h3><p>Choose what Feature 003 must prove.</p><button>Review choices →</button></article><article><span>3</span><small>QUEUED</small><h3>Specify</h3><p>Turn the decision into observable behavior.</p></article></div>
      <div class="deck-bottom"><article><span class="eyebrow">LIVE SESSION</span><b>Codex · UI discovery</b><small>Working locally · 4m</small></article><article class="attention"><span class="eyebrow">ATTENTION</span><b>One decision is waiting</b><small>No external action will run without approval.</small></article><button data-terminal>›_ ${state.terminal ? 'Hide' : 'Open'} terminal</button></div>${state.terminal ? terminalDock() : ''}
    </section>
  </div>`,
    'B',
  );
}

function renderFocus() {
  return shell(
    `<div class="focus-shell">
    <header class="focus-top">${brand()}<button class="mission-picker" data-context>${stateDot('active')} Prepare Feature 003 <span>⌄</span></button><div><button class="icon-button" data-terminal aria-label="Toggle terminal">›_</button><button class="avatar-button">B</button></div></header>
    ${state.context ? `<aside class="focus-drawer"><span class="eyebrow">MISSION QUEUE</span>${missionQueue(true)}<nav><button>Sessions</button><button>Agents</button><button>Memory</button><button>Settings</button></nav></aside>` : ''}
    <article class="focus-document"><span class="eyebrow">ACTIVE MISSION · FEATURE 003</span><h1>Prepare the next verified coordination slice.</h1><p class="lead">Decide what the next feature must prove, then turn that decision into a bounded specification.</p><div class="focus-rule"><span></span><b>Current decision</b></div><section class="decision-sheet"><h2>What should Feature 003 prove?</h2><p>The strongest next step makes mission progress easier to understand without expanding provider authority or hiding uncertain outcomes.</p><div class="choice selected"><span>A</span><div><b>Mission focus and attention</b><small>Make the active mission, pending decisions, and verified results legible.</small></div><i>recommended</i></div><div class="choice"><span>B</span><div><b>Delegation visibility</b><small>Clarify agent ownership, handoffs, and waiting work.</small></div></div><button class="primary-button wide">Use mission focus</button></section><footer><span>Last verified result</span><b>Feature 002 merged · cb6758a</b><button>View evidence</button></footer></article>
    ${state.terminal ? terminalDock() : ''}
  </div>`,
    'C',
  );
}

function renderHybrid() {
  return shell(
    `<div class="hybrid-shell">
      <aside class="left-rail hybrid-rail">
        ${brand()}
        <button class="new-mission">＋ New mission</button>
        <div class="rail-label">MISSIONS</div>
        ${missionQueue()}
        <nav class="app-nav">
          <button class="active">◎ Missions</button>
          <button>▱ Sessions <i>2</i></button>
          <button>◇ Agents</button>
          <button>▦ Templates</button>
          <button>≋ Memory</button>
        </nav>
        <button class="settings">⚙ Settings</button>
      </aside>
      <section class="hybrid-main">
        ${missionHeader()}
        <div class="hybrid-status">
          <span>${stateDot('active')} Work continues locally</span>
          <span>1 decision pending</span>
          <span>2 sessions attached</span>
        </div>
        <div class="hybrid-course">
          <div class="course-heading"><span class="eyebrow">MISSION COURSE</span><button>View full history</button></div>
          <div class="execution-track hybrid-track">
            <div class="track-line"></div>
            <article class="complete"><span>✓</span><small>VERIFIED</small><h3>Feature 002 merged</h3><p>Profile authoring and bounded supervisor missions.</p></article>
            <article class="live"><span>2</span><small>IN FOCUS</small><h3>Set the boundary</h3><p>Choose what Feature 003 must prove.</p><button>Review choices →</button></article>
            <article><span>3</span><small>QUEUED</small><h3>Write the specification</h3><p>Turn the decision into observable behavior.</p></article>
          </div>
        </div>
        <div class="hybrid-lower">
          <section class="result-card"><span class="eyebrow">LATEST VERIFIED RESULT</span><h2>The release boundary is closed.</h2><p>Feature 002 is merged. Deferred performance work remains visible without entering the next feature scope.</p><button>Open evidence</button></section>
          <section class="session-card"><span class="eyebrow">ACTIVE SESSION</span><div class="crew"><span class="avatar">C</span><div><b>Codex · UI discovery</b><small>Working locally · 4m</small></div><i>working</i></div><button data-terminal>›_ ${state.terminal ? 'Hide' : 'Open'} terminal</button></section>
        </div>
        ${terminalDock()}
      </section>
      ${attentionPanel()}
    </div>`,
    'D',
  );
}

function currentVariant() {
  const value = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  return variants[value] ? value : 'A';
}

function setVariant(key) {
  const url = new URL(location.href);
  url.searchParams.set('variant', key);
  history.replaceState({}, '', url);
  render();
}

function cycle(direction) {
  const keys = Object.keys(variants);
  const index = keys.indexOf(currentVariant());
  setVariant(keys[(index + direction + keys.length) % keys.length]);
}

function render() {
  const key = currentVariant();
  app.innerHTML = variants[key].render();
  document
    .querySelectorAll('[data-cycle]')
    .forEach((button) =>
      button.addEventListener('click', () => cycle(Number(button.dataset.cycle))),
    );
  document.querySelectorAll('[data-mission]').forEach((button) =>
    button.addEventListener('click', () => {
      state.selected = button.dataset.mission;
      render();
    }),
  );
  document.querySelectorAll('[data-terminal]').forEach((button) =>
    button.addEventListener('click', () => {
      state.terminal = !state.terminal;
      render();
    }),
  );
  document.querySelectorAll('[data-context]').forEach((button) =>
    button.addEventListener('click', () => {
      state.context = !state.context;
      render();
    }),
  );
}

addEventListener('keydown', (event) => {
  if (
    ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
    document.activeElement?.isContentEditable
  )
    return;
  if (event.key === 'ArrowLeft') cycle(-1);
  if (event.key === 'ArrowRight') cycle(1);
});
addEventListener('popstate', render);
render();
