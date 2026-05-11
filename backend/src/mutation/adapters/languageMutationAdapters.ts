import { createRegexMutationAdapter, type MutationPattern } from "./createRegexMutationAdapter";

function commonPatterns(options: {
  trueToken: string;
  falseToken: string;
  andToken?: string;
  orToken?: string;
  includeStrictEquality?: boolean;
}): MutationPattern[] {
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

export const typescriptMutationAdapter = createRegexMutationAdapter(
  "typescript-conditional",
  [".ts", ".tsx", ".js", ".jsx"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||", includeStrictEquality: true })
);

export const javaMutationAdapter = createRegexMutationAdapter(
  "java-conditional",
  [".java"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);

export const pythonMutationAdapter = createRegexMutationAdapter(
  "python-conditional",
  [".py"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "and", orToken: "or" })
);

export const rustMutationAdapter = createRegexMutationAdapter(
  "rust-conditional",
  [".rs"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);

export const goMutationAdapter = createRegexMutationAdapter(
  "go-conditional",
  [".go"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);

export const rubyMutationAdapter = createRegexMutationAdapter(
  "ruby-conditional",
  [".rb"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);

export const haskellMutationAdapter = createRegexMutationAdapter(
  "haskell-conditional",
  [".hs"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "&&", orToken: "||" })
);

export const elmMutationAdapter = createRegexMutationAdapter(
  "elm-conditional",
  [".elm"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "&&", orToken: "||" })
);

export const kotlinMutationAdapter = createRegexMutationAdapter(
  "kotlin-conditional",
  [".kt", ".kts"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);

export const swiftMutationAdapter = createRegexMutationAdapter(
  "swift-conditional",
  [".swift"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);