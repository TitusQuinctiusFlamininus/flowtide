import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const goMutationAdapter = createRegexMutationAdapter(
  "go-conditional",
  [".go"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);