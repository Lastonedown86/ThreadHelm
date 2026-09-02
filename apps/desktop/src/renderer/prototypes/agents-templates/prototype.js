// PROTOTYPE ONLY — generic representative content with no production APIs or persistence.
const profiles = [
  {
    id: 'builder',
    name: 'Implementation partner',
    description:
      'Turns an approved plan into a focused code change and reports exact verification.',
    goal: 'Complete one bounded implementation task without widening the mission.',
    abilities: ['Implement', 'Refactor', 'Focused tests'],
    provider: 'Codex CLI',
    model: 'CLI default',
    source: 'Created locally',
    revision: 'rev 4 · 91c6a0d2',
    state: 'Ready',
  },
  {
    id: 'reviewer',
    name: 'Verification partner',
    description: 'Reviews completed work against the brief and gathers material evidence.',
    goal: 'Return cited findings or an explicit no-material-defects result.',
    abilities: ['Review', 'Test', 'Accessibility'],
    provider: 'Claude Code',
    model: 'CLI default',
    source: 'Imported from verification-partner.json',
    revision: 'rev 2 · 4c8b71ef',
    state: 'Ready',
  },
  {
    id: 'researcher',
    name: 'Research partner',
    description: 'Collects primary evidence and separates facts from inferences.',
    goal: 'Produce a concise evidence packet for the active mission.',
    abilities: ['Research', 'Synthesis'],
    provider: 'Codex CLI',
    model: 'CLI default',
    source: 'Created locally',
    revision: 'rev 1 · 208e35a4',
    state: 'Disabled',
  },
];

const starters = [
  {
    id: 'build',
    name: 'Build from a plan',
    summary: 'A focused implementation partner',
    ability: 'Implement · Test',
    origin: 'Bundled generic starter',
  },
  {
    id: 'review',
    name: 'Review completed work',
    summary: 'An independent verification partner',
    ability: 'Review · Accessibility',
    origin: 'Bundled generic starter',
  },
  {
    id: 'research',
    name: 'Research a decision',
    summary: 'A primary-source research partner',
    ability: 'Research · Synthesis',
    origin: 'Bundled generic starter',
  },
];

const state = {
  selectedProfile: 'builder',
  selectedStarter: 'build',
  importOpen: false,
  localDetailOpen: false,
};
const app = document.querySelector('#app');
const requested = new URLSearchParams(location.search).get('variant')?.toUpperCase();
const variant = ['A', 'B', 'C'].includes(requested) ? requested : 'A';
const variants = { A: 'Roster first', B: 'Profile studio', C: 'Guided library' };

function profile() {
  return profiles.find((item) => item.id === state.selectedProfile) ?? profiles[0];
}
function starter() {
  return starters.find((item) => item.id === state.selectedStarter) ?? starters[0];
}

function chrome() {
  return `<aside class="chrome"><div class="brand"><i>TH</i><div><b>ThreadHelm</b><small>Design lab</small></div></div>
    <nav>${Object.entries(variants)
      .map(
        ([key, label]) =>
          `<a class="${variant === key ? 'active' : ''}" href="?variant=${key}"><b>${key}</b><span>${label}</span></a>`,
      )
      .join('')}</nav>
    <div class="lab-note"><b>Prototype only</b><span>Profiles remain inert until assigned to a mission.</span></div></aside>`;
}

function header(title, description) {
  return `<header class="page-head"><div><span class="eyebrow">Agents & templates</span><h1>${title}</h1><p>${description}</p></div><div class="head-actions"><button data-import>Import JSON</button><button class="primary">Create an agent</button></div></header>`;
}

function sourceBadge(source) {
  const kind = source.startsWith('Imported') ? 'imported' : 'local';
  return `<span class="source ${kind}">${source}</span>`;
}

function profileList() {
  return `<div class="profile-list">${profiles.map((item) => `<button data-profile="${item.id}" class="profile-row ${item.id === state.selectedProfile ? 'selected' : ''}"><span><b>${item.name}</b><small>${item.description}</small></span><span class="row-meta"><em class="${item.state === 'Disabled' ? 'disabled' : ''}">${item.state}</em><small>${item.provider}</small></span></button>`).join('')}</div>`;
}

function detail({ compact = false } = {}) {
  const item = profile();
  return `<section class="detail ${compact ? 'compact' : ''}">
    <div class="detail-title"><div><span class="eyebrow">Selected local profile</span><h2>${item.name}</h2></div><span class="ready ${item.state === 'Disabled' ? 'disabled' : ''}">${item.state}</span></div>
    <p class="description">${item.description}</p>
    <div class="goal"><span>Goal</span><strong>${item.goal}</strong></div>
    <div class="facts"><div><span>Abilities</span><b>${item.abilities.join(' · ')}</b></div><div><span>Runtime request</span><b>${item.provider} · ${item.model}</b></div><div><span>Provenance</span><b>${sourceBadge(item.source)}</b></div><div><span>Exact revision</span><b class="mono">${item.revision}</b></div></div>
    <p class="boundary">This profile describes a worker. It grants no folder, tools, role, or budget until a mission explicitly assigns them.</p>
    <div class="detail-actions"><button>Revision history</button><button>${item.state === 'Disabled' ? 'Enable' : 'Disable'}</button><button class="primary">Use in a mission</button></div>
  </section>`;
}

function starterCards() {
  return `<div class="starter-grid">${starters.map((item) => `<button data-starter="${item.id}" class="starter ${item.id === state.selectedStarter ? 'selected' : ''}"><span class="starter-icon">${item.id === 'build' ? '⌁' : item.id === 'review' ? '✓' : '◎'}</span><b>${item.name}</b><span>${item.summary}</span><small>${item.ability}</small><em>${item.origin}</em></button>`).join('')}</div>`;
}

