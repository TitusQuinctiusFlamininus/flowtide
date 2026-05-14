export interface ParsedTestResult {
  passed: number;
  failed: number;
  total: number;
  unavailable?: number;
  top_failures?: string[];
}

export interface TestRunResult {
  passed: number;
  failed: number;
  total: number;
  unavailable: number;
  top_failures: string[];
  duration_ms: number;
}

export interface DetectedProject {
  kind: string;
  root: string;
}

export interface TestRunner {
  kind: string;
  detect(filePath: string): DetectedProject | null;
  execute(root: string): Promise<string>;
  parse(output: string): ParsedTestResult;
}
