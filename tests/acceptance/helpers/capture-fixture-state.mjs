// Read-only lifecycle evidence from the private fixture profile, never owner data.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import Database from 'better-sqlite3';

const [rootArgument, phase] = process.argv.slice(2);
if (!rootArgument || !/^(baseline|cycle-[1-5]-(active|stopped)|final)$/.test(phase ?? '')) {
  throw new Error('FIXTURE_EVIDENCE_ARGUMENTS');
}
const allowedRoot = resolve(import.meta.dirname, '../../../tmp/us8');
const root = resolve(rootArgument);
const child = relative(allowedRoot, root);
if (isAbsolute(child) || child.includes('..') || !/^t173-fixtures-[a-f0-9]+$/.test(child)) {
  throw new Error('FIXTURE_EVIDENCE_BOUNDARY');
}
const identity = JSON.parse(readFileSync(join(root, 'identity.json'), 'utf8'));
const database = new Database(join(root, 'user-data/threadhelm.sqlite'), {
  readonly: true,
  fileMustExist: true,
});
try {
  const sessions = database
    .prepare(
      `SELECT id, lifecycle_state, host_pid, root_pid,
    started_at, ended_at, exit_code, stop_kind FROM agent_sessions ORDER BY created_at`,
    )
    .all();
  const readiness = database
    .prepare(
      `SELECT resolved_executable FROM agent_readiness_snapshots
    WHERE resolved_executable IS NOT NULL`,
    )
    .all();
  if (
    readiness.some(
      (row) => row.resolved_executable.toLowerCase() !== identity.FixtureExecutable.toLowerCase(),
    )
  ) {
    throw new Error('UNEXPECTED_PROVIDER_EXECUTABLE');
  }
  const result = {
    phase,
    recordedAt: new Date().toISOString(),
    fixtureSimulation: true,
    liveProvider: false,
    sessions,
  };
  writeFileSync(join(root, `${phase}-lifecycle.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  database.close();
}
