import { z } from 'zod';

export const Uuid = z.uuid();
/** Plain `Uint8Array` (any buffer kind) — structured-clone safe across IPC. */
export const Bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');
