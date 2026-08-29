/**
 * Privacy filter (T021). Every string that reaches SQLite passes through here.
 * Durable free text comes ONLY from `safeTemplate` (data-model invariant 10);
 * `sanitizeSummary` is the gate for summaries built elsewhere.
 */

import { ThreadHelmError } from '@threadhelm/contracts';

const MAX_SUMMARY = 300;
const MAX_COORDINATION_PURPOSE_SCALARS = 160;
const MAX_COORDINATION_BODY_BYTES = 16_384;

/** Applied to every persisted string, including paths. */
const RAW_CONTENT = [
  // eslint-disable-next-line no-control-regex
  /[\x00-\x1f\x7f-\x9f]/, // C0/C1 controls: ESC, CSI, newlines, bells
  /sk-[A-Za-z0-9_-]{8,}/,
  /sk-ant-/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{8,}/,
  /github_pat_/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-/,
  /Bearer\s+\S{8,}/,
  /eyJ[A-Za-z0-9_-]{4,}\.eyJ[A-Za-z0-9_-]{4,}/,
  /\b\w*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|AUTH|CREDENTIAL)\w*\s*=/i,
];

/** Extra rules for summaries: long opaque runs and raw prompt/probe markers. */
const RAW_SUMMARY = [
  /[A-Fa-f0-9]{32,}/,
  /[A-Za-z0-9+/]{32,}={0,2}/,
  /\b(?:stdout|stderr|probe output|prompt|transcript)\s*:/i,
  /\bPS [A-Z]:\\/,
  /\b(?:Human|Assistant|User|System):/,
];

function unsafe(reason: string, field?: string): ThreadHelmError {
  return new ThreadHelmError('INVALID_REQUEST', 'Value is not safe to persist.', {
    reason,
    ...(field ? { field } : {}),
  });
}

function invalidCoordination(reason: string, field: 'purpose' | 'body'): ThreadHelmError {
  return new ThreadHelmError(
    'COORDINATION_CONTENT_INVALID',
    'Coordination content did not pass validation.',
    { reason, field },
  );
}

function isWellFormedUnicode(input: string): boolean {
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Normalize only the differences named by the coordination contract. */
export function normalizeCoordinationContent(input: string): string {
  if (!isWellFormedUnicode(input)) {
    throw invalidCoordination('INVALID_UNICODE', 'body');
  }
  const normalized = input.replace(/\r\n?/g, '\n').replace(/[\p{Zs}\t]+$/gmu, '');
  // Tabs and LF are the only controls retained by the durable content contract.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(normalized)) {
    throw invalidCoordination('CONTROL_CHARACTER', 'body');
  }
  return normalized;
}

export interface SanitizedCoordinationContent {
  normalized: string;
  scalarCount: number;
  utf8Bytes: number;
}

function sanitizeCoordinationContent(
  input: string,
  field: 'purpose' | 'body',
): SanitizedCoordinationContent {
  let normalized: string;
  try {
    normalized = normalizeCoordinationContent(input);
  } catch (error) {
    if (error instanceof ThreadHelmError) {
      throw invalidCoordination(String(error.details.reason ?? 'INVALID_CONTENT'), field);
    }
    throw error;
  }
  if (RAW_CONTENT.slice(1).some((rule) => rule.test(normalized))) {
    throw invalidCoordination('CREDENTIAL_PATTERN', field);
  }
  const scalarCount = [...normalized].length;
  const utf8Bytes = new TextEncoder().encode(normalized).byteLength;
  if (scalarCount === 0) throw invalidCoordination('EMPTY', field);
  if (field === 'purpose' && scalarCount > MAX_COORDINATION_PURPOSE_SCALARS) {
    throw invalidCoordination('PURPOSE_TOO_LONG', field);
  }
  if (field === 'body' && utf8Bytes > MAX_COORDINATION_BODY_BYTES) {
    throw invalidCoordination('BODY_TOO_LARGE', field);
  }
  return { normalized, scalarCount, utf8Bytes };
}

export function sanitizeCoordinationPurpose(input: string): SanitizedCoordinationContent {
  return sanitizeCoordinationContent(input, 'purpose');
}

