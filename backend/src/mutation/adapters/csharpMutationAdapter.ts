import crypto from "crypto";
import path from "path";

import type { MutationAdapter, MutationCandidate } from "../types";

const CSHARP_PATTERNS: Array<{ operator: string; regex: RegExp; replacement: string }> = [
  { operator: "csharp-equality-flip", regex: /==/g, replacement: "!=" },
  { operator: "csharp-null-check-flip", regex: /!=\s*null/g, replacement: "== null" },
  { operator: "csharp-boolean-true-flip", regex: /\btrue\b/g, replacement: "false" },
  { operator: "csharp-boolean-false-flip", regex: /\bfalse\b/g, replacement: "true" },
  { operator: "csharp-and-to-or", regex: /&&/g, replacement: "||" },
  { operator: "csharp-or-to-and", regex: /\|\|/g, replacement: "&&" },
];

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
    adapter: "csharp-conditional",
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

export const csharpMutationAdapter: MutationAdapter = {
  name: "csharp-conditional",

  supports(filePath) {
    return filePath.toLowerCase().endsWith(".cs");
  },

  createMutations({ filePath, code, language }) {
    const candidates: MutationCandidate[] = [];

    for (const pattern of CSHARP_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(code);

      while (match && candidates.length < 6) {
        const original = match[0];
        candidates.push(
          createCandidate(filePath, language, code, pattern.operator, match.index, original, pattern.replacement)
        );
        match = pattern.regex.exec(code);
      }

      if (candidates.length >= 6) {
        break;
      }
    }

    return candidates;
  },
};