import { adapterFor } from "../registry";
import { csharpMutationAdapter } from "./adapters/csharpMutationAdapter";
import { elmMutationAdapter } from "./adapters/elmMutationAdapter";
import { genericMutationAdapter } from "./adapters/genericMutationAdapter";
import { goMutationAdapter } from "./adapters/goMutationAdapter";
import { haskellMutationAdapter } from "./adapters/haskellMutationAdapter";
import { javaMutationAdapter } from "./adapters/javaMutationAdapter";
import { kotlinMutationAdapter } from "./adapters/kotlinMutationAdapter";
import { pythonMutationAdapter } from "./adapters/pythonMutationAdapter";
import { rubyMutationAdapter } from "./adapters/rubyMutationAdapter";
import { rustMutationAdapter } from "./adapters/rustMutationAdapter";
import { swiftMutationAdapter } from "./adapters/swiftMutationAdapter";
import { typescriptMutationAdapter } from "./adapters/typescriptMutationAdapter";

const mutationAdapters = [
  csharpMutationAdapter,
  typescriptMutationAdapter,
  javaMutationAdapter,
  pythonMutationAdapter,
  rustMutationAdapter,
  goMutationAdapter,
  rubyMutationAdapter,
  haskellMutationAdapter,
  elmMutationAdapter,
  kotlinMutationAdapter,
  swiftMutationAdapter,
  genericMutationAdapter,
];

export function mutationAdapterFor(filePath: string) {
  const language = adapterFor(filePath)?.language ?? "unknown";
  return mutationAdapters.find((adapter) => adapter.supports(filePath)) ?? {
    ...genericMutationAdapter,
    name: `generic-${language.toLowerCase()}`,
  };
}