// PROTOTYPE ONLY — no native picker, provider check, revocation, or storage mutation occurs.
const app = document.querySelector('#app');
const requested = new URLSearchParams(location.search).get('variant')?.toUpperCase();
const variant = ['A', 'B', 'C'].includes(requested) ? requested : 'A';
const labels = { A: 'Settings page', B: 'Setup inspector', C: 'Guided setup' };
const state = { degraded: false, review: false };
const workspace = {
  selected: 'C:\\Users\\Bill\\Documents\\ThreadHelm',
  effective: 'C:\\Users\\Bill\\Documents\\ThreadHelm',
  identity: 'volume 9A31-22EF · file 0019af72…',
  approved: 'Today · 9:14 AM',
};
const providers = [
  { name: 'Codex CLI', state: 'Available', detail: 'v0.84.2 · signed in', tone: 'ready' },
  {
    name: 'Claude Code',
    state: 'Not signed in',
    detail: 'v2.1.4 · authentication required',
    tone: 'attention',
  },
];
function chrome() {
  return `<aside class="chrome"><div class="brand"><i>TH</i><div><b>ThreadHelm</b><small>Setup design lab</small></div></div><nav>${Object.entries(
    labels,
  )
    .map(
      ([k, v]) =>
        `<a class="${variant === k ? 'active' : ''}" href="?variant=${k}"><b>${k}</b><span>${v}</span></a>`,
    )
    .join(
      '',
    )}</nav><div class="lab-note"><b>Prototype only</b><span>No folder or provider state changes.</span></div></aside>`;
}
function head(title, copy) {
  return `<header class="page-head"><div><span class="eyebrow">Local setup & authority</span><h1>${title}</h1><p>${copy}</p></div><button class="storage-toggle" data-storage>${state.degraded ? 'Show healthy storage' : 'Preview degraded storage'}</button></header>${state.degraded ? `<div class="degraded" role="alert"><b>Local storage needs attention</b><span>Live sessions remain controllable. New launches and durable changes are blocked until storage recovers.</span><button>Open diagnostics</button></div>` : ''}`;
}
function workspaceCard(compact = false) {
  return `<section class="setup-card workspace-card"><div class="card-head"><div><span class="eyebrow">Approved workspace</span><h2>ThreadHelm</h2></div><span class="state ready">Approved</span></div><p class="path">${workspace.effective}</p><dl><div><dt>Selected path</dt><dd>${workspace.selected}</dd></div><div><dt>Effective folder</dt><dd>${workspace.effective}</dd></div>${compact ? '' : `<div><dt>Native identity</dt><dd>${workspace.identity}</dd></div><div><dt>Approved</dt><dd>${workspace.approved}</dd></div>`}</dl><p class="authority">Approval allows this folder to be selected as a working directory. It does not confine an agent to the folder.</p><div class="card-actions"><button data-review>Choose another folder…</button><button class="danger">Revoke approval…</button></div></section>`;
}
function providerCards(compact = false) {
  return `<section class="setup-card providers-card"><span class="eyebrow">AI providers</span><h2>Provider readiness</h2>${providers.map((p) => `<div class="provider"><span class="provider-mark ${p.tone}"></span><div><b>${p.name}</b><small>${p.detail}</small></div><span class="state ${p.tone}">${p.state}</span>${compact ? '' : `<button>${p.tone === 'ready' ? 'Check again' : 'Sign-in guidance'}</button>`}</div>`).join('')}<p class="authority">Provider checks report sanitized local readiness. ThreadHelm never changes provider authentication silently.</p></section>`;
}
function appInfo() {
  return `<section class="setup-card app-info"><span class="eyebrow">Application evidence</span><h2>About this installation</h2><dl><div><dt>Version</dt><dd>0.0.0 discovery build</dd></div><div><dt>Platform</dt><dd>Windows x64</dd></div><div><dt>Signature</dt><dd>Unsigned by owner choice</dd></div><div><dt>Storage</dt><dd>${state.degraded ? 'Degraded · writes blocked' : 'Healthy · SQLite local'}</dd></div><div><dt>Coordinator</dt><dd>Electron main · sole writer</dd></div></dl><button>Copy diagnostic summary</button></section>`;
}
function renderA() {
  return `<main>${head('Settings', 'Review folders, providers, storage, and application information in one destination.')}<div class="settings-grid">${workspaceCard()}${providerCards()}${appInfo()}</div></main>`;
}
function renderB() {
  return `<main>${head('Setup inspector', 'Keep setup evidence available without leaving the current mission.')}<section class="mission-strip"><div><span class="eyebrow">Current mission</span><b>Feature 003 · Session workspace</b></div><span>Running · setup changes do not alter this mission</span></section><div class="inspector-layout"><section class="attention"><span class="eyebrow">Attention</span><h2>1 setup item</h2><div class="attention-item"><b>Claude Code is not signed in</b><span>Only Codex CLI can start new work until authentication is restored.</span><button>View guidance</button></div>${appInfo()}</section><div>${workspaceCard(true)}${providerCards(true)}</div></div></main>`;
}
function renderC() {
  return `<main>${head('Get ThreadHelm ready', 'Follow three clear checks. Existing sessions remain separate from setup changes.')}<div class="readiness"><span class="readiness-ring">2/3</span><div><span class="eyebrow">Setup status</span><h2>One item needs attention</h2><p>Your approved folder and local storage are ready. Claude Code needs sign-in.</p></div></div><div class="setup-steps"><section><span class="step-number done">✓</span><div><span class="eyebrow">Step 1</span><h2>Choose where agents may work</h2><p>One folder is approved through the native Windows picker.</p>${workspaceCard()}</div></section><section><span class="step-number">2</span><div><span class="eyebrow">Step 2</span><h2>Connect your AI providers</h2><p>Use each provider’s own CLI authentication. Models and effort appear only after a provider is selected.</p>${providerCards()}</div></section><section><span class="step-number done">✓</span><div><span class="eyebrow">Step 3</span><h2>Confirm local app health</h2>${appInfo()}</div></section></div></main>`;
}
function folderReview() {
  return state.review
    ? `<div class="scrim"><section class="dialog" role="dialog" aria-modal="true" aria-label="Review folder approval"><div class="dialog-head"><div><span class="eyebrow">Native folder review</span><h2>Approve this effective folder?</h2></div><button data-close>×</button></div><dl><div><dt>Selected</dt><dd>${workspace.selected}</dd></div><div><dt>Effective folder</dt><dd>${workspace.effective}</dd></div><div><dt>Identity</dt><dd>${workspace.identity}</dd></div><div><dt>Volume</dt><dd>Fixed local drive</dd></div></dl><p class="authority">Approval applies to the effective folder shown above and does not confine an agent to it.</p><div class="dialog-actions"><button data-close>Cancel</button><button class="primary">Approve folder</button></div></section></div>`
    : '';
}
function bind() {
  document.querySelectorAll('[data-storage]').forEach((b) =>
    b.addEventListener('click', () => {
      state.degraded = !state.degraded;
      render();
    }),
  );
  document.querySelectorAll('[data-review]').forEach((b) =>
    b.addEventListener('click', () => {
      state.review = true;
      render();
    }),
  );
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      state.review = false;
      render();
    }),
  );
}
function render() {
  app.innerHTML = `<div class="frame">${chrome()}${variant === 'A' ? renderA() : variant === 'B' ? renderB() : renderC()}</div>${folderReview()}`;
  bind();
}
render();
