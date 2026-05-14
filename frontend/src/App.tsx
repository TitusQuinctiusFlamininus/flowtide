/// <reference types="vite/client" />

import { useEffect, useMemo, useRef, useState } from "react";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Treemap,
  Cell,
} from "recharts";

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL
  ?? `ws://${import.meta.env.VITE_BACKEND_HOST ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT ?? "8080"}`;

interface TelemetryEvent {
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
  tests_unavailable?: number;
  top_failures?: string[];
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
  mutation_status?: "queued" | "running" | "completed" | "skipped";
  mutation_targets?: number;
  mutation_killed?: number;
  mutation_survived?: number;
  mutation_timeout?: number;
  mutation_score?: number;
  mutation_pipeline_ms?: number;
  mutation_adapter?: string;
  mutation_stream_events?: number;
  mutation_stable_keys?: number;
}

interface ChartPoint {
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

interface ChartData {
  test: ChartPoint[];
  production: ChartPoint[];
}

interface FlowStateMetrics {
  flowScore: number;
  focusedSeconds: number;
  contextSwitches: number;
  fileHopsPerMinute: number;
  testCadenceSeconds: number | null;
  focusScore: number;
  contextScore: number;
  hoppingScore: number;
  cadenceScore: number;
}

interface RefactoringTelemetryMetrics {
  refactorDensity: number;
  codeRemovedLoc: number;
  avgRemovedPerCycle: number;
  complexityDelta: number;
  renames: number;
  moves: number;
  extractions: number;
  simplifications: number;
  deletionHeavyCycles: number;
  densityScore: number;
  removedScore: number;
  complexityScore: number;
  deletionScore: number;
}

interface ArchitecturalDriftPoint {
  cycle: number;
  module_coupling: number;
  dependency_growth: number;
  circular_references: number;
  import_graph: number;
}

interface ArchitecturalDriftTelemetry {
  dependencyEntropy: "LOW" | "MEDIUM" | "HIGH";
  couplingTrend: "up" | "down" | "flat";
  avgCoupling: number;
  avgDependencyGrowth: number;
  circularRisk: number;
  series: ArchitecturalDriftPoint[];
}

interface CognitiveLoadMetrics {
  cognitiveLoad: number;
  branchingComplexity: number;
  simultaneousFiles: number;
  editFrequency: number;
  navigationThrashing: number;
  branchingScore: number;
  filesScore: number;
  editScore: number;
  thrashScore: number;
  treemapData: Array<{ name: string; size: number; value: number; }>;
}

interface MutationActivity {
  key: string;
  cycle: number;
  adapter: string;
  operator: string;
  file: string;
  line: number;
  column: number;
  status: "running" | "killed" | "survived" | "timeout";
  duration_ms?: number;
  tests_passed?: number;
  tests_failed?: number;
  tests_total?: number;
  receivedAt: number;
}

interface MutationTestingMetrics {
  mutationScore: number;
  avgScore: number;
  queueState: "queued" | "running" | "completed" | "skipped" | "idle";
  totalTargets: number;
  killed: number;
  survived: number;
  timedOut: number;
  pipelineMs: number;
  adapterLabel: string;
  streamEvents: number;
  stableKeys: number;
  trend: Array<{
    cycle: number;
    score: number;
    killed: number;
    survived: number;
  }>;
  activity: MutationActivity[];
}

interface SnapshotMessage {
  type: "snapshot";
  events: TelemetryEvent[];
}

interface MutationUpdateMessage {
  type: "mutation_update";
  cycle: number;
  summary: Pick<
    TelemetryEvent,
    | "mutation_status"
    | "mutation_targets"
    | "mutation_killed"
    | "mutation_survived"
    | "mutation_timeout"
    | "mutation_score"
    | "mutation_pipeline_ms"
    | "mutation_adapter"
    | "mutation_stream_events"
    | "mutation_stable_keys"
  >;
  mutation?: Omit<MutationActivity, "cycle" | "receivedAt">;
}

type ThemeMode = "dark" | "light";

interface ThemePalette {
  appBg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textFaint: string;
  titleColor: string;
}

const THEMES: Record<ThemeMode, ThemePalette> = {
  dark: {
    appBg: "#0f172a",
    surface: "#1e293b",
    surfaceAlt: "#0b1220",
    border: "#334155",
    borderSoft: "#1e293b",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    textFaint: "#64748b",
    titleColor: "#fbbf24",
  },
  light: {
    appBg: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    border: "#cbd5e1",
    borderSoft: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#334155",
    textFaint: "#64748b",
    titleColor: "#1e293b",
  },
};

const COLORS = {
  complexity: "#f59e0b",
  loc_added: "#3b82f6",
  loc_total: "#14b8a6",
  functions: "#ef4444",
};

const METRICS_CONFIG = [
  { key: "complexity",   label: "Complexity",    color: "#f59e0b", defaultOn: true,  prodOnly: true },
  { key: "loc_added",    label: "LOC Added",     color: "#2563eb", defaultOn: true  },
  { key: "loc_total",    label: "Total LOC",     color: "#14b8a6", defaultOn: true  },
  { key: "functions",    label: "Functions",     color: "#dc2626", defaultOn: true,  prodOnly: true },
  { key: "conditionals", label: "Conditionals",  color: "#7c3aed", defaultOn: false, prodOnly: true },
  { key: "classes",      label: "Classes",       color: "#db2777", defaultOn: false, prodOnly: true },
  { key: "loc_removed",  label: "LOC Removed",   color: "#ea580c", defaultOn: false },
  { key: "file_count",   label: "Files Changed", color: "#65a30d", defaultOn: false },
  { key: "pass_rate",              label: "Pass Rate %",          color: "#8b5cf6", defaultOn: false, testOnly: true  },
  { key: "halstead_volume",        label: "Halstead Volume",      color: "#4338ca", defaultOn: false, prodOnly: true  },
  { key: "maintainability_index",  label: "Maintainability (MI)", color: "#16a34a", defaultOn: false, prodOnly: true  },
  { key: "nesting_depth",          label: "Nesting Depth",        color: "#e11d48", defaultOn: false, prodOnly: true  },
  { key: "max_params",             label: "Max Params",           color: "#0891b2", defaultOn: false, prodOnly: true  },
  { key: "tests_duration_ms",      label: "Test Duration (ms)",   color: "#e879f9", defaultOn: false, testOnly: true  },
  { key: "test_ratio",             label: "Test/Prod Ratio ×100", color: "#fbbf24", defaultOn: false, testOnly: true  },
] as const;

type MetricKey = (typeof METRICS_CONFIG)[number]["key"];

const APP_VERSION = "1.0.0";
const CURRENT_YEAR = new Date().getFullYear();
const CHART_HEIGHT = 320;

const CATEGORY_COLORS: Record<string, string> = {
  test: "#6366f1",
  production: "#10b981",
};

function formatTime(ts: number) {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) {
    return `${secs} sec`;
  }
  if (secs === 0) {
    return `${mins} min`;
  }
  return `${mins} min ${secs} sec`;
}

function focusKind(event: TelemetryEvent): "test" | "production" | "mixed" {
  const hasTest = event.category === "test"
    || (event.test_file_count ?? 0) > 0
    || (event.test_loc_added ?? 0) !== 0
    || (event.test_loc_removed ?? 0) !== 0
    || (event.test_loc_total ?? 0) > 0
    || (event.new_tests?.length ?? 0) > 0;

  const hasProd = event.category === "production"
    || (event.prod_file_count ?? 0) > 0
    || (event.prod_loc_added ?? 0) !== 0
    || (event.prod_loc_removed ?? 0) !== 0
    || (event.prod_loc_total ?? 0) > 0;

  if (hasTest && !hasProd) return "test";
  if (hasProd && !hasTest) return "production";
  return "mixed";
}

function metricHeatColor(score: number) {
  const red = [220, 38, 38];
  const orange = [249, 115, 22];
  const blue = [37, 99, 235];

  const mix = (a: number[], b: number[], t: number) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];

  if (score < 50) {
    return mix(red, orange, score / 50);
  }
  return mix(orange, blue, (score - 50) / 50);
}

function computeFlowStateTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): FlowStateMetrics {
  if (events.length === 0) {
    return {
      flowScore: 0,
      focusedSeconds: 0,
      contextSwitches: 0,
      fileHopsPerMinute: 0,
      testCadenceSeconds: null,
      focusScore: 0,
      contextScore: 100,
      hoppingScore: 100,
      cadenceScore: 50,
    };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const latestTs = sorted[sorted.length - 1].timestamp;

  const maxGapForFocusMs = 120000;
  let streakStartTs = latestTs;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > maxGapForFocusMs) {
      break;
    }
    streakStartTs = sorted[i - 1].timestamp;
  }
  const focusedSeconds = Math.max(0, Math.round((latestTs - streakStartTs) / 1000));

  const lookback = sorted.slice(-30);
  let contextSwitches = 0;
  for (let i = 1; i < lookback.length; i += 1) {
    const prev = focusKind(lookback[i - 1]);
    const curr = focusKind(lookback[i]);
    if (prev !== "mixed" && curr !== "mixed" && prev !== curr) {
      contextSwitches += 1;
    }
  }

  let fileHops = 0;
  for (let i = 1; i < lookback.length; i += 1) {
    if (lookback[i].filename && lookback[i - 1].filename && lookback[i].filename !== lookback[i - 1].filename) {
      fileHops += 1;
    }
  }
  const elapsedMinutes = Math.max(1 / 60, (lookback[lookback.length - 1].timestamp - lookback[0].timestamp) / 60000);
  const fileHopsPerMinute = fileHops / elapsedMinutes;

  const cadenceSource = cycleEvents
    .filter((e) => (e.tests_total ?? 0) > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  let testCadenceSeconds: number | null = null;
  if (cadenceSource.length >= 2) {
    let total = 0;
    for (let i = 1; i < cadenceSource.length; i += 1) {
      total += cadenceSource[i].timestamp - cadenceSource[i - 1].timestamp;
    }
    testCadenceSeconds = Math.round(total / (cadenceSource.length - 1) / 1000);
  }

  const focusScore = clamp((focusedSeconds / (30 * 60)) * 100, 0, 100);
  const contextScore = clamp(100 - contextSwitches * 18, 0, 100);
  const hoppingScore = clamp(100 - fileHopsPerMinute * 45, 0, 100);
  const cadenceScore = testCadenceSeconds == null
    ? 50
    : clamp(100 - Math.abs(testCadenceSeconds - 90) * 0.8, 0, 100);

  const flowScore = Math.round(
    focusScore * 0.35
    + contextScore * 0.25
    + hoppingScore * 0.2
    + cadenceScore * 0.2
  );

  return {
    flowScore,
    focusedSeconds,
    contextSwitches,
    fileHopsPerMinute,
    testCadenceSeconds,
    focusScore,
    contextScore,
    hoppingScore,
    cadenceScore,
  };
}

function computeRefactoringTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): RefactoringTelemetryMetrics {
  if (cycleEvents.length === 0) {
    return {
      refactorDensity: 0,
      codeRemovedLoc: 0,
      avgRemovedPerCycle: 0,
      complexityDelta: 0,
      renames: 0,
      moves: 0,
      extractions: 0,
      simplifications: 0,
      deletionHeavyCycles: 0,
      densityScore: 0,
      removedScore: 0,
      complexityScore: 50,
      deletionScore: 100,
    };
  }

  const textSignals = Array.from(
    new Set(events.map((e) => `${e.path ?? ""} ${e.filename ?? ""} ${e.test_name ?? ""}`.toLowerCase()))
  );
  const renames = textSignals.filter((s) => /rename|renamed|\bmv\b|->/.test(s)).length;
  const moves = textSignals.filter((s) => /move|moved|relocat|\s=>\s/.test(s)).length;

  const cyclesAsc = [...cycleEvents].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));

  let codeRemovedLoc = 0;
  let deletionHeavyCycles = 0;
  let extractions = 0;
  let simplifications = 0;

  let prevComplexity = 0;
  let hasPrevComplexity = false;

  for (const c of cyclesAsc) {
    const added = (c.prod_loc_added ?? 0) + (c.test_loc_added ?? 0) + (c.loc_added ?? 0);
    const removed = (c.prod_loc_removed ?? 0) + (c.test_loc_removed ?? 0) + (c.loc_removed ?? 0);
    const complexity = (c.prod_complexity ?? 0) + (c.test_complexity ?? 0) + (c.complexity ?? 0);
    const functions = (c.prod_functions ?? 0) + (c.test_functions ?? 0) + (c.functions ?? 0);

    codeRemovedLoc += removed;

    if (removed > added * 1.35 && removed >= 40) {
      deletionHeavyCycles += 1;
    }

    if (hasPrevComplexity) {
      const complexityDrop = prevComplexity - complexity;
      if (complexityDrop >= 2) {
        simplifications += 1;
      }

      if (functions >= 2 && complexityDrop >= 1 && added > 0) {
        extractions += 1;
      }
    }

    prevComplexity = complexity;
    hasPrevComplexity = true;
  }

  const firstComplexity = cyclesAsc.length > 0
    ? ((cyclesAsc[0].prod_complexity ?? 0) + (cyclesAsc[0].test_complexity ?? 0) + (cyclesAsc[0].complexity ?? 0))
    : 0;
  const lastComplexity = cyclesAsc.length > 0
    ? ((cyclesAsc[cyclesAsc.length - 1].prod_complexity ?? 0) + (cyclesAsc[cyclesAsc.length - 1].test_complexity ?? 0) + (cyclesAsc[cyclesAsc.length - 1].complexity ?? 0))
    : 0;
  const complexityDelta = Math.round(lastComplexity - firstComplexity);

  const cycleCount = Math.max(1, cycleEvents.length);
  const signalWeight = renames * 1.45 + moves * 1.25 + extractions * 1.8 + simplifications * 1.6 + deletionHeavyCycles * 0.95;

  // Normalize with a baseline so short sessions do not spike unrealistically.
  const densityRaw = (signalWeight / (cycleCount * 1.9 + 4)) * 100;
  const refactorDensity = Math.round(clamp(densityRaw, 0, 100));

  const avgRemovedPerCycle = codeRemovedLoc / cycleCount;
  const avgRemovedPerCycleRounded = Math.round(avgRemovedPerCycle);
  const densityScore = refactorDensity;
  const removedScore = clamp((avgRemovedPerCycle / 140) * 100, 0, 100);
  const complexityScore = complexityDelta <= 0
    ? clamp(60 + Math.min(40, Math.abs(complexityDelta) * 2), 0, 100)
    : clamp(60 - complexityDelta * 3, 0, 100);
  const deletionScore = clamp(100 - (deletionHeavyCycles / cycleCount) * 100, 0, 100);

  return {
    refactorDensity,
    codeRemovedLoc,
    avgRemovedPerCycle: avgRemovedPerCycleRounded,
    complexityDelta,
    renames,
    moves,
    extractions,
    simplifications,
    deletionHeavyCycles,
    densityScore,
    removedScore,
    complexityScore,
    deletionScore,
  };
}

function computeArchitecturalDriftTelemetry(cycleEvents: TelemetryEvent[]): ArchitecturalDriftTelemetry {
  if (cycleEvents.length === 0) {
    return {
      dependencyEntropy: "LOW",
      couplingTrend: "flat",
      avgCoupling: 0,
      avgDependencyGrowth: 0,
      circularRisk: 0,
      series: [],
    };
  }

  const sorted = [...cycleEvents].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
  const series: ArchitecturalDriftPoint[] = [];

  const combinedMetric = (total?: number, prod?: number, test?: number) => {
    const prodVal = prod ?? 0;
    const testVal = test ?? 0;
    if (prodVal !== 0 || testVal !== 0) {
      return prodVal + testVal;
    }
    return total ?? 0;
  };

  let cumulativeFileTouches = 0;
  let cumulativeUniqueApprox = 0;

  for (const c of sorted) {
    const filesInCycle = Math.max(1, (c.prod_file_count ?? 0) + (c.test_file_count ?? 0));
    const added = combinedMetric(c.loc_added, c.prod_loc_added, c.test_loc_added);
    const removed = combinedMetric(c.loc_removed, c.prod_loc_removed, c.test_loc_removed);
    const functions = combinedMetric(c.functions, c.prod_functions, c.test_functions);
    const conditionals = combinedMetric(c.conditionals, c.prod_conditionals, c.test_conditionals);
    const complexity = combinedMetric(c.complexity, c.prod_complexity, c.test_complexity);

    const functionsPerFile = functions / filesInCycle;
    const conditionalsPerFile = conditionals / filesInCycle;

    const mixedCycleBonus = (c.prod_file_count ?? 0) > 0 && (c.test_file_count ?? 0) > 0 ? 8 : 0;
    const moduleCoupling = clamp(
      (functionsPerFile / 14) * 100
      + (conditionalsPerFile / 18) * 40
      + mixedCycleBonus,
      0,
      100
    );

    const dependencyGrowth = clamp(50 + ((added - removed) / 220) * 50, 0, 100);
    const complexityPressure = clamp(complexity / 4, 0, 100);
    const circularReferences = clamp(
      moduleCoupling * 0.5 + dependencyGrowth * 0.3 + complexityPressure * 0.2 - 20,
      0,
      100
    );

    cumulativeFileTouches += filesInCycle;
    cumulativeUniqueApprox += Math.max(1, filesInCycle * 0.6);
    const importGraph = clamp(
      (cumulativeFileTouches / Math.max(1, sorted.length * 4)) * 55
      + (cumulativeUniqueApprox / Math.max(1, sorted.length * 3)) * 45,
      0,
      100
    );

    series.push({
      cycle: c.cycle,
      module_coupling: Math.round(moduleCoupling),
      dependency_growth: Math.round(dependencyGrowth),
      circular_references: Math.round(circularReferences),
      import_graph: Math.round(importGraph),
    });
  }

  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const couplingVals = series.map((p) => p.module_coupling);
  const depVals = series.map((p) => p.dependency_growth);
  const circularVals = series.map((p) => p.circular_references);

  const avgCoupling = Math.round(avg(couplingVals));
  const avgDependencyGrowth = Math.round(avg(depVals));
  const circularRisk = Math.round(avg(circularVals));

  let volatility = 0;
  for (let i = 1; i < depVals.length; i += 1) {
    volatility += Math.abs(depVals[i] - depVals[i - 1]);
  }
  const avgVolatility = depVals.length > 1 ? volatility / (depVals.length - 1) : 0;
  const entropyScore = clamp(avgDependencyGrowth * 0.55 + circularRisk * 0.3 + avgVolatility * 1.2, 0, 100);
  const dependencyEntropy: "LOW" | "MEDIUM" | "HIGH" = entropyScore >= 66 ? "HIGH" : entropyScore >= 40 ? "MEDIUM" : "LOW";

  const couplingDelta = couplingVals[couplingVals.length - 1] - couplingVals[0];
  const couplingTrend: "up" | "down" | "flat" = couplingDelta > 4 ? "up" : couplingDelta < -4 ? "down" : "flat";

  return {
    dependencyEntropy,
    couplingTrend,
    avgCoupling,
    avgDependencyGrowth,
    circularRisk,
    series,
  };
}

function computeCognitiveLoadTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): CognitiveLoadMetrics {
  if (events.length === 0) {
    return {
      cognitiveLoad: 0,
      branchingComplexity: 0,
      simultaneousFiles: 0,
      editFrequency: 0,
      navigationThrashing: 0,
      branchingScore: 0,
      filesScore: 0,
      editScore: 0,
      thrashScore: 0,
      treemapData: [],
    };
  }

  // 1. Branching Complexity: based on conditionals, nesting depth, complexity from recent events
  const recentLookback = events.slice(0, 20);
  const totalConditionals = recentLookback.reduce((sum, e) => sum + ((e.prod_conditionals ?? 0) + (e.test_conditionals ?? 0) + (e.conditionals ?? 0)), 0);
  const totalComplexity = recentLookback.reduce((sum, e) => sum + ((e.prod_complexity ?? 0) + (e.test_complexity ?? 0) + (e.complexity ?? 0)), 0);
  const totalNesting = recentLookback.reduce((sum, e) => sum + ((e.prod_nesting_depth ?? 0) + (e.test_nesting_depth ?? 0) + (e.nesting_depth ?? 0)), 0);
  const branchingComplexity = totalConditionals + totalComplexity * 0.5 + totalNesting * 0.3;
  const branchingScore = clamp(Math.min(branchingComplexity / 100 * 100, 100), 0, 100);

  // 2. Simultaneous Open Files: diversity of files touched in recent time
  const recentFiles = new Set(recentLookback.map((e) => e.filename).filter((f) => f));
  const simultaneousFiles = recentFiles.size;
  const filesScore = clamp((simultaneousFiles / 12) * 100, 0, 100);

  // 3. Edit Frequency: LOC changes per time period
  const totalLocChanged = recentLookback.reduce((sum, e) => {
    const added = (e.prod_loc_added ?? 0) + (e.test_loc_added ?? 0) + (e.loc_added ?? 0);
    const removed = (e.prod_loc_removed ?? 0) + (e.test_loc_removed ?? 0) + (e.loc_removed ?? 0);
    return sum + added + removed;
  }, 0);
  const editFrequency = totalLocChanged;
  const editScore = clamp((totalLocChanged / 1000) * 100, 0, 100);

  // 4. Navigation Thrashing: rapid file changes without settling (back-and-forth pattern)
  let fileHops = 0;
  for (let i = 1; i < recentLookback.length; i += 1) {
    if (recentLookback[i].filename && recentLookback[i - 1].filename && recentLookback[i].filename !== recentLookback[i - 1].filename) {
      fileHops += 1;
    }
  }
  // Also check for rapid file revisits (thrashing indicator)
  const fileFreq = new Map<string, number>();
  for (const e of recentLookback) {
    const fn = e.filename;
    fileFreq.set(fn, (fileFreq.get(fn) ?? 0) + 1);
  }
  const revisitCount = Array.from(fileFreq.values()).filter((count) => count > 2).length;
  const navigationThrashing = fileHops + revisitCount * 3;
  const thrashScore = clamp(100 - navigationThrashing * 2.5, 0, 100);

  // Overall cognitive load: weighted average of four factors
  const cognitiveLoad = Math.round(
    branchingScore * 0.25
    + filesScore * 0.25
    + editScore * 0.25
    + thrashScore * 0.25
  );

  // Treemap data: show breakdown of contributors
  const treemapData = [
    { name: "Branching\nComplexity", size: branchingScore, value: branchingScore },
    { name: "Simultaneous\nFiles", size: filesScore, value: filesScore },
    { name: "Edit\nFrequency", size: editScore, value: editScore },
    { name: "Navigation\nThrashing", size: thrashScore, value: thrashScore },
  ];

  return {
    cognitiveLoad,
    branchingComplexity: Math.round(branchingComplexity),
    simultaneousFiles,
    editFrequency: Math.round(editFrequency),
    navigationThrashing: Math.round(navigationThrashing),
    branchingScore,
    filesScore,
    editScore,
    thrashScore,
    treemapData,
  };
}

function computeMutationTestingTelemetry(cycleEvents: TelemetryEvent[], activity: MutationActivity[]): MutationTestingMetrics {
  const mutationCycles = cycleEvents
    .filter((event) => (
      (event.mutation_targets ?? 0) > 0
      || (event.mutation_status ?? "idle") !== "idle"
      || (event.mutation_stream_events ?? 0) > 0
    ));

  if (mutationCycles.length === 0) {
    return {
      mutationScore: 0,
      avgScore: 0,
      queueState: "idle",
      totalTargets: 0,
      killed: 0,
      survived: 0,
      timedOut: 0,
      pipelineMs: 0,
      adapterLabel: "No adapter active",
      streamEvents: 0,
      stableKeys: 0,
      trend: [],
      activity,
    };
  }

  const latest = mutationCycles[0];
  const latestCycle = latest.cycle;
  const currentCycleActivity = activity.filter((item) => item.cycle === latestCycle);
  const avgScore = Math.round(
    mutationCycles.reduce((sum, event) => sum + (event.mutation_score ?? 0), 0)
    / Math.max(1, mutationCycles.length)
  );

  return {
    mutationScore: latest.mutation_score ?? 0,
    avgScore,
    queueState: latest.mutation_status ?? "idle",
    totalTargets: latest.mutation_targets ?? 0,
    killed: latest.mutation_killed ?? 0,
    survived: latest.mutation_survived ?? 0,
    timedOut: latest.mutation_timeout ?? 0,
    pipelineMs: latest.mutation_pipeline_ms ?? 0,
    adapterLabel: latest.mutation_adapter || "No adapter active",
    streamEvents: latest.mutation_stream_events ?? 0,
    stableKeys: latest.mutation_stable_keys ?? 0,
    trend: [...mutationCycles]
      .sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0))
      .map((event) => ({
        cycle: event.cycle,
        score: event.mutation_score ?? 0,
        killed: event.mutation_killed ?? 0,
        survived: event.mutation_survived ?? 0,
      })),
    activity: currentCycleActivity,
  };
}

function mergeEventsByCycle(events: TelemetryEvent[]): TelemetryEvent[] {
  const byCycle = new Map<number, TelemetryEvent>();

  for (const raw of events) {
    const event: TelemetryEvent = raw.category === "checkpoint"
      ? { ...raw, new_tests: [...raw.new_tests] }
      : {
          ...raw,
          category: "checkpoint",
          test_loc_added: raw.category === "test" ? raw.loc_added : (raw.test_loc_added ?? 0),
          test_loc_removed: raw.category === "test" ? raw.loc_removed : (raw.test_loc_removed ?? 0),
          test_loc_total: raw.category === "test" ? raw.loc_total : (raw.test_loc_total ?? 0),
          test_functions: raw.category === "test" ? raw.functions : (raw.test_functions ?? 0),
          test_conditionals: raw.category === "test" ? raw.conditionals : (raw.test_conditionals ?? 0),
          test_classes: raw.category === "test" ? raw.classes : (raw.test_classes ?? 0),
          test_complexity: raw.category === "test" ? raw.complexity : (raw.test_complexity ?? 0),
          prod_loc_added: raw.category === "production" ? raw.loc_added : (raw.prod_loc_added ?? 0),
          prod_loc_removed: raw.category === "production" ? raw.loc_removed : (raw.prod_loc_removed ?? 0),
          prod_loc_total: raw.category === "production" ? raw.loc_total : (raw.prod_loc_total ?? 0),
          prod_functions: raw.category === "production" ? raw.functions : (raw.prod_functions ?? 0),
          prod_conditionals: raw.category === "production" ? raw.conditionals : (raw.prod_conditionals ?? 0),
          prod_classes: raw.category === "production" ? raw.classes : (raw.prod_classes ?? 0),
          prod_complexity: raw.category === "production" ? raw.complexity : (raw.prod_complexity ?? 0),
          test_file_count: raw.category === "test" ? 1 : (raw.test_file_count ?? 0),
          prod_file_count: raw.category === "production" ? 1 : (raw.prod_file_count ?? 0),
        };

    const cycleKey = event.cycle ?? 0;
    const existing = byCycle.get(cycleKey);

    if (!existing) {
      byCycle.set(cycleKey, event);
      continue;
    }

    const merged: TelemetryEvent = {
      ...existing,
      category: "checkpoint",
      timestamp: Math.max(existing.timestamp, event.timestamp),
      language: existing.language === event.language ? existing.language : "mixed",
      filename: existing.filename === event.filename ? existing.filename : "Multiple files",
      path: existing.path,
      test_name: existing.test_name === event.test_name ? existing.test_name : "Multiple changes",
      loc_added: (existing.loc_added ?? 0) + (event.loc_added ?? 0),
      loc_removed: (existing.loc_removed ?? 0) + (event.loc_removed ?? 0),
      loc_total: (existing.loc_total ?? 0) + (event.loc_total ?? 0),
      functions: (existing.functions ?? 0) + (event.functions ?? 0),
      conditionals: (existing.conditionals ?? 0) + (event.conditionals ?? 0),
      classes: (existing.classes ?? 0) + (event.classes ?? 0),
      complexity: (existing.complexity ?? 0) + (event.complexity ?? 0),
      tests_passed: Math.max(existing.tests_passed ?? 0, event.tests_passed ?? 0),
      tests_failed: Math.max(existing.tests_failed ?? 0, event.tests_failed ?? 0),
      tests_total: Math.max(existing.tests_total ?? 0, event.tests_total ?? 0),
      tests_unavailable: Math.max(existing.tests_unavailable ?? 0, event.tests_unavailable ?? 0),
      top_failures: Array.from(new Set([...(existing.top_failures ?? []), ...(event.top_failures ?? [])])).slice(0, 3),
      tests_duration_ms: Math.max(existing.tests_duration_ms ?? 0, event.tests_duration_ms ?? 0),
      new_tests: Array.from(new Set([...(existing.new_tests ?? []), ...(event.new_tests ?? [])])),
      test_loc_added: (existing.test_loc_added ?? 0) + (event.test_loc_added ?? 0),
      test_loc_removed: (existing.test_loc_removed ?? 0) + (event.test_loc_removed ?? 0),
      test_loc_total: (existing.test_loc_total ?? 0) + (event.test_loc_total ?? 0),
      test_functions: (existing.test_functions ?? 0) + (event.test_functions ?? 0),
      test_conditionals: (existing.test_conditionals ?? 0) + (event.test_conditionals ?? 0),
      test_classes: (existing.test_classes ?? 0) + (event.test_classes ?? 0),
      test_complexity: (existing.test_complexity ?? 0) + (event.test_complexity ?? 0),
      prod_loc_added: (existing.prod_loc_added ?? 0) + (event.prod_loc_added ?? 0),
      prod_loc_removed: (existing.prod_loc_removed ?? 0) + (event.prod_loc_removed ?? 0),
      prod_loc_total: (existing.prod_loc_total ?? 0) + (event.prod_loc_total ?? 0),
      prod_functions: (existing.prod_functions ?? 0) + (event.prod_functions ?? 0),
      prod_conditionals: (existing.prod_conditionals ?? 0) + (event.prod_conditionals ?? 0),
      prod_classes: (existing.prod_classes ?? 0) + (event.prod_classes ?? 0),
      prod_complexity: (existing.prod_complexity ?? 0) + (event.prod_complexity ?? 0),
      test_file_count: (existing.test_file_count ?? 0) + (event.test_file_count ?? 0),
      prod_file_count: (existing.prod_file_count ?? 0) + (event.prod_file_count ?? 0),
    };

    byCycle.set(cycleKey, merged);
  }

  return Array.from(byCycle.values()).sort(
    (a, b) => (b.cycle ?? 0) - (a.cycle ?? 0) || (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
      }}
    >
      {label}
    </span>
  );
}

