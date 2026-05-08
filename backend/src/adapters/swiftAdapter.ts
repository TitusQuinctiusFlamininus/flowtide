import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const swiftAdapter: LanguageAdapter = {

  language: "Swift",

  supports(path) {
    return path.endsWith(".swift");
  },

  classify(path) {
    return path.includes("Tests") || path.includes("Spec") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.swift$/, "");
  },

  extractTests(code) {
    // XCTest: func test*()
    const xctest = [...code.matchAll(/func\s+(test\w+)\s*\(\s*\)/g)].map((m) => m[1]);
    return xctest;
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    const functions = (code.match(/\bfunc\s+\w+/g) || []).length;
    const conditionals = (code.match(/\bif\b|\bswitch\b|\bguard\b/g) || []).length;
    const classes = (code.match(/\b(?:class|struct|enum|protocol)\s+\w+/g) || []).length;

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
      nesting_depth: computeNestingDepth(code, "Swift"),
      max_params: computeMaxParams(code),
    };
  },
};
