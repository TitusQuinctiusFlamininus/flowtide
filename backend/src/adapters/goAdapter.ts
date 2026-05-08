import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const goAdapter: LanguageAdapter = {

  language: "Go",

  supports(path) {
    return path.endsWith(".go");
  },

  classify(path) {
    return path.endsWith("_test.go") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/_test\.go$/, "").replace(/\.go$/, "");
  },

  extractTests(code) {
    const matches = [...code.matchAll(/func\s+(Test\w+)\s*\(\s*t\s+\*testing\.T\s*\)/g)];
    return matches.map((m) => m[1]);
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions = (code.match(/^func\s+/gm) || []).length;
    const conditionals = (code.match(/\bif\b/g) || []).length;
    const classes = (code.match(/^type\s+\w+\s+struct/gm) || []).length;

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
      nesting_depth: computeNestingDepth(code, "Go"),
      max_params: computeMaxParams(code),
    };
  },
};
