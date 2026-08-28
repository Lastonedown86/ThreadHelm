/**
 * Renderer state. Event-driven only: one initial load, then contract events.
 * No polling, no timers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ApplicationInfoView,
  ApprovedWorkspaceView,
  InterruptOutcome,
  ProviderId,
  ReadinessView,
  RecoveryRecordView,
  SessionView,
} from '@threadhelm/contracts';
import { api, call } from './api.js';
import { recordTruncation, type TruncationState } from './features/session/buffer.js';
import { installTerminalHooks, subscribeOutput } from './features/session/terminals.js';
import { describeError } from './features/launch/LaunchErrors.js';

export interface LaunchRequest {
  workspaceId: string;
  providerId: ProviderId;
  /** Set when the launch supersedes a recovery record. */
  recoveryRecordId?: string;
}

export interface State {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  sessions: Record<string, SessionView>;
  sessionOrder: string[];
  recoveryRecords: RecoveryRecordView[];
  selectedSessionId: string | null;
  unread: Record<string, boolean>;
  truncation: TruncationState;
  streamFailed: Record<string, string>;
  inputNotice: Record<string, string>;
  interruptResults: Record<string, InterruptOutcome>;
  storageDegraded: boolean;
  powerNotice: string | null;
  closeBlocked: SessionView[] | null;
  appInfo: ApplicationInfoView | null;
  launchRequest: LaunchRequest | null;
  notice: string | null;
}

const initial: State = {
  workspaces: [],
  readiness: [],
  sessions: {},
  sessionOrder: [],
  recoveryRecords: [],
  selectedSessionId: null,
  unread: {},
  truncation: {},
  streamFailed: {},
  inputNotice: {},
  interruptResults: {},
  storageDegraded: false,
  powerNotice: null,
  closeBlocked: null,
  appInfo: null,
  launchRequest: null,
  notice: null,
};

type Action =
  | {
      type: 'loaded';
      workspaces: ApprovedWorkspaceView[];
      readiness: ReadinessView[];
      sessions: SessionView[];
      recoveryRecords: RecoveryRecordView[];
      storageDegraded: boolean;
      appInfo: ApplicationInfoView;
    }
  | { type: 'workspace'; workspace: ApprovedWorkspaceView }
  | { type: 'readiness'; readiness: ReadinessView }
  | { type: 'session'; session: SessionView }
  | {
      type: 'activity';
      sessionId: string;
      activityState: SessionView['activityState'];
      evidenceKind: string;
      observedAt: string | null;
    }
  | { type: 'truncated'; sessionId: string; count: number }
  | { type: 'interrupt'; sessionId: string; outcome: InterruptOutcome }
  | { type: 'recovery'; record: RecoveryRecordView }
  | { type: 'power'; notice: string }
  | { type: 'storage'; degraded: boolean }
  | { type: 'closeBlocked'; sessions: SessionView[] | null }
  | { type: 'select'; sessionId: string | null }
  | { type: 'unread'; sessionId: string }
  | { type: 'streamFailed'; sessionId: string; reason: string }
  | { type: 'inputNotice'; sessionId: string; notice: string | null }
  | { type: 'launchRequest'; request: LaunchRequest | null }
  | { type: 'notice'; notice: string | null };

function upsertSession(state: State, session: SessionView): State {
  const known = session.id in state.sessions;
  return {
    ...state,
    sessions: { ...state.sessions, [session.id]: session },
    sessionOrder: known ? state.sessionOrder : [session.id, ...state.sessionOrder],
  };
}

function upsertBy<T>(list: T[], item: T, key: (value: T) => string): T[] {
  const index = list.findIndex((entry) => key(entry) === key(item));
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded': {
      const sessions: Record<string, SessionView> = {};
      for (const session of action.sessions) sessions[session.id] = session;
      return {
        ...state,
        workspaces: action.workspaces,
        readiness: action.readiness,
        sessions,
        sessionOrder: action.sessions.map((session) => session.id),
        recoveryRecords: action.recoveryRecords,
        storageDegraded: action.storageDegraded,
        appInfo: action.appInfo,
      };
    }
    case 'workspace':
      return { ...state, workspaces: upsertBy(state.workspaces, action.workspace, (w) => w.id) };
    case 'readiness':
      return {
        ...state,
        readiness: upsertBy(state.readiness, action.readiness, (r) => r.providerId),
      };
    case 'session':
      return upsertSession(state, action.session);
    case 'activity': {
      const session = state.sessions[action.sessionId];
      if (!session) return state;
      return upsertSession(state, {
        ...session,
        activityState: action.activityState,
        activityEvidenceKind: action.evidenceKind,
        activityObservedAt: action.observedAt,
      });
    }
    case 'truncated':
      return {
        ...state,
        truncation: recordTruncation(state.truncation, action.sessionId, action.count),
      };
    case 'interrupt':
      return {
        ...state,
        interruptResults: { ...state.interruptResults, [action.sessionId]: action.outcome },
      };
    case 'recovery':
      return {
        ...state,
        recoveryRecords: upsertBy(state.recoveryRecords, action.record, (r) => r.id),
      };
    case 'power':
      return { ...state, powerNotice: action.notice };
    case 'storage':
      return { ...state, storageDegraded: action.degraded };
    case 'closeBlocked':
      return { ...state, closeBlocked: action.sessions };
    case 'select':
      return {
        ...state,
        selectedSessionId: action.sessionId,
        unread: action.sessionId ? { ...state.unread, [action.sessionId]: false } : state.unread,
      };
    case 'unread':
      if (action.sessionId === state.selectedSessionId) return state;
      return { ...state, unread: { ...state.unread, [action.sessionId]: true } };
    case 'streamFailed':
      return {
        ...state,
        streamFailed: { ...state.streamFailed, [action.sessionId]: action.reason },
      };
    case 'inputNotice': {
      const inputNotice = { ...state.inputNotice };
      if (action.notice === null) delete inputNotice[action.sessionId];
      else inputNotice[action.sessionId] = action.notice;
      return { ...state, inputNotice };
    }
    case 'launchRequest':
      return { ...state, launchRequest: action.request };
    case 'notice':
      return { ...state, notice: action.notice };
  }
}

