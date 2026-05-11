import { adapterFor } from "../registry";
import { csharpMutationAdapter } from "./adapters/csharpMutationAdapter";
import { genericMutationAdapter } from "./adapters/genericMutationAdapter";
import {
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
} from "./adapters/languageMutationAdapters";

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