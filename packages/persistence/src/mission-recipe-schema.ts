/** Separate from profile templates; no source FK may cascade into copied drafts. */
export const RECIPE_TABLES = [
  {
    table: 'mission_recipe_origins',
    sql: `CREATE TABLE mission_recipe_origins (
      recipe_id TEXT PRIMARY KEY REFERENCES mission_recipes(id) ON DELETE CASCADE,
      source_recipe_id TEXT NOT NULL, source_revision_id TEXT NOT NULL,
      source_version INTEGER NOT NULL CHECK(source_version > 0)
    );`,
  },
  {
    table: 'mission_recipes',
    sql: `CREATE TABLE mission_recipes (
    id TEXT PRIMARY KEY, origin TEXT NOT NULL CHECK(origin IN ('bundled','personal')),
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    version INTEGER NOT NULL CHECK(version > 0), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
    current_revision_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`,
  },
  {
    table: 'mission_recipe_revisions',
    sql: `CREATE TABLE mission_recipe_revisions (
    id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL REFERENCES mission_recipes(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK(ordinal > 0), digest TEXT NOT NULL CHECK(length(digest)=64),
    content TEXT NOT NULL CHECK(length(CAST(content AS BLOB)) <= 1048576),
    authored_at TEXT NOT NULL, UNIQUE(recipe_id, ordinal)
  );`,
  },
  {
    table: 'mission_recipe_editor_drafts',
    sql: `CREATE TABLE mission_recipe_editor_drafts (
    id TEXT PRIMARY KEY, version INTEGER NOT NULL CHECK(version > 0),
    base_recipe_id TEXT, content TEXT NOT NULL CHECK(length(CAST(content AS BLOB)) <= 1048576),
    updated_at TEXT NOT NULL
  );`,
  },
  {
    table: 'mission_draft_recipe_context',
    sql: `CREATE TABLE mission_draft_recipe_context (
    draft_id TEXT PRIMARY KEY REFERENCES mission_composer_drafts(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK(length(CAST(content AS BLOB)) <= 1048576)
  );`,
  },
  {
    table: 'mission_recipe_operation_receipts',
    sql: `CREATE TABLE mission_recipe_operation_receipts (
    request_id TEXT PRIMARY KEY, request_digest TEXT NOT NULL CHECK(length(request_digest)=64),
    content TEXT NOT NULL CHECK(length(CAST(content AS BLOB)) <= 2048)
  );`,
  },
] as const;
export const V6_MISSION_RECIPES = RECIPE_TABLES.map((table) => table.sql).join('\n');
