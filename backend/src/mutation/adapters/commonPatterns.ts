import type { MutationPattern } from "./createRegexMutationAdapter";

interface CommonPatternOptions {
  trueToken: string;
  falseToken: string;
  andToken?: string;
  orToken?: string;
  includeStrictEquality?: boolean;
}

export function commonPatterns(options: CommonPatternOptions): MutationPattern[] {
  const patterns: MutationPattern[] = [];

  if (options.includeStrictEquality) {
    patterns.push({ operator: "strict-equality-flip", regex: /===/g, replacement: "!==" });
  }

  patterns.push(
    { operator: "equality-flip", regex: /==/g, replacement: "!=" },
    { operator: "gte-to-lt", regex: />=/g, replacement: "<" },
    { operator: "lte-to-gt", regex: /<=/g, replacement: ">" }
  );

  if (options.andToken && options.orToken) {
    if (options.andToken === "&&" && options.orToken === "||") {
      patterns.push(
        { operator: "and-to-or", regex: /&&/g, replacement: "||" },
        { operator: "or-to-and", regex: /\|\|/g, replacement: "&&" }
      );
    } else {
      patterns.push(
        {
          operator: "and-to-or",
          regex: new RegExp(`\\b${options.andToken}\\b`, "g"),
          replacement: options.orToken,
        },
        {
          operator: "or-to-and",
          regex: new RegExp(`\\b${options.orToken}\\b`, "g"),
          replacement: options.andToken,
        }
      );
    }
  }

  patterns.push(
    {
      operator: "true-to-false",
      regex: new RegExp(`\\b${options.trueToken}\\b`, "g"),
      replacement: options.falseToken,
    },
    {
      operator: "false-to-true",
      regex: new RegExp(`\\b${options.falseToken}\\b`, "g"),
      replacement: options.trueToken,
    }
  );

  return patterns;
}