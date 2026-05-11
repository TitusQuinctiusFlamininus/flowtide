import crypto from "crypto";
import path from "path";

import type { MutationAdapter, MutationCandidate } from "../types";

const GENERIC_PATTERNS: Array<{ operator: string; regex: RegExp; replacement: string }> = [
  { operator: "strict-equality-flip", regex: /===/g, replacement: "!==" },
  { operator: "equality-flip", regex: /==/g, replacement: "!=" },
  { operator: "gte-to-lt", regex: />=/g, replacement: "<" },
  { operator: "lte-to-gt", regex: /<=/g, replacement: ">" },
  { operator: "and-to-or", regex: /&&/g, replacement: "||" },
  { operator: "or-to-and", regex: /\|\|/g, replacement: "&&" },
  { operator: "true-to-false", regex: /\btrue\b/g, replacement: "false" },
  { operator: "false-to-true", regex: /\bfalse\b/g, replacement: "true" },
];

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".java",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".elm",
  ".hs",
]);

function lineAndColumnForIndex(code: string, index: number) {
  const prefix = code.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function createCandidate(filePath: string, language: string, code: string, operator: string, index: number, original: string, replacement: string): MutationCandidate {
  const location = lineAndColumnForIndex(code, index);
  const previewStart = Math.max(0, index - 24);
  const previewEnd = Math.min(code.length, index + original.length + 24);
  const preview = code.slice(previewStart, previewEnd).replace(/\s+/g, " ").trim();
  const key = crypto
    .createHash("sha1")
    .update(`${filePath}:${operator}:${location.line}:${location.column}:${original}:${replacement}`)
    .digest("hex")
    .slice(0, 12);

  return {
    key,
    adapter: "generic",
    operator,
    filePath,
    filename: path.basename(filePath),
    language,
    line: location.line,
    column: location.column,
    preview,
    edit: {
      start: index,
      end: index + original.length,
      original,
      replacement,
    },
  };
}

export const genericMutationAdapter: MutationAdapter = {
  name: "generic",

  supports(filePath) {
    return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  },

  createMutations({ filePath, code, language }) {
    const candidates: MutationCandidate[] = [];

    for (const pattern of GENERIC_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(code);

      while (match && candidates.length < 4) {
        const original = match[0];
        candidates.push(
          createCandidate(filePath, language, code, pattern.operator, match.index, original, pattern.replacement)
        );
        match = pattern.regex.exec(code);
      }

      if (candidates.length >= 4) {
        break;
      }
    }

    return candidates;
  },
};