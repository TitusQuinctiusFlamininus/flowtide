import fs from "fs";

import { adapterFor } from "../registry";
import { EMPTY_RESULT } from "../test-runners/utils";
import { runTests } from "../test-runners/runTests";
import { mutationAdapterFor } from "./registry";
import { withMutationPathSuppressed } from "./runtimeGuards";
import type { MutationCandidate, MutationExecutionDetail } from "./types";

export interface MutationSummary {
  mutation_status: "queued" | "running" | "completed" | "skipped";
  mutation_targets: number;
  mutation_killed: number;
  mutation_survived: number;
  mutation_timeout: number;
  mutation_score: number;
  mutation_pipeline_ms: number;
  mutation_adapter: string;
  mutation_stream_events: number;
  mutation_stable_keys: number;
}

interface MutationUpdatePayload {
  cycle: number;
  summary: MutationSummary;
  mutation?: MutationExecutionDetail;
}

interface EnqueueMutationTestingArgs {
  cycle: number;
  filePaths: string[];
  onUpdate(update: MutationUpdatePayload): void;
}

const MAX_MUTATIONS_PER_FILE = 4;
const MAX_MUTATIONS_PER_CYCLE = 8;

let mutationQueue: Promise<void> = Promise.resolve();

function createSummary(overrides: Partial<MutationSummary> = {}): MutationSummary {
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

function applyMutation(code: string, candidate: MutationCandidate) {
  return `${code.slice(0, candidate.edit.start)}${candidate.edit.replacement}${code.slice(candidate.edit.end)}`;
}

function recalculateScore(summary: MutationSummary) {
  if (summary.mutation_targets <= 0) {
    return 0;
  }

  return Math.round((summary.mutation_killed / summary.mutation_targets) * 100);
}

function collectCandidates(filePaths: string[]) {
  const candidates: MutationCandidate[] = [];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const code = fs.readFileSync(filePath, "utf-8");
    const language = adapterFor(filePath)?.language ?? "unknown";
    const adapter = mutationAdapterFor(filePath);
    const generated = adapter
      .createMutations({ filePath, code, language })
      .slice(0, MAX_MUTATIONS_PER_FILE);

    candidates.push(...generated);

    if (candidates.length >= MAX_MUTATIONS_PER_CYCLE) {
      break;
    }
  }

  const unique = new Map<string, MutationCandidate>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.key)) {
      unique.set(candidate.key, candidate);
    }
  }

  return Array.from(unique.values()).slice(0, MAX_MUTATIONS_PER_CYCLE);
}

async function executeCandidate(candidate: MutationCandidate) {
  if (!fs.existsSync(candidate.filePath)) {
    return {
      result: EMPTY_RESULT,
      status: "timeout" as const,
      duration_ms: 0,
    };
  }

  const original = fs.readFileSync(candidate.filePath, "utf-8");
  const mutated = applyMutation(original, candidate);

  if (mutated === original) {
    return {
      result: EMPTY_RESULT,
      status: "timeout" as const,
      duration_ms: 0,
    };
  }

  const startedAt = Date.now();
  let result = EMPTY_RESULT;

  try {
    await withMutationPathSuppressed(candidate.filePath, async () => {
      fs.writeFileSync(candidate.filePath, mutated, "utf-8");
      result = await runTests(candidate.filePath);
      fs.writeFileSync(candidate.filePath, original, "utf-8");
    });
  } catch {
    await withMutationPathSuppressed(candidate.filePath, async () => {
      fs.writeFileSync(candidate.filePath, original, "utf-8");
      return undefined;
    });
  }

  const duration_ms = Date.now() - startedAt;

  if (result.total === 0) {
    return { result, status: "timeout" as const, duration_ms };
  }

  return {
    result,
    status: result.failed > 0 ? ("killed" as const) : ("survived" as const),
    duration_ms,
  };
}

async function runMutationTesting({ cycle, filePaths, onUpdate }: EnqueueMutationTestingArgs) {
  const startedAt = Date.now();
  const candidates = collectCandidates(filePaths);
  const adapterSummary = Array.from(new Set(candidates.map((candidate) => candidate.adapter))).join(", ");
  const summary = createSummary({
    mutation_status: candidates.length > 0 ? "queued" : "skipped",
    mutation_targets: candidates.length,
    mutation_adapter: adapterSummary,
    mutation_stable_keys: candidates.length,
  });

  onUpdate({ cycle, summary });

  if (candidates.length === 0) {
    return;
  }

  for (const candidate of candidates) {
    summary.mutation_status = "running";
    summary.mutation_pipeline_ms = Date.now() - startedAt;
    summary.mutation_stream_events += 1;

    onUpdate({
      cycle,
      summary: { ...summary },
      mutation: {
        key: candidate.key,
        adapter: candidate.adapter,
        operator: candidate.operator,
        file: candidate.filename,
        line: candidate.line,
        column: candidate.column,
        status: "running",
      },
    });

    const execution = await executeCandidate(candidate);

    if (execution.status === "killed") {
      summary.mutation_killed += 1;
    } else if (execution.status === "survived") {
      summary.mutation_survived += 1;
    } else {
      summary.mutation_timeout += 1;
    }

    summary.mutation_pipeline_ms = Date.now() - startedAt;
    summary.mutation_score = recalculateScore(summary);

    onUpdate({
      cycle,
      summary: { ...summary },
      mutation: {
        key: candidate.key,
        adapter: candidate.adapter,
        operator: candidate.operator,
        file: candidate.filename,
        line: candidate.line,
        column: candidate.column,
        status: execution.status,
        duration_ms: execution.duration_ms,
        tests_passed: execution.result.passed,
        tests_failed: execution.result.failed,
        tests_total: execution.result.total,
      },
    });
  }

  summary.mutation_status = "completed";
  summary.mutation_pipeline_ms = Date.now() - startedAt;
  summary.mutation_score = recalculateScore(summary);

  onUpdate({ cycle, summary: { ...summary } });
}

export function enqueueMutationTesting(args: EnqueueMutationTestingArgs) {
  mutationQueue = mutationQueue
    .catch(() => undefined)
    .then(() => runMutationTesting(args));

  return mutationQueue;
}