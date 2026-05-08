import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const rubyAdapter: LanguageAdapter = {

  language: "Ruby",

  supports(path) {
    return path.endsWith(".rb");
  },

  classify(path) {
    return path.includes("_spec") || path.includes("_test") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path)
      .replace(/_spec\.rb$/, "")
      .replace(/_test\.rb$/, "")
      .replace(/\.rb$/, "");
  },

  extractTests(code) {
    // RSpec: it "..." / it '...'
    // Minitest: def test_*
    const rspec = [...code.matchAll(/\bit\s+['"](.+?)['"]/g)].map((m) => m[1]);
    const mini = [...code.matchAll(/def\s+(test_\w+)/g)].map((m) => m[1]);
    return [...rspec, ...mini];
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions = (code.match(/\bdef\s+\w+/g) || []).length;
    const conditionals = (code.match(/\bif\b/g) || []).length;
    const classes = (code.match(/\bclass\s+\w+/g) || []).length;

    const complexity = functions + conditionals;
    const halstead_volume = computeHalstead(code);

    return {
      functions,
      conditionals,
      classes,
      complexity,
      loc_total,
      halstead_volume,
      maintainability_index: computeMaintainabilityIndex(halstead_volume, complexity, loc_total),
      nesting_depth: computeNestingDepth(code, "Ruby"),
      max_params: computeMaxParams(code),
    };
  },
};
