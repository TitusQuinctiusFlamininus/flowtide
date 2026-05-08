import { typescriptAdapter } from "./adapters/typescriptAdapter";
import { javaAdapter } from "./adapters/javaAdapter";
import { csharpAdapter } from "./adapters/csharpAdapter";
import { pythonAdapter } from "./adapters/pythonAdapter";
import { rustAdapter } from "./adapters/rustAdapter";
import { goAdapter } from "./adapters/goAdapter";
import { rubyAdapter } from "./adapters/rubyAdapter";
import { haskellAdapter } from "./adapters/haskellAdapter";
import { elmAdapter } from "./adapters/elmAdapter";
import { kotlinAdapter } from "./adapters/kotlinAdapter";
import { swiftAdapter } from "./adapters/swiftAdapter";

const adapters = [
  typescriptAdapter,
  javaAdapter,
  csharpAdapter,
  pythonAdapter,
  rustAdapter,
  goAdapter,
  rubyAdapter,
  haskellAdapter,
  elmAdapter,
  kotlinAdapter,
  swiftAdapter,
];

export function adapterFor(path: string) {
  return adapters.find((a) =>
    a.supports(path)
  );
}