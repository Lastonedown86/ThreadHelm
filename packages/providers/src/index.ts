import type { ProviderId } from '@threadhelm/contracts';
import { ThreadHelmError } from '@threadhelm/contracts';
import type { ProviderAdapter } from './adapter.js';
import { claudeCodeAdapter } from './claude-code.js';
import { codexAdapter } from './codex.js';

export * from './adapter.js';
export { claudeCodeAdapter } from './claude-code.js';
export { codexAdapter } from './codex.js';

export const builtInAdapters: readonly ProviderAdapter[] = [codexAdapter, claudeCodeAdapter];

export function adapterById(id: ProviderId): ProviderAdapter {
  const adapter = builtInAdapters.find((a) => a.id === id);
  if (!adapter) {
    throw new ThreadHelmError('PROVIDER_UNAVAILABLE', 'Unknown provider.', { providerId: id });
  }
  return adapter;
}
