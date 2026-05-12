import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const kotlinMutationAdapter = createRegexMutationAdapter(
  "kotlin-conditional",
  [".kt", ".kts"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);