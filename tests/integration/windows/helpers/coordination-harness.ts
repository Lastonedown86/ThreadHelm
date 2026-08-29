/** Small coordination-only additions on top of the shared Windows harness. */

import Database from 'better-sqlite3';
import type { PowerEvent, ProviderId } from '@threadhelm/contracts';

export interface FixtureSessionRef {
  readonly id: string;
  readonly providerId: ProviderId;
  readonly workspaceId: string;
}

export interface CoordinationDatabaseSnapshot {
  readonly path: string;
  readonly tables: Readonly<Record<string, number>>;
}

/** Minimal app surface keeps this helper usable with LaunchedApp and small fakes. */
export interface CoordinationTestApp {
  /** LaunchedApp-compatible ElectronApplication evaluator for storagePath. */
  readonly app?: { evaluate<T>(pageFunction: () => T): Promise<T> };
  readonly crashCoordinator?: () => Promise<void>;
  readonly simulatePower?: (event: PowerEvent) => Promise<void>;
  readonly storagePath?: () => Promise<string>;
}

const COORDINATION_TABLES = [
  'conversations',
  'handoffs',
  'delivery_attempts',
  'coordination_events',
  'escalations',
] as const;

export class CoordinationHarness {
  readonly #app: CoordinationTestApp;
  readonly #sessions = new Map<string, FixtureSessionRef>();

  constructor(app: CoordinationTestApp) {
    this.#app = app;
  }

  registerSession(session: FixtureSessionRef): void {
    this.#sessions.set(session.id, session);
  }

  session(id: string): FixtureSessionRef | undefined {
    return this.#sessions.get(id);
  }

  sessionIds(): string[] {
    return [...this.#sessions.keys()];
  }

  async crashBoundary(): Promise<void> {
    if (!this.#app.crashCoordinator) throw new Error('crash boundary is unavailable');
    await this.#app.crashCoordinator();
  }

  async powerBoundary(event: PowerEvent): Promise<void> {
    if (!this.#app.simulatePower) throw new Error('power boundary is unavailable');
    await this.#app.simulatePower(event);
  }

  lockBoundary(): Promise<void> {
    return this.powerBoundary('lock');
  }

  suspendBoundary(): Promise<void> {
    return this.powerBoundary('suspend');
  }

  resumeBoundary(): Promise<void> {
    return this.powerBoundary('resume');
  }

  unlockBoundary(): Promise<void> {
    return this.powerBoundary('unlock');
  }

  async databaseSnapshot(): Promise<CoordinationDatabaseSnapshot> {
    const path = this.#app.storagePath
      ? await this.#app.storagePath()
      : this.#app.app
        ? await this.#app.app.evaluate(() =>
            (
              globalThis as unknown as { __threadhelmTest: { storagePath(): string } }
            ).__threadhelmTest.storagePath(),
          )
        : null;
    if (!path) throw new Error('database inspection is unavailable');
    const db = new Database(path, { readonly: true, fileMustExist: true });
    try {
      const tables: Record<string, number> = {};
      for (const table of COORDINATION_TABLES) {
        const exists = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(table);
        if (exists) {
          tables[table] = (
            db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number }
          ).count;
        }
      }
      return { path, tables };
    } finally {
      db.close();
    }
  }
}
