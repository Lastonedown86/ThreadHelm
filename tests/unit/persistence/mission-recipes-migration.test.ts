import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, readSchemaVersion, MIGRATIONS } from '@threadhelm/persistence';

const tables = [
  'mission_recipes',
  'mission_recipe_revisions',
  'mission_recipe_editor_drafts',
  'mission_draft_recipe_context',
  'mission_recipe_operation_receipts',
];
describe('mission recipe migration', () => {
  it('adds version 6 tables and converges after repeated startup', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);
      expect(readSchemaVersion(db)).toBe(6);
      for (const name of tables)
        expect(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name)).toBeTruthy();
      migrate(db);
      expect(readSchemaVersion(db)).toBe(6);
      for (const name of [...tables].reverse()) db.exec(`DROP TABLE ${name}`);
      migrate(db);
      for (const name of tables)
        expect(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name)).toBeTruthy();
    } finally {
      db.close();
    }
  });
  it('upgrades v5 without changing independent existing data', () => {
    const db = openDatabase(':memory:');
    try {
      for (const migration of MIGRATIONS.filter((m) => m.version <= 5)) db.exec(migration.sql);
      db.exec(
        "DELETE FROM schema_meta; INSERT INTO schema_meta VALUES (5); CREATE TABLE preserved (value TEXT); INSERT INTO preserved VALUES ('keep')",
      );
      migrate(db);
      expect(readSchemaVersion(db)).toBe(6);
      expect(db.prepare('SELECT value FROM preserved').get()).toEqual({ value: 'keep' });
    } finally {
      db.close();
    }
  });
  it('rolls back the entire migration on a conflicting schema', () => {
    const db = openDatabase(':memory:');
    try {
      for (const migration of MIGRATIONS.filter((m) => m.version <= 5)) db.exec(migration.sql);
      db.exec(
        'DELETE FROM schema_meta; INSERT INTO schema_meta VALUES (5); CREATE TABLE mission_recipe_revisions (sentinel TEXT)',
      );
      expect(() => migrate(db)).toThrow();
      expect(readSchemaVersion(db)).toBe(5);
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE name='mission_recipes'").get(),
      ).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
