import { createRegexMutationAdapter } from "./createRegexMutationAdapter";
import { commonPatterns } from "./commonPatterns";

export const pythonMutationAdapter = createRegexMutationAdapter(
  "python-conditional",
  [".py"],
  commonPatterns({ trueToken: "True", falseToken: "False", andToken: "and", orToken: "or" })
);