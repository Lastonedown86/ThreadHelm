import type { OperationResponse } from '@threadhelm/contracts';

export function templateLabel(
  template: OperationResponse<'agentTemplates.list'>['templates'][number],
): string {
  return `${template.name.charAt(0).toUpperCase()}${template.name.slice(1)} (${template.origin === 'bundled' ? 'bundled' : 'local'})`;
}
