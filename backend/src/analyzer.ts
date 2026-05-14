import fs from "fs";
import path from "path";

import { getPrevious, saveSnapshot, getPreviousTests, saveTestSnapshot }
  from "./snapshotStore";

import { computeLOC }
  from "./diffEngine";

import { adapterFor }
  from "./registry";

import db from "./db";

import { broadcast }
  from "./websocket";

import { runTests } from "./test-runners/runTests";
import {
  enqueueMutationTesting,
  type MutationSummary,
} from "./mutation/runMutationTesting";

const cycleSeedRow = db
  .prepare("SELECT COALESCE(MAX(cycle), 0) AS maxCycle FROM events")
  .get() as { maxCycle?: number } | undefined;

let cycleCounter = Number(cycleSeedRow?.maxCycle ?? 0);
let flushTimer: NodeJS.Timeout | null = null;

interface FileState {
  filename: string;
  language: string;
  test_name: string;
  loc_total: number;
  functions: number;
  conditionals: number;
  classes: number;
  complexity: number;
  halstead_volume: number;
  maintainability_index: number;
  nesting_depth: number;
  max_params: number;
}

interface BucketState {
  loc_added: number;
  loc_removed: number;
  files: Map<string, FileState>;
}

interface PendingState {
  allPaths: Set<string>;
  lastChangedPath: string | null;
  newTests: Set<string>;
  byCategory: {
    test: BucketState;
    production: BucketState;
  };
}

function createMutationSummary(overrides: Partial<MutationSummary> = {}): MutationSummary {
  return {
    mutation_status: "queued",
    mutation_targets: 0,
    mutation_killed: 0,
    mutation_survived: 0,
    mutation_timeout: 0,
    mutation_score: 0,
    mutation_pipeline_ms: 0,
    mutation_adapter: "",
    mutation_stream_events: 0,
    mutation_stable_keys: 0,
    ...overrides,
  };
}

function persistMutationSummary(cycle: number, summary: MutationSummary) {
  db.prepare(`
    UPDATE events
    SET mutation_status = @mutation_status,
        mutation_targets = @mutation_targets,
        mutation_killed = @mutation_killed,
        mutation_survived = @mutation_survived,
        mutation_timeout = @mutation_timeout,
        mutation_score = @mutation_score,
        mutation_pipeline_ms = @mutation_pipeline_ms,
        mutation_adapter = @mutation_adapter,
        mutation_stream_events = @mutation_stream_events,
        mutation_stable_keys = @mutation_stable_keys
    WHERE cycle = @cycle
  `).run({ cycle, ...summary });
}

function createBucket(): BucketState {
  return {
    loc_added: 0,
    loc_removed: 0,
    files: new Map(),
  };
}

function createPending(): PendingState {
  return {
    allPaths: new Set(),
    lastChangedPath: null,
    newTests: new Set(),
    byCategory: {
      test: createBucket(),
      production: createBucket(),
    },
  };
}

let pending = createPending();

function summarizeBucket(bucket: BucketState) {
  let loc_total = 0;
  let functions = 0;
  let conditionals = 0;
  let classes = 0;
  let complexity = 0;
  let halstead_volume = 0;
  let mi_sum = 0;
  let nesting_depth = 0;   // max
  let max_params = 0;      // max
  let file_count = 0;

  for (const state of bucket.files.values()) {
    loc_total    += state.loc_total;
    functions    += state.functions;
    conditionals += state.conditionals;
    classes      += state.classes;
    complexity   += state.complexity;
    halstead_volume += state.halstead_volume;
    mi_sum       += state.maintainability_index;
    file_count++;
    if (state.nesting_depth > nesting_depth) nesting_depth = state.nesting_depth;
    if (state.max_params   > max_params)    max_params    = state.max_params;
  }

  const maintainability_index = file_count > 0 ? Math.round(mi_sum / file_count) : 100;

  return {
    loc_added: bucket.loc_added,
    loc_removed: bucket.loc_removed,
    loc_total,
    functions,
    conditionals,
    classes,
    complexity,
    halstead_volume,
    maintainability_index,
    nesting_depth,
    max_params,
    file_count,
  };
}

function scheduleFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    void flushCycle();
  }, 1500);
}