function templatePreview() {
  const item = starter();
  return `<section class="template-preview"><div><span class="eyebrow">Starter preview</span><h3>${item.name}</h3><p>${item.summary}. The coach will ask for the desired outcome, abilities, provider, and limits before saving a local profile.</p></div><div class="preview-facts"><span>Source <b>${item.origin}</b></span><span>Creates <b>A new local draft</b></span><span>Launches work <b>No</b></span></div><button class="primary">Start guided setup</button></section>`;
}

function drafts() {
  return `<section class="drafts"><div><span class="eyebrow">Continue where you left off</span><h3>1 saved draft</h3><p>Review partner · Outcome complete · saved locally 12 minutes ago</p></div><button>Resume draft</button></section>`;
}

function renderA() {
  return `<main>${header('Agent roster', 'Manage reviewed local profiles, then open templates when you need a new one.')}
    <div class="subnav"><button class="active">Local agents <b>3</b></button><button>Template library <b>3</b></button><button>Drafts <b>1</b></button></div>
    <div class="roster-layout"><section class="roster"><div class="section-head"><div><span class="eyebrow">Reviewed profiles</span><h2>Your local agents</h2></div><button>Filter: All</button></div>${profileList()}</section>${detail()}</div></main>`;
}

function renderB() {
  return `<main>${header('Agent profile studio', 'Keep one worker’s purpose, abilities, runtime request, and provenance in view.')}
    <div class="studio-layout"><aside class="studio-rail"><div class="section-head"><div><span class="eyebrow">Local profiles</span><h2>3 agents</h2></div></div>${profileList()}<button class="wide">Browse generic starters</button></aside><div class="studio-main">${detail()}<section class="revision-lane"><span class="eyebrow">Profile history</span><div><b>Current · ${profile().revision}</b><span>Exact profile content retained locally</span></div><div><b>Previous revision</b><span>Available for comparison; never restored silently</span></div></section></div></div></main>`;
}

function renderC() {
  return `<main>${header('Build your agent team', 'Start with the job to be done. ThreadHelm guides the setup and keeps local profiles separate.')}
    <section class="guided-intro"><div><span class="step">1</span><span class="eyebrow">Choose a starting point</span><h2>What should this agent help accomplish?</h2><p>Choose a generic starter, continue a saved draft, or import a profile you already trust.</p></div><button data-import>Import an existing profile</button></section>
    ${starterCards()}${templatePreview()}${drafts()}
    <section class="local-separation"><div><span class="eyebrow">Your private local profiles</span><h2>Already created</h2><p>These stay on this machine and are never mixed into the bundled starter library.</p></div><div class="local-cards">${profiles
      .slice(0, 2)
      .map(
        (item) =>
          `<button data-profile="${item.id}" data-open-detail><b>${item.name}</b><span>${item.goal}</span>${sourceBadge(item.source)}</button>`,
      )
      .join('')}</div></section>
    ${state.localDetailOpen ? `<div class="drawer-scrim"><aside class="profile-drawer"><button class="drawer-close" data-close-detail aria-label="Close profile detail">×</button>${detail({ compact: true })}</aside></div>` : ''}
  </main>`;
}

function importDialog() {
  return `<div class="scrim"><section class="dialog" role="dialog" aria-modal="true" aria-label="Review imported profile"><div class="dialog-head"><div><span class="eyebrow">Local JSON preview</span><h2>Review imported profile</h2></div><button data-close aria-label="Close import preview">×</button></div>
    <p class="file">verification-partner.json <span>SHA-256 · 4c8b71ef…</span></p>
    <div class="import-grid"><div><span>Name</span><b>Verification partner</b></div><div><span>Author</span><b>Local user</b></div><div><span>Goal</span><b>Return cited findings or an explicit no-material-defects result.</b></div><div><span>Abilities</span><b>Review · Test · Accessibility</b></div><div><span>Provider request</span><b>Claude Code · CLI default</b></div><div><span>Compatibility</span><b class="compatible">Compatible</b></div></div>
    <p class="boundary">Import saves this exact inert profile locally. It grants no workspace, tools, mission role, or budget.</p><label><input type="checkbox"> Save this exact reviewed profile.</label><div class="dialog-actions"><button data-close>Choose another file</button><button class="primary" disabled>Import profile</button></div></section></div>`;
}

function bind() {
  document.querySelectorAll('[data-profile]').forEach((button) =>
    button.addEventListener('click', () => {
      state.selectedProfile = button.dataset.profile;
      state.localDetailOpen = button.hasAttribute('data-open-detail');
      render();
    }),
  );
  document.querySelectorAll('[data-starter]').forEach((button) =>
    button.addEventListener('click', () => {
      state.selectedStarter = button.dataset.starter;
      render();
    }),
  );
  document.querySelectorAll('[data-import]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importOpen = true;
      render();
    }),
  );
  document.querySelectorAll('[data-close]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importOpen = false;
      render();
    }),
  );
  document.querySelectorAll('[data-close-detail]').forEach((button) =>
    button.addEventListener('click', () => {
      state.localDetailOpen = false;
      render();
    }),
  );
}

function render() {
  const content = variant === 'A' ? renderA() : variant === 'B' ? renderB() : renderC();
  app.innerHTML = `<div class="frame">${chrome()}${content}</div>${state.importOpen ? importDialog() : ''}`;
  bind();
}
render();
