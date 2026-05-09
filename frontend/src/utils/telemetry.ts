import { TelemetryEvent, FlowStateMetrics, RefactoringTelemetryMetrics, ArchitecturalDriftTelemetry, CognitiveLoadMetrics } from "../types/telemetry";
import { clamp, focusKind } from "./formatters";

export function computeFlowStateTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): FlowStateMetrics {
  if (events.length === 0) {
    return {
      flowScore: 0,
      focusedSeconds: 0,
      contextSwitches: 0,
      fileHopsPerMinute: 0,
      testCadenceSeconds: null,
      focusScore: 0,
      contextScore: 100,
      navigationScore: 100,
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
  const navigationScore = clamp(100 - fileHopsPerMinute * 45, 0, 100);
  const cadenceScore = testCadenceSeconds == null
    ? 50
    : clamp(100 - Math.abs(testCadenceSeconds - 90) * 0.8, 0, 100);

  const flowScore = Math.round(
    focusScore * 0.35
    + contextScore * 0.25
    + navigationScore * 0.2
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
    navigationScore,
    cadenceScore,
  };
}

export function computeRefactoringTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): RefactoringTelemetryMetrics {
  if (cycleEvents.length === 0) {
    return {
      refactorDensity: 0,
      avgRemovedPerCycle: 0,
      signalCounts: { renames: 0, moves: 0, extractions: 0, simplifications: 0 },
      deletionHeavyScore: 0,
      refactorCoreScore: 0,
      codeQualityScore: 50,
      refactorPositivityScore: 100,
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

  const cycleCount = Math.max(1, cycleEvents.length);
  const signalWeight = renames * 1.45 + moves * 1.25 + extractions * 1.8 + simplifications * 1.6 + deletionHeavyCycles * 0.95;
  const densityRaw = (signalWeight / (cycleCount * 1.9 + 4)) * 100;
  const refactorDensity = Math.round(clamp(densityRaw, 0, 100));

  const avgRemovedPerCycle = codeRemovedLoc / cycleCount;
  const refactorCoreScore = Math.round(renames + moves + extractions + simplifications);
  const codeQualityScore = lastComplexity <= firstComplexity
    ? clamp(60 + Math.min(40, Math.abs(lastComplexity - firstComplexity) * 2), 0, 100)
    : clamp(60 - (lastComplexity - firstComplexity) * 3, 0, 100);
  const deletionHeavyScore = clamp(100 - (deletionHeavyCycles / cycleCount) * 100, 0, 100);

  return {
    refactorDensity,
    avgRemovedPerCycle: Math.round(avgRemovedPerCycle),
    signalCounts: { renames, moves, extractions, simplifications },
    deletionHeavyScore,
    refactorCoreScore,
    codeQualityScore,
    refactorPositivityScore: deletionHeavyScore,
  };
}

export function computeArchitecturalDriftTelemetry(cycleEvents: TelemetryEvent[]): ArchitecturalDriftTelemetry {
  if (cycleEvents.length === 0) {
    return {
      moduleCoupling: [],
      dependencyGrowth: [],
      circularReferences: [],
      importGraphEvolution: [],
    };
  }

  const sorted = [...cycleEvents].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
  const moduleCoupling: { cycle: number; value: number }[] = [];
  const dependencyGrowth: { cycle: number; value: number }[] = [];
  const circularReferences: { cycle: number; value: number }[] = [];
  const importGraphEvolution: { cycle: number; value: number }[] = [];

  let cumulativeFileTouches = 0;
  let cumulativeUniqueApprox = 0;

  for (const c of sorted) {
    const filesInCycle = Math.max(1, (c.prod_file_count ?? 0) + (c.test_file_count ?? 0));
    const added = (c.prod_loc_added ?? 0) + (c.test_loc_added ?? 0) + (c.loc_added ?? 0);
    const removed = (c.prod_loc_removed ?? 0) + (c.test_loc_removed ?? 0) + (c.loc_removed ?? 0);
    const functions = (c.prod_functions ?? 0) + (c.test_functions ?? 0) + (c.functions ?? 0);
    const conditionals = (c.prod_conditionals ?? 0) + (c.test_conditionals ?? 0) + (c.conditionals ?? 0);
    const complexity = (c.prod_complexity ?? 0) + (c.test_complexity ?? 0) + (c.complexity ?? 0);

    const mixedCycleBonus = (c.prod_file_count ?? 0) > 0 && (c.test_file_count ?? 0) > 0 ? 8 : 0;
    const moduleCouplingVal = clamp(
      (functions / (filesInCycle * 6)) * 100
      + (conditionals / (filesInCycle * 10)) * 20
      + mixedCycleBonus,
      0,
      100
    );

    const dependencyGrowthVal = clamp(50 + ((added - removed) / 220) * 50, 0, 100);
    const complexityPressure = clamp(complexity / 4, 0, 100);
    const circularReferencesVal = clamp(
      moduleCouplingVal * 0.5 + dependencyGrowthVal * 0.3 + complexityPressure * 0.2 - 20,
      0,
      100
    );

    cumulativeFileTouches += filesInCycle;
    cumulativeUniqueApprox += Math.max(1, filesInCycle * 0.6);
    const importGraphVal = clamp(
      (cumulativeFileTouches / Math.max(1, sorted.length * 4)) * 55
      + (cumulativeUniqueApprox / Math.max(1, sorted.length * 3)) * 45,
      0,
      100
    );

    moduleCoupling.push({ cycle: c.cycle ?? 0, value: Math.round(moduleCouplingVal) });
    dependencyGrowth.push({ cycle: c.cycle ?? 0, value: Math.round(dependencyGrowthVal) });
    circularReferences.push({ cycle: c.cycle ?? 0, value: Math.round(circularReferencesVal) });
    importGraphEvolution.push({ cycle: c.cycle ?? 0, value: Math.round(importGraphVal) });
  }

  return {
    moduleCoupling,
    dependencyGrowth,
    circularReferences,
    importGraphEvolution,
  };
}

export function computeCognitiveLoadTelemetry(events: TelemetryEvent[], cycleEvents: TelemetryEvent[]): CognitiveLoadMetrics {
  if (events.length === 0) {
    return {
      cognitiveLoad: 0,
      branchingComplexity: 0,
      branchingScore: 0,
      simultaneousFiles: 0,
      simultaneousScore: 0,
      editFrequency: 0,
      editScore: 0,
      navigationThrashing: 0,
      navigationScore: 0,
      treemapData: [],
    };
  }

  const recentLookback = events.slice(0, 20);
  const totalConditionals = recentLookback.reduce((sum, e) => sum + ((e.prod_conditionals ?? 0) + (e.test_conditionals ?? 0) + (e.conditionals ?? 0)), 0);
  const totalComplexity = recentLookback.reduce((sum, e) => sum + ((e.prod_complexity ?? 0) + (e.test_complexity ?? 0) + (e.complexity ?? 0)), 0);
  const totalNesting = recentLookback.reduce((sum, e) => sum + ((e.prod_nesting_depth ?? 0) + (e.test_nesting_depth ?? 0) + (e.nesting_depth ?? 0)), 0);
  const branchingComplexity = totalConditionals + totalComplexity * 0.5 + totalNesting * 0.3;
  const branchingScore = clamp(Math.min(branchingComplexity / 100 * 100, 100), 0, 100);

  const recentFiles = new Set(recentLookback.map((e) => e.filename).filter((f) => f));
  const simultaneousFiles = recentFiles.size;
  const simultaneousScore = clamp((simultaneousFiles / 12) * 100, 0, 100);

  const totalLocChanged = recentLookback.reduce((sum, e) => {
    const added = (e.prod_loc_added ?? 0) + (e.test_loc_added ?? 0) + (e.loc_added ?? 0);
    const removed = (e.prod_loc_removed ?? 0) + (e.test_loc_removed ?? 0) + (e.loc_removed ?? 0);
    return sum + added + removed;
  }, 0);
  const editFrequency = totalLocChanged;
  const editScore = clamp((totalLocChanged / 1000) * 100, 0, 100);

  let fileHops = 0;
  for (let i = 1; i < recentLookback.length; i += 1) {
    if (recentLookback[i].filename && recentLookback[i - 1].filename && recentLookback[i].filename !== recentLookback[i - 1].filename) {
      fileHops += 1;
    }
  }

  const fileFreq = new Map<string, number>();
  for (const e of recentLookback) {
    const fn = e.filename;
    fileFreq.set(fn, (fileFreq.get(fn) ?? 0) + 1);
  }
  const revisitCount = Array.from(fileFreq.values()).filter((count) => count > 2).length;
  const navigationThrashing = fileHops + revisitCount * 3;
  const navigationScore = clamp(100 - navigationThrashing * 2.5, 0, 100);

  const cognitiveLoad = Math.round(
    branchingScore * 0.25
    + simultaneousScore * 0.25
    + editScore * 0.25
    + navigationScore * 0.25
  );

  const treemapData = [
    { name: "Branching\nComplexity", size: branchingScore, value: branchingScore },
    { name: "Simultaneous\nFiles", size: simultaneousScore, value: simultaneousScore },
    { name: "Edit\nFrequency", size: editScore, value: editScore },
    { name: "Navigation\nThrashing", size: navigationScore, value: navigationScore },
  ];

  return {
    cognitiveLoad,
    branchingComplexity: Math.round(branchingComplexity),
    branchingScore,
    simultaneousFiles,
    simultaneousScore,
    editFrequency: Math.round(editFrequency),
    editScore,
    navigationThrashing: Math.round(navigationThrashing),
    navigationScore,
    treemapData,
  };
}

export function mergeEventsByCycle(events: TelemetryEvent[]): TelemetryEvent[] {
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
