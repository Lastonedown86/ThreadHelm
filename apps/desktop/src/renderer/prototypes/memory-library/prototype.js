// PROTOTYPE ONLY — representative evidence; no production APIs or persistence.
const books = [
  {
    id: 'decision',
    title: 'Mission dock is the selected session structure',
    kind: 'Decision',
    status: 'Active',
    tone: 'active',
    scope: 'Feature 003',
    author: 'User',
    source: 'Session design decision · rev 1',
    updated: 'Today · 10:14 AM',
    excerpt: 'Session tabs and exact-target controls stay inside the active mission.',
    why: 'Title and body match “session structure”; scoped to the active workspace.',
    color: 'copper',
  },
  {
    id: 'constraint',
    title: 'Private profiles stay outside bundled starters',
    kind: 'Constraint',
    status: 'Active',
    tone: 'active',
    scope: 'ThreadHelm workspace',
    author: 'User',
    source: 'Agent library decision · rev 1',
    updated: 'Today · 10:31 AM',
    excerpt: 'Private local profiles are never mixed into the generic starter library.',
    why: 'Constraint applies to the current workspace and product-release boundary.',
    color: 'green',
  },
  {
    id: 'conflict',
    title: 'Terminal should remain permanently visible',
    kind: 'Preference',
    status: 'Contested',
    tone: 'contested',
    scope: 'Feature 003',
    author: 'Session 73e3a410',
    source: 'Mission discussion · rev 2',
    updated: 'Yesterday',
    excerpt: 'A permanent terminal may reduce the steps needed to inspect output.',
    why: 'Included because contested entries are visible in the current search.',
    color: 'gold',
  },
  {
    id: 'expired',
    title: 'Temporary UI prototype port allocation',
    kind: 'Fact',
    status: 'Expired',
    tone: 'expired',
    scope: 'Feature 003',
    author: 'Session 93b8d20a',
    source: 'Prototype setup · rev 1',
    updated: 'Expired Aug 31',
    excerpt: 'Ports 4178–4180 were reserved for disposable design previews.',
    why: 'Shown by the lifecycle filter; excluded from normal mission context.',
    color: 'gray',
  },
  {
    id: 'retracted',
    title: 'Use a separate virtual machine for installation',
    kind: 'Decision',
    status: 'Retracted',
    tone: 'retracted',
    scope: 'ThreadHelm workspace',
    author: 'User',
    source: 'Installation discussion · rev 3',
    updated: 'Retracted Aug 30',
    excerpt: 'This recommendation was withdrawn after local installation was approved.',
    why: 'Shown only because historical states are enabled.',
    color: 'red',
  },
  {
    id: 'deleted',
    title: 'Deleted memory receipt',
    kind: 'Deleted content',
    status: 'Deleted',
    tone: 'deleted',
    scope: 'Feature 002',
    author: 'User',
    source: 'Deletion receipt · no content retained',
    updated: 'Deleted Aug 29',
    excerpt: 'Content and search index removed. Minimal audit receipt retained.',
    why: 'Deletion receipts cannot enter provider context.',
    color: 'black',
  },
  {
    id: 'superseded',
    title: 'Use a full-height terminal beside every mission',
    kind: 'Decision',
    status: 'Superseded',
    tone: 'superseded',
    scope: 'Feature 003',
    author: 'User',
    source: 'Session layout decision · rev 1',
    updated: 'Superseded today',
    excerpt: 'Replaced by the approved collapsible mission dock decision.',
    why: 'Historical edition linked from the current Mission dock decision.',
    color: 'blue',
  },
];
const state = {
  selected: 'decision',
  query: 'session structure',
  coach: true,
  pack: ['decision', 'constraint'],
  page: 1,
};
const app = document.querySelector('#app');
const q = new URLSearchParams(location.search);
const requested = q.get('variant')?.toUpperCase();
const variant = ['A', 'B', 'C'].includes(requested) ? requested : 'A';
const labels = { A: 'Catalog hall', B: 'Reading desk', C: 'Mission room' };
function selected() {
  return books.find((b) => b.id === state.selected) ?? books[0];
}
function chrome() {
  return `<aside class="chrome"><div class="brand"><i>TH</i><div><b>ThreadHelm</b><small>Memory Library</small></div></div><nav>${Object.entries(
    labels,
  )
    .map(
      ([k, v]) =>
        `<a class="${variant === k ? 'active' : ''}" href="?variant=${k}"><b>${k}</b><span>${v}</span></a>`,
    )
    .join(
      '',
    )}</nav><div class="lab-note"><b>Prototype only</b><span>Books represent exact local memory revisions.</span></div></aside>`;
}
function head(title, copy) {
  return `<header class="page-head"><div><span class="eyebrow">Workspace Library · Local</span><h1>${title}</h1><p>${copy}</p></div><div class="head-actions"><button data-coach>Ask the Librarian</button><button class="primary">Publish memory</button></div></header>`;
}
function status(b) {
  return `<span class="memory-status ${b.tone}">${b.status}</span>`;
}
function book(b, shape = 'row') {
  const supportingText = shape === 'card' ? `Edition: ${b.source}` : b.excerpt;
  return `<button class="memory-${shape} ${state.selected === b.id ? 'selected' : ''}" data-book="${b.id}"><i class="spine ${b.color}"></i><span><small>${b.kind} · ${b.scope}</small><b>${b.title}</b><em>${supportingText}</em></span>${status(b)}</button>`;
}
function detail() {
  const b = selected();
  return `<article class="book-detail"><div class="book-heading"><div><span class="eyebrow">Open volume</span><h2>${b.title}</h2></div>${status(b)}</div><p class="book-body">${b.excerpt}</p><dl><div><dt>Scope</dt><dd>${b.scope}</dd></div><div><dt>Attribution</dt><dd>${b.author}</dd></div><div><dt>Exact source</dt><dd>${b.source}</dd></div><div><dt>Lifecycle</dt><dd>${b.updated}</dd></div></dl><section class="why"><b>Why this appeared</b><p>${b.why}</p></section><p class="boundary">This volume supplies context only. It cannot grant tools, expand scope, change budget, or override the mission.</p><div class="detail-actions"><button>View lineage</button><button>${b.status === 'Active' ? 'Contest' : 'Inspect state'}</button><button class="primary">Add to reading list</button></div></article>`;
}
function coach() {
  return state.coach
    ? `<aside class="librarian"><div class="librarian-head"><span class="avatar">L</span><div><span class="eyebrow">Memory Coach</span><h2>The Librarian</h2></div><button data-coach aria-label="Close Librarian">×</button></div><p>I found evidence for <strong>“${state.query}”</strong>. Two current volumes are suitable for the mission. One related preference is contested.</p><div class="coach-action"><b>Build a mission reading list?</b><span>I’ll show every revision, source, and lifecycle state before anything is supplied to a worker.</span><button>Review 2 proposed volumes</button></div><div class="coach-prompts"><button>Explain the conflict</button><button>Help me publish a memory</button><button>Find stale decisions</button></div><p class="coach-boundary">I can organize and explain memory. I cannot silently publish, resolve conflicts, or grant authority.</p></aside>`
    : '';
}
function search() {
  return `<div class="library-search"><span>⌕</span><input aria-label="Search the Memory Library" value="${state.query}"><button>Search library</button><button class="filter">Scope: This workspace</button><button class="filter">States: All 7</button></div>`;
}
function renderA() {
  return `<main>${head('Library catalog', 'Browse durable knowledge by collection, status, and exact revision.')}<div class="catalog-stats"><div><b>42</b><span>Active volumes</span></div><div><b>3</b><span>Need attention</span></div><div><b>7</b><span>Mission collections</span></div></div><div class="catalog-layout"><aside class="collections"><span class="eyebrow">Collections</span><button class="selected">All volumes <b>57</b></button><button>Decisions <b>14</b></button><button>Constraints <b>9</b></button><button>Lessons <b>18</b></button><button>Artifacts <b>11</b></button><hr><button>Contested <b>2</b></button><button>Expired <b>1</b></button><button>Retracted <b>2</b></button></aside><section class="shelves">${books.map((b) => book(b)).join('')}<button class="load-more">Load next 20 volumes · 31–50</button></section>${detail()}</div></main>`;
}
function renderB() {
  return `<main>${head('Find the evidence you need', 'Search exact local knowledge, inspect why it matched, and let the Librarian assemble a bounded reading list.')}${search()}<div class="result-note"><span><b>7 results</b> across this workspace</span><span>Deterministic text match · exact revisions</span></div><div class="reading-layout"><section class="results">${books.map((b) => book(b)).join('')}<button class="load-more">Load next 20 results · cursor 2 of 4</button></section>${detail()}${coach()}</div></main>`;
}
function renderC() {
  return `<main>${head('Mission reading room', 'Review the exact knowledge proposed for Feature 003 before any worker receives it.')}<section class="mission-brief"><div><span class="eyebrow">Active mission</span><h2>Deliver the approved session workspace</h2><p>2 volumes proposed · 3.2 KB of 12 KB context budget</p></div><button>Change mission</button></section><div class="room-layout"><section class="reading-list"><div class="section-head"><div><span class="eyebrow">Librarian’s reading list</span><h2>Proposed context</h2></div><span class="budget">27% budget</span></div>${books
    .slice(0, 3)
    .map(
      (b, i) =>
        `<label class="pack"><input type="checkbox" ${i < 2 ? 'checked' : ''}><span>${book(b, 'card')}</span></label>`,
    )
    .join(
      '',
    )}<button class="primary wide">Review context packet</button></section><section class="mission-search">${search()}<h3>Search the library without leaving this mission</h3>${books
    .slice(3)
    .map((b) => book(b))
    .join('')}</section>${coach()}</div></main>`;
}
function bind() {
  document.querySelectorAll('[data-book]').forEach((el) =>
    el.addEventListener('click', () => {
      state.selected = el.dataset.book;
      render();
    }),
  );
  document.querySelectorAll('[data-coach]').forEach((el) =>
    el.addEventListener('click', () => {
      state.coach = !state.coach;
      render();
    }),
  );
  document
    .querySelector('input[aria-label="Search the Memory Library"]')
    ?.addEventListener('input', (e) => {
      state.query = e.target.value;
    });
}
function render() {
  app.innerHTML = `<div class="frame">${chrome()}${variant === 'A' ? renderA() : variant === 'B' ? renderB() : renderC()}</div>`;
  bind();
}
render();
