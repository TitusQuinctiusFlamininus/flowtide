import { startWatcher } from "./watcher";
import "./websocket";

const targetPath = process.argv[2];

if (!targetPath) {
  console.error(`
Usage:

npm run dev -- <path-to-kata>

Example:
npm run dev -- /Users/me/katas/roman
`);

  process.exit(1);
}

startWatcher(targetPath);