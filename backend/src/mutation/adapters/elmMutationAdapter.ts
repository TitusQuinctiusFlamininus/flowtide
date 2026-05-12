import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const elmMutationAdapter = createRegexMutationAdapter(
  "elm-conditional",
  [".elm"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "&&", orToken: "||" })
);