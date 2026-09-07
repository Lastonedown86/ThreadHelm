import { useEffect, useRef, useState } from 'react';
import type { OperationResponse } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { ModalDialog } from '../coordination/ModalDialog.js';
import { STAGE_LABEL } from './composer-fields.js';

export function DiscardMissionDraft({
  draftId,
  onClose,
  onDiscarded,
}: {
  draftId: string;
  onClose(): void;
  onDiscarded(): void;
}) {
  const [review, setReview] = useState<{
    draft: OperationResponse<'missionComposer.getDraft'>;
    token: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [generation, setGeneration] = useState(0);
  const submitting = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReview(null);
    setError(null);
    void (async () => {
      try {
        const draft = await call(api.missionComposer.getDraft({ draftId }));
        const preview = await call(
          api.missionComposer.previewDiscard({ draftId, version: draft.version }),
        );
        if (!cancelled) setReview({ draft, token: preview.discardToken });
      } catch {
        if (!cancelled)
          setError(
            'The draft could not be reviewed. Nothing was discarded. Review again or keep the draft.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, generation]);
  const discard = async () => {
    if (!review || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      await call(
        api.missionComposer.confirmDiscard({
          draftId,
          version: review.draft.version,
          discardToken: review.token,
        }),
      );
      onDiscarded();
    } catch {
      setReview(null);
      setError(
        'Discard was not confirmed. The draft may have changed or the review expired. Review again to check its current state.',
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <ModalDialog
      label="Discard mission draft?"
      onDismiss={() => {
        if (!submitting.current) onClose();
      }}
    >
      <h2>Discard mission draft?</h2>
      <p>This permanently deletes this saved draft. Missions and sessions are unaffected.</p>
      <p className="draft-discard-identity">
        {review?.draft.fieldValues.objective || 'Untitled mission draft'}
      </p>
      <p className="draft-discard-identity">
        Draft {draftId}
        {review ? ` · ${STAGE_LABEL[review.draft.currentStage]}` : ''}
      </p>
      {loading ? <p role="status">Loading current draft review…</p> : null}
      {pending ? <p role="status">Discarding draft…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="actions">
        <button type="button" disabled={pending} onClick={onClose}>
          Keep draft
        </button>
        {error ? (
          <button type="button" onClick={() => setGeneration((value) => value + 1)}>
            Review again
          </button>
        ) : null}
        <button
          type="button"
          className="danger"
          disabled={!review || loading || pending}
          onClick={() => void discard()}
        >
          Discard draft
        </button>
      </div>
    </ModalDialog>
  );
}
