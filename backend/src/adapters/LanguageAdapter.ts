export interface LanguageAdapter {
  language: string;
  supports(path: string): boolean;

  classify(
    path: string
  ): "test" | "production";

  extractTestName(path: string): string;

  /** Extract individual test case names (it/test/describe blocks) from source */
  extractTests(code: string): string[];

  analyze(code: string): Promise<{
    functions: number;
    conditionals: number;
    classes: number;
    complexity: number;
    loc_total: number;
    halstead_volume: number;
    maintainability_index: number;
    nesting_depth: number;
    max_params: number;
  }>;
}