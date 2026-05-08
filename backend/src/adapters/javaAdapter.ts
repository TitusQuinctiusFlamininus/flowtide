import { LanguageAdapter }
  from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const javaAdapter:
LanguageAdapter = {

  language: "Java",

  supports(path) {
    return path.endsWith(".java");
  },

  classify(path) {
    return path.includes("Test")
      ? "test"
      : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.java$/, "");
  },

  extractTests(code) {
    const matches = [...code.matchAll(/@Test[\s\S]*?void\s+(\w+)\s*\(/g)];
    return matches.map((m) => m[1]);
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const methods =
      (code.match(/void|public/g)
      || []).length;

    const conditionals =
      (code.match(/if/g)
      || []).length;

    const classes =
      (code.match(/class/g)
      || []).length;

    const complexity = methods + conditionals;
    const halstead_volume = computeHalstead(code);

    return {
      functions: methods,
      conditionals,
      classes,
      complexity,
      loc_total,
      halstead_volume,
      maintainability_index: computeMaintainabilityIndex(halstead_volume, complexity, loc_total),
      nesting_depth: computeNestingDepth(code, "Java"),
      max_params: computeMaxParams(code),
    };
  }
};