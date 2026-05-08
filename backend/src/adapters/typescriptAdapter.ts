import Parser from "tree-sitter";

import TypeScript
  from "tree-sitter-typescript";

import { LanguageAdapter }
  from "./LanguageAdapter";

import {
  computeHalstead,
  computeMaintainabilityIndex,
  computeNestingDepth,
  computeMaxParams,
} from "../metricsHelpers";

const parser = new Parser();

parser.setLanguage(
  TypeScript.typescript
);

export const typescriptAdapter:
LanguageAdapter = {

  language: "TypeScript",

  supports(path) {
    return (
      path.endsWith(".ts") ||
      path.endsWith(".tsx")
    );
  },

  classify(path) {
    return path.includes(".test.") ||
      path.includes(".spec.")
      ? "test"
      : "production";
  },

  extractTestName(path) {
    const base = path.split("/").pop() || path;
    return base.replace(/\.(test|spec)\.(ts|tsx)$/, "").replace(/\.(ts|tsx)$/, "");
  },

  extractTests(code) {
    const tree = parser.parse(code);
    const names: string[] = [];

    function walk(node: any) {
      // Match: it("...", ...) / test("...", ...) / describe("...", ...)
      if (node.type === "call_expression") {
        const fn = node.namedChildren[0];
        const args = node.namedChildren[1];
        if (
          fn &&
          (fn.text === "it" || fn.text === "test" || fn.text === "describe") &&
          args &&
          args.namedChildren.length > 0
        ) {
          const first = args.namedChildren[0];
          if (first.type === "string") {
            const raw = first.text.replace(/^['"`]|['"`]$/g, "");
            names.push(raw);
          }
        }
      }
      for (const child of node.namedChildren || []) {
        walk(child);
      }
    }

    walk(tree.rootNode);
    return names;
  },

  async analyze(code) {
    const loc_total = code.split("\n").filter((l) => l.trim().length > 0).length;
    const tree = parser.parse(code);

    let functions = 0;
    let conditionals = 0;
    let classes = 0;

    function walk(node: any) {
      if (
        node.type ===
        "function_declaration"
      ) {
        functions++;
      }

      if (
        node.type ===
        "if_statement"
      ) {
        conditionals++;
      }

      if (
        node.type ===
        "class_declaration"
      ) {
        classes++;
      }

      for (
        const child of
        node.namedChildren || []
      ) {
        walk(child);
      }
    }

    walk(tree.rootNode);

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
      nesting_depth: computeNestingDepth(code, "TypeScript"),
      max_params: computeMaxParams(code),
    };
  }
};