import Database from "better-sqlite3";

const db = new Database("events.db");

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  path TEXT,
  filename TEXT,
  language TEXT,
  category TEXT,
  test_name TEXT,
  cycle INTEGER,
  loc_added INTEGER,
  loc_removed INTEGER,
  loc_total INTEGER,
  functions INTEGER,
  conditionals INTEGER,
  classes INTEGER,
  complexity INTEGER,
  halstead_volume INTEGER DEFAULT 0,
  maintainability_index INTEGER DEFAULT 100,
  nesting_depth INTEGER DEFAULT 0,
  max_params INTEGER DEFAULT 0,
  tests_passed INTEGER,
  tests_failed INTEGER,
  tests_total INTEGER,
  tests_unavailable INTEGER DEFAULT 0,
  top_failures TEXT DEFAULT '[]',
  tests_duration_ms INTEGER DEFAULT 0,
  new_tests TEXT,
  test_loc_added INTEGER,
  test_loc_removed INTEGER,
  test_loc_total INTEGER,
  test_functions INTEGER,
  test_conditionals INTEGER,
  test_classes INTEGER,
  test_complexity INTEGER,
  test_halstead_volume INTEGER DEFAULT 0,
  test_maintainability_index INTEGER DEFAULT 100,
  test_nesting_depth INTEGER DEFAULT 0,
  test_max_params INTEGER DEFAULT 0,
  prod_loc_added INTEGER,
  prod_loc_removed INTEGER,
  prod_loc_total INTEGER,
  prod_functions INTEGER,
  prod_conditionals INTEGER,
  prod_classes INTEGER,
  prod_complexity INTEGER,
  prod_halstead_volume INTEGER DEFAULT 0,
  prod_maintainability_index INTEGER DEFAULT 100,
  prod_nesting_depth INTEGER DEFAULT 0,
  prod_max_params INTEGER DEFAULT 0,
  test_file_count INTEGER DEFAULT 0,
  prod_file_count INTEGER DEFAULT 0,
  mutation_status TEXT DEFAULT 'queued',
  mutation_targets INTEGER DEFAULT 0,
  mutation_killed INTEGER DEFAULT 0,
  mutation_survived INTEGER DEFAULT 0,
  mutation_timeout INTEGER DEFAULT 0,
  mutation_score INTEGER DEFAULT 0,
  mutation_pipeline_ms INTEGER DEFAULT 0,
  mutation_adapter TEXT DEFAULT '',
  mutation_stream_events INTEGER DEFAULT 0,
  mutation_stable_keys INTEGER DEFAULT 0
)
`);

// Migrate existing databases
const existingCols = (db.pragma("table_info(events)") as any[]).map((r: any) => r.name);
const newCols: Record<string, string> = {
  filename: "TEXT",
  language: "TEXT",
  test_name: "TEXT",
  cycle: "INTEGER DEFAULT 0",
  loc_total: "INTEGER DEFAULT 0",
  tests_passed: "INTEGER DEFAULT 0",
  tests_failed: "INTEGER DEFAULT 0",
  tests_total: "INTEGER DEFAULT 0",
  tests_unavailable: "INTEGER DEFAULT 0",
  top_failures: "TEXT DEFAULT '[]'",
  new_tests: "TEXT DEFAULT '[]'",
  test_loc_added: "INTEGER DEFAULT 0",
  test_loc_removed: "INTEGER DEFAULT 0",
  test_loc_total: "INTEGER DEFAULT 0",
  test_functions: "INTEGER DEFAULT 0",
  test_conditionals: "INTEGER DEFAULT 0",
  test_classes: "INTEGER DEFAULT 0",
  test_complexity: "INTEGER DEFAULT 0",
  prod_loc_added: "INTEGER DEFAULT 0",
  prod_loc_removed: "INTEGER DEFAULT 0",
  prod_loc_total: "INTEGER DEFAULT 0",
  prod_functions: "INTEGER DEFAULT 0",
  prod_conditionals: "INTEGER DEFAULT 0",
  prod_classes: "INTEGER DEFAULT 0",
  prod_complexity: "INTEGER DEFAULT 0",
  test_file_count: "INTEGER DEFAULT 0",
  prod_file_count: "INTEGER DEFAULT 0",
  halstead_volume: "INTEGER DEFAULT 0",
  maintainability_index: "INTEGER DEFAULT 100",
  nesting_depth: "INTEGER DEFAULT 0",
  max_params: "INTEGER DEFAULT 0",
  test_halstead_volume: "INTEGER DEFAULT 0",
  test_maintainability_index: "INTEGER DEFAULT 100",
  test_nesting_depth: "INTEGER DEFAULT 0",
  test_max_params: "INTEGER DEFAULT 0",
  prod_halstead_volume: "INTEGER DEFAULT 0",
  prod_maintainability_index: "INTEGER DEFAULT 100",
  prod_nesting_depth: "INTEGER DEFAULT 0",
  prod_max_params: "INTEGER DEFAULT 0",
  tests_duration_ms: "INTEGER DEFAULT 0",
  mutation_status: "TEXT DEFAULT 'queued'",
  mutation_targets: "INTEGER DEFAULT 0",
  mutation_killed: "INTEGER DEFAULT 0",
  mutation_survived: "INTEGER DEFAULT 0",
  mutation_timeout: "INTEGER DEFAULT 0",
  mutation_score: "INTEGER DEFAULT 0",
  mutation_pipeline_ms: "INTEGER DEFAULT 0",
  mutation_adapter: "TEXT DEFAULT ''",
  mutation_stream_events: "INTEGER DEFAULT 0",
  mutation_stable_keys: "INTEGER DEFAULT 0",
};
for (const [col, type] of Object.entries(newCols)) {
  if (!existingCols.includes(col)) {
    db.exec(`ALTER TABLE events ADD COLUMN ${col} ${type}`);
  }
}

export function clearAllEvents() {
  db.exec("DELETE FROM events");
}

export function getRecentEvents(limit = 200) {
  return db
    .prepare(`
      SELECT *
      FROM events
      ORDER BY cycle DESC, id DESC
      LIMIT ?
    `)
    .all(limit);
}

export default db;