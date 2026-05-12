import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const haskellMutationAdapter = createRegexMutationAdapter(
  "haskell-conditional",
  [".hs"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "&&", orToken: "||" })
);