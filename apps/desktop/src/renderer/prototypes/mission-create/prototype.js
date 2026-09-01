// PROTOTYPE ONLY — representative local state, no production APIs or persistence.
const variants = {
  A: { name: 'Envelope', render: renderEnvelope },
  B: { name: 'Guided course', render: renderGuided },
  C: { name: 'Live boundary', render: renderSplit },
  D: { name: 'Guided boundary', render: renderHybrid },
};

const state = {
  step: 1,
  workerCount: 1,
  objective: 'Prepare the verified Mission Focus implementation plan.',
  evidence: 'Approved browser designs, focused tests, and installed Windows evidence.',
  review: false,
  importOpen: false,
  importPreview: false,
  createProfileOpen: false,
  createProfileReview: false,
  cliDraftOpen: false,
  cliDraftResult: false,
  selectedStarter: 'review',
  draftWork:
    'Review completed implementation work for correctness, accessibility, and agreement with the approved design.',
  draftResult: 'Clear, cited material findings or an explicit no-material-defects result.',
  draftAbilities: ['Review', 'Test', 'Accessibility'],
  scopeGuard:
    'Do not implement the production redesign or widen mission authority during this planning mission.',
  accessMode: 'write',
  workerRuntime: {},
  crewBuilderOpen: false,
  crewBuilderGenerated: false,
  crewBuilderAdded: false,
  crewPlanMode: 'focused',
  selectedCrewSuggestions: ['builder', 'reviewer'],
  outcomeCoachOpen: false,
  outcomeCoachGenerated: false,
  outcomeCoachApplied: false,
  roughOutcomeRequest:
    'Help me improve mission creation, verify that it works in the installed Windows app, and keep the work focused.',
  accessCoachOpen: false,
  accessCoachApplied: false,
  draftExitOpen: false,
  draftExitMode: 'autosave',
};
const initialParams = new URLSearchParams(location.search);
if (initialParams.get('stage') === 'review') state.step = 4;
if (initialParams.get('stage') === 'access') state.step = 3;
if (initialParams.get('stage') === 'crew') state.step = 2;
if (initialParams.get('stage') === 'outcome') state.step = 1;
if (initialParams.get('stage') === 'prompt') {
  state.step = 2;
  state.importOpen = true;
  state.cliDraftOpen = true;
}
if (initialParams.get('builder') === 'workshop') {
  state.step = 2;
  state.crewBuilderOpen = true;
  state.crewBuilderGenerated = initialParams.get('crewState') !== 'start';
}
if (initialParams.get('coach')) {
  state.step = 1;
  state.outcomeCoachOpen = true;
  state.outcomeCoachGenerated = initialParams.get('coach') !== 'start';
  state.outcomeCoachApplied = initialParams.get('coach') === 'applied';
}
if (initialParams.get('accessCoach')) {
  state.step = 3;
  state.accessCoachOpen = true;
  state.accessCoachApplied = initialParams.get('accessCoach') === 'applied';
  state.workerCount = 2;
  state.crewBuilderAdded = true;
}
if (initialParams.get('stage') === 'review') {
  state.workerCount = 2;
  state.crewBuilderAdded = true;
  state.accessCoachApplied = true;
}
if (initialParams.get('exit')) {
  state.draftExitOpen = true;
  state.draftExitMode = ['autosave', 'confirm', 'failed'].includes(initialParams.get('exit'))
    ? initialParams.get('exit')
    : 'autosave';
}
const app = document.querySelector('#app');

function currentVariant() {
  const value = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  return variants[value] ? value : 'A';
}

function currentReviewLayout() {
  const value = new URLSearchParams(location.search).get('review');
  return ['summary', 'ledger', 'boundary'].includes(value) ? value : 'summary';
}

const crewLayouts = {
  inline: 'A — Inline controls',
  card: 'B — Brief + defaults',
  lane: 'C — Work lane',
};

const promptLayouts = {
  quick: 'A — Quick request',
  guided: 'B — Guided starters',
  preview: 'C — Live profile',
};

const flowLayouts = {
  quiet: {
    label: 'A — Quiet form',
    description: 'A compact path with only essential choices and concise explanations.',
  },
  guided: {
    label: 'B — Guided guardrails',
    description: 'Plain-language prompts, readiness checks, and visible consequences.',
  },
  exact: {
    label: 'C — Exact operator',
    description: 'Dense authority and binding detail for experienced operators.',
  },
};

function currentFlowLayout() {
  const value = new URLSearchParams(location.search).get('flow');
  return flowLayouts[value] ? value : 'guided';
}

function currentReviewState() {
  const value = new URLSearchParams(location.search).get('reviewState');
  return ['ready', 'changed', 'expired', 'blocked'].includes(value) ? value : 'ready';
}

function currentCrewBuilderState() {
  const value = new URLSearchParams(location.search).get('crewState');
  return ['ready', 'cli-unavailable', 'invalid', 'duplicate', 'too-many', 'empty'].includes(value)
    ? value
    : 'ready';
}

function setCrewBuilderState(crewState) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'crew');
  url.searchParams.set('crew', 'card');
  url.searchParams.set('builder', 'workshop');
  url.searchParams.set('crewState', crewState);
  history.replaceState({}, '', url);
  state.step = 2;
  state.crewBuilderOpen = true;
  state.crewBuilderGenerated = crewState !== 'start';
  state.crewBuilderAdded = false;
  render();
}

function currentOutcomeCoachState() {
  const value = new URLSearchParams(location.search).get('coachState');
  return ['ready', 'ambiguous', 'too-broad', 'cli-unavailable', 'invalid'].includes(value)
    ? value
    : 'ready';
}

function setOutcomeCoachState(coachState) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'outcome');
  url.searchParams.set('flow', 'guided');
  url.searchParams.set('coach', 'review');
  url.searchParams.set('coachState', coachState);
  history.replaceState({}, '', url);
  state.step = 1;
  state.outcomeCoachOpen = true;
  state.outcomeCoachGenerated = true;
  state.outcomeCoachApplied = false;
  render();
}

function stageForStep(step = state.step) {
  return ['outcome', 'crew', 'access', 'review'][step - 1];
}

function syncStageUrl() {
  const url = new URL(location.href);
  url.searchParams.set('stage', stageForStep());
  url.searchParams.set('flow', currentFlowLayout());
  if (state.step !== 2) url.searchParams.delete('crew');
  if (state.step !== 2) url.searchParams.delete('builder');
  if (state.step !== 2) url.searchParams.delete('crewState');
  if (state.step !== 4) url.searchParams.delete('reviewState');
  if (state.step !== 4) url.searchParams.delete('review');
  if (state.step !== 1) url.searchParams.delete('coach');
  if (state.step !== 1) url.searchParams.delete('coachState');
  if (state.step !== 3) url.searchParams.delete('accessCoach');
  history.replaceState({}, '', url);
}

function setFlowLayout(layout) {
  if (!flowLayouts[layout]) return;
  const url = new URL(location.href);
  url.searchParams.set('flow', layout);
  url.searchParams.set('stage', stageForStep());
  if (state.step === 4) url.searchParams.set('reviewState', currentReviewState());
  history.replaceState({}, '', url);
  render();
}

function setReviewState(reviewState) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'review');
  url.searchParams.set('flow', currentFlowLayout());
  url.searchParams.set('reviewState', reviewState);
  history.replaceState({}, '', url);
  state.step = 4;
  render();
}

const starterBriefs = {
  review: {
    title: 'Implementation review',
    hint: 'Check finished work and return evidence.',
    work: 'Review completed implementation work for correctness, accessibility, and agreement with the approved design.',
    result: 'Clear, cited material findings or an explicit no-material-defects result.',
    abilities: ['Review', 'Test', 'Accessibility'],
  },
  investigate: {
    title: 'Bug investigation',
    hint: 'Reproduce a problem and establish its cause.',
    work: 'Reproduce reported failures, isolate the responsible behavior, and explain the confirmed root cause.',
    result: 'Reproduction evidence, a supported root cause, and the smallest safe correction path.',
    abilities: ['Investigation', 'Test', 'Documentation'],
  },
  docs: {
    title: 'Documentation steward',
    hint: 'Keep instructions aligned with verified behavior.',
    work: 'Review product and developer documentation when behavior, setup, or operating guidance changes.',
    result:
      'Clear updated guidance with examples or commands checked against the current implementation.',
    abilities: ['Documentation', 'Review', 'Test'],
  },
  blank: {
    title: 'Start without a starter',
    hint: 'Write the reusable purpose in your own words.',
    work: '',
    result: '',
    abilities: [],
  },
};

function currentPromptLayout() {
  const value = new URLSearchParams(location.search).get('prompt');
  return promptLayouts[value] ? value : 'guided';
}

function setPromptLayout(layout) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'prompt');
  url.searchParams.set('crew', 'card');
  url.searchParams.set('prompt', layout);
  url.searchParams.delete('review');
  history.replaceState({}, '', url);
  state.step = 2;
  state.importOpen = true;
  state.cliDraftOpen = true;
  state.cliDraftResult = false;
  render();
}

function currentCrewLayout() {
  const value = new URLSearchParams(location.search).get('crew');
  return crewLayouts[value] ? value : 'inline';
}

function setCrewLayout(layout) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'crew');
  url.searchParams.set('crew', layout);
  url.searchParams.delete('review');
  history.replaceState({}, '', url);
  state.step = 2;
  render();
}

function setReviewLayout(layout) {
  const url = new URL(location.href);
  url.searchParams.set('stage', 'review');
  url.searchParams.set('review', layout);
  history.replaceState({}, '', url);
  state.step = 4;
  render();
}

function setVariant(key) {
  const url = new URL(location.href);
  url.searchParams.set('variant', key);
  url.searchParams.delete('stage');
  url.searchParams.delete('review');
  url.searchParams.delete('crew');
  url.searchParams.delete('prompt');
  history.replaceState({}, '', url);
  state.step = 1;
  state.review = false;
  state.importOpen = false;
  state.importPreview = false;
  state.createProfileOpen = false;
  state.createProfileReview = false;
  state.cliDraftOpen = false;
  state.cliDraftResult = false;
  render();
}

function cycle(direction) {
  const keys = Object.keys(variants);
  const index = keys.indexOf(currentVariant());
  setVariant(keys[(index + direction + keys.length) % keys.length]);
}

function brand() {
  return `<div class="brand"><div class="mark">T</div><div><b>ThreadHelm</b><small>Mission design</small></div></div>`;
}

function draftExitPanel() {
  if (!state.draftExitOpen) return '';
  const modes = [
    ['autosave', 'B · Local autosave'],
    ['confirm', 'A · Ask every time'],
    ['failed', 'Save failure'],
  ];
  const switcher = `<nav class="draft-exit-switcher" aria-label="Draft exit alternatives"><span>EXIT ALTERNATIVES</span>${modes.map(([key, label]) => `<button class="${state.draftExitMode === key ? 'selected' : ''}" data-draft-exit-mode="${key}">${label}</button>`).join('')}</nav>`;
  let content;
  if (state.draftExitMode === 'confirm') {
    content = `<div class="draft-exit-message"><span class="draft-exit-mark">?</span><div><span class="eyebrow">UNSAVED MISSION DRAFT</span><h2>What should happen to these changes?</h2><p>The mission has not started. Choose whether to keep a local draft or discard the composer values.</p></div></div><div class="draft-exit-summary"><div><span>Outcome</span><b>Shaped · 3 proof obligations</b></div><div><span>Crew</span><b>2 workers selected</b></div><div><span>Access</span><b>1 folder · read and write</b></div></div><div class="draft-exit-actions"><button data-close-draft-exit>Keep editing</button><button class="danger-outline">Discard changes</button><button class="primary">Save draft and close</button></div>`;
  } else if (state.draftExitMode === 'failed') {
    content = `<div class="draft-exit-message failed"><span class="draft-exit-mark">!</span><div><span class="eyebrow">LOCAL SAVE FAILED</span><h2>I couldn’t safely save this draft.</h2><p>The composer remains open and no values were discarded. Start and Close stay unavailable until you retry or make an explicit choice.</p></div></div><div class="draft-save-error"><span>Draft store unavailable</span><b>The local database did not confirm the write. No retry was attempted automatically.</b></div><div class="draft-exit-actions"><button data-close-draft-exit>Keep editing</button><button class="danger-outline">Discard changes…</button><button class="primary">Retry local save</button></div>`;
  } else {
    content = `<div class="draft-exit-message saved"><span class="draft-exit-mark">✓</span><div><span class="eyebrow">MISSION COACH · DRAFT SAVED</span><h2>Your mission draft is safe locally.</h2><p>I saved the editable outcome, crew plan, guardrails, and coach receipts. Nothing was launched or granted authority.</p></div></div><div class="draft-exit-summary"><div><span>Saved locally</span><b>Just now</b><small>App-owned draft store</small></div><div><span>Resume point</span><b>${['Outcome', 'Crew', 'Access & limits', 'Review'][state.step - 1]}</b><small>Returns to this wizard stage</small></div><div><span>Still off</span><b>Access · permissions · launch</b><small>A draft is not mission authority</small></div></div><div class="draft-exit-policy"><span>✓</span><div><b>Recommended default</b><small>Save locally after meaningful edits and before closing. Show this receipt without adding a second confirmation gate.</small></div></div><div class="draft-exit-actions"><button data-close-draft-exit>Keep editing</button><button class="primary">Close composer</button></div>`;
  }
  return `<div class="draft-exit-backdrop" role="presentation"><section class="draft-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-exit-heading"><div class="draft-exit-heading"><div><span class="eyebrow">CLOSE MISSION COMPOSER</span><h1 id="draft-exit-heading">Leave without losing your work.</h1></div><button data-close-draft-exit aria-label="Close exit dialog">×</button></div>${switcher}${content}</section></div>`;
}

function shell(content, variant) {
  return `<main class="prototype variant-${variant.toLowerCase()}">
    <div class="prototype-flag">DESIGN PROTOTYPE · READ ONLY</div>
    <header class="app-top">${brand()}<div class="crumb">Missions <span>›</span> New mission</div><button class="close">Close</button></header>
    ${content}
  </main>${draftExitPanel()}
  <nav class="variant-switcher" aria-label="Prototype variants">
    <button data-cycle="-1" aria-label="Previous design">←</button>
    <span><b>${variant}</b> — ${variants[variant].name}</span>
    <button data-cycle="1" aria-label="Next design">→</button>
  </nav>`;
}

function field(label, content, help = '') {
  return `<label class="field"><span>${label}</span>${content}${help ? `<small>${help}</small>` : ''}</label>`;
}

function objectiveFields() {
  return `<div class="field-stack">
    ${field('Objective', `<textarea data-objective rows="3">${state.objective}</textarea>`, 'One bounded outcome that every participant can recognize.')}
    ${field('Completion evidence', `<textarea data-evidence rows="2">${state.evidence}</textarea>`, 'What must be cited before this mission can be complete.')}
  </div>`;
}

function supervisorFields() {
  return `<div class="two-fields">
    ${field('Supervisor profile', '<select><option>Mission coordinator · rev 7b19a0ce</option></select>')}
    ${field('Supervisor session', '<select><option>Codex CLI · ThreadHelm · 1e6f32a4</option></select>', 'The supervisor uses this session’s verified runtime.')}
  </div>`;
}

