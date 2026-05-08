import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const kotlinAdapter: LanguageAdapter = {

  language: "Kotlin",

  supports(path) {
    return path.endsWith(".kt") || path.endsWith(".kts");
  },

  classify(path) {
    return path.includes("Test") || path.includes("Spec") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.(kt|kts)$/, "");
  },

  extractTests(code) {
    // JUnit 5 / Kotest
    const junit = [...code.matchAll(/@Test[^]*?fun\s+(`[^`]+`|\w+)\s*\(/g)].map((m) => m[1].replace(/`/g, ""));
    const kotest = [...code.matchAll(/\b(?:test|it|should)\s*\(\s*"(.+?)"/g)].map((m) => m[1]);
    return [...junit, ...kotest];
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions = (code.match(/\bfun\s+\w+/g) || []).length;
    const conditionals = (code.match(/\bif\b|\bwhen\b/g) || []).length;
    const classes = (code.match(/\b(?:class|object|interface)\s+\w+/g) || []).length;

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
      nesting_depth: computeNestingDepth(code, "Kotlin"),
      max_params: computeMaxParams(code),
    };
  },
};
