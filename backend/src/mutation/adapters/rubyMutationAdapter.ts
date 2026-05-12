import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const rubyMutationAdapter = createRegexMutationAdapter(
  "ruby-conditional",
  [".rb"],
  commonPatterns({ trueToken: "true", falseToken: "false", andToken: "&&", orToken: "||" })
);