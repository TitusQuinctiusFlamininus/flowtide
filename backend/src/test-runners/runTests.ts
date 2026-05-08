import { builtInTestRunners, detectProject } from "./runners";
import type { TestRunResult } from "./types";
import { EMPTY_RESULT } from "./utils";

export type { TestRunResult } from "./types";
export { builtInTestRunners } from "./runners";

export async function runTests(filePath: string): Promise<TestRunResult> {
  const match = detectProject(filePath, builtInTestRunners);
  if (!match) return EMPTY_RESULT;

  const { project, runner } = match;
  console.log(`[runTests] kind=${project.kind} root=${project.root}`);

  const start = Date.now();
  const output = await runner.execute(project.root);
  const duration_ms = Date.now() - start;

  console.log(`[runTests] ${runner.kind} output:`, output.slice(0, 500));
  const result = runner.parse(output);
  return { ...result, duration_ms };
}
