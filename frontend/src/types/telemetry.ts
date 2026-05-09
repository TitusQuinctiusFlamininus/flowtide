export interface TelemetryEvent {
  id?: number;
  timestamp: number;
  path: string;
  filename: string;
  language: string;
  category: "test" | "production" | "checkpoint";
  test_name: string;
  cycle: number;
  loc_added: number;
  loc_removed: number;
  loc_total: number;
  functions: number;
  conditionals: number;
  classes: number;
  complexity: number;
  tests_passed: number;
  tests_failed: number;
  tests_total: number;
  new_tests: string[];
  test_loc_added?: number;
  test_loc_removed?: number;
  test_loc_total?: number;
  test_functions?: number;
  test_conditionals?: number;
  test_classes?: number;
  test_complexity?: number;
  prod_loc_added?: number;
  prod_loc_removed?: number;
  prod_loc_total?: number;
  prod_functions?: number;
  prod_conditionals?: number;
  prod_classes?: number;
  prod_complexity?: number;
  test_file_count?: number;
  prod_file_count?: number;
  halstead_volume?: number;
  maintainability_index?: number;
  nesting_depth?: number;
  max_params?: number;
  test_halstead_volume?: number;
  test_maintainability_index?: number;
  test_nesting_depth?: number;
  test_max_params?: number;
  prod_halstead_volume?: number;
  prod_maintainability_index?: number;
  prod_nesting_depth?: number;
  prod_max_params?: number;
  tests_duration_ms?: number;
}

export interface ChartPoint {
  cycle: number;
  complexity: number;
  loc_added: number;
  loc_removed: number;
  loc_total: number;
  functions: number;
  conditionals: number;
  classes: number;
  file_count: number;
  pass_rate: number;
  halstead_volume: number;
  maintainability_index: number;
  nesting_depth: number;
  max_params: number;
  tests_duration_ms: number;
  test_ratio: number;
}

export interface ChartData {
  test: ChartPoint[];
  production: ChartPoint[];
}

export interface FlowStateMetrics {
  flowScore: number;
  focusedSeconds: number;
  contextSwitches: number;
  fileHopsPerMinute: number;
  testCadenceSeconds: number | null;
  focusScore: number;
  contextScore: number;
  navigationScore: number;
  cadenceScore: number;
}

export interface RefactoringTelemetryMetrics {
  avgRemovedPerCycle: number;
  refactorDensity: number;
  signalCounts: {
    renames: number;
    moves: number;
    extractions: number;
    simplifications: number;
  };
  deletionHeavyScore: number;
  refactorCoreScore: number;
  codeQualityScore: number;
  refactorPositivityScore: number;
}

export interface ArchitecturalDriftTelemetry {
  moduleCoupling: { cycle: number; value: number }[];
  dependencyGrowth: { cycle: number; value: number }[];
  circularReferences: { cycle: number; value: number }[];
  importGraphEvolution: { cycle: number; value: number }[];
}

export interface CognitiveLoadMetrics {
  cognitiveLoad: number;
  branchingComplexity: number;
  branchingScore: number;
  simultaneousFiles: number;
  simultaneousScore: number;
  editFrequency: number;
  editScore: number;
  navigationThrashing: number;
  navigationScore: number;
  treemapData: Array<{ name: string; size: number; value: number }>;
}

export interface SnapshotMessage {
  type: "snapshot";
  events: TelemetryEvent[];
}
