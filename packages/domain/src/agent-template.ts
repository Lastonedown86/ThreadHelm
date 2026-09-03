/**
 * Pure policy for the reviewed agent-template wizard. Templates are local,
 * non-executable scaffolds: this module never resolves runtime permission,
 * tools, roles, workspaces, or a launch descriptor.
 */

import {
  AGENT_PROFILE_MANIFEST_SPEC,
  AgentManifestV1,
  ThreadHelmError,
  type AgentManifestV1 as AgentManifest,
} from '@threadhelm/contracts';

export interface TemplateProvenance {
  readonly templateId: string;
  readonly templateRevisionId: string;
}

export interface TemplateDraft {
  readonly provenance: TemplateProvenance | null;
  readonly manifest: AgentManifest;
}

export interface CreateTemplateDraftInput {
  readonly templateId?: string;
  readonly templateRevisionId?: string;
  readonly manifest: AgentManifest;
  readonly variables?: Readonly<Record<string, string>>;
}

export type TemplateDraftState = 'drafting' | 'completed' | 'deleted';

export const TEMPLATE_DRAFT_STATE_TRANSITIONS: Readonly<
  Record<TemplateDraftState, readonly TemplateDraftState[]>
> = {
  drafting: ['completed', 'deleted'],
  completed: [],
  deleted: [],
};

export function canTransitionTemplateDraftState(
  from: TemplateDraftState,
  to: TemplateDraftState,
): boolean {
  return TEMPLATE_DRAFT_STATE_TRANSITIONS[from].includes(to);
}

export function advanceTemplateDraftState(
  from: TemplateDraftState,
  to: TemplateDraftState,
): TemplateDraftState {
  if (from === to) return from;
  if (!canTransitionTemplateDraftState(from, to)) {
    throw new ThreadHelmError(
      'INVALID_STATE',
      `Illegal template draft transition ${from} -> ${to}`,
    );
  }
  return to;
}

const VARIABLE = /{{([a-z][a-z0-9_]*)}}/g;

function parseManifest(value: unknown): AgentManifest {
  const result = AgentManifestV1.safeParse(value);
  if (!result.success) {
    throw new ThreadHelmError(
      'PROFILE_SCHEMA_INVALID',
      'Template fields failed manifest validation.',
    );
  }
  return result.data;
}

export function applyTemplateVariables(
  value: string,
  values: Readonly<Record<string, string>>,
  declared: readonly string[],
): string {
  return value.replace(VARIABLE, (_match, variable: string) => {
    if (!declared.includes(variable) || typeof values[variable] !== 'string') {
      throw new ThreadHelmError(
        'TEMPLATE_VARIABLE_UNRESOLVED',
        'A template variable is undeclared or unresolved.',
      );
    }
    return values[variable];
  });
}

function unresolved(manifest: AgentManifest): boolean {
  const values = [
    manifest.name,
    manifest.description,
    manifest.model,
    manifest.goal,
    manifest.author,
  ];
  return values.some((value) => /{{[a-z][a-z0-9_]*}}/.test(value));
}

function substituteManifest(
  manifest: AgentManifest,
  variables: Readonly<Record<string, string>>,
): AgentManifest {
  const declared = Object.keys(variables);
  return parseManifest({
    ...manifest,
    name: applyTemplateVariables(manifest.name, variables, declared),
    description: applyTemplateVariables(manifest.description, variables, declared),
    model: applyTemplateVariables(manifest.model, variables, declared),
    goal: applyTemplateVariables(manifest.goal, variables, declared),
    author: applyTemplateVariables(manifest.author, variables, declared),
  });
}

export function createTemplateDraft(input: CreateTemplateDraftInput): TemplateDraft {
  const provenance =
    input.templateId && input.templateRevisionId
      ? { templateId: input.templateId, templateRevisionId: input.templateRevisionId }
      : null;
  if ((input.templateId === undefined) !== (input.templateRevisionId === undefined)) {
    throw new ThreadHelmError(
      'INVALID_REQUEST',
      'Template provenance must include an exact revision.',
    );
  }
  return {
    provenance,
    manifest: substituteManifest(parseManifest(input.manifest), input.variables ?? {}),
  };
}

/** Validates the exact shared agent-manifest schema before any save/export action. */
export function completeTemplateDraft(draft: TemplateDraft): AgentManifest {
  const manifest = parseManifest(draft.manifest);
  if (unresolved(manifest)) {
    throw new ThreadHelmError(
      'TEMPLATE_DRAFT_INCOMPLETE',
      'All template variables must be resolved before review.',
    );
  }
  // Completion produces newly reviewed ThreadHelm data, including resumed legacy drafts.
  // Parsing imports and reading historical revisions must preserve their original identifier.
  return { ...manifest, spec: AGENT_PROFILE_MANIFEST_SPEC };
}
