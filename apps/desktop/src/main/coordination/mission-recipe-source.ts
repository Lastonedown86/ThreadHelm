import {
  MissionRecipeSourceContent,
  type MissionRecipeEditor,
  type OperationRequest,
} from '@threadhelm/contracts';
import { recipeFailure, type MissionRecipeRepository } from '@threadhelm/persistence';

/** Reads only approved inert fields; never inspect assignments or runtime configuration. */
export function extractRecipeSource(
  repo: MissionRecipeRepository,
  request: OperationRequest<'missionRecipes.previewSource'>,
): MissionRecipeEditor['content'] {
  const source = repo.sourceContent(request.source);
  const content = {
    name: '',
    description: '',
    outcomeScaffold: request.fields.includes('objective') ? source.objective : '',
    acceptanceChecklist: request.fields.includes('completionEvidence')
      ? source.completionEvidence.split(/\r?\n/)
      : [],
    suggestedRoles: request.fields.includes('suggestedRoles') ? source.suggestedRoles : [],
    variables: [],
  };
  const parsed = MissionRecipeSourceContent.safeParse(content);
  if (!parsed.success) recipeFailure('FIELD_LIMIT');
  return parsed.data;
}
