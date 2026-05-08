import { LanguageAdapter }
  from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const rustAdapter:
LanguageAdapter = {

  language: "Rust",

  supports(path) {
    return path.endsWith(".rs");
  },

  classify(path) {
    return path.includes("test")
      ? "test"
      : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.rs$/, "");
  },

  extractTests(code) {
    const matches = [...code.matchAll(/#\[test\][\s\S]*?fn\s+(\w+)\s*\(/g)];
    return matches.map((m) => m[1]);
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions =
      (code.match(/fn /g)
      || []).length;

    const conditionals =
      (code.match(/if /g)
      || []).length;

    const structs =
      (code.match(/struct /g)
      || []).length;

    const complexity = functions + conditionals;
    const halstead_volume = computeHalstead(code);

    return {
      functions,
      conditionals,
      classes: structs,
      complexity,
      loc_total,
      halstead_volume,
      maintainability_index: computeMaintainabilityIndex(halstead_volume, complexity, loc_total),
      nesting_depth: computeNestingDepth(code, "Rust"),
      max_params: computeMaxParams(code),
    };
  }
};