const runtimeCatalog = {
  'codex-cli': {
    label: 'Codex CLI',
    profile: 'Implementation agent · rev 24c801fe',
    profileModel: 'gpt-5.6-sol',
    models: [
      ['gpt-5.6-sol', 'GPT-5.6 Sol'],
      ['gpt-5.6-terra', 'GPT-5.6 Terra'],
      ['gpt-5.6-luna', 'GPT-5.6 Luna'],
      ['gpt-5.4', 'GPT-5.4'],
    ],
    efforts: {
      'gpt-5.6-sol': ['low', 'medium', 'high', 'xhigh', 'max'],
      'gpt-5.6-terra': ['low', 'medium', 'high', 'xhigh', 'max'],
      'gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
      'gpt-5.4': ['low', 'medium', 'high', 'xhigh'],
    },
  },
  'claude-code': {
    label: 'Claude Code',
    profile: 'Claude implementation agent · rev 983bf214',
    profileModel: 'sonnet',
    models: [
      ['sonnet', 'Claude Sonnet'],
      ['opus', 'Claude Opus'],
      ['fable', 'Claude Fable 5'],
    ],
    efforts: {
      sonnet: ['low', 'medium', 'high', 'xhigh'],
      opus: ['low', 'medium', 'high', 'xhigh'],
      fable: ['low', 'medium', 'high'],
    },
  },
};

function workerRuntime(index) {
  if (!state.workerRuntime[index]) {
    state.workerRuntime[index] = {
      providerId: index > 1 ? 'claude-code' : 'codex-cli',
      model: 'profile',
    };
  }
  return state.workerRuntime[index];
}

function runtimeFields(index) {
  const runtime = workerRuntime(index);
  const provider = runtimeCatalog[runtime.providerId];
  const effectiveModel = runtime.model === 'profile' ? provider.profileModel : runtime.model;
  const modelLabel =
    runtime.model === 'default'
      ? `${provider.label} default model`
      : (provider.models.find(([value]) => value === effectiveModel)?.[1] ?? 'Custom model');
  const efforts = provider.efforts[effectiveModel] ?? ['low', 'medium', 'high'];
  return `${field(
    'Provider',
    `<div class="resolved-choice"><b>${provider.label}</b><small>Fixed by the exact profile revision</small></div>`,
    'Choose another provider by choosing a compatible profile or live session.',
  )}
    ${field(
      'Model',
      `<select data-worker-model="${index}"><option value="default" ${runtime.model === 'default' ? 'selected' : ''}>Use ${provider.label} default</option><option value="profile" ${runtime.model === 'profile' ? 'selected' : ''}>Profile request · ${provider.models.find(([value]) => value === provider.profileModel)?.[1]}</option>${provider.models.map(([value, label]) => `<option value="${value}" ${runtime.model === value ? 'selected' : ''}>${label}</option>`).join('')}<option value="custom" ${runtime.model === 'custom' ? 'selected' : ''}>Custom model…</option></select>`,
      `Only ${provider.label} models are listed. Unsupported values are held, never substituted.`,
    )}
    ${field(
      `Effort for ${modelLabel}`,
      `<select data-worker-effort="${index}"><option>Use ${provider.label} default effort</option>${efforts.map((effort) => `<option>${effort === 'xhigh' ? 'Extra high' : effort[0].toUpperCase() + effort.slice(1)}</option>`).join('')}</select>`,
      'Effort choices come from the selected provider and model capability record.',
    )}`;
}

function workerRuntimeSummary(index) {
  const runtime = workerRuntime(index);
  const provider = runtimeCatalog[runtime.providerId];
  const model =
    runtime.model === 'default'
      ? `${provider.label} default model`
      : runtime.model === 'profile'
        ? provider.models.find(([value]) => value === provider.profileModel)?.[1]
        : (provider.models.find(([value]) => value === runtime.model)?.[1] ?? 'Custom model');
  return { provider: provider.label, model };
}

function workerEditor(index = 1, compact = false) {
  const reviewer = index > 1;
  const runtime = workerRuntime(index);
  const provider = runtimeCatalog[runtime.providerId];
  const workerName = reviewer ? 'Implementation reviewer' : 'Implementation worker';
  const workerGoal = reviewer
    ? 'Verify the change against the approved design and report evidence or defects.'
    : 'Implement the approved mission slice without widening its authority.';
  const workerAbilities = reviewer
    ? 'review · test · documentation'
    : 'implementation · test · documentation';
  const assignment = reviewer
    ? 'Review the completed Mission Composer slice against the approved browser design and report material defects.'
    : 'Implement the approved Mission Composer crew and review states without changing coordinator authority.';
  const assignmentEvidence = reviewer
    ? 'Cited findings or an explicit no-material-defects result.'
    : 'Focused tests, browser evidence, and the exact files changed.';
  if (currentCrewLayout() === 'card') {
    return workerBriefEditor({
      index,
      reviewer,
      runtime,
      provider,
      workerName,
      workerGoal,
      workerAbilities,
      assignment,
      assignmentEvidence,
    });
  }
  return `<fieldset class="worker ${compact ? 'compact' : ''}">
    <legend><span class="worker-number">${index}</span><span>${workerName}<small>Bound to this mission only</small></span><button data-remove-worker="${index}" ${state.workerCount === 1 ? 'disabled' : ''}>Remove</button></legend>
    <div class="worker-grid">
      ${field('Profile', `<select data-worker-profile="${index}"><option value="codex-cli" ${runtime.providerId === 'codex-cli' ? 'selected' : ''}>Implementation agent · rev 24c801fe</option><option value="claude-code" ${runtime.providerId === 'claude-code' ? 'selected' : ''}>Claude implementation agent · rev 983bf214</option></select>`)}
      ${field('Role', '<select><option>worker</option><option>reviewer</option><option>triage</option></select>')}
      ${field('Session', `<select><option>Offline worker · ${provider.label}</option><option>${provider.label} · ThreadHelm</option></select>`, 'A live session fixes provider, model, and effort to its verified launch snapshot.')}
      ${field('Workspace', '<select><option>C:\\Users\\Bill\\Documents\\ThreadHelm</option></select>')}
      ${runtimeFields(index)}
      ${field('Permission', '<select><option>Manual</option><option>Bounded allowlist</option><option>Auto — requires exact provider proof</option></select>')}
      ${field('Automatic startup', '<select><option>Not authorized</option><option>Authorize for this exact binding</option></select>')}
    </div>
    <div class="worker-purpose"><div><span>Goal</span><p>${workerGoal}</p></div><div><span>Abilities</span><p>${workerAbilities}</p><small>Descriptive profile labels; permissions remain separate.</small></div></div>
    ${workerAssignment(currentCrewLayout(), assignment, assignmentEvidence)}
    ${compact ? '' : '<details><summary>Worker execution bounds</summary><div class="bounds-inline"><span>30 min</span><span>64 turns</span><span>8 processes</span><span>250k tokens</span></div></details>'}
  </fieldset>`;
}

function workerBriefEditor({
  index,
  reviewer,
  runtime,
  provider,
  workerName,
  workerGoal: _workerGoal,
  workerAbilities: _workerAbilities,
  assignment,
  assignmentEvidence,
}) {
  const resolved = workerRuntimeSummary(index);
  return `<fieldset class="worker worker-brief">
    <legend><span class="worker-number">${index}</span><span>${workerName}<small>One profile · one mission contribution</small></span><button data-remove-worker="${index}" ${state.workerCount === 1 ? 'disabled' : ''}>Remove</button></legend>
    <section class="brief-question">
      <span class="question-number">1</span>
      <div class="question-content"><div class="question-heading"><div><span class="eyebrow">WHO SHOULD HELP?</span><h3>Choose a worker profile.</h3></div><p>The profile supplies a reusable goal and abilities. It does not grant access or permission.</p></div>
        <div class="profile-choice-cards">
          <button type="button" class="profile-choice ${runtime.providerId === 'codex-cli' ? 'selected' : ''}" data-profile-card="${index}" data-provider="codex-cli"><span class="profile-choice-mark">C</span><span><b>Implementation agent</b><small>Goal · Implement an approved slice without widening authority.</small><small>Abilities · implementation · test · documentation</small></span><em>Codex CLI</em></button>
          <button type="button" class="profile-choice ${runtime.providerId === 'claude-code' ? 'selected' : ''}" data-profile-card="${index}" data-provider="claude-code"><span class="profile-choice-mark">A</span><span><b>Claude implementation agent</b><small>Goal · Implement an approved slice and return focused evidence.</small><small>Abilities · implementation · test · documentation</small></span><em>Claude Code</em></button>
        </div>
        <button type="button" class="choose-profile" data-open-worker>Choose, create, or import another profile…</button>
      </div>
    </section>
    <section class="brief-question">
      <span class="question-number">2</span>
      <div class="question-content"><div class="question-heading"><div><span class="eyebrow">WHAT SHOULD THEY DELIVER?</span><h3>Give this worker one contribution.</h3></div><p>This instruction belongs to the mission. It does not change the profile’s standing goal.</p></div>
        <div class="assignment-brief-fields">
          ${field('Assigned contribution', `<textarea rows="3">${assignment}</textarea>`, 'Describe one concrete outcome, not a general job title.')}
          ${field('Done when', `<input value="${assignmentEvidence}" />`, 'Name the evidence the worker must return.')}
        </div>
      </div>
    </section>
    <section class="brief-question run-question">
      <span class="question-number">3</span>
      <div class="question-content"><div class="question-heading"><div><span class="eyebrow">HOW SHOULD THEY RUN?</span><h3>Use the reviewed profile defaults.</h3></div><p>ThreadHelm will hold the worker if these settings are unavailable or change before launch.</p></div>
        <div class="run-recommendation"><span class="run-mark">✓</span><div><b>${resolved.provider} · ${resolved.model}</b><span>${resolved.provider} default effort · Manual permission · Automatic startup off</span><small>Role · ${reviewer ? 'Reviewer' : 'Worker'} · Workspace access is set once in the next step.</small></div><em>recommended</em></div>
        <details class="runtime-disclosure"><summary>Customize runtime</summary><p>Change these only when this mission needs a different verified runtime.</p><div class="runtime-customize">
          ${runtimeFields(index)}
          ${field('Role', `<select><option>${reviewer ? 'Reviewer' : 'Worker'}</option><option>${reviewer ? 'Worker' : 'Reviewer'}</option><option>Triage</option></select>`)}
          ${field('Session', `<select><option>Offline worker · ${provider.label}</option><option>${provider.label} · ThreadHelm</option></select>`, 'A live session uses its verified provider, model, and effort.')}
          ${field('Permission', '<select><option>Manual</option><option>Bounded allowlist</option><option>Auto — requires exact provider proof</option></select>')}
          ${field('Automatic startup', '<select><option>Not authorized</option><option>Authorize for this exact binding</option></select>')}
        </div><p class="runtime-boundary">The final review always shows the resolved provider, model, effort, permission, startup, workspace, and execution bounds.</p></details>
      </div>
    </section>
  </fieldset>`;
}

function workerAssignment(layout, assignment, evidence) {
  if (layout === 'card') {
    return `<section class="assignment-card" aria-label="Mission-specific worker assignment">
      <div class="assignment-heading"><div><span>MISSION ASSIGNMENT</span><h3>Give this worker one bounded contribution.</h3></div><b>required</b></div>
      ${field('Assigned contribution', `<textarea rows="3">${assignment}</textarea>`, 'This applies only to the selected mission; it does not change the reusable profile goal.')}
      ${field('Evidence to return', `<input value="${evidence}" />`, 'The supervisor uses this to recognize a complete handoff.')}
      <p>Profile abilities help match the assignment. The reviewed workspace, permission, runtime, and limits still control what can execute.</p>
    </section>`;
  }
  if (layout === 'lane') {
    return `<section class="assignment-lane" aria-label="Mission-specific worker assignment">
      <div><span>WORK LANE</span><select aria-label="Worker work lane"><option>${assignment.includes('Review') ? 'Verification' : 'Implementation'}</option><option>Documentation</option><option>Investigation</option></select></div>
      <div class="lane-brief"><span>ASSIGNED OUTCOME</span><b>${assignment}</b><small>Return · ${evidence}</small></div>
      <button type="button">Edit assignment…</button>
    </section>`;
  }
  return `<div class="assignment-inline">
    ${field('Mission assignment', `<textarea rows="3">${assignment}</textarea>`, 'Required for this mission only. The profile goal remains reusable and unchanged.')}
    <div><span>RETURN EVIDENCE</span><b>${evidence}</b></div>
  </div>`;
}

function crewLayoutSwitcher() {
  const current = currentCrewLayout();
  return `<div class="crew-layout-switcher" aria-label="Crew setup alternatives">
    <div><span>CREW SETUP LAYOUT</span><b>Compare how much runtime detail appears before final review.</b></div>
    ${Object.entries(crewLayouts)
      .map(
        ([key, label]) =>
          `<button class="${current === key ? 'selected' : ''}" data-crew-layout="${key}">${label}</button>`,
      )
      .join('')}
  </div>`;
}

function promptLayoutSwitcher() {
  const current = currentPromptLayout();
  return `<div class="prompt-layout-switcher" aria-label="CLI prompt builder alternatives">
    <span>PROFILE DRAFTING LAYOUT</span>
    ${Object.entries(promptLayouts)
      .map(
        ([key, label]) =>
          `<button class="${current === key ? 'selected' : ''}" data-prompt-layout="${key}">${label}</button>`,
      )
      .join('')}
  </div>`;
}

function draftingRuntime() {
  return `<div class="draft-runtime">
    <span class="run-mark">✓</span>
    <div><span class="eyebrow">RECOMMENDED DRAFTING RUNTIME</span><b>Codex CLI · GPT-5.6 Luna · Medium</b><small>No project folder · no tools · 90 second limit · bounded output</small></div>
    <em>ready</em>
  </div>
  <details class="draft-runtime-change"><summary>Change drafting runtime</summary><div class="draft-runtime-options"><button class="selected"><b>Codex CLI</b><span>GPT-5.6 Luna · Medium</span><small>Recommended economical choice</small></button><button><b>Claude Code</b><span>Claude Sonnet · Medium</span><small>Available local alternative</small></button></div><p>ThreadHelm will never switch provider or model after you start the draft.</p></details>`;
}

function starterBriefPicker() {
  return `<section class="starter-briefs" aria-labelledby="starter-brief-heading">
    <div class="starter-heading"><div><span class="eyebrow">OPTIONAL STARTING POINT</span><h3 id="starter-brief-heading">Begin with a useful brief.</h3></div><p>A starter fills the three questions below. Every word remains editable.</p></div>
    <div class="starter-grid">${Object.entries(starterBriefs)
      .map(
        ([key, starter]) =>
          `<button class="starter-card ${state.selectedStarter === key ? 'selected' : ''}" data-starter="${key}" aria-pressed="${state.selectedStarter === key}"><span class="starter-check">${state.selectedStarter === key ? '✓' : ''}</span><b>${starter.title}</b><small>${starter.hint}</small></button>`,
      )
      .join('')}</div>
  </section>`;
}

function guidedProfileReadback() {
  const abilityText = state.draftAbilities.length
    ? state.draftAbilities.join(' · ')
    : 'The drafting CLI may suggest abilities for review';
  return `<aside class="guided-profile-readback" aria-label="Plain-language profile preview">
    <div><span class="eyebrow">THIS WILL BECOME AN UNSAVED PROFILE</span><h3>${state.selectedStarter === 'blank' ? 'Your reusable worker' : starterBriefs[state.selectedStarter].title}</h3></div>
    <dl><div><dt>Helps with</dt><dd data-readback-work>${state.draftWork || 'Describe the reusable work above.'}</dd></div><div><dt>Good result</dt><dd data-readback-result>${state.draftResult || 'Describe the evidence or outcome above.'}</dd></div><div><dt>Abilities</dt><dd>${abilityText}</dd></div></dl>
    <p><b>Still excluded:</b> folders, permissions, mission assignment, effort, and automatic startup.</p>
  </aside>`;
}

