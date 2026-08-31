// NONSHIPPING: real renderer with static, empty, in-memory responses only.
// No Electron preload, Tauri command, provider launch or filesystem bridge exists.
const responses: Record<string, unknown> = {
  'workspaces.list': [],
  'providers.listReadiness': [],
  'sessions.list': { sessions: [], recoveryRecords: [], storageDegraded: false },
  'application.getInfo': {
    version: 'PROTOTYPE',
    electronVersion: 'none (mock bridge)',
    arch: 'x64',
    storageDegraded: false,
  },
  'coordination.listHandoffs': { handoffs: [], storageDegraded: false },
  'coordination.listConversations': { conversations: [] },
  'profiles.list': { profiles: [] },
  'agentTemplates.list': { templates: [], nextCursor: null },
  'agentWizard.listDrafts': { drafts: [] },
  'missions.list': [],
};
const bridge: Record<string, unknown> = {
  on: () => () => {},
  streamPortChannel: 'prototype-no-stream',
};
for (const [operation, response] of Object.entries(responses)) {
  const [namespace, method] = operation.split('.');
  bridge[namespace] ??= {};
  (bridge[namespace] as Record<string, unknown>)[method] = async () => ({
    ok: true,
    value: response,
  });
}
for (const namespace of Object.keys(bridge)) {
  if (typeof bridge[namespace] !== 'object') continue;
  bridge[namespace] = new Proxy(bridge[namespace] as object, {
    get(target, key) {
      return (
        Reflect.get(target, key) ??
        (async () => ({
          ok: false,
          error: { code: 'PROTOTYPE_READ_ONLY', message: 'No authority exists in this prototype.' },
        }))
      );
    },
  });
}
Object.defineProperty(window, 'threadhelm', { value: Object.freeze(bridge), writable: false });
await import('../../../apps/desktop/src/renderer/main.tsx');
const observer = new MutationObserver(() => {
  if (!document.querySelector('.status-bar')?.textContent?.includes('PROTOTYPE')) return;
  if (!document.querySelector('.workspace-main h1')) return;
  observer.disconnect();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.title = 'TH-PROTOTYPE-RENDERED';
    }),
  );
});
observer.observe(document.querySelector('#root')!, {
  childList: true,
  subtree: true,
  characterData: true,
});