async function flushCycle() {
  if (pending.allPaths.size === 0 || !pending.lastChangedPath) {
    return;
  }

  const snapshot = pending;
  pending = createPending();

  // One test execution defines one cycle.
  const testRun = await runTests(snapshot.lastChangedPath);

  cycleCounter++;

  const testAgg = summarizeBucket(snapshot.byCategory.test);
  const prodAgg = summarizeBucket(snapshot.byCategory.production);

  const allStates = [
    ...snapshot.byCategory.test.files.entries(),
    ...snapshot.byCategory.production.files.entries(),
  ];

  const oneFile = allStates.length === 1 ? allStates[0] : null;
  const languages = new Set(allStates.map(([, s]) => s.language));

  const event = {
    timestamp: Date.now(),
    path: oneFile ? oneFile[0] : "multiple-files",
    filename: oneFile ? oneFile[1].filename : `${allStates.length} files changed`,
    language: languages.size === 1 ? [...languages][0] : "Mixed",
    category: "checkpoint",
    test_name: oneFile ? oneFile[1].test_name : "test-run-checkpoint",
    cycle: cycleCounter,

    // Overall totals for compatibility with existing UI cards
    loc_added: testAgg.loc_added + prodAgg.loc_added,
    loc_removed: testAgg.loc_removed + prodAgg.loc_removed,
    loc_total: testAgg.loc_total + prodAgg.loc_total,
    functions: testAgg.functions + prodAgg.functions,
    conditionals: testAgg.conditionals + prodAgg.conditionals,
    classes: testAgg.classes + prodAgg.classes,
    complexity: testAgg.complexity + prodAgg.complexity,
    halstead_volume: testAgg.halstead_volume + prodAgg.halstead_volume,
    maintainability_index: Math.round((testAgg.maintainability_index + prodAgg.maintainability_index) / 2),
    nesting_depth: Math.max(testAgg.nesting_depth, prodAgg.nesting_depth),
    max_params: Math.max(testAgg.max_params, prodAgg.max_params),

    // Per-category metrics for split graphs
    test_loc_added: testAgg.loc_added,
    test_loc_removed: testAgg.loc_removed,
    test_loc_total: testAgg.loc_total,
    test_functions: testAgg.functions,
    test_conditionals: testAgg.conditionals,
    test_classes: testAgg.classes,
    test_complexity: testAgg.complexity,
    test_halstead_volume: testAgg.halstead_volume,
    test_maintainability_index: testAgg.maintainability_index,
    test_nesting_depth: testAgg.nesting_depth,
    test_max_params: testAgg.max_params,

    prod_loc_added: prodAgg.loc_added,
    prod_loc_removed: prodAgg.loc_removed,
    prod_loc_total: prodAgg.loc_total,
    prod_functions: prodAgg.functions,
    prod_conditionals: prodAgg.conditionals,
    prod_classes: prodAgg.classes,
    prod_complexity: prodAgg.complexity,
    prod_halstead_volume: prodAgg.halstead_volume,
    prod_maintainability_index: prodAgg.maintainability_index,
    prod_nesting_depth: prodAgg.nesting_depth,
    prod_max_params: prodAgg.max_params,

    test_file_count: testAgg.file_count,
    prod_file_count: prodAgg.file_count,

    tests_passed: testRun.passed,
    tests_failed: testRun.failed,
    tests_total: testRun.total,
    tests_unavailable: testRun.unavailable,
    top_failures: JSON.stringify(testRun.top_failures ?? []),
    tests_duration_ms: testRun.duration_ms,
    new_tests: JSON.stringify([...snapshot.newTests]),
    ...createMutationSummary({
      mutation_status: snapshot.byCategory.production.files.size > 0 ? "queued" : "skipped",
    }),
  };

  db.prepare(`
    INSERT INTO events (
      timestamp,
      path,
      filename,
      language,
      category,
      test_name,
      cycle,
      loc_added,
      loc_removed,
      loc_total,
      functions,
      conditionals,
      classes,
      complexity,
      halstead_volume,
      maintainability_index,
      nesting_depth,
      max_params,
      tests_passed,
      tests_failed,
      tests_total,
      tests_unavailable,
      top_failures,
      tests_duration_ms,
      new_tests,
      test_loc_added,
      test_loc_removed,
      test_loc_total,
      test_functions,
      test_conditionals,
      test_classes,
      test_complexity,
      test_halstead_volume,
      test_maintainability_index,
      test_nesting_depth,
      test_max_params,
      prod_loc_added,
      prod_loc_removed,
      prod_loc_total,
      prod_functions,
      prod_conditionals,
      prod_classes,
      prod_complexity,
      prod_halstead_volume,
      prod_maintainability_index,
      prod_nesting_depth,
      prod_max_params,
      test_file_count,
      prod_file_count,
      mutation_status,
      mutation_targets,
      mutation_killed,
      mutation_survived,
      mutation_timeout,
      mutation_score,
      mutation_pipeline_ms,
      mutation_adapter,
      mutation_stream_events,
      mutation_stable_keys
    )
    VALUES (
      @timestamp,
      @path,
      @filename,
      @language,
      @category,
      @test_name,
      @cycle,
      @loc_added,
      @loc_removed,
      @loc_total,
      @functions,
      @conditionals,
      @classes,
      @complexity,
      @halstead_volume,
      @maintainability_index,
      @nesting_depth,
      @max_params,
      @tests_passed,
      @tests_failed,
      @tests_total,
      @tests_unavailable,
      @top_failures,
      @tests_duration_ms,
      @new_tests,
      @test_loc_added,
      @test_loc_removed,
      @test_loc_total,
      @test_functions,
      @test_conditionals,
      @test_classes,
      @test_complexity,
      @test_halstead_volume,
      @test_maintainability_index,
      @test_nesting_depth,
      @test_max_params,
      @prod_loc_added,
      @prod_loc_removed,
      @prod_loc_total,
      @prod_functions,
      @prod_conditionals,
      @prod_classes,
      @prod_complexity,
      @prod_halstead_volume,
      @prod_maintainability_index,
      @prod_nesting_depth,
      @prod_max_params,
      @test_file_count,
      @prod_file_count,
      @mutation_status,
      @mutation_targets,
      @mutation_killed,
      @mutation_survived,
      @mutation_timeout,
      @mutation_score,
      @mutation_pipeline_ms,
      @mutation_adapter,
      @mutation_stream_events,
      @mutation_stable_keys
    )
  `).run(event);

  broadcast({ ...event, new_tests: [...snapshot.newTests] });

  void enqueueMutationTesting({
    cycle: cycleCounter,
    filePaths: [...snapshot.byCategory.production.files.keys()],
    onUpdate: ({ cycle, summary, mutation }) => {
      persistMutationSummary(cycle, summary);
      broadcast({
        type: "mutation_update",
        cycle,
        summary,
        mutation,
      });
    },
  });
}