export function sanitizeCoordinationBody(input: string): SanitizedCoordinationContent {
  return sanitizeCoordinationContent(input, 'body');
}

export function assertNoRawContent(fields: object): void {
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== 'string') continue;
    if (RAW_CONTENT.some((rule) => rule.test(value))) throw unsafe('UNSAFE_CONTENT', name);
  }
}

export function sanitizeSummary(input: string): string {
  if (input.length === 0 || input.length > MAX_SUMMARY) throw unsafe('UNSAFE_SUMMARY');
  if ([...RAW_CONTENT, ...RAW_SUMMARY].some((rule) => rule.test(input))) {
    throw unsafe('UNSAFE_SUMMARY');
  }
  return input;
}

const TEMPLATES = {
  launch_requested: 'Launch of {provider} requested',
  launched: '{provider} started with root pid {pid}',
  state_changed: 'State changed from {from} to {to}',
  interrupt_requested: 'Interrupt requested for {provider}',
  stop_requested: 'Stop requested for {provider}',
  force_stop_requested: 'Force stop requested for {provider}',
  output_truncated: 'Output discarded under pressure ({count} events so far)',
  reconciled: 'Reconciled from {from} to {to} at startup',
  recovery_resolved: 'Recovery record resolved as {resolution}',
  workspace_approved: 'Workspace approved',
  workspace_revoked: 'Workspace revoked',
  provider_exited: '{provider} exited with code {exitCode}',
  session_failed: 'Session failed: {reason}',
} as const;

export type SummaryTemplateId = keyof typeof TEMPLATES;
export const SUMMARY_TEMPLATE_IDS = Object.keys(TEMPLATES) as SummaryTemplateId[];

const COORDINATION_TEMPLATES = {
  handoff_queued: 'Handoff queued',
  delivery_changed: 'Delivery changed to {state}',
  conversation_changed: 'Conversation changed to {state}',
  outcome_recorded: 'Work outcome recorded as {outcome}',
  content_deleted: 'Conversation content deleted',
} as const;

export type CoordinationSummaryTemplateId = keyof typeof COORDINATION_TEMPLATES;
const COORDINATION_SUMMARY_KEYS = new Set(['state', 'outcome']);

const ALLOWED_KEYS = new Set([
  'provider',
  'from',
  'to',
  'pid',
  'count',
  'exitCode',
  'resolution',
  'reason',
]);
const SAFE_VALUE = /^[A-Za-z0-9 _.:\-/\\]{1,100}$/;

/** Builds a durable summary from a fixed template and allowlisted values only. */
export function safeTemplate(
  templateId: SummaryTemplateId,
  values: Record<string, string | number> = {},
): string {
  const template: string | undefined = TEMPLATES[templateId];
  if (!template) throw unsafe('UNKNOWN_TEMPLATE');
  let out = template;
  for (const [key, raw] of Object.entries(values)) {
    const value = String(raw);
    if (!ALLOWED_KEYS.has(key) || !SAFE_VALUE.test(value)) {
      throw unsafe('UNSAFE_TEMPLATE_VALUE', key);
    }
    out = out.replaceAll(`{${key}}`, value);
  }
  if (/\{[a-zA-Z]+\}/.test(out)) throw unsafe('MISSING_TEMPLATE_VALUE');
  return sanitizeSummary(out);
}

/** Builds content-free coordination evidence from a small fixed vocabulary. */
export function coordinationSafeSummary(
  templateId: CoordinationSummaryTemplateId,
  values: Record<string, string | number> = {},
): string {
  const template: string | undefined = COORDINATION_TEMPLATES[templateId];
  if (!template) throw unsafe('UNKNOWN_TEMPLATE');
  let out = template;
  for (const [key, raw] of Object.entries(values)) {
    const value = String(raw);
    if (!COORDINATION_SUMMARY_KEYS.has(key) || !SAFE_VALUE.test(value)) {
      throw unsafe('UNSAFE_TEMPLATE_VALUE', key);
    }
    out = out.replaceAll(`{${key}}`, value);
  }
  if (/\{[a-zA-Z]+\}/.test(out)) throw unsafe('MISSING_TEMPLATE_VALUE');
  return sanitizeSummary(out);
}
