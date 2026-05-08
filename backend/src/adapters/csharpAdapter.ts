import { LanguageAdapter }
  from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const csharpAdapter:
LanguageAdapter = {

  language: "C#",

  supports(path) {
    return path.endsWith(".cs");
  },

  classify(path) {
    return path.includes("Test")
      ? "test"
      : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.cs$/, "");
  },

  extractTests(code) {
    const matches = [...code.matchAll(/\[Test(?:Method)?\][\s\S]*?(?:public|private)\s+\w+\s+(\w+)\s*\(/g)];
    return matches.map((m) => m[1]);
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const methods =
      (code.match(/public|private/g)
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
      nesting_depth: computeNestingDepth(code, "C#"),
      max_params: computeMaxParams(code),
    };
  }
};