function FlowtideMark({ theme }: { theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const frame = isDark ? "#1e293b" : "#e2e8f0";
  const orb = isDark ? "#fde047" : "#334155";

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(145deg, ${theme.surfaceAlt}, ${theme.surface})`,
        border: `1px solid ${frame}`,
        boxShadow: isDark ? "0 14px 28px rgba(0, 0, 0, 0.28)" : "0 12px 24px rgba(15, 23, 42, 0.08)",
        flexShrink: 0,
        animation: "flowtide-mark 8s ease-in-out infinite",
        transformOrigin: "50% 50%",
        willChange: "transform, box-shadow, filter",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <polygon points="15,2.5 26,9 26,21 15,27.5 4,21 4,9" stroke={theme.titleColor} strokeWidth="1.8" />
        <polygon points="15,7 21.5,11 21.5,19 15,23 8.5,19 8.5,11" fill={theme.titleColor} opacity="0.18" />
        <circle cx="15" cy="15" r="4.2" fill={orb} />
      </svg>
    </div>
  );
}

function EventCard({ event, index, theme, isLatest }: { event: TelemetryEvent; index: number; theme: ThemePalette; isLatest?: boolean }) {
  const isDark = theme.appBg === "#0f172a";
  const catColor = event.category === "checkpoint"
    ? (isDark ? "#93c5fd" : "#1e3a8a")
    : (CATEGORY_COLORS[event.category] ?? "#94a3b8");
  const hasTestData = event.tests_total > 0;
  const hasFailures = event.tests_failed > 0;
  const hasProdChanges =
    (event.prod_file_count ?? 0) > 0 ||
    (event.prod_loc_added ?? 0) !== 0 ||
    (event.prod_loc_removed ?? 0) !== 0 ||
    (event.prod_loc_total ?? 0) > 0 ||
    (event.prod_functions ?? 0) > 0 ||
    (event.prod_complexity ?? 0) > 0;
  const hasTestChanges =
    (event.test_file_count ?? 0) > 0 ||
    (event.test_loc_added ?? 0) !== 0 ||
    (event.test_loc_removed ?? 0) !== 0 ||
    (event.test_loc_total ?? 0) > 0 ||
    (event.test_functions ?? 0) > 0 ||
    (event.test_complexity ?? 0) > 0;
  const isCheckpoint = event.category === "checkpoint";

  function MetricGrid({
    locAdded,
    locTotal,
    complexity,
    functions,
  }: {
    locAdded: number;
    locTotal: number;
    complexity: number;
    functions: number;
  }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
        {[
          { label: "+LOC", value: locAdded, color: COLORS.loc_added },
          { label: "Total", value: locTotal, color: COLORS.loc_total },
          { label: "Cmplx", value: complexity, color: COLORS.complexity },
          { label: "Fns", value: functions, color: COLORS.functions },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center", background: theme.surfaceAlt, borderRadius: 5, padding: "4px 2px" }}>
            <div style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textFaint, fontSize: 10 }}>{label}</div>
          </div>
        ))}
      </div>
    );
  }

  const cycleTint = hasTestData
    ? hasFailures
      ? themeModeAwareColor(theme, "warning", isLatest)
      : themeModeAwareColor(theme, "success", isLatest)
    : theme.surface;

  const cycleBorder = hasTestData
    ? hasFailures
      ? themeModeAwareColor(theme, "warningBorder", isLatest)
      : themeModeAwareColor(theme, "successBorder", isLatest)
    : theme.border;

  return (
    <div
      style={{
        background: cycleTint,
        border: `1px solid ${isLatest ? (event.tests_failed > 0 ? "#ef4444" : "#10b981") : cycleBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 8,
        transition: "border-color 0.2s",
        boxShadow: isLatest ? `0 0 0 2px ${event.tests_failed > 0 ? "#ef444430" : "#10b98130"}` : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: theme.text, fontSize: isLatest ? 16 : 13, display: "flex", alignItems: "center", gap: 6 }}>
          {isLatest && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: event.tests_failed > 0 ? "#f97316" : "#10b981",
                animation: "pulse-dot 1.4s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          )}
          Cycle #{event.cycle}
        </span>
        <span
          style={{
            color: isDark ? "#ffffff" : "#ffffff",
            fontSize: 11,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 300,
            letterSpacing: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(event.timestamp)}
        </span>
      </div>

      {/* Test name */}
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: isDark ? theme.textFaint : "#334155", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}>Test / Module</span>
        <div style={{ color: isDark ? theme.text : "rgba(255, 255, 255, 0.9)", fontSize: 13, fontWeight: 600, marginTop: 1 }}>
          {event.test_name || "—"}
        </div>
      </div>

      {/* File name */}
      <div style={{ marginBottom: 7 }}>
        <span style={{ color: theme.textFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>File</span>
        <div style={{ color: theme.textMuted, fontSize: 11, fontFamily: "monospace", marginTop: 1, wordBreak: "break-all" }}>
          {event.filename}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
        <Badge label={event.category} color={catColor} />
        <Badge label={event.language} color={isDark ? "#38bdf8" : "#0c4a6e"} />
      </div>

      {isCheckpoint ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hasProdChanges && (
            <div>
              <div style={{ color: "#f472b6", textShadow: "0 0 10px #f472b666", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, fontWeight: 700 }}>
                Production Code
              </div>
              <MetricGrid
                locAdded={event.prod_loc_added ?? 0}
                locTotal={event.prod_loc_total ?? 0}
                complexity={event.prod_complexity ?? 0}
                functions={event.prod_functions ?? 0}
              />
            </div>
          )}
          {hasTestChanges && (
            <div>
              <div style={{ color: isDark ? "#22d3ee" : "#0e7490", textShadow: isDark ? "0 0 10px #22d3ee66" : "0 0 6px #0891b233", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, fontWeight: 700 }}>
                Test Code
              </div>
              <MetricGrid
                locAdded={event.test_loc_added ?? 0}
                locTotal={event.test_loc_total ?? 0}
                complexity={event.test_complexity ?? 0}
                functions={event.test_functions ?? 0}
              />
            </div>
          )}
          {!hasProdChanges && !hasTestChanges && (
            <MetricGrid
              locAdded={event.loc_added}
              locTotal={event.loc_total}
              complexity={event.complexity}
              functions={event.functions}
            />
          )}
        </div>
      ) : (
        <MetricGrid
          locAdded={event.loc_added}
          locTotal={event.loc_total}
          complexity={event.complexity}
          functions={event.functions}
        />
      )}
    </div>
  );
}

function themeModeAwareColor(theme: ThemePalette, kind: "success" | "warning" | "successBorder" | "warningBorder", isLatest = false) {
  const isDark = theme.appBg === "#0f172a";
  if (kind === "success") return isDark ? (isLatest ? "#14532d" : "#123524") : (isLatest ? "#dcfce7" : "#ecfdf5");
  if (kind === "warning") return isDark ? (isLatest ? "#5c0a16" : "#3d0910") : (isLatest ? "#fca5a5" : "#fecaca");
  if (kind === "successBorder") return isDark ? (isLatest ? "#4ade80" : "#22c55e") : (isLatest ? "#22c55e" : "#86efac");
  /* warningBorder */ return isDark ? (isLatest ? "#f87171" : "#ef4444") : (isLatest ? "#ef4444" : "#fca5a5");
}