export interface Actions {
  refresh(): Promise<void>;
  select(sessionId: string | null): void;
  openLaunch(request: LaunchRequest | null): void;
  setNotice(notice: string | null): void;
  dismissCloseBlocked(): void;
  sessionAdded(session: SessionView): void;
  recoveryChanged(record: RecoveryRecordView): void;
  workspaceChanged(workspace: ApprovedWorkspaceView): void;
}

const StoreContext = createContext<{ state: State; actions: Actions } | null>(null);

const LIVE: ReadonlySet<SessionView['lifecycleState']> = new Set([
  'starting',
  'running',
  'interrupting',
  'stopping',
]);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = state.selectedSessionId;

  const refresh = useCallback(async () => {
    try {
      const [workspaces, readiness, list, appInfo] = await Promise.all([
        call(api.workspaces.list(undefined)),
        call(api.providers.listReadiness(undefined)),
        call(api.sessions.list(undefined)),
        call(api.application.getInfo(undefined)),
      ]);
      dispatch({
        type: 'loaded',
        workspaces,
        readiness,
        sessions: list.sessions,
        recoveryRecords: list.recoveryRecords,
        storageDegraded: list.storageDegraded || appInfo.storageDegraded,
        appInfo,
      });
      for (const session of list.sessions) {
        if (LIVE.has(session.lifecycleState)) subscribeOutput(session.id);
      }
    } catch (error) {
      dispatch({ type: 'notice', notice: describeError(error) });
    }
  }, []);

  useEffect(() => {
    const uninstall = installTerminalHooks({
      isSelected: (sessionId) => selectedRef.current === sessionId,
      onOutput: (sessionId) => dispatch({ type: 'unread', sessionId }),
      onTruncated: (sessionId, count) => dispatch({ type: 'truncated', sessionId, count }),
      onStreamFailure: (sessionId, reason) => dispatch({ type: 'streamFailed', sessionId, reason }),
      onInputRejected: (sessionId, code) =>
        dispatch({
          type: 'inputNotice',
          sessionId,
          notice:
            code === 'INPUT_BLOCKED'
              ? 'This session no longer accepts input.'
              : code === 'NOT_SELECTED'
                ? 'Input is only routed to the selected session.'
                : code === 'BACKPRESSURE'
                  ? 'Output is catching up; input was not accepted. Try again.'
                  : `Input was rejected (${code}).`,
        }),
    });
    const offs = [
      api.on('workspace.changed', (workspace) => dispatch({ type: 'workspace', workspace })),
      api.on('provider.readinessChanged', (readiness) =>
        dispatch({ type: 'readiness', readiness }),
      ),
      api.on('session.changed', ({ session }) => {
        dispatch({ type: 'session', session });
        if (LIVE.has(session.lifecycleState)) subscribeOutput(session.id);
      }),
      api.on('session.activityChanged', (payload) =>
        dispatch({
          type: 'activity',
          sessionId: payload.sessionId,
          activityState: payload.activityState,
          evidenceKind: payload.evidenceKind,
          observedAt: payload.observedAt,
        }),
      ),
      api.on('session.outputTruncated', ({ sessionId, truncationCount }) =>
        dispatch({ type: 'truncated', sessionId, count: truncationCount }),
      ),
      api.on('session.interruptResult', ({ sessionId, outcome }) =>
        dispatch({ type: 'interrupt', sessionId, outcome }),
      ),
      api.on('recovery.changed', (record) => dispatch({ type: 'recovery', record })),
      api.on('application.powerChanged', ({ event, reconciled, recoveryRequired }) =>
        dispatch({
          type: 'power',
          notice: `Windows ${event}: ${reconciled} session(s) rechecked, ${recoveryRequired} need recovery. Nothing was restarted or replayed.`,
        }),
      ),
      api.on('application.storageHealth', ({ degraded }) =>
        dispatch({ type: 'storage', degraded }),
      ),
      api.on('application.closeBlocked', ({ activeSessions }) =>
        dispatch({ type: 'closeBlocked', sessions: activeSessions }),
      ),
    ];
    void refresh();
    return () => {
      for (const off of offs) off();
      uninstall();
    };
    // selectedRef is a plain object updated on every render; hooks read it live.
  }, [refresh]);

  const actions = useMemo<Actions>(
    () => ({
      refresh,
      select: (sessionId) => {
        dispatch({ type: 'select', sessionId });
        void call(api.sessions.select({ sessionId })).catch(() => undefined);
      },
      openLaunch: (request) => dispatch({ type: 'launchRequest', request }),
      setNotice: (notice) => dispatch({ type: 'notice', notice }),
      dismissCloseBlocked: () => dispatch({ type: 'closeBlocked', sessions: null }),
      sessionAdded: (session) => {
        dispatch({ type: 'session', session });
        subscribeOutput(session.id);
      },
      recoveryChanged: (record) => dispatch({ type: 'recovery', record }),
      workspaceChanged: (workspace) => dispatch({ type: 'workspace', workspace }),
    }),
    [refresh],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreProvider');
  return store;
}
