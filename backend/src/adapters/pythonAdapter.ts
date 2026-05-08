import { LanguageAdapter }
  from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const pythonAdapter:
LanguageAdapter = {

  language: "Python",

  supports(path) {
    return path.endsWith(".py");
  },

  classify(path) {
    return path.includes("test")
      ? "test"
      : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.py$/, "");
  },

  extractTests(code) {
    const matches = [...code.matchAll(/def\s+(test_\w+)\s*\(/g)];
    return matches.map((m) => m[1]);
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions =
      (code.match(/def /g)
      || []).length;

    const conditionals =
      (code.match(/if /g)
      || []).length;

    const classes =
      (code.match(/class /g)
      || []).length;

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
      nesting_depth: computeNestingDepth(code, "Python"),
      max_params: computeMaxParams(code),
    };
  }
};