export async function analyzeFile(filePath: string) {
  const adapter = adapterFor(filePath);

  if (!adapter) return;

  const current =
    fs.readFileSync(filePath, "utf-8");

  const previous =
    getPrevious(filePath);

  const loc =
    computeLOC(previous, current);

  const metrics =
    await adapter.analyze(current);

  saveSnapshot(filePath, current);

  const category =
    adapter.classify(filePath);

  const filename = path.basename(filePath);
  const language = adapter.language;
  const test_name = adapter.extractTestName(filePath);

  // Detect new tests
  const currentTests = adapter.extractTests(current);
  const previousTests = getPreviousTests(filePath);
  const new_tests = currentTests.filter((t) => !previousTests.has(t));
  saveTestSnapshot(filePath, currentTests);

  const bucket = pending.byCategory[category];
  bucket.loc_added += loc.added;
  bucket.loc_removed += loc.removed;
  bucket.files.set(filePath, {
    filename,
    language,
    test_name,
    loc_total: metrics.loc_total,
    functions: metrics.functions,
    conditionals: metrics.conditionals,
    classes: metrics.classes,
    complexity: metrics.complexity,
    halstead_volume: metrics.halstead_volume,
    maintainability_index: metrics.maintainability_index,
    nesting_depth: metrics.nesting_depth,
    max_params: metrics.max_params,
  });

  for (const t of new_tests) {
    pending.newTests.add(t);
  }

  pending.allPaths.add(filePath);
  pending.lastChangedPath = filePath;

  scheduleFlush();
}