function CustomTooltip({ active, payload, label, theme }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: theme.textMuted, marginBottom: 4 }}>Cycle #{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MetricsChart({
  title,
  titleFontSize = 20,
  accentColor,
  data,
  emptyLabel,
  theme,
  chartKind,
}: {
  title: string;
  titleFontSize?: number;
  accentColor: string;
  data: ChartPoint[];
  emptyLabel: string;
  theme: ThemePalette;
  chartKind: "test" | "production";
}) {
  const availableMetrics = METRICS_CONFIG.filter(
    (m) => (chartKind === "test" ? !(m as any).prodOnly : !(m as any).testOnly)
  );
  const [visible, setVisible] = useState<Set<MetricKey>>(
    () => new Set(availableMetrics.filter((m) => m.defaultOn).map((m) => m.key))
  );

  function toggleMetric(key: MetricKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const isDark = theme.appBg === "#0f172a";

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${accentColor}33`,
        borderRadius: 10,
        padding: "16px 12px 8px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          fontSize: titleFontSize,
          fontWeight: 800,
          color: theme.appBg === "#0f172a" ? "#ffffff" : "#374151",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {title}
        <span style={{ marginLeft: "auto", color: theme.textFaint, fontWeight: 400, fontSize: 11 }}>
          {data.length} point{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Metric toggle pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
        {availableMetrics.map((m) => {
          const on = visible.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 12,
                border: `1px solid ${on ? m.color : (isDark ? "#334155" : "#cbd5e1")}`,
                background: on ? `${m.color}22` : "transparent",
                color: on ? m.color : theme.textFaint,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: on ? m.color : (isDark ? "#475569" : "#94a3b8"),
                  flexShrink: 0,
                }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      {data.length === 0 ? (
        <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textFaint, fontSize: 13 }}>
          {emptyLabel}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.borderSoft} />
            <XAxis
              dataKey="cycle"
              label={{ value: "Cycle", position: "insideBottomRight", offset: -8, fill: theme.textFaint, fontSize: 10 }}
              tick={{ fill: theme.textFaint, fontSize: 10 }}
              stroke={theme.border}
            />
            <YAxis
              label={{ value: "Count", angle: -90, position: "left", offset: 4, fill: theme.textFaint, fontSize: 10 }}
              tick={{ fill: theme.textFaint, fontSize: 10 }}
              stroke={theme.border}
              width={52}
            />
            <Tooltip content={<CustomTooltip theme={theme} />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: theme.textMuted }} />
            {availableMetrics.map((m) =>
              visible.has(m.key) ? (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function FlowStatePanel({ metrics, theme }: { metrics: FlowStateMetrics; theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const flowScoreColor = metrics.flowScore >= 70 ? "#22c55e" : metrics.flowScore >= 45 ? "#f59e0b" : "#ef4444";

  const tile = (label: string, value: string, score: number, helper: string) => {
    const [baseR, baseG, baseB] = metricHeatColor(score);
    const isTestCadenceTile = label === "Test Cadence";
    const r = isTestCadenceTile ? 168 : baseR;
    const g = isTestCadenceTile ? 85 : baseG;
    const b = isTestCadenceTile ? 247 : baseB;
    const border = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.9 : 0.7})`;
    const bg = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.28 : 0.45})`;
    const glow = isDark
      ? `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.22), 0 0 10px rgba(${r}, ${g}, ${b}, 0.22), 0 0 16px rgba(${r}, ${g}, ${b}, 0.12)`
      : `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.14), 0 0 8px rgba(${r}, ${g}, ${b}, 0.12), 0 0 12px rgba(${r}, ${g}, ${b}, 0.08)`;

    return (
      <div
        key={label}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 10,
          padding: "12px 14px",
          boxShadow: glow,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
          minHeight: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ color: isDark ? "#ffffff" : "#000000", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
        <div style={{ color: theme.text, fontSize: 16, fontWeight: 800, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{helper}</div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Flow State Telemetry
          </div>
          <div style={{ color: theme.text, fontSize: 20, fontWeight: 900, marginTop: 3 }}>
            Flow Score <span style={{ marginLeft: 8, color: flowScoreColor }}>{metrics.flowScore}</span>
          </div>
        </div>
        <div style={{ color: theme.textMuted, fontSize: 12 }}>Blue = better flow, orange/red = needs attention</div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateRows: "1fr 1fr", gap: 10, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, minHeight: 0 }}>
          {tile("Focused For", formatDuration(metrics.focusedSeconds), metrics.focusScore, "Uninterrupted coding streak")}
          {tile("Context Switches", `${metrics.contextSwitches}`, metrics.contextScore, "Lower is better")}
          {tile("File Hopping", `${metrics.fileHopsPerMinute.toFixed(2)}/min`, metrics.hoppingScore, "Filename changes per minute")}
        </div>
        <div style={{ minHeight: 0 }}>
        {tile(
          "Test Cadence",
          metrics.testCadenceSeconds == null ? "N/A" : `every ${metrics.testCadenceSeconds}s`,
          metrics.cadenceScore,
          "Average interval between test cycles"
        )}
        </div>
      </div>
    </div>
  );
}

function RefactoringTelemetryPanel({ metrics, theme }: { metrics: RefactoringTelemetryMetrics; theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const refactorDensityColor = metrics.refactorDensity >= 65 ? "#22c55e" : metrics.refactorDensity >= 40 ? "#f59e0b" : "#ef4444";

  const formatLocEstimate = (loc: number) => {
    const safe = Math.max(0, Number.isFinite(loc) ? loc : 0);
    if (safe < 1000) {
      return `~${Math.round(safe)} LOC`;
    }
    const compact = (safe / 1000).toFixed(1).replace(/\.0$/, "");
    return `~${compact}k LOC`;
  };

  const formatLocPace = (locPerCycle: number) => {
    const safe = Math.max(0, Number.isFinite(locPerCycle) ? locPerCycle : 0);
    return `~${Math.round(safe)} LOC/cycle`;
  };

  const tile = (label: string, value: string, score: number, helper: string) => {
    const [r, g, b] = metricHeatColor(score);
    const scoreLabel = Math.round(score);
    const hotspot = score < 35 ? "#fde047" : score < 65 ? "#fb923c" : "#ef4444";
    const hotspotRgb = score < 35 ? "253,224,71" : score < 65 ? "251,146,60" : "239,68,68";
    const markerLeft = Math.max(10, Math.min(90, score));
    const panelBase = isDark ? "#0b1220" : "#eef2f7";
    const panelOverlay = isDark
      ? `radial-gradient(circle at ${markerLeft}% 45%, rgba(${hotspotRgb}, 0.48), rgba(${hotspotRgb}, 0.06) 58%)`
      : `radial-gradient(circle at ${markerLeft}% 45%, rgba(${hotspotRgb}, 0.42), rgba(${hotspotRgb}, 0.08) 56%)`;
    const gridOverlay = isDark
      ? "repeating-linear-gradient(45deg, rgba(148,163,184,0.06) 0px, rgba(148,163,184,0.06) 6px, rgba(15,23,42,0) 6px, rgba(15,23,42,0) 12px)"
      : "repeating-linear-gradient(45deg, rgba(100,116,139,0.08) 0px, rgba(100,116,139,0.08) 6px, rgba(226,232,240,0) 6px, rgba(226,232,240,0) 12px)";
    const glow = isDark
      ? `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.2), 0 0 18px rgba(${r}, ${g}, ${b}, 0.22)`
      : `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.16), 0 0 10px rgba(${r}, ${g}, ${b}, 0.14)`;

    return (
      <div
        key={label}
        style={{
          background: `${panelOverlay}, ${gridOverlay}, ${panelBase}`,
          border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
          borderRadius: 10,
          padding: "10px",
          boxShadow: glow,
          position: "relative",
          overflow: "hidden",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            border: `2px solid ${hotspot}`,
            background: `radial-gradient(circle at 35% 30%, rgba(${hotspotRgb}, 0.65), rgba(${hotspotRgb}, 0.1) 70%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: isDark ? "#ffffff" : "#111827",
            fontSize: 13,
            fontWeight: 800,
            boxShadow: `0 0 14px rgba(${hotspotRgb}, ${isDark ? 0.45 : 0.26})`,
            position: "relative",
            zIndex: 1,
          }}
        >
          {scoreLabel}
        </div>
        <div style={{ minWidth: 0, marginLeft: 10, position: "relative", zIndex: 1, flex: 1 }}>
          <div style={{ color: isDark ? "#ffffff" : "#000000", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
          <div style={{ color: theme.text, fontSize: 19, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
          <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>{helper}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
        Refactoring Telemetry
      </div>
      <div style={{ color: theme.text, fontSize: 20, fontWeight: 900, marginTop: 3 }}>
        Refactor Density <span style={{ marginLeft: 8, color: refactorDensityColor }}>{metrics.refactorDensity}%</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[
          { label: "Renames", value: metrics.renames, color: "#38bdf8" },
          { label: "Moves", value: metrics.moves, color: "#60a5fa" },
          { label: "Extraction", value: metrics.extractions, color: "#22d3ee" },
          { label: "Simplification", value: metrics.simplifications, color: "#06b6d4" },
          { label: "Deletion-Heavy", value: metrics.deletionHeavyCycles, color: "#f97316" },
        ].map((item) => (
          <span
            key={item.label}
            style={{
              background: `${item.color}22`,
              color: item.color,
              border: `1px solid ${item.color}55`,
              borderRadius: 999,
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {item.label}: {item.value}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateRows: "1fr 1fr", gap: 10, marginTop: 12, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minHeight: 0 }}>
          {tile(
            "Code Removed",
            formatLocPace(metrics.avgRemovedPerCycle),
            metrics.removedScore,
            `${formatLocEstimate(metrics.codeRemovedLoc)} total across visible cycles`
          )}
          {tile("Complexity Reduced", `${metrics.complexityDelta}`, metrics.complexityScore, "Negative means reduced")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minHeight: 0 }}>
          {tile("Detection Density", `${metrics.refactorDensity}%`, metrics.densityScore, "Refactor signal intensity")}
          {tile("Deletion-Heavy", `${metrics.deletionHeavyCycles}`, metrics.deletionScore, "Lower is healthier")}
        </div>
      </div>
    </div>
  );
}

function ArchitecturalDriftPanel({ telemetry, theme }: { telemetry: ArchitecturalDriftTelemetry; theme: ThemePalette }) {
  const entropyColor = telemetry.dependencyEntropy === "HIGH"
    ? "#ef4444"
    : telemetry.dependencyEntropy === "MEDIUM"
      ? "#f59e0b"
      : "#10b981";

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Architectural Drift Telemetry
          </div>
          <div style={{ color: theme.appBg === "#0f172a" ? "#ffffff" : "#000000", fontSize: 20, fontWeight: 900, marginTop: 2 }}>
            Dependency Entropy <span style={{ color: entropyColor, marginLeft: 8, fontSize: 18 }}>{telemetry.dependencyEntropy}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {[
          { label: "Avg Coupling", value: telemetry.avgCoupling, color: "#e879f9" },
          { label: "Dependency Growth", value: telemetry.avgDependencyGrowth, color: "#22c55e" },
          { label: "Circular Risk", value: telemetry.circularRisk, color: "#f97316" },
        ].map((m) => (
          <span
            key={m.label}
            style={{
              background: `${m.color}22`,
              color: m.color,
              border: `1px solid ${m.color}55`,
              borderRadius: 999,
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {m.label}: {m.value}
          </span>
        ))}
      </div>

      {telemetry.series.length === 0 ? (
        <div style={{ color: theme.textFaint, fontSize: 13 }}>No drift data yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={telemetry.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.borderSoft} />
            <XAxis dataKey="cycle" tick={{ fill: theme.textFaint, fontSize: 10 }} stroke={theme.border} />
            <YAxis tick={{ fill: theme.textFaint, fontSize: 10 }} stroke={theme.border} width={40} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip theme={theme} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: theme.textMuted }} />
            <Area type="monotone" dataKey="module_coupling" name="Module Coupling" stroke="#e879f9" fill="#e879f938" strokeWidth={2} />
            <Area type="monotone" dataKey="dependency_growth" name="Dependency Growth" stroke="#22c55e" fill="#22c55e38" strokeWidth={2} />
            <Area type="monotone" dataKey="circular_references" name="Circular Risk" stroke="#f97316" fill="#f9731638" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function CognitiveLoadPanel({ metrics, theme }: { metrics: CognitiveLoadMetrics; theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const loadColor = metrics.cognitiveLoad < 40 ? "#10b981" : metrics.cognitiveLoad < 70 ? "#f59e0b" : "#ef4444";

  const getScoreColor = (score: number) => {
    // Single color (green/amber/red) with gradient based on score
    // Better (lower score) = darker green, Worse (higher score) = bright red
    if (score < 20) return "#065f46"; // very dark green
    if (score < 30) return "#047857"; // dark green
    if (score < 40) return "#059669"; // medium green
    if (score < 50) return "#10b981"; // green
    if (score < 60) return "#34d399"; // light green
    if (score < 70) return "#f59e0b"; // amber
    if (score < 80) return "#ea580c"; // orange
    if (score < 90) return "#dc2626"; // red
    return "#991b1b"; // dark red
  };

  // Add fill color to each treemap data item
  const coloredTreemapData = metrics.treemapData.map((item) => ({
    ...item,
    fill: getScoreColor(item.value),
  }));

  const labelColor = "#ffffff";

  const TreemapCell = ({ x, y, width, height, name, fill: cellFill }: any) => (
    <g shapeRendering="crispEdges">
      <rect x={Math.round(x)} y={Math.round(y)} width={Math.round(width)} height={Math.round(height)} fill={cellFill} stroke={theme.border} />
      {width > 60 && height > 24 && (
        <foreignObject x={Math.round(x)} y={Math.round(y)} width={Math.round(width)} height={Math.round(height)}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 500,
              color: labelColor,
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: "0.02em",
              textAlign: "center",
              padding: "0 4px",
              boxSizing: "border-box",
              pointerEvents: "none",
              userSelect: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
        </foreignObject>
      )}
    </g>
  );

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
        Human-Computer Interaction
      </div>
      <div
        style={{
          color: theme.appBg === "#0f172a" ? "#ffffff" : "#000000",
          fontSize: 20,
          fontWeight: 900,
          marginTop: 2,
          marginBottom: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          whiteSpace: "nowrap",
        }}
      >
        <span>Cognitive Load Estimation</span>
        <span style={{ color: loadColor }}>{metrics.cognitiveLoad}%</span>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 8, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${metrics.cognitiveLoad}%`,
                background: loadColor,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>
            {metrics.cognitiveLoad < 40 ? "Low load" : metrics.cognitiveLoad < 70 ? "Moderate load" : "High load — risk of errors & TDD drift"}
          </div>
        </div>
      </div>

      {coloredTreemapData.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <Treemap
            data={coloredTreemapData}
            dataKey="value"
            stroke={theme.border}
            fill={theme.surface}
            content={<TreemapCell />}
          >
            <Tooltip 
              contentStyle={{
                background: isDark ? "#0b1220" : theme.surface,
                border: `1px solid ${isDark ? "#334155" : theme.border}`,
                borderRadius: 6,
                fontSize: 12,
                color: isDark ? "#ffffff" : "#0f172a",
              }}
              labelStyle={{ color: isDark ? "#ffffff" : "#0f172a" }}
              itemStyle={{ color: isDark ? "#ffffff" : "#0f172a" }}
              formatter={(value: any) => `Score: ${Math.round(value)}`}
              labelFormatter={(label: any) => `${label}`}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function MutationTestingPanel({ metrics, theme }: { metrics: MutationTestingMetrics; theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const [showAllSurvivors, setShowAllSurvivors] = useState(false);
  const killedColor = "#22c55e";
  const survivedColor = "#ef4444";
  const survivedTileColor = "#f97316";
  const scoreColor = metrics.mutationScore >= 75 ? "#10b981" : metrics.mutationScore >= 45 ? "#f59e0b" : "#ef4444";
  const queueColor = metrics.queueState === "completed"
    ? "#10b981"
    : metrics.queueState === "running"
      ? "#38bdf8"
      : metrics.queueState === "queued"
        ? "#f59e0b"
        : metrics.queueState === "skipped"
          ? "#94a3b8"
          : "#64748b";

  const tile = (label: string, value: string, helper: string, color: string, emphasis = false) => (
    <div
      key={label}
      style={{
        background: isDark
          ? `${color}${emphasis ? "2f" : "18"}`
          : `${color}${emphasis ? "24" : "14"}`,
        border: `1px solid ${color}${emphasis ? "88" : "44"}`,
        borderRadius: 10,
        padding: "12px 14px",
        boxShadow: emphasis
          ? (isDark ? `0 0 0 1px ${color}33, 0 0 16px ${color}44` : `0 0 0 1px ${color}22, 0 0 10px ${color}22`)
          : "none",
      }}
    >
      <div style={{ color, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ color: theme.text, fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>{helper}</div>
    </div>
  );

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Mutation Testing
          </div>
          <div style={{ color: theme.text, fontSize: 20, fontWeight: 900, marginTop: 3 }}>
            Mutation Score <span style={{ color: scoreColor, marginLeft: 8 }}>{metrics.mutationScore}%</span>
          </div>
        </div>
        {metrics.queueState !== "skipped" && (
          <div
            style={{
              background: `${queueColor}1a`,
              border: `1px solid ${queueColor}55`,
              color: queueColor,
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            {metrics.queueState}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {tile("Killed", `${metrics.killed}/${Math.max(metrics.totalTargets, 1)}`, "Strong tests caught these mutants", killedColor, true)}
        {tile("Survived", `${metrics.survived}`, "Weak tests let these pass", survivedTileColor, true)}
      </div>

      {metrics.trend.length === 0 ? (
        <div style={{ color: theme.textFaint, fontSize: 13 }}>No mutation cycles yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={145}>
          <AreaChart data={metrics.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.borderSoft} />
            <XAxis dataKey="cycle" tick={{ fill: theme.textFaint, fontSize: 10 }} stroke={theme.border} />
            <YAxis tick={{ fill: theme.textFaint, fontSize: 10 }} stroke={theme.border} width={40} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip theme={theme} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: theme.textMuted }} />
            <Area type="monotone" dataKey="score" name="Mutation Score" stroke="#22c55e" fill="#22c55e38" strokeWidth={2.5} />
            <Area type="monotone" dataKey="killed" name="Killed" stroke="#ec4899" fill="#ec489938" strokeWidth={2} />
            <Area type="monotone" dataKey="survived" name="Survived" stroke="#f97316" fill="#f9731638" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div>
        <div style={{ color: theme.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
          Live Mutation Stream
        </div>
        {(() => {
          const survivors = metrics.activity.filter((item) => item.status === "survived");
          const visibleSurvivors = showAllSurvivors ? survivors : survivors.slice(0, 2);

          if (survivors.length === 0) {
            return <div style={{ color: theme.textFaint, fontSize: 13 }}>No survived mutations yet.</div>;
          }

          return (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {visibleSurvivors.map((item) => {
                  const itemColor = survivedColor;

                  return (
                    <div
                      key={`${item.cycle}-${item.key}-${item.status}`}
                      style={{
                        border: `1px solid ${itemColor}33`,
                        background: isDark ? `${itemColor}10` : `${itemColor}0d`,
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ color: theme.text, fontSize: 13, fontWeight: 700 }}>
                          {item.operator} on {item.file}:{item.line}
                        </div>
                        <Badge label={item.status} color={itemColor} />
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                        {item.adapter} adapter · Cycle #{item.cycle}
                        {typeof item.duration_ms === "number" ? ` · ${item.duration_ms} ms` : ""}
                        {typeof item.tests_total === "number" && item.tests_total > 0
                          ? ` · ${item.tests_failed ?? 0} failed / ${item.tests_passed ?? 0} passed`
                          : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {survivors.length > 2 && (
                <button
                  onClick={() => setShowAllSurvivors((prev) => !prev)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    background: theme.surfaceAlt,
                    color: theme.textMuted,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {showAllSurvivors
                    ? "Hide older survived mutations"
                    : `Show all survived mutations (${survivors.length})`}
                </button>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function App() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [chartData, setChartData] = useState<ChartData>({ test: [], production: [] });
  const [mutationActivity, setMutationActivity] = useState<MutationActivity[]>([]);
  const [showOlderEvents, setShowOlderEvents] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("telemetry-theme");
    if (saved === "light" || saved === "dark") {
      return saved;
    }

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const theme = THEMES[themeMode];
  const [historyMode, setHistoryMode] = useState<"all" | "latest">("all");
  const [showClearDbDialog, setShowClearDbDialog] = useState(false);
  const [mutationPanelOpen, setMutationPanelOpen] = useState(true);
  const [cognitiveDriftOpen, setCognitiveDriftOpen] = useState(true);
  const [flowRefactorOpen, setFlowRefactorOpen] = useState(true);

  useEffect(() => {
    const socket = new WebSocket(BACKEND_WS_URL);
    socketRef.current = socket;

    const normalizeEvent = (raw: any): TelemetryEvent => ({
      ...raw,
      new_tests: Array.isArray(raw.new_tests)
        ? raw.new_tests
        : (typeof raw.new_tests === "string" ? JSON.parse(raw.new_tests) : []),
      mutation_status: raw.mutation_status ?? "queued",
      mutation_targets: Number(raw.mutation_targets ?? 0),
      mutation_killed: Number(raw.mutation_killed ?? 0),
      mutation_survived: Number(raw.mutation_survived ?? 0),
      mutation_timeout: Number(raw.mutation_timeout ?? 0),
      mutation_score: Number(raw.mutation_score ?? 0),
      mutation_pipeline_ms: Number(raw.mutation_pipeline_ms ?? 0),
      mutation_adapter: raw.mutation_adapter ?? "",
      mutation_stream_events: Number(raw.mutation_stream_events ?? 0),
      mutation_stable_keys: Number(raw.mutation_stable_keys ?? 0),
      tests_unavailable: Number(raw.tests_unavailable ?? 0),
      top_failures: Array.isArray(raw.top_failures)
        ? raw.top_failures.map((entry: unknown) => String(entry)).slice(0, 3)
        : (typeof raw.top_failures === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(raw.top_failures);
                return Array.isArray(parsed) ? parsed.map((entry) => String(entry)).slice(0, 3) : [];
              } catch {
                return [];
              }
            })()
          : []),
    });

    const toPoint = (
      cycle: number,
      complexity: number,
      loc_added: number,
      loc_removed: number,
      loc_total: number,
      functions: number,
      conditionals: number,
      classes: number,
      file_count: number,
      tests_passed: number,
      tests_total: number,
      halstead_volume: number,
      maintainability_index: number,
      nesting_depth: number,
      max_params: number,
      tests_duration_ms: number,
      test_ratio: number,
    ): ChartPoint => ({
      cycle,
      complexity,
      loc_added,
      loc_removed,
      loc_total,
      functions,
      conditionals,
      classes,
      file_count,
      pass_rate: tests_total > 0 ? Math.round((tests_passed / tests_total) * 100) : 0,
      halstead_volume,
      maintainability_index,
      nesting_depth,
      max_params,
      tests_duration_ms,
      test_ratio,
    });

    const buildChartData = (list: TelemetryEvent[]): ChartData => {
      const sorted = [...list].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
      const next: ChartData = { test: [], production: [] };

      for (const event of sorted) {
        if (event.category === "checkpoint") {
          next.test.push(
            toPoint(
              event.cycle,
              event.test_complexity ?? 0,
              event.test_loc_added ?? 0,
              event.test_loc_removed ?? 0,
              event.test_loc_total ?? 0,
              event.test_functions ?? 0,
              event.test_conditionals ?? 0,
              event.test_classes ?? 0,
              event.test_file_count ?? 0,
              event.tests_passed,
              event.tests_total,
              event.test_halstead_volume ?? 0,
              event.test_maintainability_index ?? 100,
              event.test_nesting_depth ?? 0,
              event.test_max_params ?? 0,
              event.tests_duration_ms ?? 0,
              (event.prod_loc_total ?? 0) > 0
                ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
                : 0,
            )
          );
          next.production.push(
            toPoint(
              event.cycle,
              event.prod_complexity ?? 0,
              event.prod_loc_added ?? 0,
              event.prod_loc_removed ?? 0,
              event.prod_loc_total ?? 0,
              event.prod_functions ?? 0,
              event.prod_conditionals ?? 0,
              event.prod_classes ?? 0,
              event.prod_file_count ?? 0,
              event.tests_passed,
              event.tests_total,
              event.prod_halstead_volume ?? 0,
              event.prod_maintainability_index ?? 100,
              event.prod_nesting_depth ?? 0,
              event.prod_max_params ?? 0,
              event.tests_duration_ms ?? 0,
              (event.prod_loc_total ?? 0) > 0
                ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
                : 0,
            )
          );
        } else {
          const point = toPoint(
            event.cycle,
            event.complexity,
            event.loc_added,
            event.loc_removed ?? 0,
            event.loc_total,
            event.functions,
            event.conditionals,
            event.classes,
            0,
            event.tests_passed,
            event.tests_total,
            event.halstead_volume ?? 0,
            event.maintainability_index ?? 100,
            event.nesting_depth ?? 0,
            event.max_params ?? 0,
            event.tests_duration_ms ?? 0,
            0,
          );
          if (event.category === "test") {
            next.test.push(point);
          } else if (event.category === "production") {
            next.production.push(point);
          }
        }
      }

      return next;
    };

    socket.onmessage = (msg) => {
      const raw = JSON.parse(msg.data);

      if (raw?.type === "cleared") {
        setEvents([]);
        setChartData({ test: [], production: [] });
        setMutationActivity([]);
        setShowOlderEvents(false);
        return;
      }

      if (raw?.type === "snapshot" && Array.isArray(raw.events)) {
        const snapshot = (raw as SnapshotMessage).events.map(normalizeEvent);

        // Side panel expects latest first.
        const latestFirst = [...snapshot].sort((a, b) => (b.cycle ?? 0) - (a.cycle ?? 0));
        setEvents(latestFirst);
        setChartData(buildChartData(snapshot));
        setMutationActivity([]);
        return;
      }

      if (raw?.type === "mutation_update") {
        const update = raw as MutationUpdateMessage;
        setEvents((prev) => prev.map((event) => (
          event.cycle === update.cycle
            ? { ...event, ...update.summary }
            : event
        )));

        if (update.mutation) {
          setMutationActivity((prev) => [
            {
              ...update.mutation,
              cycle: update.cycle,
              receivedAt: Date.now(),
            },
            ...prev,
          ].slice(0, 16));
        }
        return;
      }

      const event: TelemetryEvent = normalizeEvent(raw);

      setEvents((prev) => [event, ...prev]);

      // Primary mode: one checkpoint event per test run with split test/prod metrics.
      if (event.category === "checkpoint") {
        // Keep mutation stream scoped to the active cycle only.
        setMutationActivity([]);

        const testPoint: ChartPoint = {
          cycle: event.cycle,
          complexity: event.test_complexity ?? 0,
          loc_added: event.test_loc_added ?? 0,
          loc_removed: event.test_loc_removed ?? 0,
          loc_total: event.test_loc_total ?? 0,
          functions: event.test_functions ?? 0,
          conditionals: event.test_conditionals ?? 0,
          classes: event.test_classes ?? 0,
          file_count: event.test_file_count ?? 0,
          pass_rate: event.tests_total > 0 ? Math.round((event.tests_passed / event.tests_total) * 100) : 0,
          halstead_volume: event.test_halstead_volume ?? 0,
          maintainability_index: event.test_maintainability_index ?? 100,
          nesting_depth: event.test_nesting_depth ?? 0,
          max_params: event.test_max_params ?? 0,
          tests_duration_ms: event.tests_duration_ms ?? 0,
          test_ratio: (event.prod_loc_total ?? 0) > 0
            ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
            : 0,
        };

        const prodPoint: ChartPoint = {
          cycle: event.cycle,
          complexity: event.prod_complexity ?? 0,
          loc_added: event.prod_loc_added ?? 0,
          loc_removed: event.prod_loc_removed ?? 0,
          loc_total: event.prod_loc_total ?? 0,
          functions: event.prod_functions ?? 0,
          conditionals: event.prod_conditionals ?? 0,
          classes: event.prod_classes ?? 0,
          file_count: event.prod_file_count ?? 0,
          pass_rate: event.tests_total > 0 ? Math.round((event.tests_passed / event.tests_total) * 100) : 0,
          halstead_volume: event.prod_halstead_volume ?? 0,
          maintainability_index: event.prod_maintainability_index ?? 100,
          nesting_depth: event.prod_nesting_depth ?? 0,
          max_params: event.prod_max_params ?? 0,
          tests_duration_ms: event.tests_duration_ms ?? 0,
          test_ratio: (event.prod_loc_total ?? 0) > 0
            ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
            : 0,
        };

        setChartData((prev) => ({
          test: [...prev.test, testPoint],
          production: [...prev.production, prodPoint],
        }));
        return;
      }

      // Backward compatibility for older per-file events.
      const point: ChartPoint = toPoint(
        event.cycle,
        event.complexity,
        event.loc_added,
        event.loc_removed ?? 0,
        event.loc_total,
        event.functions,
        event.conditionals,
        event.classes,
        0,
        event.tests_passed,
        event.tests_total,
        event.halstead_volume ?? 0,
        event.maintainability_index ?? 100,
        event.nesting_depth ?? 0,
        event.max_params ?? 0,
        event.tests_duration_ms ?? 0,
        0,
      );

      const categoryKey: "test" | "production" =
        event.category === "test" ? "test" : "production";

      setChartData((prev) => ({
        ...prev,
        [categoryKey]: [...prev[categoryKey], point],
      }));
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("telemetry-theme", themeMode);
  }, [themeMode]);

  const cycleEvents = useMemo(() => mergeEventsByCycle(events), [events]);
  const flowStateMetrics = useMemo(() => computeFlowStateTelemetry(events, cycleEvents), [events, cycleEvents]);
  const refactoringMetrics = useMemo(() => computeRefactoringTelemetry(events, cycleEvents), [events, cycleEvents]);
  const architecturalDriftTelemetry = useMemo(() => computeArchitecturalDriftTelemetry(cycleEvents), [cycleEvents]);
  const cognitiveLoadMetrics = useMemo(() => computeCognitiveLoadTelemetry(events, cycleEvents), [events, cycleEvents]);
  const mutationTestingMetrics = useMemo(
    () => computeMutationTestingTelemetry(cycleEvents, mutationActivity),
    [cycleEvents, mutationActivity]
  );

  const visibleEvents = historyMode === "latest"
    ? cycleEvents.slice(0, 1)
    : cycleEvents;

  const visibleChartData: ChartData = historyMode === "latest"
    ? {
        test: chartData.test.slice(-1),
        production: chartData.production.slice(-1),
      }
    : chartData;

  const latestVisibleEvents = visibleEvents.slice(0, 3);
  const olderVisibleEvents = visibleEvents.slice(3);

  function clearVisibleMetrics() {
    setEvents([]);
    setChartData({ test: [], production: [] });
    setMutationActivity([]);
    setShowOlderEvents(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.appBg,
        color: theme.text,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.5); }
        }

        @keyframes flowtide-mark {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1) saturate(1);
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
          }
          50% {
            transform: scale(1.08);
            filter: brightness(1.28) saturate(1.35);
            box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.38), 0 0 34px rgba(251, 191, 36, 0.5), 0 0 60px rgba(251, 191, 36, 0.22), 0 18px 38px rgba(15, 23, 42, 0.22);
          }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${theme.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <FlowtideMark theme={theme} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1 }}>
            <span style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>
              <span style={{ color: themeMode === "dark" ? "#fbbf24" : "#f97316" }}>flow</span>
              <span style={{ color: themeMode === "dark" ? theme.titleColor : "#f97316" }}>tide</span>
            </span>
            <span style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1.8, color: themeMode === "dark" ? "#cbd5e1" : "#475569", textTransform: "uppercase", marginTop: 5 }}>TDD Telemetry Tool</span>
          </div>
        </div>
        {visibleEvents.length > 0 && (() => {
          const latest = visibleEvents[0];
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                minWidth: 340,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: latest.tests_failed > 0 ? "#ef4444" : "#ff8a00",
                  boxShadow: latest.tests_failed > 0
                    ? "0 0 0 3px #ef444422, 0 0 9px #ef444488"
                    : "0 0 0 3px #ff8a0028, 0 0 11px #ff8a00aa",
                  animation: "pulse-dot 1.4s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: 0.2,
                    textRendering: "geometricPrecision",
                  }}
                >
                  Current Cycle #{latest.cycle}
                </span>
                <span style={{ color: latest.tests_failed > 0 ? "#ef4444" : "#10b981", fontSize: 11, fontWeight: 700 }}>
                  {(() => {
                    const executed = latest.tests_total ?? 0;
                    const unavailable = latest.tests_unavailable ?? 0;

                    if (executed > 0) {
                      const executedLabel = latest.tests_failed > 0
                        ? `${latest.tests_failed} failing, ${latest.tests_passed} passing test${executed === 1 ? "" : "s"} in cycle`
                        : `${latest.tests_passed} passing test${latest.tests_passed === 1 ? "" : "s"} in cycle`;

                      if (unavailable > 0) {
                        return `${executedLabel} (+${unavailable} discovered unavailable)`;
                      }

                      return executedLabel;
                    }

                    if (unavailable > 0) {
                      return `${unavailable} test${unavailable === 1 ? "" : "s"} discovered (execution unavailable)`;
                    }

                    return "No tests recorded in cycle";
                  })()}
                </span>
              </div>
              {latest.tests_total > 0 && (
                <div style={{ marginLeft: "auto", width: 80, height: 6, background: theme.surfaceAlt, borderRadius: 999, overflow: "hidden", flexShrink: 0 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(latest.tests_passed / latest.tests_total) * 100}%`,
                      background: latest.tests_failed === 0 ? "#10b981" : "#f59e0b",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })()}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            padding: "6px",
          }}
        >
          <button
            onClick={() => setHistoryMode("all")}
            style={{
              background: historyMode === "all" ? theme.surface : "transparent",
              color: historyMode === "all" ? theme.text : theme.textMuted,
              border: `1px solid ${historyMode === "all" ? theme.border : "transparent"}`,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Show All Cycles
          </button>
          <button
            onClick={() => setHistoryMode("latest")}
            style={{
              background: historyMode === "latest" ? theme.surface : "transparent",
              color: historyMode === "latest" ? theme.text : theme.textMuted,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Keep Latest Cycle
          </button>
          <button
            onClick={clearVisibleMetrics}
            style={{
              background: theme.surface,
              color: "#ef4444",
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Clear View
          </button>
          <button
            onClick={() => setShowClearDbDialog(true)}
            style={{
              background: theme.surface,
              color: "#ef4444",
              border: `1px solid #ef4444`,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Clear All Data
          </button>
        </div>
        <button
          onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
          style={{
            marginLeft: 10,
            background: themeMode === "dark" ? "#f8fafc" : "#0f172a",
            color: themeMode === "dark" ? "#0f172a" : "#f8fafc",
            border: `2px solid ${themeMode === "dark" ? "#cbd5e1" : "#1e293b"}`,
            borderRadius: 8,
            padding: "7px 12px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.2,
            boxShadow: themeMode === "dark"
              ? "0 2px 8px rgba(15,23,42,0.18)"
              : "0 2px 8px rgba(2,6,23,0.35)",
          }}
        >
          {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Chart area - left scrollable panels */}
        <div
          ref={leftPanelRef}
          style={{
            flex: 1,
            padding: "24px 28px",
            overflow: "auto",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 8 }}>
            <MetricsChart
              title="Test Code"
              titleFontSize={22}
              accentColor="#6366f1"
              data={visibleChartData.test}
              emptyLabel="No test file changes yet"
              theme={theme}
              chartKind="test"
            />
            <MetricsChart
              title="Production Code"
              titleFontSize={22}
              accentColor="#10b981"
              data={visibleChartData.production}
              emptyLabel="No production file changes yet"
              theme={theme}
              chartKind="production"
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setMutationPanelOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: theme.textFaint, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.2, textTransform: "uppercase",
                padding: "4px 0", marginBottom: mutationPanelOpen ? 8 : 0,
              }}
            >
              <span style={{ fontSize: 10, display: "inline-block", transform: mutationPanelOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
              Mutation Testing
            </button>
            {mutationPanelOpen && <MutationTestingPanel metrics={mutationTestingMetrics} theme={theme} />}
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setCognitiveDriftOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: theme.textFaint, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.2, textTransform: "uppercase",
                padding: "4px 0", marginBottom: cognitiveDriftOpen ? 8 : 0,
              }}
            >
              <span style={{ fontSize: 10, display: "inline-block", transform: cognitiveDriftOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
              Cognitive Load &amp; Architectural Drift
            </button>
            {cognitiveDriftOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
                <CognitiveLoadPanel metrics={cognitiveLoadMetrics} theme={theme} />
                <ArchitecturalDriftPanel telemetry={architecturalDriftTelemetry} theme={theme} />
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setFlowRefactorOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: theme.textFaint, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.2, textTransform: "uppercase",
                padding: "4px 0", marginBottom: flowRefactorOpen ? 8 : 0,
              }}
            >
              <span style={{ fontSize: 10, display: "inline-block", transform: flowRefactorOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
              Flow State &amp; Refactoring
            </button>
            {flowRefactorOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
                <FlowStatePanel metrics={flowStateMetrics} theme={theme} />
                <RefactoringTelemetryPanel metrics={refactoringMetrics} theme={theme} />
              </div>
            )}
          </div>

          {visibleEvents.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: theme.textFaint,
                marginTop: 60,
                fontSize: 15,
              }}
            >
              Waiting for file changes... Save a file in the watched directory to see data.
            </div>
          )}

        </div>

        {/* Side trace panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${theme.borderSoft}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: `1px solid ${theme.borderSoft}`,
              fontSize: 13,
              fontWeight: 600,
              color: theme.textMuted,
              flexShrink: 0,
            }}
          >
            Recent Changes
          </div>
          <div
            ref={sidebarRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 12px",
            }}
          >
            {visibleEvents.length === 0 ? (
              <div style={{ color: theme.textFaint, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No events yet
              </div>
            ) : (
              <>
                {latestVisibleEvents.map((event, i) => (
                  <EventCard key={`${event.timestamp}-${i}`} event={event} index={i} theme={theme} isLatest={i === 0} />
                ))}

                {olderVisibleEvents.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      borderTop: `1px solid ${theme.borderSoft}`,
                      paddingTop: 10,
                    }}
                  >
                    <button
                      onClick={() => setShowOlderEvents((prev) => !prev)}
                      style={{
                        width: "100%",
                        background: theme.surfaceAlt,
                        color: theme.textMuted,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 6,
                        padding: "8px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {showOlderEvents
                        ? `Hide older changes (${olderVisibleEvents.length})`
                        : `Show older changes (${olderVisibleEvents.length})`}
                    </button>

                    {showOlderEvents && (
                      <div style={{ marginTop: 10 }}>
                        {olderVisibleEvents.map((event, i) => (
                          <EventCard
                            key={`${event.timestamp}-older-${i}`}
                            event={event}
                            index={i + 3}
                            theme={theme}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${theme.borderSoft}`,
          padding: "10px 28px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: theme.textFaint,
          fontSize: 11,
          letterSpacing: 0.3,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>Flowtide v{APP_VERSION}</span>
          <span>Created by Ngumbah Michael Nyika</span>
        </div>
        <span>{CURRENT_YEAR}</span>
      </div>

      {/* Clear All Data confirmation dialog */}
      {showClearDbDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowClearDbDialog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: "28px 32px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>
              ⚠ Clear All Data?
            </div>
            <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              This will permanently delete <strong style={{ color: theme.text }}>all recorded events</strong> from the database.
              Charts and metrics will be reset and cannot be recovered.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowClearDbDialog(false)}
                style={{
                  background: theme.surfaceAlt,
                  color: theme.textMuted,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  padding: "8px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  socketRef.current?.send(JSON.stringify({ type: "clear_db" }));
                  setShowClearDbDialog(false);
                }}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Yes, clear everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