function escapeMarkup(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function generatedProfileForRequest() {
  const choices = {
    review: {
      name: 'Implementation quality reviewer',
      description:
        'Reviews completed implementation work for correctness, accessibility, and agreement with its approved design.',
      goal: 'Find material defects and return clear evidence before the mission is considered complete.',
    },
    investigate: {
      name: 'Root-cause investigator',
      description: 'Reproduces reported failures and isolates the behavior responsible for them.',
      goal: 'Return reproduction evidence, a supported root cause, and the smallest safe correction path.',
    },
    docs: {
      name: 'Documentation steward',
      description:
        'Keeps operating and development guidance aligned with verified product behavior.',
      goal: 'Produce clear updated guidance with examples or commands checked against the current implementation.',
    },
    blank: {
      name: 'Custom worker draft',
      description: state.draftWork || 'Reusable work defined by the local owner.',
      goal: state.draftResult || 'Return a clear result that matches the reviewed profile brief.',
    },
  };
  const selected = choices[state.selectedStarter] || choices.blank;
  return {
    spec: 'threadhelm/agent-profile@1',
    name: selected.name,
    description: selected.description,
    provider: 'codex-cli',
    model: 'gpt-5.6-sol',
    goal: selected.goal,
    capabilities: state.draftAbilities.map((ability) => ability.toLowerCase()),
    isolate: true,
    tokenCap: 250000,
    author: 'Local owner',
  };
}

function profileDraftResult() {
  const profile = generatedProfileForRequest();
  const exactJson = escapeMarkup(JSON.stringify(profile, null, 2));
  const abilities = profile.capabilities.length
    ? profile.capabilities.join(' · ')
    : 'none requested';
  return `<section class="cli-draft-result" aria-labelledby="draft-result-heading">
    <div class="result-heading"><span class="review-mark">✓</span><div><span class="eyebrow">UNSAVED PROFILE DRAFT</span><h2 id="draft-result-heading">${escapeMarkup(profile.name)} is ready to inspect.</h2><p>Generated fields passed the strict profile schema. Review and edit them before saving anything.</p></div></div>
    <div class="draft-result-grid"><section><span>Name</span><b>${escapeMarkup(profile.name)}</b></section><section><span>Provider request</span><b>Codex CLI · GPT-5.6 Sol</b></section><section class="wide"><span>Description</span><b>${escapeMarkup(profile.description)}</b></section><section class="wide"><span>Goal</span><b>${escapeMarkup(profile.goal)}</b></section><section><span>Abilities</span><b>${escapeMarkup(abilities)}</b></section><section><span>Safety request</span><b>Isolation requested · 250k token cap</b></section></div>
    <div class="generation-receipt"><span>Drafted by Codex CLI</span><b>GPT-5.6 Luna · Medium</b><span>42 seconds · bounded local run</span><b class="mono">sha256:7a32c06d…f18b</b></div>
    <p class="import-boundary">This is an untrusted, unsaved profile draft. It has no tools, permission, workspace access, mission role, automatic startup, or assignment.</p>
    <details><summary>Exact validated profile JSON</summary><pre>${exactJson}</pre></details>
    <div class="import-actions"><button data-edit-cli-request>Edit request</button><button class="primary" data-use-cli-draft>Use this draft in profile editor</button></div>
  </section>`;
}

function cliPromptBuilder() {
  if (state.cliDraftResult) return profileDraftResult();
  const layout = currentPromptLayout();
  let content;
  if (layout === 'quick') {
    content = `<div class="quick-prompt"><label><span>Describe the worker you need</span><textarea rows="7">I need a reviewer that checks implementation, accessibility, and tests, then returns clear evidence of any material problems.</textarea><small>Include the kind of work, what good results look like, and any abilities that matter.</small></label>${draftingRuntime()}</div>`;
  } else if (layout === 'preview') {
    content = `<div class="prompt-preview-layout"><div class="prompt-preview-input"><span class="eyebrow">YOUR REQUEST</span><h3>Describe the worker in your own words.</h3><textarea rows="8">I need a reviewer that checks implementation, accessibility, and tests, then returns clear evidence of any material problems.</textarea>${draftingRuntime()}</div><aside class="profile-shape-preview"><span class="eyebrow">PROFILE SHAPE PREVIEW</span><h3>Implementation quality reviewer</h3><p>ThreadHelm will ask the CLI to propose these profile-only fields.</p><dl><div><dt>Goal</dt><dd>Focused review and evidence</dd></div><div><dt>Abilities</dt><dd>review · test · accessibility</dd></div><div><dt>Provider</dt><dd>Codex CLI</dd></div><div><dt>Excluded</dt><dd>permission · workspace · role · effort</dd></div></dl><p class="ability-note">The preview is illustrative. Only the validated CLI response can populate the unsaved draft.</p></aside></div>`;
  } else {
    content = `<div class="guided-starters">
      ${starterBriefPicker()}
      <div class="guided-starter-layout"><div class="guided-prompt">
        <section><span class="question-number">1</span><div>${field('What should this worker help with?', `<textarea rows="3" data-draft-work>${state.draftWork}</textarea>`, 'Describe one reusable kind of work, not a mission assignment.')}</div></section>
        <section><span class="question-number">2</span><div>${field('What should a good result contain?', `<textarea rows="3" data-draft-result>${state.draftResult}</textarea>`, 'This becomes guidance for the profile goal and description.')}</div></section>
        <section><span class="question-number">3</span><div><span class="field-label">Which abilities matter?</span><div class="ability-choices">${[
          'Review',
          'Test',
          'Accessibility',
          'Documentation',
          'Investigation',
        ]
          .map(
            (ability) =>
              `<button class="${state.draftAbilities.includes(ability) ? 'selected' : ''}" data-draft-ability="${ability}" aria-pressed="${state.draftAbilities.includes(ability)}">${ability}</button>`,
          )
          .join(
            '',
          )}</div><small class="field-help">These are matching labels only. They never grant tools or authority.</small></div></section>
      </div>${guidedProfileReadback()}</div>
      ${draftingRuntime()}
    </div>`;
  }
  return `<section class="cli-prompt-builder" aria-labelledby="cli-prompt-heading">
    <div class="import-heading"><div><span class="eyebrow">DRAFT WITH A LOCAL CLI MODEL</span><h2 id="cli-prompt-heading">Describe the worker. ThreadHelm will shape the JSON.</h2><p>The CLI drafts profile text inside a temporary ThreadHelm folder. Nothing is saved or launched.</p></div><button data-close-cli-draft>Back to profile choices</button></div>
    ${promptLayoutSwitcher()}
    ${content}
    <div class="cli-draft-action"><div><b>One bounded generation</b><span>The exact provider, model, limits, and validated result stay visible.</span></div><button class="primary" data-run-cli-draft>Draft profile with Codex CLI</button></div>
  </section>`;
}

function workerAddPanel() {
  if (state.cliDraftOpen) return cliPromptBuilder();
  if (state.createProfileOpen) {
    if (state.createProfileReview) {
      return `<section class="worker-import profile-create" aria-label="Created worker profile preview">
        <div class="import-heading"><div><span class="eyebrow">NEW LOCAL PROFILE · REVIEW</span><h2>Review the worker profile</h2></div><button data-cancel-import>Close</button></div>
        <div class="created-profile-summary"><span class="profile-initial">Q</span><div><h3>Quality reviewer</h3><p>Reviews implementation changes for correctness, accessibility, and agreement with the approved design.</p></div><b>local draft</b></div>
        <dl class="import-facts">
          <div class="wide"><dt>Goal</dt><dd>Find material defects and produce clear, cited review findings before the mission is complete.</dd></div>
          <div><dt>Abilities</dt><dd>review · test · accessibility · documentation</dd></div>
          <div><dt>Provider</dt><dd>Codex CLI</dd></div>
          <div><dt>Requested model</dt><dd>GPT-5.6 Sol</dd></div>
          <div><dt>Startup</dt><dd>Not authorized</dd></div>
        </dl>
        <p class="ability-note">The goal and abilities describe this reusable profile. The selected mission still controls folder access, permissions, runtime bounds, and the worker's assigned work.</p>
        <div class="import-actions"><button data-back-create>Edit profile</button><button class="primary" data-confirm-created>Save profile and add worker</button></div>
      </section>`;
    }
    return `<section class="worker-import profile-create" aria-label="Create worker profile">
      <div class="import-heading"><div><span class="eyebrow">NEW LOCAL PROFILE</span><h2>Describe the worker.</h2></div><button data-cancel-import>Close</button></div>
      <p class="create-intro">Create a reusable reviewed profile without writing JSON. Nothing starts when the profile is saved.</p>
      <div class="create-profile-fields">
        ${field('Name', '<input value="Quality reviewer" />')}
        ${field('Description', '<textarea rows="3">Reviews implementation changes for correctness, accessibility, and agreement with the approved design.</textarea>', 'A short explanation of when this profile is useful.')}
        ${field('Goal', '<textarea rows="3">Find material defects and produce clear, cited review findings before the mission is complete.</textarea>', 'The profile’s standing purpose. The mission assignment remains separate.')}
        ${field('Abilities', '<input value="review, test, accessibility, documentation" />', 'Descriptive lowercase matching labels; these do not grant authority.')}
        <div class="two-fields">${field('Provider', '<select><option>Codex CLI</option><option>Claude Code</option></select>', 'Only installed, verified runtime adapters appear here.')}${field('Requested model', '<select><option>GPT-5.6 Sol</option><option>GPT-5.6 Terra</option><option>GPT-5.6 Luna</option><option>Custom model…</option></select>', 'Profiles request a provider model. Provider defaults remain a mission or session runtime choice.')}</div>
      </div>
      <p class="import-boundary">Creating a profile does not grant tools, folder access, permission, automatic startup, or a mission assignment.</p>
      <div class="import-actions"><button data-cancel-import>Cancel</button><button class="primary" data-review-created>Review profile</button></div>
    </section>`;
  }
  if (state.importPreview) {
    return `<section class="worker-import previewing" aria-label="Imported worker profile preview">
      <div class="import-heading"><div><span class="eyebrow">LOCAL JSON PREVIEW</span><h2>Review imported worker</h2></div><button data-cancel-import>Close</button></div>
      <div class="import-file"><span>implementation-reviewer.json</span><b>local file · not yet saved</b></div>
      <dl class="import-facts">
        <div><dt>Spec</dt><dd>threadhelm/agent-profile@1</dd></div>
        <div><dt>Name</dt><dd>Implementation reviewer</dd></div>
        <div class="wide"><dt>Goal</dt><dd>Verify the change against the approved design and report evidence or defects.</dd></div>
        <div><dt>Provider</dt><dd>Codex CLI</dd></div>
        <div><dt>Requested model</dt><dd>GPT-5.6 Sol</dd></div>
        <div><dt>Abilities</dt><dd>review · test · documentation</dd></div>
        <div><dt>Digest</dt><dd class="mono">sha256:4d9c8f71…a236</dd></div>
      </dl>
      <p class="ability-note">Abilities are inert profile labels used for matching work. They do not grant tools, permissions, folder access, or authority.</p>
      <p class="import-boundary">Importing creates a local reviewed profile revision. It does not start a session, grant folder access, or authorize automatic worker startup.</p>
      <details><summary>Exact imported JSON</summary><pre>{
  "spec": "threadhelm/agent-profile@1",
  "name": "Implementation reviewer",
  "description": "Reviews completed work and returns focused evidence.",
  "provider": "codex-cli",
  "model": "gpt-5.6-sol",
  "goal": "Verify the change against the approved design and report evidence or defects.",
  "capabilities": ["review", "test", "documentation"],
  "isolate": true,
  "tokenCap": 250000,
  "author": "Local owner"
}</pre></details>
      <div class="import-actions"><button data-back-import>Choose another file</button><button class="primary" data-confirm-import>Add imported worker</button></div>
    </section>`;
  }
  return `<section class="worker-import" aria-label="Add worker">
    <div class="import-heading"><div><span class="eyebrow">ADD WORKER</span><h2>Choose, create, or import a profile.</h2></div><button data-cancel-import>Close</button></div>
    <div class="worker-sources">
      <div><span class="source-mark">◇</span><h3>Saved profile</h3><p>Select a reviewed local profile already in ThreadHelm.</p><select aria-label="Saved worker profile"><option>Implementation agent · rev 24c801fe</option><option>Mission reviewer · rev a19b4032</option></select><div class="source-purpose"><span>Goal</span><b>Implement the approved mission slice without widening its authority.</b><span>Abilities</span><b>implementation · test · documentation</b></div><button data-use-saved>Add saved worker</button></div>
      <div><span class="source-mark">＋</span><h3>Create profile</h3><p>Describe the worker yourself or ask a bounded local CLI model to prepare the first draft.</p><div class="source-purpose"><span>No JSON needed</span><b>Every path returns to the same exact profile review.</b></div><button data-cli-draft>Draft with a local CLI model…</button><button data-create-profile>Enter profile details manually…</button><small>Drafting or saving a profile does not start it or grant authority.</small></div>
      <div><span class="source-mark">⇧</span><h3>Import profile</h3><p>Choose a local ThreadHelm profile JSON and inspect its exact contents first.</p><button data-preview-import>Choose local JSON…</button><small>No profile is saved until you approve its preview.</small></div>
    </div>
  </section>`;
}

function missionLimits() {
  return `<div class="limits">
    <div><b>30 min</b><span>Elapsed</span></div><div><b>4</b><span>Workers</span></div><div><b>64</b><span>Work items</span></div><div><b>8</b><span>Depth</span></div><div><b>3</b><span>Attempts</span></div><div><b>250k</b><span>Token budget</span></div>
    <button>Adjust limits</button>
  </div>`;
}

function flowPathSwitcher(stageName) {
  const current = currentFlowLayout();
  return `<section class="flow-path-switcher" aria-label="${stageName} path alternatives">
    <div><span class="eyebrow">${stageName.toUpperCase()} PATH</span><b>${flowLayouts[current].description}</b></div>
    <div class="flow-path-options">${Object.entries(flowLayouts)
      .map(
        ([key, path]) =>
          `<button class="${current === key ? 'selected' : ''}" data-flow-layout="${key}" aria-pressed="${current === key}">${path.label}</button>`,
      )
      .join('')}</div>
  </section>`;
}

function outcomeQuietPath() {
  return `<section class="guided-step flow-stage outcome-quiet"><span class="eyebrow">STEP 1 OF 4 · OUTCOME</span><h1>Set the mission finish line.</h1><p class="lead">Keep the mission narrow enough that everyone can recognize when it is done.</p>${flowPathSwitcher('Outcome')}${objectiveFields()}${field('Outside this mission', `<textarea data-scope-guard rows="2">${state.scopeGuard}</textarea>`, 'This boundary prevents useful work from quietly widening the mission.')}
  <div class="stage-readiness ready"><span>✓</span><div><b>Outcome is ready to plan</b><small>A finish line, completion evidence, and scope guard are present.</small></div></div></section>`;
}

function outcomeCoachStateSwitcher() {
  const current = currentOutcomeCoachState();
  const states = [
    ['ready', 'Ready draft'],
    ['ambiguous', 'Needs one answer'],
    ['too-broad', 'Too broad'],
    ['cli-unavailable', 'CLI unavailable'],
    ['invalid', 'Invalid response'],
  ];
  return `<nav class="outcome-coach-states" aria-label="Outcome Coach material states"><span>PROTOTYPE STATES</span>${states
    .map(
      ([key, label]) =>
        `<button class="${current === key ? 'selected' : ''}" data-outcome-coach-state="${key}">${label}</button>`,
    )
    .join('')}</nav>`;
}

function outcomeCoachExceptionalState(kind) {
  const states = {
    ambiguous: {
      mark: '?',
      title: 'One answer changes the finish line.',
      copy: 'The request mentions installed Windows evidence, but it is unclear whether producing that evidence belongs in this mission.',
      body: `<div class="coach-question"><span class="eyebrow">ANSWER ONLY WHAT CHANGES THE PLAN</span><h3>Should installed-app verification be required before this mission can complete?</h3><div><button data-coach-answer="later">No · schedule it later</button><button class="selected" data-coach-answer="include">Yes · include it</button></div></div>`,
      action: 'Use this answer',
    },
    'too-broad': {
      mark: '3',
      title: 'This request contains three finish lines.',
      copy: 'The coach kept mission creation as the primary outcome and moved packaging and documentation expansion into visible follow-up candidates.',
      body: `<div class="coach-split"><div><span>THIS MISSION</span><b>Prepare and verify the Mission Composer implementation path.</b></div><div><span>FOLLOW-UP CANDIDATE</span><b>Revise installation packaging after the UI behavior is approved.</b></div><div><span>FOLLOW-UP CANDIDATE</span><b>Expand operating guidance after installed behavior is verified.</b></div></div>`,
      action: 'Use focused mission',
    },
    'cli-unavailable': {
      mark: '!',
      title: 'The selected CLI is unavailable.',
      copy: 'No request was sent and no substitute provider was used. The manual outcome fields remain available.',
      body: '',
      action: 'Use local starter',
    },
    invalid: {
      mark: '!',
      title: 'The proposed outcome failed validation.',
      copy: 'The response omitted required completion evidence. ThreadHelm kept it separate from the mission draft and preserved the exact validation receipt.',
      body: `<div class="coach-validation"><span>Rejected</span><b>outcome.evidence must contain at least one reviewable proof obligation</b></div>`,
      action: 'Repair from request',
    },
  };
  const item = states[kind];
  return `<section class="outcome-coach-exception ${kind}"><span class="coach-exception-mark">${item.mark}</span><div><span class="eyebrow">HELD FOR REVIEW</span><h2>${item.title}</h2><p>${item.copy}</p>${item.body}<div class="coach-exception-actions"><button data-close-outcome-coach>Return to manual fields</button><button class="primary" data-outcome-coach-ready>${item.action}</button></div></div></section>`;
}

function outcomeCoachProposal() {
  return `<section class="coach-proposal"><div class="coach-proposal-heading"><div><span class="eyebrow">PROPOSED OUTCOME CONTRACT</span><h2>One observable finish line, with proof and a boundary.</h2></div><span>unsaved draft</span></div>
    <div class="coach-transformation"><div><span>ROUGH REQUEST</span><p>${state.roughOutcomeRequest}</p></div><span class="transform-arrow">→</span><div><span>COACH INTERPRETATION</span><p>Improve mission creation is the outcome. Installed Windows behavior is completion proof. Adjacent production redesign remains outside this mission.</p></div></div>
    <div class="coach-contract"><section><span class="contract-number">01</span><div><span class="eyebrow">FINISH LINE</span><h3>${state.objective}</h3><small>One change that every participant can recognize.</small></div></section><section><span class="contract-number">02</span><div><span class="eyebrow">PROOF OBLIGATIONS</span><div class="coach-proof-list"><div><span>✓</span><b>Owner-approved browser direction</b><small>Owner-visible decision</small></div><div><span>✓</span><b>Focused behavior checks</b><small>Relevant verification</small></div><div><span>✓</span><b>Installed Windows evidence</b><small>Actual host behavior</small></div></div></div></section><section><span class="contract-number">03</span><div><span class="eyebrow">OUTSIDE THIS MISSION</span><h3>${state.scopeGuard}</h3><small>Useful adjacent work remains visible without widening authority.</small></div></section></div>
    <div class="coach-quality"><div><span>✓</span><b>One finish line</b></div><div><span>✓</span><b>Reviewable proof</b></div><div><span>✓</span><b>Explicit boundary</b></div><div><span>✓</span><b>No unresolved assumptions</b></div></div>
    <details class="coach-decision-receipt"><summary>What the coach changed and why</summary><div><p><b>“Help me” removed:</b> phrased the result as an observable product outcome.</p><p><b>Verification separated:</b> treated checks as proof rather than additional finish lines.</p><p><b>Scope constrained:</b> kept production implementation and adjacent redesign outside this planning mission.</p><p><b>Input boundary:</b> one explicit local CLI request received only the rough request; no workspace, files, tools, or authority.</p></div></details>
    <div class="coach-proposal-actions"><button data-edit-outcome-request>← Edit rough request</button><div><span>Applying changes only this local mission draft.</span><button class="primary" data-apply-outcome-coach>Apply proposed outcome</button></div></div>
  </section>`;
}

function outcomeCoachPanel() {
  if (!state.outcomeCoachOpen) {
    return `<section class="outcome-coach-invite"><span class="coach-mark">✦</span><div><span class="eyebrow">OUTCOME COACH</span><h2>Start with a rough request.</h2><p>ThreadHelm can shape it into one finish line, proof obligations, and exclusions before planning the crew.</p></div><button class="primary" data-open-outcome-coach>Guide me</button></section>`;
  }
  if (state.outcomeCoachApplied) {
    return `<section class="coach-applied"><span>✓</span><div><span class="eyebrow">OUTCOME COACH APPLIED</span><b>The proposal is now in this local mission draft.</b><small>You can edit every field below. Crew planning will use the edited values.</small></div><button data-reopen-outcome-coach>Review proposal</button></section>`;
  }
  if (!state.outcomeCoachGenerated) {
    return `<section class="outcome-coach-start"><div class="coach-start-heading"><div><span class="eyebrow">OUTCOME COACH · LOCAL DRAFT</span><h2>What are you trying to change?</h2><p>Use ordinary language. The coach will separate the finish line from tasks, proof, and follow-up work.</p></div><button data-close-outcome-coach>Use manual fields</button></div>${outcomeCoachStateSwitcher()}${field('Rough request', `<textarea data-rough-outcome rows="5">${state.roughOutcomeRequest}</textarea>`, 'Only this text is sent to the selected bounded local CLI run. No workspace or tools are attached.')}<div class="coach-starters"><span>Try a starter</span><button data-outcome-starter="change">Build or change something</button><button data-outcome-starter="investigate">Investigate a problem</button><button data-outcome-starter="review">Review completed work</button></div><div class="coach-run"><div><b>Codex CLI · bounded one-shot draft</b><span>Strict outcome contract · no provider fallback · nothing saved automatically</span></div><button class="primary" data-run-outcome-coach>Shape this outcome</button></div></section>`;
  }
  const materialState = currentOutcomeCoachState();
  return `<section class="outcome-coach-review"><div class="coach-review-title"><div><span class="eyebrow">OUTCOME COACH</span><h2>Review the shaped outcome.</h2><p>The coach prepared a contract; you decide whether it becomes mission input.</p></div><button data-edit-outcome-request>Edit request</button></div>${outcomeCoachStateSwitcher()}${materialState === 'ready' ? outcomeCoachProposal() : outcomeCoachExceptionalState(materialState)}</section>`;
}

function outcomeGuidedPath() {
  const showManualContract = !state.outcomeCoachOpen || state.outcomeCoachApplied;
  return `<section class="guided-step flow-stage outcome-guided"><span class="eyebrow">STEP 1 OF 4 · OUTCOME</span><h1>Define one finish line.</h1><p class="lead">Describe the change, the proof, and the boundary before choosing workers.</p>${flowPathSwitcher('Outcome')}${outcomeCoachPanel()}
    ${
      showManualContract
        ? `
    <div class="guided-contract">
      <section><span class="question-number">1</span><div>${field('What changes when this mission succeeds?', `<textarea data-objective rows="3">${state.objective}</textarea>`, 'Use one observable outcome rather than a list of tasks.')}</div></section>
      <section><span class="question-number">2</span><div>${field('What proves it is complete?', `<textarea data-evidence rows="2">${state.evidence}</textarea>`, 'Name the evidence the coordinator must cite before completion.')}
        <div class="proof-list" aria-label="Required completion proof"><div><span>✓</span><b>Approved browser direction</b><small>Owner-visible decision</small></div><div><span>✓</span><b>Focused verification</b><small>Relevant checks only</small></div><div><span>✓</span><b>Installed Windows evidence</b><small>Actual host behavior</small></div><button>＋ Add proof item</button></div>
      </div></section>
      <section><span class="question-number">3</span><div>${field('What must stay outside this mission?', `<textarea data-scope-guard rows="2">${state.scopeGuard}</textarea>`, 'Optional, but recommended when adjacent work could widen the mission.')}</div></section>
    </div>
    <div class="stage-readiness ready"><span>✓</span><div><b>Ready to choose the crew</b><small>The coordinator can recognize completion without interpreting a task list.</small></div><em>3 requirements</em></div>
    `
        : ''
    }
  </section>`;
}

function outcomeExactPath() {
  return `<section class="guided-step flow-stage outcome-exact"><span class="eyebrow">STEP 1 OF 4 · OUTCOME CONTRACT</span><h1>Define the exact completion contract.</h1><p class="lead">Review every outcome field as mission authority.</p>${flowPathSwitcher('Outcome')}
    <div class="operator-ledger"><div><span>outcome.statement</span><textarea data-objective rows="3">${state.objective}</textarea><small>required · owner-authored</small></div><div><span>outcome.evidence</span><textarea data-evidence rows="2">${state.evidence}</textarea><small>required · completion gate</small></div><div><span>outcome.exclusions</span><textarea data-scope-guard rows="2">${state.scopeGuard}</textarea><small>optional · authority guard</small></div><div><span>on_ambiguity</span><b>hold_for_owner</b><small>fixed · no inference</small></div></div>
    <details class="exact-contract" open><summary>Exact outcome binding</summary><pre>{
  "statement": "${state.objective}",
  "evidenceRequired": true,
  "scopeExpansion": "denied",
  "unknownOutcome": "hold"
}</pre></details>
  </section>`;
}

function outcomePath() {
  const layout = currentFlowLayout();
  if (layout === 'quiet') return outcomeQuietPath();
  if (layout === 'exact') return outcomeExactPath();
  return outcomeGuidedPath();
}

function accessChoice() {
  return `<div class="access-choice" role="group" aria-label="Workspace access"><button class="${state.accessMode === 'read' ? 'selected' : ''}" data-access-mode="read"><b>Read only</b><span>Inspect files without changing them.</span></button><button class="${state.accessMode === 'write' ? 'selected' : ''}" data-access-mode="write"><b>Read and write</b><span>Allow reviewed changes inside this folder.</span></button></div>`;
}

function workspaceCard() {
  return `<section class="workspace-card"><span class="workspace-mark">W</span><div><span class="eyebrow">APPROVED WORKSPACE</span><h3>ThreadHelm</h3><code>C:\\Users\\Bill\\Documents\\ThreadHelm</code><small>Local folder · approval current · no reparse-point warning</small></div><em>verified</em></section>`;
}

function accessQuietPath() {
  return `<section class="guided-step flow-stage access-quiet"><span class="eyebrow">STEP 3 OF 4 · ACCESS & LIMITS</span><h1>Choose where the mission may work.</h1><p class="lead">One approved folder and one access level define the workspace boundary.</p>${flowPathSwitcher('Access & limits')}${workspaceCard()}${accessChoice()}${missionLimits()}<div class="stage-readiness ready"><span>✓</span><div><b>Workspace and runtimes are ready</b><small>Codex CLI coordinator and one worker can start inside this boundary.</small></div></div></section>`;
}

function runtimeReadiness() {
  return `<section class="runtime-readiness"><div class="section-intro"><div><span class="eyebrow">RUNTIME READINESS</span><h3>Every required CLI is available.</h3></div><p>ThreadHelm will not substitute a provider or model if readiness changes.</p></div><div class="readiness-rows"><div><span class="ready-dot">✓</span><div><b>Mission coordinator</b><small>Codex CLI · verified session</small></div><em>ready</em></div><div><span class="ready-dot">✓</span><div><b>Implementation worker</b><small>Codex CLI · GPT-5.6 Sol · provider default effort</small></div><em>ready</em></div></div></section>`;
}

function automaticHolds() {
  return `<section class="automatic-holds"><span class="eyebrow">AUTOMATIC HOLDS</span><h3>ThreadHelm returns control before authority becomes unclear.</h3><div><span>01</span><p><b>Hold when an outcome becomes uncertain.</b><small>No inferred success and no automatic replay.</small></p></div><div><span>02</span><p><b>Hold when a reviewed limit is reached.</b><small>Elapsed time, work, depth, attempts, workers, or tokens.</small></p></div><div><span>03</span><p><b>Hold when the coordinator is lost.</b><small>Recovery requires a fresh inspection.</small></p></div><div><span>04</span><p><b>Return to you before a consequential action.</b><small>The mission cannot approve its own expansion.</small></p></div></section>`;
}

function accessCoachPanel() {
  if (!state.accessCoachOpen) {
    return `<section class="access-coach-invite"><span class="coach-mark">✦</span><div><span class="eyebrow">MISSION COACH · ACCESS</span><h2>Let me prepare the minimum authority.</h2><p>I’ll derive folder access, runtime requirements, and operating limits from the approved crew assignments.</p></div><button class="primary" data-open-access-coach>Prepare guardrails</button></section>`;
  }
  if (state.accessCoachApplied) {
    return `<section class="coach-applied"><span>✓</span><div><span class="eyebrow">ACCESS COACH APPLIED</span><b>The recommended guardrails are now in this local mission draft.</b><small>You can inspect and edit every value below before Review.</small></div><button data-review-access-coach>Review recommendation</button></section>`;
  }
  return `<section class="access-coach-review"><div class="access-coach-heading"><div><span class="eyebrow">MISSION COACH · ACCESS</span><h2>I prepared the smallest authority envelope.</h2><p>Every recommendation traces back to an approved assignment. Anything broader remains off.</p></div><span class="access-unsaved">unsaved draft</span></div>
    <div class="access-coach-readiness"><div class="ready"><span>✓</span><div><b>Outcome shaped</b><small>3 proof obligations</small></div></div><div class="ready"><span>✓</span><div><b>Crew covered</b><small>2 proposed workers</small></div></div><div class="current"><span>3</span><div><b>Access prepared</b><small>Needs your review</small></div></div><div><span>4</span><div><b>Launch brief</b><small>Waiting</small></div></div></div>
    <section class="access-recommendation"><div class="access-rec-heading"><div><span class="eyebrow">RECOMMENDED AUTHORITY</span><h3>One folder, read and write, manual permission.</h3></div><span class="minimum-badge">minimum sufficient</span></div>
      <div class="access-rec-grid"><div><span>Workspace</span><b>ThreadHelm</b><code>C:\\Users\\Bill\\Documents\\ThreadHelm</code><small>Exact approved folder only</small></div><div><span>Access</span><b>Read and write</b><small>Required by the implementation assignment</small></div><div><span>Runtime</span><b>Codex CLI · verified</b><small>No provider or model fallback</small></div><div><span>Permission</span><b>Manual</b><small>Automatic startup remains off</small></div></div>
      <div class="access-reasoning"><div><span>WHY WRITE?</span><p>The implementation worker must change approved Mission Composer files. Read only would make the assignment impossible.</p></div><div><span>WHY ONE FOLDER?</span><p>No assignment requires a parent, sibling, home directory, network share, or additional repository.</p></div><div><span>WHY MANUAL?</span><p>The mission has no proved need for unattended consequential actions or automatic worker startup.</p></div></div>
    </section>
    <section class="coach-operating-envelope"><div><span class="eyebrow">RECOMMENDED OPERATING ENVELOPE</span><h3>Bounded for this focused plan.</h3></div><div class="coach-limit-cards"><div><b>30 minutes</b><span>Elapsed</span><small>Hold at limit</small></div><div><b>3 participants</b><span>Coordinator + crew</span><small>No automatic expansion</small></div><div><b>250k tokens</b><span>Combined budget</span><small>No automatic increase</small></div></div></section>
    <div class="access-withheld"><span>STILL OFF</span><b>Parent and sibling folders</b><b>Provider substitution</b><b>Automatic startup</b><b>Consequential external actions</b></div>
    <details class="access-coach-receipt"><summary>Why the coach made these recommendations</summary><div><p><b>Assignment evidence:</b> one worker changes files, one worker reviews them, and the coordinator verifies installed behavior.</p><p><b>Capability evidence:</b> the required local CLI runtime is currently available. A readiness change will hold launch.</p><p><b>Authority boundary:</b> no assignment supports broader file, network, provider, or startup authority.</p></div></details>
    <div class="access-coach-actions"><button data-close-access-coach>Choose guardrails myself</button><div><span>Applying changes only this local draft.</span><button class="primary" data-apply-access-coach>Apply recommended guardrails</button></div></div>
  </section>`;
}

function accessGuidedPath() {
  const showManualAccess = !state.accessCoachOpen || state.accessCoachApplied;
  return `<section class="guided-step flow-stage access-guided"><span class="eyebrow">STEP 3 OF 4 · ACCESS & LIMITS</span><h1>Set the mission guardrails.</h1><p class="lead">Confirm where work happens, whether the tools are ready, and when work must return to you.</p>${flowPathSwitcher('Access & limits')}${accessCoachPanel()}
    ${
      showManualAccess
        ? `
    <div class="guardrail-grid"><div>${workspaceCard()}${accessChoice()}</div>${runtimeReadiness()}</div>
    <section class="recommended-envelope"><div class="section-intro"><div><span class="eyebrow">RECOMMENDED OPERATING ENVELOPE</span><h3>Bounded for one focused mission.</h3></div><p>The three limits most likely to guide your decision stay visible.</p></div><div class="primary-limits"><div><b>30 minutes</b><span>Elapsed time</span><small>Mission holds at the limit</small></div><div><b>3 participants</b><span>Coordinator + crew</span><small>No automatic expansion</small></div><div><b>250k tokens</b><span>Combined budget</span><small>No automatic increase</small></div></div><details><summary>Advanced limits · 64 work items · depth 8 · 3 attempts</summary><p>These limits protect against fan-out, deep reply chains, and repeated failures. Change them only when the mission requires it.</p></details></section>
    ${automaticHolds()}
    `
        : ''
    }
  </section>`;
}

function accessExactPath() {
  return `<section class="guided-step flow-stage access-exact"><span class="eyebrow">STEP 3 OF 4 · AUTHORITY BINDINGS</span><h1>Inspect the exact access envelope.</h1><p class="lead">Every runtime, folder, limit, and stop condition is explicit.</p>${flowPathSwitcher('Access & limits')}
    <div class="boundary-ledger"><div class="ledger-head"><span>Binding</span><span>Resolved value</span><span>Authority</span></div><div><span>workspace.path</span><b>C:\\Users\\Bill\\Documents\\ThreadHelm</b><small>approved exact folder</small></div><div><span>workspace.mode</span><b>${state.accessMode}</b><small>no parent or sibling access</small></div><div><span>supervisor.session</span><b>Codex CLI · verified</b><small>required at start and resume</small></div><div><span>worker.runtime</span><b>Codex CLI · GPT-5.6 Sol</b><small>substitution denied</small></div><div><span>mission.bounds</span><b>30m · 4 workers · 64 items · d8 · 3 attempts · 250k</b><small>exhaustion holds work</small></div><div><span>unknown.outcome</span><b>hold_for_owner</b><small>automatic replay denied</small></div></div>
    <details class="exact-contract" open><summary>Exact access and limit JSON</summary><pre>{
  "workspace": { "mode": "${state.accessMode}", "approved": true },
  "providerSubstitution": false,
  "onUnknown": "hold",
  "autoStart": false
}</pre></details>
  </section>`;
}

function accessPath() {
  const layout = currentFlowLayout();
  if (layout === 'quiet') return accessQuietPath();
  if (layout === 'exact') return accessExactPath();
  return accessGuidedPath();
}

function reviewSwitcher() {
  const current = currentReviewLayout();
  return `<div class="review-switcher" aria-label="Review section alternatives"><span>Review layout</span><button class="${current === 'summary' ? 'selected' : ''}" data-review-layout="summary">Authority summary</button><button class="${current === 'ledger' ? 'selected' : ''}" data-review-layout="ledger">Resolution ledger</button><button class="${current === 'boundary' ? 'selected' : ''}" data-review-layout="boundary">Boundary check</button></div>`;
}

function reviewHeading(title, description) {
  return `<div class="review-title"><span class="review-mark">✓</span><div><span class="eyebrow">EXACT MISSION ENVELOPE</span><h2 id="review-heading">${title}</h2><p>${description}</p></div></div>${reviewSwitcher()}`;
}

function reviewConfirmation() {
  return `<div class="review-confirm"><label class="confirmation"><input type="checkbox" /> <span>I confirm this exact mission and folder-access boundary.</span></label><button class="primary" disabled>Start mission</button></div>`;
}

function authoritySummaryReview() {
  return `<section class="exact-review review-summary" aria-labelledby="review-heading">
    ${reviewHeading('Review mission authority', 'Confirm the outcome, crew, access, and resolved runtime before anything starts.')}
    <div class="review-objective"><span class="eyebrow">MISSION OUTCOME</span><h3>${state.objective}</h3><p><b>Complete when</b> ${state.evidence}</p></div>
    <section class="review-section"><div class="review-section-heading"><h3>Crew and purpose</h3><span>${state.workerCount + 1} bound profiles</span></div>
      <div class="review-person supervisor"><span class="person-mark">S</span><div><b>Mission coordinator</b><small>Goal · Keep the mission within its reviewed outcome and authority.</small><small>Abilities · coordination · review · escalation</small></div><div><b>Codex CLI</b><small>verified session · CLI defaults</small></div></div>
      ${Array.from({ length: state.workerCount }, (_, index) => {
        const resolved = workerRuntimeSummary(index + 1);
        return `<div class="review-person"><span class="person-mark">${index + 1}</span><div><b>${index ? 'Implementation reviewer' : 'Implementation worker'}</b><small>Profile goal · ${index ? 'Verify the change and report evidence or defects.' : 'Implement the approved slice without widening authority.'}</small><small>Abilities · ${index ? 'review · test · documentation' : 'implementation · test · documentation'}</small><small>Mission assignment · ${index ? 'Review the completed slice and report material defects.' : 'Implement the approved Mission Composer crew and review states.'}</small></div><div><b>${resolved.provider}</b><small>${resolved.model} · provider default effort</small><small>manual · offline · auto-start off</small></div></div>`;
      }).join('')}
    </section>
    <div class="review-grid"><section><span class="eyebrow">FOLDER ACCESS</span><h3>ThreadHelm · write</h3><p>One reviewed local workspace. No other folder access.</p></section><section><span class="eyebrow">MISSION LIMITS</span><h3>30 min · 4 workers · 250k tokens</h3><p>64 work items · 8 levels · 3 attempts</p></section></div>
    <p class="boundary">Unknown outcomes, exhausted bounds, consequential actions, and supervisor loss stop work. No substitution or automatic replay is authorized.</p>
    <details><summary>Exact launch and permission bindings</summary><pre>{\n  "supervisor": { "session": "verified", "model": null },\n  "worker": { "permission": "manual", "autoStart": false },\n  "workspace": { "name": "ThreadHelm", "mode": "write" }\n}</pre></details>
    ${reviewConfirmation()}
  </section>`;
}

function resolutionLedgerReview() {
  const runtime = workerRuntimeSummary(1);
  return `<section class="exact-review review-ledger" aria-labelledby="review-heading">
    ${reviewHeading('Review what was selected and resolved', 'ThreadHelm cannot replace a profile, model, permission, workspace, or limit after this review.')}
    <div class="ledger-head"><span>You selected</span><span>ThreadHelm resolved</span></div>
    <div class="ledger-row"><div><span>Outcome</span><b>${state.objective}</b></div><div><span>Completion rule</span><b>${state.evidence}</b></div></div>
    <div class="ledger-row"><div><span>Supervisor</span><b>Mission coordinator · session 1e6f32a4</b></div><div><span>Runtime</span><b>Codex CLI · verified · CLI defaults</b></div></div>
    <div class="ledger-row"><div><span>Worker profile</span><b>Implementation worker · rev 24c801fe</b><small>Profile goal · Implement the approved slice.</small><small>Abilities · implementation · test · documentation</small><small>Mission assignment · Implement the approved Mission Composer crew and review states.</small></div><div><span>Effective binding</span><b>${runtime.provider} · ${runtime.model}</b><small>Provider default effort · manual · offline · auto-start off</small><small>Isolation effective · 250k token ceiling</small></div></div>
    <div class="ledger-row"><div><span>Workspace request</span><b>ThreadHelm · write</b></div><div><span>Effective access</span><b>Exact approved folder · write</b></div></div>
    <div class="ledger-stop"><b>No substitutions</b><span>Unknown outcomes remain held</span><span>Consequential actions require owner approval</span><span>Expired reviews cannot start</span></div>
    <details><summary>Compare exact input and resolved envelope</summary><pre>selected.permission = "manual"\nresolved.permission = "manual"\nresolved.autoStart = false\nresolved.effectiveIsolation = true</pre></details>
    ${reviewConfirmation()}
  </section>`;
}

function boundaryCheckReview() {
  const runtime = workerRuntimeSummary(1);
  return `<section class="exact-review review-boundary" aria-labelledby="review-heading">
    ${reviewHeading('Check the mission boundary', 'Review what routine work may continue, what must stop, and what always returns to you.')}
    <div class="boundary-columns"><section class="may"><span class="boundary-icon">✓</span><h3>May continue</h3><ul><li>Read and write inside ThreadHelm</li><li>Use reviewed profile abilities for work matching</li><li>Retry only proved failures before effect</li><li>Work within time, process, and token limits</li></ul></section><section class="stop"><span class="boundary-icon">■</span><h3>Must stop</h3><ul><li>Unknown delivery or tool outcome</li><li>Supervisor session loss</li><li>Exhausted mission or worker bound</li><li>Unresolved provider capability</li></ul></section><section class="owner"><span class="boundary-icon">!</span><h3>Needs your approval</h3><ul><li>Consequential external actions</li><li>Folder-access changes</li><li>Profile or runtime substitution</li><li>Resume after recovery inspection</li></ul></section></div>
    <div class="boundary-roster"><div><span>Supervisor</span><b>Mission coordinator · verified Codex CLI session</b></div><div><span>Worker runtime</span><b>${runtime.provider} · ${runtime.model} · provider default effort</b></div><div><span>Profile goal</span><b>Implement the approved slice without widening authority.</b></div><div><span>Abilities</span><b>implementation · test · documentation</b></div><div class="assignment-review"><span>Mission assignment</span><b>Implement the approved Mission Composer crew and review states.</b></div></div>
    <p class="ability-note">Ability labels help match work. They never grant tools, permissions, folder access, or authority.</p>
    ${reviewConfirmation()}
  </section>`;
}

function exactReview() {
  const layout = currentReviewLayout();
  if (layout === 'ledger') return resolutionLedgerReview();
  if (layout === 'boundary') return boundaryCheckReview();
  return authoritySummaryReview();
}

function reviewStateSwitcher() {
  const current = currentReviewState();
  return `<div class="review-state-switcher" aria-label="Review material states"><span>Material state</span><button class="${current === 'ready' ? 'selected' : ''}" data-review-state="ready">Ready</button><button class="${current === 'changed' ? 'selected' : ''}" data-review-state="changed">Mission changed</button><button class="${current === 'expired' ? 'selected' : ''}" data-review-state="expired">Approval expired</button><button class="${current === 'blocked' ? 'selected' : ''}" data-review-state="blocked">Setup incomplete</button></div>`;
}

function reviewStateNotice() {
  const current = currentReviewState();
  if (current === 'changed') {
    return `<section class="review-alert changed"><span class="alert-mark">↻</span><div><span class="eyebrow">MISSION CHANGED AFTER REVIEW</span><h3>Folder access changed from read only to read and write.</h3><p>The previous confirmation no longer applies. Review the highlighted binding before confirming again.</p><div class="change-row"><span>workspace.mode</span><del>read</del><b>write</b></div></div></section>`;
  }
  if (current === 'blocked') {
    return `<section class="review-alert blocked"><span class="alert-mark">!</span><div><span class="eyebrow">SETUP INCOMPLETE</span><h3>The implementation worker cannot start.</h3><p>Codex CLI readiness could not be proved for the exact worker binding. ThreadHelm will not substitute another provider or model.</p><div class="blocked-effect"><span>Blocks</span><b>Implementation assignment · Start mission</b></div></div><button>Open provider setup</button></section>`;
  }
  if (current === 'expired') {
    return `<section class="review-alert expired"><span class="alert-mark">⌛</span><div><span class="eyebrow">APPROVAL EXPIRED BEFORE LAUNCH</span><h3>The workspace approval is no longer current.</h3><p>The mission draft is unchanged, but the previous authority confirmation cannot be reused. Refresh the exact folder approval, then review the brief again.</p><div class="blocked-effect"><span>Expired binding</span><b>workspace.approval · Start mission</b></div></div><button data-back-access>Refresh approval</button></section>`;
  }
  return `<section class="review-alert ready"><span class="alert-mark">✓</span><div><span class="eyebrow">READY FOR YOUR DECISION</span><h3>All required bindings are current.</h3><p>One folder-boundary confirmation remains before the mission can start.</p></div></section>`;
}

function reviewActionFooter() {
  const current = currentReviewState();
  if (current === 'changed') {
    return `<footer class="review-action-footer changed"><div><b>Confirmation cleared</b><span>The changed workspace binding must be reviewed again.</span></div><button class="primary" data-review-updated>Review updated mission</button></footer>`;
  }
  if (current === 'blocked') {
    return `<footer class="review-action-footer blocked"><div><b>Start unavailable</b><span>Resolve the worker CLI readiness check first.</span></div><button data-back-access>Back to access and limits</button><button class="primary" disabled>Start mission</button></footer>`;
  }
  if (current === 'expired') {
    return `<footer class="review-action-footer expired"><div><b>Start unavailable</b><span>Refresh the exact workspace approval and review the launch brief again.</span></div><button data-back-access>Back to access and limits</button><button class="primary" disabled>Start mission</button></footer>`;
  }
  return `<footer class="review-action-footer"><label class="confirmation"><input type="checkbox" /> <span>I confirm this exact mission and folder-access boundary.</span></label><button class="primary" disabled>Start mission</button></footer>`;
}

function reviewPathHeading(title, description) {
  return `<div class="review-title"><span class="review-mark">✓</span><div><span class="eyebrow">EXACT MISSION ENVELOPE</span><h2 id="review-heading">${title}</h2><p>${description}</p></div></div>${flowPathSwitcher('Review')}${reviewStateSwitcher()}${reviewStateNotice()}`;
}

function reviewCoachHeading() {
  const reviewState = currentReviewState();
  const summary =
    reviewState === 'ready'
      ? 'I assembled every approved decision into one launch brief. One owner confirmation remains.'
      : reviewState === 'changed'
        ? 'I found a change after review. The previous confirmation is cleared until you inspect it.'
        : reviewState === 'expired'
          ? 'The plan is unchanged, but one authority approval expired before launch and must be refreshed.'
          : 'I found a launch blocker. No substitution or partial start will be attempted.';
  const status =
    reviewState === 'ready'
      ? '1 decision remains'
      : reviewState === 'changed'
        ? 'review changed'
        : reviewState === 'expired'
          ? 'approval expired'
          : 'launch blocked';
  return `<div class="review-coach-heading"><span class="review-coach-mark">✦</span><div><span class="eyebrow">MISSION COACH · FINAL REVIEW</span><h2 id="review-heading">Review the coach-prepared launch brief.</h2><p>${summary}</p></div><span class="review-coach-status ${reviewState}">${status}</span></div>${flowPathSwitcher('Review')}${reviewStateSwitcher()}${reviewStateNotice()}`;
}

function reviewCoachSynthesis() {
  return `<section class="review-coach-synthesis"><div class="review-coach-intro"><div><span class="eyebrow">HOW THE PLAN CAME TOGETHER</span><h3>One assistant carried the mission through four decisions.</h3></div><span>all coach receipts available</span></div><div class="coach-source-grid"><div><span>✓</span><div><b>Outcome shaped</b><small>1 finish line · 3 proof obligations · exclusions preserved</small></div></div><div><span>✓</span><div><b>Crew covered</b><small>2 workers · 0 duplicate roles · every proof owned</small></div></div><div><span>✓</span><div><b>Access minimized</b><small>1 exact folder · manual permission · broader authority off</small></div></div><div><span>✓</span><div><b>Preflight passed</b><small>Runtimes current · no unresolved exception questions</small></div></div></div></section>`;
}

function reviewCoachSequence() {
  return `<section class="review-coach-sequence"><div class="review-section-heading"><h3>05 · What will happen</h3><span>ordered handoff</span></div><div class="review-sequence-line"><div><span>1</span><b>Coordinator</b><small>Starts the reviewed mission</small></div><i>→</i><div><span>2</span><b>Implementation worker</b><small>Returns changes and browser evidence</small></div><i>→</i><div><span>3</span><b>Implementation verifier</b><small>Returns findings or approval</small></div><i>→</i><div class="owner-return"><span>4</span><b>Back to you</b><small>Review completion evidence</small></div></div><div class="review-never"><span>WILL NOT HAPPEN</span><b>No provider substitution</b><b>No authority expansion</b><b>No uncertain replay</b><b>No automatic merge or external action</b></div></section>`;
}

function reviewCoachDecision() {
  if (currentReviewState() !== 'ready') return '';
  return `<section class="review-owner-decision"><span class="decision-number">1</span><div><span class="eyebrow">THE ONLY DECISION LEFT</span><h3>Confirm this mission and its exact folder boundary.</h3><p>This confirmation covers the shaped outcome, two-worker crew, one exact read/write workspace, current runtimes, and reviewed operating limits. Any later change clears it.</p></div></section>`;
}

function reviewQuietPath() {
  const runtime = workerRuntimeSummary(1);
  return `<section class="guided-step review-step mission-review-path exact-review review-quiet" aria-labelledby="review-heading">${reviewPathHeading('Review the mission before it starts.', 'The essential outcome, crew, workspace, runtime, and limits are shown together.')}
    <div class="review-objective"><span class="eyebrow">MISSION OUTCOME</span><h3>${state.objective}</h3><p><b>Complete when</b> ${state.evidence}</p></div>
    <div class="quiet-review-list"><div><span>Crew</span><b>Mission coordinator + ${state.workerCount} worker</b><small>Manual start · assignments reviewed</small></div><div><span>Workspace</span><b>ThreadHelm · ${state.accessMode}</b><small>One approved local folder</small></div><div><span>Runtime</span><b>${runtime.provider} · ${runtime.model}</b><small>Verified · no substitution</small></div><div><span>Limits</span><b>30 minutes · 4 workers · 250k tokens</b><small>64 items · depth 8 · 3 attempts</small></div></div>
    <p class="boundary">Unknown outcomes, exhausted bounds, consequential actions, and coordinator loss hold work for you.</p>${reviewActionFooter()}</section>`;
}

function reviewGuidedPath() {
  const runtime = workerRuntimeSummary(1);
  return `<section class="guided-step review-step mission-review-path exact-review review-launch-brief review-coach" aria-labelledby="review-heading">${reviewCoachHeading()}${reviewCoachSynthesis()}
    <section class="launch-outcome"><span class="eyebrow">01 · FINISH LINE</span><h3>${state.objective}</h3><p><b>Proof required</b> ${state.evidence}</p><p><b>Outside this mission</b> ${state.scopeGuard}</p></section>
    <section class="launch-section"><div class="review-section-heading"><h3>02 · Crew and purpose</h3><span>${state.workerCount + 1} bound profiles</span></div><div class="review-person supervisor"><span class="person-mark">S</span><div><b>Mission coordinator</b><small>Keeps work inside the reviewed outcome and authority.</small><small>Coordinates · reviews · escalates</small></div><div><b>Codex CLI</b><small>verified session · manual start</small></div></div><div class="review-person"><span class="person-mark">1</span><div><b>Implementation worker</b><small>Profile goal · Implement the approved slice without widening authority.</small><small>Mission assignment · Build the approved Mission Composer flows.</small></div><div><b>${runtime.provider}</b><small>${runtime.model} · provider default effort</small></div></div><div class="review-person"><span class="person-mark">2</span><div><b>Implementation verifier</b><small>Profile goal · Find material defects and return cited findings.</small><small>Mission assignment · Verify correctness, accessibility, and the approved design.</small></div><div><b>Codex CLI</b><small>GPT-5.6 Terra · provider default effort</small></div></div></section>
    <section class="launch-section"><div class="review-section-heading"><h3>03 · Access and readiness</h3><span>${['blocked', 'expired'].includes(currentReviewState()) ? '1 blocker' : 'all current'}</span></div><div class="launch-bindings"><div class="${currentReviewState() === 'expired' ? 'binding-blocked' : ''}"><span>Workspace</span><b>${currentReviewState() === 'expired' ? 'Approval expired' : `ThreadHelm · ${state.accessMode}`}</b><small>C:\\Users\\Bill\\Documents\\ThreadHelm</small></div><div><span>Coordinator</span><b>Codex CLI · verified</b><small>Exact session required</small></div><div class="${currentReviewState() === 'blocked' ? 'binding-blocked' : ''}"><span>Worker runtime</span><b>${currentReviewState() === 'blocked' ? 'Readiness unresolved' : `${runtime.provider} · ${runtime.model}`}</b><small>${currentReviewState() === 'blocked' ? 'No fallback will be used' : 'Capability match current'}</small></div><div><span>Operating envelope</span><b>30m · 3 participants · 250k</b><small>64 items · depth 8 · 3 attempts</small></div></div></section>
    <section class="launch-section authority-review"><div class="review-section-heading"><h3>04 · Authority behavior</h3><span>fixed for this mission</span></div><div class="boundary-columns"><section class="may"><span class="boundary-icon">✓</span><h3>May continue</h3><ul><li>Work inside the exact approved folder</li><li>Use reviewed profile abilities for matching</li><li>Retry only a proved failure before effect</li></ul></section><section class="stop"><span class="boundary-icon">■</span><h3>Must hold</h3><ul><li>Outcome or delivery becomes uncertain</li><li>A reviewed limit is exhausted</li><li>The coordinator session is lost</li></ul></section><section class="owner"><span class="boundary-icon">!</span><h3>Needs you</h3><ul><li>Consequential external action</li><li>Folder, profile, or runtime change</li><li>Resume after recovery inspection</li></ul></section></div></section>
    ${reviewCoachSequence()}
    <details class="resolution-details"><summary>06 · Exact resolution ledger</summary><div class="resolution-grid"><div><span>Profile revision</span><b>24c801fe</b><small>bound exactly</small></div><div><span>Workspace approval</span><b>current</b><small>digest verified</small></div><div><span>Provider fallback</span><b>denied</b><small>fixed</small></div><div><span>Automatic replay</span><b>denied</b><small>unknown holds</small></div></div></details>
    ${reviewCoachDecision()}${reviewActionFooter()}
  </section>`;
}

function reviewExactPath() {
  const runtime = workerRuntimeSummary(1);
  return `<section class="guided-step review-step mission-review-path exact-review review-exact" aria-labelledby="review-heading">${reviewPathHeading('Inspect the exact mission envelope.', 'Dense bindings, provenance, and failure behavior are shown without interpretation.')}
    <div class="boundary-ledger review-ledger"><div class="ledger-head"><span>Binding</span><span>Resolved value</span><span>Provenance / behavior</span></div><div><span>outcome.statement</span><b>${state.objective}</b><small>owner-authored</small></div><div><span>outcome.evidence</span><b>${state.evidence}</b><small>completion gate</small></div><div><span>worker.profile</span><b>24c801fe</b><small>exact reviewed revision</small></div><div><span>worker.runtime</span><b>${runtime.provider} · ${runtime.model}</b><small>${currentReviewState() === 'blocked' ? 'unresolved · start blocked' : 'capability registry · current'}</small></div><div><span>workspace</span><b>ThreadHelm · ${state.accessMode}</b><small>exact approved path</small></div><div><span>bounds</span><b>30m · 4w · 64i · d8 · a3 · 250k</b><small>exhaustion holds</small></div><div><span>unknown</span><b>hold_for_owner</b><small>replay denied</small></div></div>
    <details class="exact-contract" open><summary>Exact mission envelope JSON</summary><pre>{
  "outcome": { "evidenceRequired": true },
  "workspace": { "mode": "${state.accessMode}", "approved": true },
  "runtime": { "provider": "codex-cli", "fallback": false },
  "unknownOutcome": "hold",
  "autoStart": false
}</pre></details>${reviewActionFooter()}</section>`;
}

function reviewPath() {
  const layout = currentFlowLayout();
  if (layout === 'quiet') return reviewQuietPath();
  if (layout === 'exact') return reviewExactPath();
  return reviewGuidedPath();
}

function renderEnvelope() {
  return shell(
    `<div class="envelope-layout">
    <section class="composer-main"><div class="page-heading"><span class="eyebrow">NEW MISSION</span><h1>Set one exact boundary.</h1><p>Describe the outcome, bind the people and workspaces, then review what the mission can do.</p></div>
      <section class="form-section"><div class="section-number">01</div><div><h2>Outcome</h2>${objectiveFields()}</div></section>
      <section class="form-section"><div class="section-number">02</div><div><h2>Supervisor</h2>${supervisorFields()}</div></section>
      <section class="form-section"><div class="section-number">03</div><div><div class="section-line"><h2>Crew</h2><button data-add-worker>＋ Add worker</button></div>${Array.from({ length: state.workerCount }, (_, i) => workerEditor(i + 1)).join('')}</div></section>
      <section class="form-section"><div class="section-number">04</div><div><h2>Mission limits</h2>${missionLimits()}</div></section>
    </section>
    <aside class="sticky-summary"><span class="eyebrow">BOUNDARY SUMMARY</span><h2>Ready to review</h2><p>${state.objective}</p><div class="summary-row"><span>Supervisor</span><b>1 verified</b></div><div class="summary-row"><span>Workers</span><b>${state.workerCount} bound</b></div><div class="summary-row"><span>Workspaces</span><b>1 write</b></div><div class="summary-row"><span>Runtime</span><b>CLI defaults</b></div><p class="summary-warning">Profiles and model output cannot expand this envelope.</p><button class="primary" data-review>Review exact mission</button></aside>
  </div>`,
    'A',
  );
}

const crewSuggestions = {
  builder: {
    source: 'Saved profile · rev 24c801fe',
    sourceClass: 'saved',
    name: 'Implementation worker',
    goal: 'Implement an approved mission slice without widening its authority.',
    abilities: 'implementation · test · documentation',
    reason: 'The outcome requires a concrete product change and focused verification evidence.',
    assignment: 'Build the approved Mission Composer paths from the reviewed browser direction.',
    evidence: 'Focused checks, browser evidence, and the exact files changed.',
    runtime: 'Codex CLI · GPT-5.6 Sol',
  },
  reviewer: {
    source: 'New profile draft · generic recipe',
    sourceClass: 'draft',
    name: 'Implementation verifier',
    goal: 'Find material defects and return clear, cited findings before completion.',
    abilities: 'review · test · accessibility',
    reason:
      'Completion requires independent evidence that the implementation matches the approved design.',
    assignment:
      'Review the completed slice for correctness, accessibility, and agreement with the approved design.',
    evidence: 'Cited findings or an explicit no-material-defects result.',
    runtime: 'Codex CLI · GPT-5.6 Terra',
  },
  steward: {
    source: 'New profile draft · generic recipe',
    sourceClass: 'draft',
    name: 'Documentation steward',
    goal: 'Keep product and operating guidance aligned with verified behavior.',
    abilities: 'documentation · review · test',
    reason:
      'The outcome names installed evidence, so changed operating guidance may need a focused update.',
    assignment: 'Update only the guidance affected by the approved Mission Composer change.',
    evidence: 'Changed guidance checked against the implemented behavior.',
    runtime: 'Claude Code · Claude Sonnet',
  },
};

function crewBuilderStateSwitcher() {
  const current = currentCrewBuilderState();
  const states = [
    ['ready', 'Suggested crew'],
    ['cli-unavailable', 'CLI unavailable'],
    ['invalid', 'Invalid response'],
    ['duplicate', 'Duplicate'],
    ['too-many', 'Over limit'],
    ['empty', 'No match'],
  ];
  return `<nav class="crew-state-switcher" aria-label="Smart Crew Builder material states"><span>PROTOTYPE STATES</span>${states
    .map(
      ([key, label]) =>
        `<button class="${current === key ? 'selected' : ''}" data-crew-builder-state="${key}">${label}</button>`,
    )
    .join('')}</nav>`;
}

function crewSuggestionCard(id) {
  const suggestion = crewSuggestions[id];
  const selected = state.selectedCrewSuggestions.includes(id);
  return `<article class="crew-suggestion ${selected ? 'selected' : ''}">
    <div class="crew-card-top"><button class="crew-card-check" data-toggle-crew="${id}" aria-pressed="${selected}">${selected ? '✓' : ''}<span class="sr-only">Select ${suggestion.name}</span></button><div><span class="source-badge ${suggestion.sourceClass}">${suggestion.source}</span><h3>${suggestion.name}</h3><p>${suggestion.reason}</p></div><button class="text-button">Edit draft</button></div>
    <div class="crew-purpose-grid"><div><span>Standing goal</span><b>${suggestion.goal}</b></div><div><span>Abilities</span><b>${suggestion.abilities}</b><small>Matching labels only; they grant no authority.</small></div></div>
    <div class="crew-assignment"><span>Mission contribution</span><p>${suggestion.assignment}</p><span>Must return</span><p>${suggestion.evidence}</p></div>
    <div class="crew-runtime"><span>${suggestion.runtime}</span><b>Manual permission</b><b>Automatic start off</b></div>
  </article>`;
}

function crewAutomationWizard() {
  return `<section class="automation-wizard" aria-label="Automated mission planning progress">
    <div class="automation-step done"><span>✓</span><div><b>Outcome understood</b><small>Finish line and exclusions found</small></div></div>
    <div class="automation-step done"><span>✓</span><div><b>Proof mapped</b><small>3 completion requirements</small></div></div>
    <div class="automation-step current"><span>3</span><div><b>Crew proposed</b><small>Smallest useful crew first</small></div></div>
    <div class="automation-step"><span>4</span><div><b>Preflight</b><small>Review authority and holds</small></div></div>
  </section>`;
}

function crewPlanChoices() {
  const choices = {
    focused: {
      title: 'Focused',
      count: '2 workers',
      copy: 'Smallest crew that covers implementation and independent verification.',
      tag: 'recommended',
    },
    balanced: {
      title: 'Balanced',
      count: '3 workers',
      copy: 'Adds a documentation steward when operating guidance is likely to change.',
      tag: 'broader coverage',
    },
    thorough: {
      title: 'Thorough',
      count: '3 workers · 2 checkpoints',
      copy: 'Uses the full crew and adds an owner checkpoint before installed verification.',
      tag: 'more oversight',
    },
  };
  return `<section class="plan-choice-section"><div class="section-intro"><div><span class="eyebrow">AUTOMATION LEVEL</span><h3>Choose how much plan ThreadHelm prepares.</h3></div><p>Every option remains a reviewable draft. Automation never expands mission authority.</p></div><div class="crew-plan-choices">${Object.entries(
    choices,
  )
    .map(
      ([key, choice]) =>
        `<button class="${state.crewPlanMode === key ? 'selected' : ''}" data-crew-plan="${key}" aria-pressed="${state.crewPlanMode === key}"><span><b>${choice.title}</b><em>${choice.tag}</em></span><strong>${choice.count}</strong><small>${choice.copy}</small></button>`,
    )
    .join('')}</div></section>`;
}

function missionPreflight() {
  const selected = new Set(state.selectedCrewSuggestions);
  const proofRows = [
    {
      proof: 'Approved browser behavior',
      owner: selected.has('builder') ? 'Implementation worker' : 'Unassigned',
      evidence: 'Browser evidence',
      covered: selected.has('builder'),
    },
    {
      proof: 'Correctness and accessibility',
      owner: selected.has('reviewer') ? 'Implementation verifier' : 'Coordinator review',
      evidence: 'Cited review findings',
      covered: true,
    },
    {
      proof: 'Installed Windows behavior',
      owner: 'Mission coordinator',
      evidence: 'Installed-app check',
      covered: true,
    },
  ];
  const coveredCount = proofRows.filter((row) => row.covered).length;
  const extraWorker = selected.has('steward');
  const why = extraWorker
    ? 'The documentation steward is included because this plan treats changed operating guidance as part of the mission.'
    : 'A third worker is not required yet. Documentation remains an exception: the coordinator can propose a steward if verified behavior changes guidance.';
  return `<section class="mission-preflight"><div class="preflight-heading"><div><span class="eyebrow">MISSION PREFLIGHT</span><h2>Check the automated plan before adding the crew.</h2></div><span class="preflight-ready">${coveredCount === 3 ? '✓ all proof owned' : '! needs attention'}</span></div>
    <div class="preflight-metrics"><div><b>${coveredCount}/3</b><span>Proof covered</span></div><div><b>${state.selectedCrewSuggestions.length}</b><span>Workers proposed</span></div><div><b>0</b><span>Duplicate roles</span></div><div><b>${state.crewPlanMode === 'thorough' ? '2' : '1'}</b><span>Owner checkpoints</span></div></div>
    <div class="preflight-grid"><section><div class="preflight-section-title"><span class="eyebrow">PROOF MAP</span><b>Every finish condition has an owner.</b></div><div class="proof-map"><div class="proof-head"><span>Required proof</span><span>Owner</span><span>Return evidence</span></div>${proofRows
      .map(
        (row) =>
          `<div class="${row.covered ? '' : 'uncovered'}"><span>${row.covered ? '✓' : '!'} ${row.proof}</span><b>${row.owner}</b><small>${row.evidence}</small></div>`,
      )
      .join('')}</div></section>
      <section class="smallest-crew"><span class="eyebrow">WHY THIS CREW?</span><h3>${extraWorker ? 'Broader coverage was selected.' : 'This is the smallest sufficient crew.'}</h3><p>${why}</p><div><span>Held until later</span><b>No access · no permissions · no launch</b></div></section></div>
    <section class="preflight-sequence"><div><span class="sequence-number">1</span><b>Implementation worker</b><small>Change + browser evidence</small></div><span class="sequence-arrow">→</span><div><span class="sequence-number">2</span><b>Implementation verifier</b><small>Findings or approval</small></div><span class="sequence-arrow">→</span>${extraWorker ? `<div><span class="sequence-number">3</span><b>Documentation steward</b><small>Only affected guidance</small></div><span class="sequence-arrow">→</span>` : ''}<div class="coordinator-node"><span class="sequence-number">${extraWorker ? '4' : '3'}</span><b>Coordinator</b><small>Evidence + owner review</small></div></section>
    <div class="exception-question"><span>✓</span><div><b>No unresolved exception questions</b><small>The wizard will ask again only if workspace, runtime, proof coverage, or mission scope changes.</small></div><button>View decision receipt</button></div>
  </section>`;
}

function crewBuilderExceptionalState(kind) {
  const states = {
    'cli-unavailable': {
      mark: '!',
      title: 'The selected CLI is unavailable.',
      copy: 'No request was sent and no substitute provider was used. You can retry after setup or continue with reviewed generic starters.',
      action: 'Use generic starters',
    },
    invalid: {
      mark: '!',
      title: 'The proposed crew did not pass validation.',
      copy: 'ThreadHelm rejected an unknown profile field and kept the response unsaved. The exact validation receipt remains available for inspection.',
      action: 'Refine request',
    },
    duplicate: {
      mark: '↺',
      title: 'A reviewed profile already covers this role.',
      copy: 'The saved Implementation worker is shown instead of creating a duplicate. Its exact active revision will be pinned if selected.',
      action: 'Review matched profile',
    },
    'too-many': {
      mark: '3',
      title: 'The draft proposed five roles. Three are shown.',
      copy: 'The builder kept the smallest crew that covers implementation and verification. Add another worker manually only when the mission truly needs it.',
      action: 'Review focused crew',
    },
    empty: {
      mark: '◇',
      title: 'No useful profile match was found.',
      copy: 'The outcome remains unchanged. Build the crew manually or use generic starters without contacting a CLI model.',
      action: 'Choose profiles myself',
    },
  };
  const item = states[kind];
  return `<section class="crew-builder-exception ${kind}"><span class="exception-mark">${item.mark}</span><div><span class="eyebrow">HELD FOR REVIEW</span><h2>${item.title}</h2><p>${item.copy}</p><div><button data-open-worker>Choose profiles myself</button><button class="primary" data-crew-builder-ready>${item.action}</button></div></div></section>`;
}

function crewBuilderWorkshop() {
  const materialState = currentCrewBuilderState();
  const selectedCount = state.selectedCrewSuggestions.length;
  if (!state.crewBuilderGenerated) {
    return `<section class="guided-step crew-workshop"><span class="eyebrow">STEP 2 OF 4 · SMART CREW BUILDER</span><h1>Build a focused crew from this outcome.</h1><p class="lead">ThreadHelm can match saved profiles and ask one bounded local CLI run to draft missing generic roles. You review every result.</p>${crewBuilderStateSwitcher()}
      <section class="crew-outcome-brief"><span class="outcome-mark">01</span><div><span class="eyebrow">REVIEWED OUTCOME</span><h2>${state.objective}</h2><p><b>Proof</b> ${state.evidence}</p><p><b>Outside this mission</b> ${state.scopeGuard}</p></div></section>
      <div class="crew-builder-choice"><section class="recommended"><span class="choice-mark">✦</span><div><span class="eyebrow">RECOMMENDED</span><h3>Suggest a focused crew</h3><p>Reuse suitable reviewed profiles first, then prepare only the missing profile drafts. Maximum three workers.</p><ul><li>One explicit local CLI request</li><li>No workspace contents or tools</li><li>No save, access, permission, or launch</li></ul><button class="primary" data-generate-crew>Suggest crew</button></div></section><section><span class="choice-mark">＋</span><div><span class="eyebrow">MANUAL PATH</span><h3>Choose profiles myself</h3><p>Add a saved profile, create one without JSON, or inspect a local profile import.</p><button data-open-worker>Choose profiles…</button></div></section></div>
      <p class="crew-builder-boundary"><b>What the builder receives:</b> outcome, completion evidence, and exclusions only. It does not receive the mission workspace, tools, or authority.</p>
    </section>`;
  }
  if (materialState !== 'ready' && materialState !== 'duplicate' && materialState !== 'too-many') {
    return `<section class="guided-step crew-workshop"><span class="eyebrow">STEP 2 OF 4 · SMART CREW BUILDER</span><h1>Review the crew-building result.</h1>${crewBuilderStateSwitcher()}${crewBuilderExceptionalState(materialState)}</section>`;
  }
  if (state.crewBuilderAdded) {
    return `<section class="guided-step crew-workshop"><span class="eyebrow">STEP 2 OF 4 · CREW READY</span><h1>${selectedCount} workers added to this mission draft.</h1><p class="lead">Saved profiles are pinned exactly. New profiles remain reviewed drafts until you save them.</p>${crewBuilderStateSwitcher()}<div class="crew-added-summary">${state.selectedCrewSuggestions.map((id) => `<div><span class="added-check">✓</span><div><b>${crewSuggestions[id].name}</b><small>${crewSuggestions[id].source}</small><p>${crewSuggestions[id].assignment}</p></div><button class="text-button">Edit</button></div>`).join('')}</div><div class="crew-save-boundary"><b>Still off</b><span>Workspace access</span><span>Permissions</span><span>Automatic startup</span><span>Worker launch</span></div><button data-edit-crew-plan>← Edit suggested crew</button></section>`;
  }
  return `<section class="guided-step crew-workshop"><span class="eyebrow">STEP 2 OF 4 · SMART CREW BUILDER</span><h1>Review the proposed crew.</h1><p class="lead">Each worker has one reason to be here, one mission contribution, and evidence to return.</p>${crewBuilderStateSwitcher()}
    ${materialState === 'duplicate' || materialState === 'too-many' ? crewBuilderExceptionalState(materialState) : ''}
    ${crewAutomationWizard()}
    <section class="generation-receipt crew-generation-receipt"><div><span>Method</span><b>Saved-profile match + bounded CLI draft</b></div><div><span>Shared with CLI</span><b>Outcome text only · no workspace</b></div><div><span>Result</span><b>1 saved match · 2 new drafts</b></div></section>
    ${crewPlanChoices()}
    <div class="crew-suggestion-list">${Object.keys(crewSuggestions).map(crewSuggestionCard).join('')}</div>
    ${missionPreflight()}
    <footer class="crew-selection-footer"><div><b>${selectedCount} of 3 selected</b><span>New drafts require profile review before mission binding.</span></div><button data-reset-crew>Start over</button><button class="primary" data-add-selected-crew ${selectedCount === 0 ? 'disabled' : ''}>Add selected crew</button></footer>
  </section>`;
}

function continuousMissionCoach() {
  const copy = {
    1: {
      title: 'Let’s turn the request into one finish line.',
      detail: 'I’ll separate outcome, proof, exclusions, and follow-up work.',
      status: 'Outcome review',
    },
    2: {
      title: 'The outcome is shaped. Now I’m matching the smallest useful crew.',
      detail: 'Every proposed worker must own a proof obligation or mission contribution.',
      status: 'Crew review',
    },
    3: {
      title: 'The crew is covered. I prepared the minimum authority they need.',
      detail: 'Broader folders, permissions, and automatic startup remain off.',
      status: 'Access review',
    },
    4: {
      title: 'The plan is assembled. Review one launch brief before anything starts.',
      detail: 'I’ll call out changes, blockers, holds, and every remaining owner decision.',
      status: 'Launch ready',
    },
  };
  const current = copy[state.step];
  return `<section class="continuous-mission-coach"><span class="continuous-coach-mark">✦</span><div><span class="eyebrow">MISSION COACH</span><b>${current.title}</b><small>${current.detail}</small></div><div class="continuous-readiness"><span>${current.status}</span><div>${[
    1, 2, 3, 4,
  ]
    .map(
      (step) =>
        `<i class="${step < state.step ? 'done' : step === state.step ? 'current' : ''}"></i>`,
    )
    .join('')}</div></div></section>`;
}

function stepContent() {
  if (state.step === 1) return outcomePath();
  if (state.step === 2 && state.crewBuilderOpen) return crewBuilderWorkshop();
  if (state.step === 2 && state.cliDraftOpen)
    return `<section class="guided-step cli-draft-step">${workerAddPanel()}</section>`;
  if (state.step === 2)
    return `<section class="guided-step"><span class="eyebrow">STEP 2 OF 4 · CREW</span><h1>Who works inside this boundary?</h1><p class="lead">The profile explains who the worker is. The assignment states the worker’s one contribution to this mission.</p>${crewLayoutSwitcher()}${supervisorFields()}<div class="guided-workers">${Array.from({ length: state.workerCount }, (_, i) => workerEditor(i + 1, true)).join('')}</div>${state.importOpen ? workerAddPanel() : '<button data-open-worker>＋ Add worker…</button>'}</section>`;
  if (state.step === 3) return accessPath();
  return reviewPath();
}

function renderGuided() {
  const steps = ['Outcome', 'Crew', 'Access & limits', 'Review'];
  return shell(
    `<div class="guided-layout"><aside class="guided-rail"><span class="eyebrow">CREATE MISSION</span><ol>${steps.map((label, index) => `<li class="${state.step === index + 1 ? 'current' : state.step > index + 1 ? 'done' : ''}"><span>${state.step > index + 1 ? '✓' : index + 1}</span><b>${label}</b></li>`).join('')}</ol><div class="draft-note"><b>Local draft</b><span>Nothing starts before exact review.</span></div></aside><div class="guided-main">${state.step === 4 ? '' : continuousMissionCoach()}${stepContent()}${guidedControls()}</div></div>`,
    'B',
  );
}

function livePreview() {
  const runtime = workerRuntimeSummary(1);
  const proposedCrew =
    state.crewBuilderOpen && state.crewBuilderGenerated && !state.crewBuilderAdded;
  const workerSummary = proposedCrew
    ? `${state.selectedCrewSuggestions.length} proposed · unsaved`
    : `${state.workerCount} · manual`;
  const runtimeSummary = proposedCrew
    ? 'Pending crew review'
    : `${runtime.provider} · ${runtime.model}`;
  return `<aside class="live-preview"><div class="preview-head"><span class="eyebrow">LIVE BOUNDARY PREVIEW</span><span class="fresh">● current</span></div><h2 data-preview-objective>${state.objective}</h2><p class="evidence"><b>Complete when</b><span data-preview-evidence>${state.evidence}</span></p><div class="binding-line"><span>Supervisor</span><b>Codex CLI · verified</b></div><div class="binding-line"><span>Worker</span><b>${workerSummary}</b></div><div class="binding-line"><span>Workspace</span><b>${proposedCrew ? 'Not granted' : 'ThreadHelm · write'}</b></div><div class="binding-line"><span>Runtime</span><b>${runtimeSummary}</b></div><div class="binding-line"><span>Effort</span><b>${proposedCrew ? 'Not resolved' : `${runtime.provider} default`}</b></div><div class="boundary-box"><b>Authority stops here</b><p>Unknown outcomes are held. Consequential actions require owner approval. No substitution or automatic replay.</p></div><button data-exact-review>Open exact envelope review</button></aside>`;
}

function renderSplit() {
  return shell(
    `<div class="split-layout"><section class="split-editor"><div class="page-heading"><span class="eyebrow">NEW MISSION · LIVE PREVIEW</span><h1>Write the mission. Watch the boundary.</h1><p>The preview updates as fields change; exact folder confirmation remains the final gate.</p></div><details open><summary><span>01</span> Outcome <i>complete</i></summary>${objectiveFields()}</details><details open><summary><span>02</span> Supervisor <i>verified</i></summary>${supervisorFields()}</details><details open><summary><span>03</span> Crew <i>${state.workerCount} bound</i></summary>${Array.from({ length: state.workerCount }, (_, i) => workerEditor(i + 1, true)).join('')}<button data-add-worker>＋ Add worker</button></details><details><summary><span>04</span> Access and limits <i>1 workspace</i></summary>${missionLimits()}</details></section>${state.review ? exactReview() : livePreview()}</div>`,
    'C',
  );
}

function guidedRail() {
  const steps = ['Outcome', 'Crew', 'Access & limits', 'Review'];
  return `<aside class="guided-rail"><span class="eyebrow">CREATE MISSION</span><ol>${steps.map((label, index) => `<li class="${state.step === index + 1 ? 'current' : state.step > index + 1 ? 'done' : ''}"><span>${state.step > index + 1 ? '✓' : index + 1}</span><b>${label}</b></li>`).join('')}</ol><div class="draft-note"><b>Local draft</b><span>Nothing starts before exact review.</span></div></aside>`;
}

function guidedControls() {
  if (state.step === 2 && state.crewBuilderOpen && !state.crewBuilderAdded) return '';
  if (state.step === 1 && state.outcomeCoachOpen && !state.outcomeCoachApplied) {
    return `<footer class="guided-controls"><button data-back disabled>Back</button><span>Apply or close the Outcome Coach before continuing.</span><button class="primary" disabled>Continue to crew</button></footer>`;
  }
  if (state.step === 3 && state.accessCoachOpen && !state.accessCoachApplied) {
    return `<footer class="guided-controls"><button data-back>Back</button><span>Apply or close the Access Coach before continuing.</span><button class="primary" disabled>Continue to review</button></footer>`;
  }
  const nextLabel =
    state.step === 1
      ? 'Continue to crew'
      : state.step === 2
        ? 'Continue to access and limits'
        : 'Continue to review';
  return `<footer class="guided-controls"><button data-back ${state.step === 1 ? 'disabled' : ''}>Back</button><span>Changes stay local to this draft.</span>${state.step < 4 ? `<button class="primary" data-next>${nextLabel}</button>` : ''}</footer>`;
}

function renderHybrid() {
  return shell(
    `<div class="guided-hybrid-layout">
      ${guidedRail()}
      <div class="hybrid-guide-main ${state.step === 4 ? 'review-wide' : ''}">${state.step === 4 ? '' : continuousMissionCoach()}${stepContent()}${guidedControls()}</div>
      ${state.step === 4 ? '' : livePreview()}
    </div>`,
    'D',
  );
}

function attachEvents() {
  document.querySelectorAll('button.close').forEach((button) =>
    button.addEventListener('click', () => {
      state.draftExitOpen = true;
      state.draftExitMode = 'autosave';
      const url = new URL(location.href);
      url.searchParams.set('exit', 'autosave');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-draft-exit-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      state.draftExitMode = button.dataset.draftExitMode;
      const url = new URL(location.href);
      url.searchParams.set('exit', state.draftExitMode);
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-close-draft-exit]').forEach((button) =>
    button.addEventListener('click', () => {
      state.draftExitOpen = false;
      const url = new URL(location.href);
      url.searchParams.delete('exit');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document
    .querySelectorAll('[data-cycle]')
    .forEach((button) =>
      button.addEventListener('click', () => cycle(Number(button.dataset.cycle))),
    );
  document
    .querySelectorAll('[data-review-layout]')
    .forEach((button) =>
      button.addEventListener('click', () => setReviewLayout(button.dataset.reviewLayout)),
    );
  document
    .querySelectorAll('[data-crew-layout]')
    .forEach((button) =>
      button.addEventListener('click', () => setCrewLayout(button.dataset.crewLayout)),
    );
  document
    .querySelectorAll('[data-prompt-layout]')
    .forEach((button) =>
      button.addEventListener('click', () => setPromptLayout(button.dataset.promptLayout)),
    );
  document
    .querySelectorAll('[data-flow-layout]')
    .forEach((button) =>
      button.addEventListener('click', () => setFlowLayout(button.dataset.flowLayout)),
    );
  document
    .querySelectorAll('[data-review-state]')
    .forEach((button) =>
      button.addEventListener('click', () => setReviewState(button.dataset.reviewState)),
    );
  document
    .querySelectorAll('[data-crew-builder-state]')
    .forEach((button) =>
      button.addEventListener('click', () => setCrewBuilderState(button.dataset.crewBuilderState)),
    );
  document
    .querySelectorAll('[data-outcome-coach-state]')
    .forEach((button) =>
      button.addEventListener('click', () =>
        setOutcomeCoachState(button.dataset.outcomeCoachState),
      ),
    );
  document.querySelectorAll('[data-open-outcome-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.outcomeCoachOpen = true;
      state.outcomeCoachGenerated = false;
      state.outcomeCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.set('coach', 'start');
      url.searchParams.delete('coachState');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-close-outcome-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.outcomeCoachOpen = false;
      state.outcomeCoachGenerated = false;
      state.outcomeCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.delete('coach');
      url.searchParams.delete('coachState');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document
    .querySelectorAll('[data-run-outcome-coach]')
    .forEach((button) => button.addEventListener('click', () => setOutcomeCoachState('ready')));
  document.querySelectorAll('[data-edit-outcome-request]').forEach((button) =>
    button.addEventListener('click', () => {
      state.outcomeCoachGenerated = false;
      state.outcomeCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.set('coach', 'start');
      url.searchParams.delete('coachState');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-apply-outcome-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.outcomeCoachApplied = true;
      const url = new URL(location.href);
      url.searchParams.set('coach', 'applied');
      url.searchParams.set('coachState', 'ready');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-reopen-outcome-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.outcomeCoachApplied = false;
      state.outcomeCoachGenerated = true;
      const url = new URL(location.href);
      url.searchParams.set('coach', 'review');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document
    .querySelectorAll('[data-outcome-coach-ready]')
    .forEach((button) => button.addEventListener('click', () => setOutcomeCoachState('ready')));
  document.querySelectorAll('[data-rough-outcome]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.roughOutcomeRequest = event.target.value;
    }),
  );
  document.querySelectorAll('[data-outcome-starter]').forEach((button) =>
    button.addEventListener('click', () => {
      const starters = {
        change:
          'Build or change one product behavior and prove that it works without widening the mission.',
        investigate:
          'Investigate a reported failure, establish the supported cause, and return the smallest safe correction path.',
        review:
          'Review completed work against its approved behavior and return cited findings or an explicit no-material-defects result.',
      };
      state.roughOutcomeRequest = starters[button.dataset.outcomeStarter];
      render();
    }),
  );
  document.querySelectorAll('[data-coach-answer]').forEach((button) =>
    button.addEventListener('click', () => {
      document
        .querySelectorAll('[data-coach-answer]')
        .forEach((choice) => choice.classList.toggle('selected', choice === button));
    }),
  );
  document.querySelectorAll('[data-open-access-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.accessCoachOpen = true;
      state.accessCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.set('accessCoach', 'review');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-close-access-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.accessCoachOpen = false;
      state.accessCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.delete('accessCoach');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-apply-access-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.accessCoachApplied = true;
      state.accessMode = 'write';
      const url = new URL(location.href);
      url.searchParams.set('accessCoach', 'applied');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-review-access-coach]').forEach((button) =>
    button.addEventListener('click', () => {
      state.accessCoachApplied = false;
      const url = new URL(location.href);
      url.searchParams.set('accessCoach', 'review');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-generate-crew]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewBuilderGenerated = true;
      state.crewBuilderAdded = false;
      setCrewBuilderState('ready');
    }),
  );
  document
    .querySelectorAll('[data-crew-builder-ready]')
    .forEach((button) => button.addEventListener('click', () => setCrewBuilderState('ready')));
  document.querySelectorAll('[data-toggle-crew]').forEach((button) =>
    button.addEventListener('click', () => {
      const id = button.dataset.toggleCrew;
      state.crewPlanMode = 'custom';
      state.selectedCrewSuggestions = state.selectedCrewSuggestions.includes(id)
        ? state.selectedCrewSuggestions.filter((item) => item !== id)
        : [...state.selectedCrewSuggestions, id].slice(0, 3);
      render();
    }),
  );
  document.querySelectorAll('[data-crew-plan]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewPlanMode = button.dataset.crewPlan;
      state.selectedCrewSuggestions =
        state.crewPlanMode === 'focused'
          ? ['builder', 'reviewer']
          : ['builder', 'reviewer', 'steward'];
      render();
    }),
  );
  document.querySelectorAll('[data-add-selected-crew]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewBuilderAdded = true;
      state.workerCount = Math.max(1, state.selectedCrewSuggestions.length);
      render();
    }),
  );
  document.querySelectorAll('[data-edit-crew-plan]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewBuilderAdded = false;
      render();
    }),
  );
  document.querySelectorAll('[data-reset-crew]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewBuilderGenerated = false;
      state.crewBuilderAdded = false;
      render();
    }),
  );
  document.querySelectorAll('[data-access-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      state.accessMode = button.dataset.accessMode;
      render();
    }),
  );
  document.querySelectorAll('[data-worker-profile]').forEach((select) =>
    select.addEventListener('change', () => {
      state.workerRuntime[select.dataset.workerProfile] = {
        providerId: select.value,
        model: 'profile',
      };
      render();
    }),
  );
  document.querySelectorAll('[data-profile-card]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerRuntime[button.dataset.profileCard] = {
        providerId: button.dataset.provider,
        model: 'profile',
      };
      render();
    }),
  );
  document.querySelectorAll('[data-worker-model]').forEach((select) =>
    select.addEventListener('change', () => {
      const runtime = workerRuntime(select.dataset.workerModel);
      runtime.model = select.value;
      render();
    }),
  );
  document.querySelectorAll('[data-objective]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.objective = event.target.value;
      document.querySelectorAll('[data-preview-objective]').forEach((preview) => {
        preview.textContent = state.objective;
      });
    }),
  );
  document.querySelectorAll('[data-evidence]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.evidence = event.target.value;
      document.querySelectorAll('[data-preview-evidence]').forEach((preview) => {
        preview.textContent = state.evidence;
      });
    }),
  );
  document.querySelectorAll('[data-scope-guard]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.scopeGuard = event.target.value;
    }),
  );
  document.querySelectorAll('[data-add-worker]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerCount = Math.min(3, state.workerCount + 1);
      render();
    }),
  );
  document.querySelectorAll('[data-open-worker]').forEach((button) =>
    button.addEventListener('click', () => {
      state.crewBuilderOpen = false;
      state.importOpen = true;
      state.importPreview = false;
      state.createProfileOpen = false;
      state.createProfileReview = false;
      state.cliDraftOpen = false;
      state.cliDraftResult = false;
      const url = new URL(location.href);
      url.searchParams.delete('builder');
      url.searchParams.delete('crewState');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-cli-draft]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importOpen = true;
      state.importPreview = false;
      state.createProfileOpen = false;
      state.createProfileReview = false;
      state.cliDraftOpen = true;
      state.cliDraftResult = false;
      const url = new URL(location.href);
      url.searchParams.set('stage', 'prompt');
      url.searchParams.set('crew', 'card');
      url.searchParams.set('prompt', 'guided');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-close-cli-draft]').forEach((button) =>
    button.addEventListener('click', () => {
      state.cliDraftOpen = false;
      state.cliDraftResult = false;
      const url = new URL(location.href);
      url.searchParams.set('stage', 'crew');
      url.searchParams.set('crew', 'card');
      url.searchParams.delete('prompt');
      history.replaceState({}, '', url);
      render();
    }),
  );
  document.querySelectorAll('[data-run-cli-draft]').forEach((button) =>
    button.addEventListener('click', () => {
      state.cliDraftResult = true;
      render();
    }),
  );
  document.querySelectorAll('[data-starter]').forEach((button) =>
    button.addEventListener('click', () => {
      const starter = starterBriefs[button.dataset.starter];
      if (!starter) return;
      state.selectedStarter = button.dataset.starter;
      state.draftWork = starter.work;
      state.draftResult = starter.result;
      state.draftAbilities = [...starter.abilities];
      render();
    }),
  );
  document.querySelectorAll('[data-draft-work]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.draftWork = event.target.value;
      state.selectedStarter = 'blank';
      document.querySelectorAll('[data-readback-work]').forEach((readback) => {
        readback.textContent = state.draftWork || 'Describe the reusable work above.';
      });
      document.querySelectorAll('[data-starter]').forEach((starter) => {
        starter.classList.remove('selected');
        starter.setAttribute('aria-pressed', 'false');
        starter.querySelector('.starter-check').textContent = '';
      });
    }),
  );
  document.querySelectorAll('[data-draft-result]').forEach((input) =>
    input.addEventListener('input', (event) => {
      state.draftResult = event.target.value;
      state.selectedStarter = 'blank';
      document.querySelectorAll('[data-readback-result]').forEach((readback) => {
        readback.textContent = state.draftResult || 'Describe the evidence or outcome above.';
      });
      document.querySelectorAll('[data-starter]').forEach((starter) => {
        starter.classList.remove('selected');
        starter.setAttribute('aria-pressed', 'false');
        starter.querySelector('.starter-check').textContent = '';
      });
    }),
  );
  document.querySelectorAll('[data-draft-ability]').forEach((button) =>
    button.addEventListener('click', () => {
      const ability = button.dataset.draftAbility;
      state.draftAbilities = state.draftAbilities.includes(ability)
        ? state.draftAbilities.filter((item) => item !== ability)
        : [...state.draftAbilities, ability];
      state.selectedStarter = 'blank';
      render();
    }),
  );
  document.querySelectorAll('[data-edit-cli-request]').forEach((button) =>
    button.addEventListener('click', () => {
      state.cliDraftResult = false;
      render();
    }),
  );
  document.querySelectorAll('[data-use-cli-draft]').forEach((button) =>
    button.addEventListener('click', () => {
      state.cliDraftOpen = false;
      state.cliDraftResult = false;
      state.createProfileOpen = true;
      state.createProfileReview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-use-saved]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerCount = Math.min(3, state.workerCount + 1);
      state.importOpen = false;
      state.createProfileOpen = false;
      render();
    }),
  );
  document.querySelectorAll('[data-preview-import]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importPreview = true;
      state.createProfileOpen = false;
      render();
    }),
  );
  document.querySelectorAll('[data-confirm-import]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerCount = Math.min(3, state.workerCount + 1);
      state.importOpen = false;
      state.importPreview = false;
      state.createProfileOpen = false;
      state.createProfileReview = false;
      state.cliDraftOpen = false;
      state.cliDraftResult = false;
      render();
    }),
  );
  document.querySelectorAll('[data-cancel-import]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importOpen = false;
      state.importPreview = false;
      state.createProfileOpen = false;
      state.createProfileReview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-back-import]').forEach((button) =>
    button.addEventListener('click', () => {
      state.importPreview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-create-profile]').forEach((button) =>
    button.addEventListener('click', () => {
      state.createProfileOpen = true;
      state.createProfileReview = false;
      state.importPreview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-review-created]').forEach((button) =>
    button.addEventListener('click', () => {
      state.createProfileReview = true;
      render();
    }),
  );
  document.querySelectorAll('[data-back-create]').forEach((button) =>
    button.addEventListener('click', () => {
      state.createProfileReview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-confirm-created]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerCount = Math.min(3, state.workerCount + 1);
      state.importOpen = false;
      state.createProfileOpen = false;
      state.createProfileReview = false;
      render();
    }),
  );
  document.querySelectorAll('[data-remove-worker]').forEach((button) =>
    button.addEventListener('click', () => {
      state.workerCount = Math.max(1, state.workerCount - 1);
      render();
    }),
  );
  document.querySelectorAll('[data-review], [data-exact-review]').forEach((button) =>
    button.addEventListener('click', () => {
      state.review = true;
      if (currentVariant() === 'A') state.step = 4;
      render();
    }),
  );
  document.querySelectorAll('[data-next]').forEach((button) =>
    button.addEventListener('click', () => {
      const leavingOutcome = state.step === 1;
      const leavingCrew = state.step === 2;
      state.step = Math.min(4, state.step + 1);
      if (leavingOutcome) {
        state.crewBuilderOpen = true;
        state.crewBuilderGenerated = false;
        const url = new URL(location.href);
        url.searchParams.set('builder', 'workshop');
        url.searchParams.set('crewState', 'start');
        history.replaceState({}, '', url);
      }
      if (leavingCrew) {
        state.accessCoachOpen = true;
        state.accessCoachApplied = false;
        const url = new URL(location.href);
        url.searchParams.set('accessCoach', 'review');
        history.replaceState({}, '', url);
      }
      syncStageUrl();
      render();
    }),
  );
  document.querySelectorAll('[data-back]').forEach((button) =>
    button.addEventListener('click', () => {
      state.step = Math.max(1, state.step - 1);
      syncStageUrl();
      render();
    }),
  );
  document
    .querySelectorAll('[data-review-updated]')
    .forEach((button) => button.addEventListener('click', () => setReviewState('ready')));
  document.querySelectorAll('[data-back-access]').forEach((button) =>
    button.addEventListener('click', () => {
      state.step = 3;
      syncStageUrl();
      render();
    }),
  );
  document.querySelectorAll('.confirmation input').forEach((input) =>
    input.addEventListener('change', () => {
      const start = document.querySelector('.review-action-footer .primary');
      if (start) start.disabled = !input.checked;
    }),
  );
}

function render() {
  const key = currentVariant();
  app.innerHTML = variants[key].render();
  attachEvents();
}

addEventListener('keydown', (event) => {
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
    document.activeElement?.isContentEditable
  )
    return;
  if (event.key === 'ArrowLeft') cycle(-1);
  if (event.key === 'ArrowRight') cycle(1);
});
addEventListener('popstate', render);
render();
