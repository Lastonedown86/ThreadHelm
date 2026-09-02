import { useEffect, useRef, useState } from 'react';
import {
  AgentManifestV1,
  MAX_TOKEN_CAP,
  UpdateAgentWizardStepRequest,
  type OperationResponse,
  type OperationRequest,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { AgentAuthoringError } from './AgentAuthoringError.js';
import { ModalDialog } from './ModalDialog.js';
import { templateLabel } from './template-label.js';

type Draft = OperationResponse<'agentWizard.getDraft'>;
type Template = OperationResponse<'agentTemplates.list'>['templates'][number];
type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Review = OperationResponse<'agentWizard.previewCompletion'>;
type ExportReview = OperationResponse<'agentWizard.previewExport'>;
type Fields = Draft['fieldValues'];
type Step = 'start' | 'identity' | 'role' | 'capabilities' | 'runtime' | 'review';
const STEPS: readonly Step[] = ['start', 'identity', 'role', 'capabilities', 'runtime', 'review'];
const TITLES: Record<Step, string> = {
  start: 'Start',
  identity: 'Identity',
  role: 'Role and goal',
  capabilities: 'Capabilities',
  runtime: 'Runtime requests',
  review: 'Review',
};
const OWNED: Record<Step, readonly (keyof AgentManifestV1)[]> = {
  start: [],
  identity: ['name', 'description', 'author'],
  role: ['goal'],
  capabilities: ['capabilities'],
  runtime: ['provider', 'model', 'isolate', 'tokenCap'],
  review: [],
};
const FIELD_NAMES: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  author: 'Author',
  goal: 'Goal',
  capabilities: 'Capability labels',
  provider: 'Provider',
  model: 'Model',
  isolate: 'Isolation request',
  tokenCap: 'Requested token cap',
};
const MODELS = {
  codex: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna'],
  claude: ['claude-sonnet-5', 'claude-opus-5'],
};

