export interface MutationEdit {
  start: number;
  end: number;
  original: string;
  replacement: string;
}

export interface MutationCandidate {
  key: string;
  adapter: string;
  operator: string;
  filePath: string;
  filename: string;
  language: string;
  line: number;
  column: number;
  preview: string;
  edit: MutationEdit;
}

export interface MutationAdapter {
  name: string;
  supports(filePath: string): boolean;
  createMutations(input: {
    filePath: string;
    code: string;
    language: string;
  }): MutationCandidate[];
}

export interface MutationExecutionDetail {
  key: string;
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
}