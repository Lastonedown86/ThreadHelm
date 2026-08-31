/** Build/package guard only; this module is never part of the shipped runtime. */
import { closeSync, openSync, readSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PRIVATE_PERSONA =
  /MARVEL_ROSTER_FIXTURES|Black Panther|Captain America|Doctor Strange|Maria Hill|Nick Fury|She-Hulk|Shuri|Spider-Man|War Machine|["']?name["']?\s*:\s*["']Vision["']/;

export function assertNoPrivatePersonaText(content: string, artifact: string): void {
  if (PRIVATE_PERSONA.test(content)) {
    throw new Error(`Production artifact contains private persona content: ${artifact}`);
  }
}

/** Bounded reads also inspect Windows UTF-16 data and signatures split between chunks. */
export function assertNoPrivatePersonaFile(path: string): void {
  const file = openSync(path, 'r');
  const chunk = Buffer.alloc(1024 * 1024);
  let tail = Buffer.alloc(0);
  try {
    let count: number;
    while ((count = readSync(file, chunk, 0, chunk.length, null)) > 0) {
      const bytes = Buffer.concat([tail, chunk.subarray(0, count)]);
      assertNoPrivatePersonaText(bytes.toString('utf8'), path);
      assertNoPrivatePersonaText(bytes.toString('utf16le'), path);
      // An ASAR entry can begin at either byte alignment.
      // Copy before decoding: Windows Node 24 can corrupt its native heap when
      // UTF-16 conversion reads a Buffer view with an unaligned byte offset.
      assertNoPrivatePersonaText(Buffer.from(bytes.subarray(1)).toString('utf16le'), path);
      tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 2048)));
    }
  } finally {
    closeSync(file);
  }
}

/** Scan every copied asset, including stale chunks and extensionless dependency data. */
export function assertProductionPersonaBoundary(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unresolved package asset link: ${path}`);
    if (entry.isDirectory()) assertProductionPersonaBoundary(path);
    else if (entry.isFile()) {
      assertNoPrivatePersonaFile(path);
    }
  }
}
