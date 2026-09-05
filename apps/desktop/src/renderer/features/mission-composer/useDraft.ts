import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MissionComposerDraftDetailView,
  MissionComposerFields,
  MissionComposerSaveReceipt,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { fieldsForSave, type Stage } from './composer-fields.js';
import { createDraftSaveQueue } from './draft-save-queue.js';

const SAVE_DELAY_MS = 800;

export interface DraftFailure {
  code: string;
  savedElsewhere?: MissionComposerDraftDetailView;
}

export function useDraft(draftId: string) {
  const [draft, setDraft] = useState<MissionComposerDraftDetailView | null>(null);
  const [fields, setFieldsState] = useState<MissionComposerFields>({});
  const [stage, setStage] = useState<Stage>('outcome');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<DraftFailure | null>(null);
  const [receipt, setReceipt] = useState<MissionComposerSaveReceipt | null>(null);
  const version = useRef(0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedReceipt = useRef<MissionComposerSaveReceipt | null>(null);
  const latest = useRef<{ fields: MissionComposerFields; stage: Stage }>({
    fields: {},
    stage: 'outcome',
  });

  useEffect(() => {
    let cancelled = false;
    void call(api.missionComposer.getDraft({ draftId }))
      .then((loaded) => {
        if (cancelled) return;
        setDraft(loaded);
        setFieldsState(loaded.fieldValues);
        setStage(loaded.currentStage);
        version.current = loaded.version;
        savedReceipt.current = {
          draftId,
          version: loaded.version,
          savedAt: loaded.updatedAt,
          currentStage: loaded.currentStage,
        };
        latest.current = { fields: loaded.fieldValues, stage: loaded.currentStage };
      })
      .catch((cause) => {
        if (!cancelled) setFailure({ code: errorCode(cause) });
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draftId]);

  const performSave = useCallback(async (): Promise<MissionComposerSaveReceipt | null> => {
    const snapshot = latest.current;
    setSaving(true);
    try {
      const saved = await call(
        api.missionComposer.updateDraft({
          draftId,
          expectedVersion: version.current,
          fieldValues: fieldsForSave(snapshot.fields),
          currentStage: snapshot.stage,
        }),
      );
      version.current = saved.version;
      dirty.current = latest.current !== snapshot;
      savedReceipt.current = saved;
      setReceipt(saved);
      setFailure(null);
      return saved;
    } catch (cause) {
      // An edit during the failed request may have scheduled another debounce.
      // Stop it so a failure waits for a deliberate retry or a new edit.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const code = errorCode(cause);
      if (code === 'MISSION_DRAFT_STALE') {
        const elsewhere = await call(api.missionComposer.getDraft({ draftId })).catch(() => null);
        setFailure({ code, ...(elsewhere ? { savedElsewhere: elsewhere } : {}) });
      } else setFailure({ code });
      return null;
    } finally {
      setSaving(false);
    }
  }, [draftId]);

  const flush = useMemo(
    () => createDraftSaveQueue(performSave, () => dirty.current),
    [performSave],
  );
  const saveNow = useCallback(async (): Promise<MissionComposerSaveReceipt | null> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // No editor is exposed before hydration. Never write defaults over a draft
    // whose initial read has not completed (or failed).
    if (!savedReceipt.current) return null;
    if (!dirty.current) return savedReceipt.current;
    return flush();
  }, [flush]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
  }, [saveNow]);

  const setFields = useCallback(
    (patch: Partial<MissionComposerFields>) => {
      const next = { ...latest.current.fields, ...patch };
      latest.current = { ...latest.current, fields: next };
      setFieldsState(next);
      dirty.current = true;
      schedule();
    },
    [schedule],
  );

  const goTo = useCallback(
    async (next: Stage) => {
      latest.current = { ...latest.current, stage: next };
      dirty.current = true;
      const saved = await saveNow();
      if (saved) setStage(next);
      return saved !== null;
    },
    [saveNow],
  );

  const useSavedVersion = useCallback(() => {
    const elsewhere = failure?.savedElsewhere;
    if (!elsewhere) return;
    setFieldsState(elsewhere.fieldValues);
    setStage(elsewhere.currentStage);
    version.current = elsewhere.version;
    savedReceipt.current = {
      draftId,
      version: elsewhere.version,
      savedAt: elsewhere.updatedAt,
      currentStage: elsewhere.currentStage,
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = { fields: elsewhere.fieldValues, stage: elsewhere.currentStage };
    dirty.current = false;
    setFailure(null);
  }, [failure, draftId]);

  const keepMyEdits = useCallback(() => {
    const elsewhere = failure?.savedElsewhere;
    if (!elsewhere) return;
    version.current = elsewhere.version;
    dirty.current = true;
    setFailure(null);
    void saveNow();
  }, [failure, saveNow]);

  return {
    draft,
    fields,
    setFields,
    stage,
    goTo,
    saveNow,
    saving,
    failure,
    receipt,
    version: () => version.current,
    retry: saveNow,
    useSavedVersion,
    keepMyEdits,
  };
}
