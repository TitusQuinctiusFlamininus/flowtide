import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const javaMutationAdapter = createRegexMutationAdapter(
  "java-conditional",
  [".java"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);