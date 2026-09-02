// PROTOTYPE ONLY — no recovery resolution, replay, relaunch, or deletion occurs.
const app = document.querySelector('#app');
const requested = new URLSearchParams(location.search).get('variant')?.toUpperCase();
const variant = ['A', 'B', 'C'].includes(requested) ? requested : 'A';
const labels = { A: 'Recovery page', B: 'Mission recovery', C: 'Attention queue' };
const state = { selected: 'unknown', deleteOpen: false, startOpen: false };
const items = [
  {
    id: 'unknown',
    severity: 'Recovery required',
    title: 'Observation was lost',
    mission: 'Feature 003 · Session workspace',
    session: 'Implementation worker · Codex CLI',
    workspace: 'C:\\Users\\Bill\\Documents\\ThreadHelm',
    last: 'Running · 10:42 AM',
    summary: 'ThreadHelm lost observation before a durable completion result was recorded.',
    tone: 'danger',
  },
  {
    id: 'stop',
    severity: 'Needs review',
    title: 'Stop did not complete',
    mission: 'Provider verification',
    session: 'Verification worker · Claude Code',
    workspace: 'C:\\Users\\Bill\\Documents\\ThreadHelm',
    last: 'Stopping · Yesterday',
    summary: 'The host ended before stop completion could be verified.',
    tone: 'warning',
  },
  {
    id: 'storage',
    severity: 'Resolved evidence',
    title: 'Storage was repaired',
    mission: 'Local maintenance',
    session: 'No process target',
    workspace: 'ThreadHelm application data',
    last: 'Recovered · Aug 30',
    summary: 'SQLite integrity checks completed. Durable changes are available again.',
    tone: 'neutral',
  },
];
function item() {
  return items.find((i) => i.id === state.selected) ?? items[0];
}
function chrome() {
  return `<aside class="chrome"><div class="brand"><i>TH</i><div><b>ThreadHelm</b><small>Recovery design lab</small></div></div><nav>${Object.entries(
    labels,
  )
    .map(
      ([k, v]) =>
        `<a class="${variant === k ? 'active' : ''}" href="?variant=${k}"><b>${k}</b><span>${v}</span></a>`,
    )
    .join(
      '',
    )}</nav><div class="lab-note"><b>Prototype only</b><span>No process or content changes occur.</span></div></aside>`;
}
function head(title, copy) {
  return `<header class="page-head"><div><span class="eyebrow">Safety & recovery</span><h1>${title}</h1><p>${copy}</p></div><button class="danger-outline" data-delete>Review destructive action</button></header>`;
}
function queue() {
  return `<div class="recovery-list">${items.map((i) => `<button data-item="${i.id}" class="recovery-item ${state.selected === i.id ? 'selected' : ''}"><span class="severity ${i.tone}">${i.severity}</span><b>${i.title}</b><span>${i.mission}</span><small>${i.session}</small></button>`).join('')}</div>`;
}
function evidence() {
  const i = item();
  return `<section class="recovery-detail"><div class="detail-title"><div><span class="eyebrow">Exact recovery target</span><h2>${i.title}</h2></div><span class="severity ${i.tone}">${i.severity}</span></div><p>${i.summary}</p><dl><div><dt>Mission</dt><dd>${i.mission}</dd></div><div><dt>Session</dt><dd>${i.session}</dd></div><div><dt>Workspace</dt><dd>${i.workspace}</dd></div><div><dt>Last known state</dt><dd>${i.last}</dd></div></dl>${i.id !== 'storage' ? `<div class="unknown"><b>Outcome is unknown</b><span>ThreadHelm will not replay, resend, resume, or mark this work complete automatically.</span></div><h3>Choose a new action</h3><p class="action-copy">A replacement session starts as new work. It does not continue the unknown process and receives no assumed completion state.</p><div class="detail-actions"><button>Dismiss record</button><button class="primary" data-start>Review new session</button></div>` : `<div class="resolved"><b>Resolved record</b><span>This evidence is retained for review and requires no process action.</span></div>`}</section>`;
}
function renderA() {
  return `<main>${head('Recovery records', 'Review sessions that did not end cleanly. Nothing is relaunched automatically.')}<div class="recovery-page"><aside><div class="section-head"><div><span class="eyebrow">Open records</span><h2>2 need attention</h2></div></div>${queue()}</aside>${evidence()}</div></main>`;
}
function renderB() {
  return `<main>${head('Mission recovery', 'Keep the recovery decision beside the affected mission and its retained evidence.')}<section class="mission-context"><div><span class="eyebrow">Affected mission</span><h2>Feature 003 · Session workspace</h2><p>Paused for recovery review · other missions are unaffected</p></div><span class="severity danger">Recovery required</span></section><div class="mission-recovery">${evidence()}<aside class="timeline"><span class="eyebrow">Retained evidence</span><h2>Last observed events</h2><ol><li><b>10:41:52</b><span>Worker output received</span></li><li><b>10:42:01</b><span>Observation channel closed</span></li><li><b>10:42:01</b><span>Recovery record created</span></li></ol><p>These events establish observation loss. They do not establish whether external work completed.</p></aside></div></main>`;
}
function renderC() {
  return `<main>${head('Attention queue', 'Handle uncertain outcomes and destructive reviews from one calm queue.')}<div class="attention-summary"><div><b>2</b><span>Recovery decisions</span></div><div><b>1</b><span>Resolved record</span></div><div><b>0</b><span>Automatic retries</span></div></div><div class="attention-layout"><aside><div class="queue-filters"><button class="selected">Needs action · 2</button><button>Resolved · 1</button><button>All records · 3</button></div>${queue()}</aside>${evidence()}<aside class="recovery-coach"><span class="avatar">R</span><span class="eyebrow">Recovery Coach</span><h2>What is safe now?</h2><p>I can explain the retained evidence and prepare a new action. I cannot infer that unknown work failed or succeeded.</p><button>Explain this record</button><button>Compare replacement options</button><p class="coach-boundary">No automatic replay. No silent dismissal. No target substitution.</p></aside></div></main>`;
}
function deleteDialog() {
  return state.deleteOpen
    ? `<div class="scrim"><section class="dialog delete-dialog" role="dialog" aria-modal="true" aria-label="Review mission content deletion"><div class="dialog-head"><div><span class="eyebrow">Destructive action review</span><h2>Delete Feature 003 mission content?</h2></div><button data-close>×</button></div><p>This targets one exact mission. It does not delete the workspace, provider configuration, agent profiles, or unrelated memory.</p><dl><div><dt>Mission</dt><dd>Feature 003 · Session workspace</dd></div><div><dt>Content removed</dt><dd>Brief, 4 work items, 2 decisions</dd></div><div><dt>Linked memory</dt><dd>2 mission-scoped entries deleted</dd></div><div><dt>Audit retained</dt><dd>Content-free deletion receipts</dd></div></dl><div class="unknown"><b>This cannot be undone</b><span>Active or unknown work must be resolved before deletion can proceed.</span></div><label><input type="checkbox"> Delete only the exact content listed above.</label><div class="dialog-actions"><button data-close>Keep mission</button><button class="delete" disabled>Delete mission content</button></div></section></div>`
    : '';
}
function startDialog() {
  const i = item();
  return state.startOpen
    ? `<div class="scrim"><section class="dialog" role="dialog" aria-modal="true" aria-label="Review replacement session"><div class="dialog-head"><div><span class="eyebrow">New action review</span><h2>Start a separate replacement session?</h2></div><button data-close>×</button></div><dl><div><dt>Recovery record</dt><dd>${i.title}</dd></div><div><dt>New provider</dt><dd>${i.session.split(' · ')[1]}</dd></div><div><dt>Workspace</dt><dd>${i.workspace}</dd></div><div><dt>Relationship</dt><dd>Supersedes record; does not replay work</dd></div></dl><p class="unknown"><b>Previous outcome remains unknown</b><span>The replacement starts from a reviewed prompt and receives no claim that earlier effects did or did not occur.</span></p><div class="dialog-actions"><button data-close>Cancel</button><button class="primary">Start new session</button></div></section></div>`
    : '';
}
function bind() {
  document.querySelectorAll('[data-item]').forEach((b) =>
    b.addEventListener('click', () => {
      state.selected = b.dataset.item;
      render();
    }),
  );
  document.querySelectorAll('[data-delete]').forEach((b) =>
    b.addEventListener('click', () => {
      state.deleteOpen = true;
      render();
    }),
  );
  document.querySelectorAll('[data-start]').forEach((b) =>
    b.addEventListener('click', () => {
      state.startOpen = true;
      render();
    }),
  );
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      state.deleteOpen = false;
      state.startOpen = false;
      render();
    }),
  );
}
function render() {
  app.innerHTML = `<div class="frame">${chrome()}${variant === 'A' ? renderA() : variant === 'B' ? renderB() : renderC()}</div>${deleteDialog()}${startDialog()}`;
  bind();
}
render();
