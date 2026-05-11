import chokidar from "chokidar";

import { analyzeFile }
  from "./analyzer";
import { isPathMutationSuppressed }
  from "./mutation/runtimeGuards";

export function startWatcher(
  targetPath: string
) {

  const watcher = chokidar.watch(
    targetPath,
    {
      ignored:
        /node_modules|target|bin|obj|dist|build/,

      persistent: true,

      ignoreInitial: true
    }
  );

  watcher.on(
    "change",
    async (path) => {
      if (isPathMutationSuppressed(path)) {
        return;
      }

      console.log("Changed:", path);

      await analyzeFile(path);
    }
  );

  watcher.on(
    "add",
    async (path) => {
      if (isPathMutationSuppressed(path)) {
        return;
      }

      console.log("Added:", path);

      await analyzeFile(path);
    }
  );

  console.log(`
Watching filesystem:
${targetPath}
`);
}