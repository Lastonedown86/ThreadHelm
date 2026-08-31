import { z } from 'zod';
import { Bytes, Uuid } from './primitives.js';
import { MAX_FRAME_BYTES } from './limits.js';

export const OutputFrame = z.object({
  kind: z.literal('output'),
  sessionId: Uuid,
  sequence: z.number().int().min(1),
  bytes: Bytes.refine((b) => b.byteLength <= MAX_FRAME_BYTES, {
    message: 'frame exceeds MAX_FRAME_BYTES',
  }),
});
export type OutputFrame = z.infer<typeof OutputFrame>;

export const OutputAck = z.object({
  kind: z.literal('ack'),
  sessionId: Uuid,
  throughSequence: z.number().int().min(0),
});
export type OutputAck = z.infer<typeof OutputAck>;

/** Sent by the host when output had to be discarded; count is cumulative. */
export const OutputTruncated = z.object({
  kind: z.literal('truncated'),
  sessionId: Uuid,
  truncationCount: z.number().int().min(1),
});
export type OutputTruncated = z.infer<typeof OutputTruncated>;

export const StreamFrame = z.discriminatedUnion('kind', [OutputFrame, OutputAck, OutputTruncated]);
export type StreamFrame = z.infer<typeof StreamFrame>;