export function AgentProfileWizard({
  draftId,
  sourceRevisionId,
  onClose,
  onCompleted,
}: {
  draftId?: string;
  sourceRevisionId?: string;
  onClose(): void;
  onCompleted(message: string): void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [step, setStep] = useState<Step>('start');
  const stepRef = useRef<Step>('start');
  const [fields, setFields] = useState<Fields>({});
  const [capabilityText, setCapabilityText] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const fieldsRef = useRef<Fields>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const valuesRef = useRef<Record<string, string>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [source, setSource] = useState(sourceRevisionId ? `template:${sourceRevisionId}` : 'blank');
  const [sourceDetail, setSourceDetail] = useState<OperationResponse<'agentTemplates.get'> | null>(
    null,
  );
  const [review, setReview] = useState<Review | null>(null);
  const [exportReview, setExportReview] = useState<ExportReview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [exportWarning, setExportWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [editSequence, setEditSequence] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [templateEditor, setTemplateEditor] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [templateTarget, setTemplateTarget] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<Draft | null>>(async () => null);

  function acceptDraft(next: Draft, replaceFields = false) {
    draftRef.current = next;
    if (!mounted.current) return;
    setDraft(next);
    if (replaceFields) {
      fieldsRef.current = next.fieldValues;
      valuesRef.current = next.variableValues;
      setFields(next.fieldValues);
      setCapabilityText((next.fieldValues.capabilities ?? []).join(', '));
      const models =
        next.fieldValues.provider === 'claude' || next.fieldValues.provider === 'claude-code'
          ? MODELS.claude
          : MODELS.codex;
      setCustomModelMode(
        Boolean(next.fieldValues.model && !models.includes(next.fieldValues.model)),
      );
      setValues(next.variableValues);
      stepRef.current = next.currentStep;
      setStep(next.currentStep);
    }
  }

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const load = async () => {
      const allTemplates: Template[] = [];
      let cursor: string | null = null;
      do {
        const page: OperationResponse<'agentTemplates.list'> = await call(
          api.agentTemplates.list({ state: 'active', limit: 50, ...(cursor ? { cursor } : {}) }),
        );
        allTemplates.push(...page.templates);
        cursor = page.nextCursor;
      } while (cursor && allTemplates.length <= 150);
      const allProfiles: Profile[] = [];
      cursor = null;
      do {
        const roster: OperationResponse<'profiles.list'> = await call(
          api.profiles.list({ state: 'active', limit: 50, ...(cursor ? { cursor } : {}) }),
        );
        allProfiles.push(...roster.profiles);
        cursor = roster.nextCursor;
      } while (cursor && allProfiles.length <= 100);
      if (cancelled) return;
      setTemplates(allTemplates);
      setProfiles(allProfiles);
      if (draftId) {
        const resumed = await call(api.agentWizard.getDraft({ draftId }));
        if (cancelled) return;
        acceptDraft(resumed, true);
        if (resumed.sourceTemplateRevisionId) {
          const template = allTemplates.find(
            (item) => item.currentRevisionId === resumed.sourceTemplateRevisionId,
          );
          if (template)
            setSourceDetail(
              await call(api.agentTemplates.get({ templateId: template.templateId })),
            );
        }
      }
    };
    void load()
      .catch((cause) => {
        if (!cancelled) setError(cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [draftId]);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const persist = (nextStep?: Step): Promise<Draft | null> => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    const ownedStep = stepRef.current;
    const snapshot = fieldsRef.current;
    const variableSnapshot = valuesRef.current;
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        const current = draftRef.current;
        if (!current || ownedStep === 'start') return current;
        if (mounted.current) setSaveStatus('Saving draft…');
        const ownedFields = Object.fromEntries(
          OWNED[ownedStep]
            .filter((key) => snapshot[key] !== undefined)
            .map((key) => [key, snapshot[key]]),
        );
        const next = await call(
          api.agentWizard.updateStep(
            UpdateAgentWizardStepRequest.parse({
              draftId: current.draftId,
              version: current.version,
              step: ownedStep,
              fields: ownedFields,
              variables: variableSnapshot,
              ...(nextStep ? { nextStep } : {}),
            }),
          ),
        );
        acceptDraft(next);
        if (mounted.current) setSaveStatus('Draft saved locally.');
        return next;
      });
    queue.current = operation;
    return operation;
  };
  saveRef.current = () => persist();

  useEffect(() => {
    if (!editSequence) return;
    pendingTimer.current = setTimeout(() => {
      void saveRef.current().catch((cause) => {
        if (mounted.current) {
          setError(cause);
          setSaveStatus('Draft not saved. Your edits remain visible.');
        }
      });
    }, 350);
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [editSequence]);

  function edit(patch: Fields) {
    const next = { ...fieldsRef.current, ...patch };
    fieldsRef.current = next;
    setFields(next);
    setReview(null);
    setExportReview(null);
    setConfirmed(false);
    setEditSequence((value) => value + 1);
  }

  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      if (errorCode(cause) !== 'SELECTION_CANCELLED') setError(cause);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function validate(currentStep: Step): boolean {
    const parsed = AgentManifestV1.safeParse(fieldsRef.current);
    const issues = parsed.success
      ? []
      : parsed.error.issues.filter((issue) =>
          OWNED[currentStep].includes(String(issue.path[0]) as keyof AgentManifestV1),
        );
    const messages = [
      ...new Set(
        issues.map(
          (issue) =>
            `${FIELD_NAMES[String(issue.path[0])] ?? 'Field'}: enter a valid, bounded value.`,
        ),
      ),
    ];
    setFieldErrors(messages);
    return messages.length === 0;
  }

  async function navigate(direction: 1 | -1) {
    if (step === 'start') {
      const createSource: OperationRequest<'agentWizard.createDraft'>['source'] = source.startsWith(
        'template:',
      )
        ? { kind: 'template', templateRevisionId: source.slice(9) }
        : source.startsWith('profile:')
          ? { kind: 'profile', profileRevisionId: source.slice(8) }
          : { kind: 'blank' };
      const created = await call(api.agentWizard.createDraft({ source: createSource }));
      acceptDraft(created, true);
      if (createSource.kind === 'template') {
        const template = templates.find(
          (item) => item.currentRevisionId === createSource.templateRevisionId,
        );
        if (template)
          setSourceDetail(await call(api.agentTemplates.get({ templateId: template.templateId })));
      }
      return;
    }
    if (direction === 1 && !validate(step)) return;
    const requestedStep = STEPS[Math.max(1, STEPS.indexOf(step) + direction)]!;
    const updated = await persist(requestedStep);
    const nextStep = updated?.currentStep ?? step;
    stepRef.current = nextStep;
    setStep(nextStep);
    setFieldErrors([]);
    setReview(null);
    setExportReview(null);
    setConfirmed(false);
    if (nextStep === 'review' && updated) {
      setReview(
        await call(
          api.agentWizard.previewCompletion({
            draftId: updated.draftId,
            version: updated.version,
            action: 'profile',
          }),
        ),
      );
    }
  }

  const close = () =>
    void act(async () => {
      await persist();
      onClose();
    });
  const finishProfile = () =>
    void act(async () => {
      if (!review || !confirmed) return;
      const saved = await call(
        api.agentWizard.confirmProfile({
          completionToken: review.completionToken,
          profileConfirmation: true,
        }),
      );
      onCompleted(`Saved ${saved.displayName} as a reviewed local profile. No agent was launched.`);
    });
  const chooseExport = () =>
    void act(async () => {
      const current = draftRef.current;
      if (!current || !confirmed) return;
      const exportCompletion = await call(
        api.agentWizard.previewCompletion({
          draftId: current.draftId,
          version: current.version,
          action: 'export',
        }),
      );
      const selected = await call(api.agentWizard.chooseExportTarget(undefined));
      setExportReview(
        await call(
          api.agentWizard.previewExport({
            completionToken: exportCompletion.completionToken,
            targetHandle: selected.targetHandle,
          }),
        ),
      );
      setOverwrite(false);
      setExportWarning(false);
    });
  const finishExport = () =>
    void act(async () => {
      if (!exportReview || (exportReview.collision && !overwrite)) return;
      try {
        await call(
          api.agentWizard.confirmExport({
            exportToken: exportReview.exportToken,
            overwriteConfirmation: overwrite,
          }),
        );
      } catch (cause) {
        setExportWarning(true);
        setExportReview(null);
        setConfirmed(false);
        throw cause;
      }
      onCompleted('Exported the reviewed agent manifest. No agent was launched.');
    });

  const renderText = (key: 'name' | 'description' | 'author' | 'goal', multiline = false) => (
    <label className="field">
      {FIELD_NAMES[key]}
      {multiline ? (
        <textarea
          aria-label={FIELD_NAMES[key]}
          value={fields[key] ?? ''}
          rows={key === 'goal' ? 6 : 3}
          maxLength={4000}
          onChange={(event) => edit({ [key]: event.target.value })}
        />
      ) : (
        <input
          aria-label={FIELD_NAMES[key]}
          value={fields[key] ?? ''}
          maxLength={200}
          onChange={(event) => edit({ [key]: event.target.value })}
        />
      )}
    </label>
  );
  const providerGroup =
    fields.provider === 'claude' || fields.provider === 'claude-code' ? 'claude' : 'codex';
  const modelOptions = MODELS[providerGroup];
  const customModel =
    customModelMode || Boolean(fields.model && !modelOptions.includes(fields.model));
  const visibleFieldErrors = [
    ...new Set([
      ...fieldErrors,
      ...Object.keys(draft?.fieldErrors ?? {})
        .filter((key) => OWNED[step].includes(key as keyof AgentManifestV1) || step === 'review')
        .map((key) => `${FIELD_NAMES[key] ?? key}: enter a valid, bounded value.`),
    ]),
  ];

  return (
    <ModalDialog
      label="Create agent"
      onDismiss={() => {
        if (!busy) close();
      }}
    >
      <div className="agent-wizard">
        <p className="hint">Step {STEPS.indexOf(step) + 1} of 6 · Create agent</p>
        <h3 ref={heading} tabIndex={-1}>
          {TITLES[step]}
        </h3>
        <p className="hint">
          Templates and drafts are local data. They never launch an agent or grant tools,
          permissions, workspace access, or a mission role.
        </p>
        {sourceDetail && step !== 'start' ? (
          <p className="hint">
            Copied from {sourceDetail.name} · revision {sourceDetail.revision} ·{' '}
            {sourceDetail.origin}. Your draft is independent.
          </p>
        ) : null}
        {!sourceDetail && draft?.sourceTemplateRevisionId ? (
          <p className="hint">
            Copied from template revision{' '}
            <span className="mono">{draft.sourceTemplateRevisionId}</span>. Your draft is
            independent.
          </p>
        ) : null}
        {draft?.sourceProfileRevisionId ? (
          <p className="hint">
            Copied from reviewed profile revision{' '}
            <span className="mono">{draft.sourceProfileRevisionId}</span>. Your draft is
            independent.
          </p>
        ) : null}
        <AgentAuthoringError error={error} />
        {exportWarning ? (
          <p className="notice warning" role="alert">
            Export did not report success. Inspect the selected file before retrying: it may already
            contain the reviewed manifest. An unknown export outcome is never replayed
            automatically.
          </p>
        ) : null}
        {visibleFieldErrors.length ? (
          <ul className="notice error" role="alert">
            {visibleFieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <fieldset disabled={busy || loading} className="wizard-fields">
          {step === 'start' ? (
            <label className="field">
              Start from
              <select
                aria-label="Start from"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="blank">Blank agent</option>
                {templates
                  .filter((template) => template.state === 'active')
                  .map((template) => (
                    <option
                      key={template.templateId}
                      value={`template:${template.currentRevisionId}`}
                    >
                      {templateLabel(template)}
                    </option>
                  ))}
                {profiles.map((profile) => (
                  <option key={profile.profileId} value={`profile:${profile.currentRevisionId}`}>
                    {profile.displayName} (reviewed profile)
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {step === 'identity' ? (
            <>
              <p className="hint">
                Name and style identify your local agent; they do not assign authority.
              </p>
              {renderText('name')}
              {renderText('description', true)}
              {renderText('author')}
            </>
          ) : null}
          {step === 'role' ? (
            <>
              <p className="hint">
                Describe one bounded role and goal. This text remains untrusted context, even if it
                requests permissions.
              </p>
              {renderText('goal', true)}
            </>
          ) : null}
          {step === 'capabilities' ? (
            <>
              <p className="hint">
                Routing labels only. Labels grant no tools or permissions. Use up to 16 lowercase
                labels, separated by commas.
              </p>
              <label className="field">
                Capability labels
                <input
                  value={capabilityText}
                  onChange={(event) => {
                    setCapabilityText(event.target.value);
                    edit({
                      capabilities: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    });
                  }}
                />
              </label>
            </>
          ) : null}
          {step === 'runtime' ? (
            <>
              <p className="hint">
                These are requests, not effective launch settings. Permission mode, effort, tools,
                workspace, isolation, and resource limits are resolved separately at launch.
              </p>
              <label className="field">
                Provider
                <select
                  aria-label="Provider"
                  value={fields.provider ?? ''}
                  onChange={(event) => {
                    setCustomModelMode(false);
                    edit({
                      provider: event.target.value as AgentManifestV1['provider'],
                      model: '',
                    });
                  }}
                >
                  <option value="" disabled>
                    Choose a provider
                  </option>
                  <option value="codex">Codex CLI</option>
                  <option value="claude">Claude Code</option>
                  {fields.provider === 'codex-cli' ? (
                    <option value="codex-cli">Codex CLI (imported identifier)</option>
                  ) : null}
                  {fields.provider === 'claude-code' ? (
                    <option value="claude-code">Claude Code (imported identifier)</option>
                  ) : null}
                </select>
              </label>
              <label className="field">
                Model
                <select
                  aria-label="Model"
                  value={customModel ? '__custom__' : (fields.model ?? '')}
                  onChange={(event) => {
                    setCustomModelMode(event.target.value === '__custom__');
                    edit({ model: event.target.value === '__custom__' ? '' : event.target.value });
                  }}
                >
                  <option value="" disabled>
                    Choose a requested model
                  </option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                  <option value="__custom__">Custom model…</option>
                </select>
              </label>
              {customModel ? (
                <label className="field">
                  Custom model
                  <input
                    value={fields.model ?? ''}
                    maxLength={128}
                    onChange={(event) => edit({ model: event.target.value })}
                  />
                </label>
              ) : null}
              <p className="hint">
                The portable agent manifest schema requires a model. CLI default remains available
                in the separate launch dialog.
              </p>
              <label className="confirmation">
                <input
                  type="checkbox"
                  checked={fields.isolate ?? false}
                  onChange={(event) => edit({ isolate: event.target.checked })}
                />{' '}
                Request isolated workspace
              </label>
              <label className="field">
                Requested token cap
                <input
                  type="number"
                  min={1}
                  max={MAX_TOKEN_CAP}
                  value={fields.tokenCap ?? ''}
                  onChange={(event) => edit({ tokenCap: Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}
          {step !== 'start' && step !== 'review' && sourceDetail?.variables.length ? (
            <section aria-label="Template variables">
              <p className="hint">
                Template values are literal local text. Complete any values referenced by this step
                before continuing.
              </p>
              {sourceDetail.variables.map((variable) => (
                <label className="field" key={variable.name}>
                  Variable: {variable.name}
                  <input
                    maxLength={variable.maxLength * 2}
                    value={values[variable.name] ?? ''}
                    onChange={(event) => {
                      const next = {
                        ...valuesRef.current,
                        [variable.name]: [...event.target.value]
                          .slice(0, variable.maxLength)
                          .join(''),
                      };
                      valuesRef.current = next;
                      setValues(next);
                      setEditSequence((value) => value + 1);
                    }}
                  />
                </label>
              ))}
            </section>
          ) : null}
          {step === 'review' ? (
            <>
              {review ? (
                <>
                  <p>Compatibility: {review.compatibility}</p>
                  {review.compatibilityReasons.length ? (
                    <ul>
                      {review.compatibilityReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  <pre className="wizard-json" aria-label="Exact manifest JSON" tabIndex={0}>
                    {review.manifestJson}
                  </pre>
                  <p className="hint">
                    SHA-256: <span className="mono">{review.digest}</span>
                  </p>
                  <p className="notice">
                    Permission mode, effort, workspace, tools, isolation and budgets are resolved
                    separately at launch. Saving or exporting grants nothing.
                  </p>
                  <label className="confirmation">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />{' '}
                    I reviewed this exact manifest
                  </label>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={!!exportReview}
                      onClick={() =>
                        void act(async () => {
                          const current = draftRef.current;
                          if (!current) return;
                          setConfirmed(false);
                          setReview(
                            await call(
                              api.agentWizard.previewCompletion({
                                draftId: current.draftId,
                                version: current.version,
                                action: 'profile',
                              }),
                            ),
                          );
                        })
                      }
                    >
                      Refresh review
                    </button>
                    <button
                      type="button"
                      disabled={!confirmed || !!exportReview}
                      onClick={finishProfile}
                    >
                      Save profile
                    </button>
                    <button
                      type="button"
                      disabled={!confirmed || !!exportReview}
                      onClick={chooseExport}
                    >
                      Export…
                    </button>
                    <button
                      type="button"
                      disabled={!confirmed || !!exportReview}
                      onClick={() => {
                        setTemplateEditor(true);
                        setTemplateName(fields.name ?? '');
                        setTemplateKey(
                          (fields.name ?? '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        );
                      }}
                    >
                      Save as template…
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void act(async () => {
                      const current = draftRef.current;
                      if (current)
                        setReview(
                          await call(
                            api.agentWizard.previewCompletion({
                              draftId: current.draftId,
                              version: current.version,
                              action: 'profile',
                            }),
                          ),
                        );
                    })
                  }
                >
                  Refresh review
                </button>
              )}
              {exportReview ? (
                <section aria-label="Export confirmation">
                  <h4>Review export target</h4>
                  <p className="mono">{exportReview.displayPath}</p>
                  <p>
                    {exportReview.collision
                      ? 'An existing file will be replaced only with your explicit confirmation.'
                      : 'A new agent manifest will be created here.'}
                  </p>
                  {exportReview.collision ? (
                    <label className="confirmation">
                      <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={(event) => setOverwrite(event.target.checked)}
                      />{' '}
                      Replace this existing file
                    </label>
                  ) : null}
                  <div className="actions">
                    <button
                      type="button"
                      disabled={exportReview.collision && !overwrite}
                      onClick={finishExport}
                    >
                      Confirm export
                    </button>
                    <button type="button" onClick={() => setExportReview(null)}>
                      Cancel export
                    </button>
                  </div>
                </section>
              ) : null}
              {templateEditor ? (
                <section aria-label="Save local template">
                  <h4>Save local template</h4>
                  <label className="field">
                    Template destination
                    <select
                      aria-label="Template destination"
                      value={templateTarget}
                      onChange={(event) => {
                        setTemplateTarget(event.target.value);
                        const selected = templates.find(
                          (template) => template.templateId === event.target.value,
                        );
                        if (selected) {
                          setTemplateKey(selected.key);
                          setTemplateName(selected.name);
                        }
                      }}
                    >
                      <option value="">New local template</option>
                      {templates
                        .filter((template) => template.origin === 'user')
                        .map((template) => (
                          <option key={template.templateId} value={template.templateId}>
                            New revision of {template.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Template name
                    <input
                      value={templateName}
                      maxLength={200}
                      onChange={(event) => setTemplateName(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    Template key
                    <input
                      value={templateKey}
                      disabled={Boolean(templateTarget)}
                      maxLength={128}
                      onChange={(event) => setTemplateKey(event.target.value)}
                    />
                  </label>
                  <p className="hint">
                    Save only this reviewed local scaffold. The draft remains open and no agent
                    launches.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() =>
                        void act(async () => {
                          const current = draftRef.current;
                          if (!current) return;
                          const selected = templates.find(
                            (template) => template.templateId === templateTarget,
                          );
                          const saved = await call(
                            api.agentTemplates.saveRevision({
                              source: {
                                kind: 'draft',
                                draftId: current.draftId,
                                version: current.version,
                              },
                              key: templateKey,
                              name: templateName,
                              ...(selected
                                ? {
                                    templateId: selected.templateId,
                                    revisionId: selected.currentRevisionId,
                                  }
                                : {}),
                            }),
                          );
                          setTemplates((previous) => [
                            ...previous.filter(
                              (template) => template.templateId !== saved.templateId,
                            ),
                            saved,
                          ]);
                          setTemplateEditor(false);
                          setSaveStatus('Local template saved. Draft remains open.');
                        })
                      }
                    >
                      Confirm save template
                    </button>
                    <button type="button" onClick={() => setTemplateEditor(false)}>
                      Cancel template save
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </fieldset>
        <p className="hint" role="status">
          {saveStatus}
        </p>
        <div className="actions">
          {step !== 'start' && step !== 'identity' ? (
            <button type="button" disabled={busy} onClick={() => void act(() => navigate(-1))}>
              Back
            </button>
          ) : null}
          {step !== 'review' ? (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void act(() => navigate(1))}
            >
              Next
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={close}>
            {draft ? 'Save draft and close' : 'Cancel'}
          </button>
          {draft ? (
            <button type="button" disabled={busy} onClick={() => setDeleteConfirm(true)}>
              Delete draft
            </button>
          ) : null}
        </div>
        {deleteConfirm ? (
          <div className="notice warning">
            <p>Delete this local draft and its saved fields? This cannot be undone.</p>
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    if (pendingTimer.current) clearTimeout(pendingTimer.current);
                    await queue.current.catch(() => undefined);
                    const current = draftRef.current;
                    if (!current) return;
                    await call(
                      api.agentWizard.deleteDraft({
                        draftId: current.draftId,
                        version: current.version,
                      }),
                    );
                    onCompleted('Draft deleted.');
                  })
                }
              >
                Confirm delete draft
              </button>
              <button type="button" onClick={() => setDeleteConfirm(false)}>
                Keep draft
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ModalDialog>
  );
}
