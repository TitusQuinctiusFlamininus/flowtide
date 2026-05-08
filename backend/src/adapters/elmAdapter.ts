import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const elmAdapter: LanguageAdapter = {

  language: "Elm",

  supports(path) {
    return path.endsWith(".elm");
  },

  classify(path) {
    const base = path.toLowerCase();
    return base.includes("test") || base.includes("spec") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.elm$/, "");
  },

  extractTests(code) {
    // elm-test: test "..." / describe "..."
    const tests = [...code.matchAll(/\btest\s+"(.+?)"/g)].map((m) => m[1]);
    const describes = [...code.matchAll(/\bdescribe\s+"(.+?)"/g)].map((m) => m[1]);
    return [...tests, ...describes];
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    // Top-level function definitions: name : Type on one line, name arg = on next
    const functions = (code.match(/^\w[\w_]*\s*:/gm) || []).length;
    const conditionals = (code.match(/\bif\b|\bcase\b/g) || []).length;
    // Elm uses type / type alias instead of classes
    const classes = (code.match(/^type(?:\s+alias)?\s+/gm) || []).length;

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
      nesting_depth: computeNestingDepth(code, "Elm"),
      max_params: computeMaxParams(code),
    };
  },
};
