import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const typescriptMutationAdapter = createRegexMutationAdapter(
  "typescript-conditional",
  [".ts", ".tsx", ".js", ".jsx"],
  commonPatterns({
    trueToken: "true",
    falseToken: "false",
    andToken: "&&",
    orToken: "||",
    includeStrictEquality: true,
  })
);