import { LanguageAdapter } from "./LanguageAdapter";
import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

export const haskellAdapter: LanguageAdapter = {

  language: "Haskell",

  supports(path) {
    return path.endsWith(".hs") || path.endsWith(".lhs");
  },

  classify(path) {
    const base = path.toLowerCase();
    return base.includes("test") || base.includes("spec") ? "test" : "production";
  },

  extractTestName(path) {
    return (path.split("/").pop() || path).replace(/\.(l?hs)$/, "");
  },

  extractTests(code) {
    // Hspec: it "..." / describe "..."
    const hspec = [...code.matchAll(/\bit\s+"(.+?)"/g)].map((m) => m[1]);
    // HUnit / Tasty: testCase "..."
    const tasty = [...code.matchAll(/testCase\s+"(.+?)"/g)].map((m) => m[1]);
    // prop_ / test_ top-level names
    const props = [...code.matchAll(/^((?:prop|test|unit)_\w+)\s*::/gm)].map((m) => m[1]);
    return [...hspec, ...tasty, ...props];
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;

    // Top-level function bindings (lines with :: type signature = declaration)
    const functions = (code.match(/^\w[\w']*\s*::/gm) || []).length;
    const conditionals = (code.match(/\bif\b|\bcase\b|\bguard\b/g) || []).length;
    // Haskell has no classes in the OO sense; count data/newtype declarations
    const classes = (code.match(/^(?:data|newtype)\s+/gm) || []).length;

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
      nesting_depth: computeNestingDepth(code, "Haskell"),
      max_params: computeMaxParams(code),
    };
  },
};
