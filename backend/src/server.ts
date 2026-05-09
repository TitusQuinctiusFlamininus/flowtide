import { startWatcher } from "./watcher";
import { startWebSocketServer } from "./websocket";

function readOption(name: string) {
  const option = `--${name}`;
  const index = process.argv.indexOf(option);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

const positionalArgs = process.argv.slice(2).filter((arg, index, all) => {
  if (arg.startsWith("--")) {
    return false;
  }

  const previous = all[index - 1];
  return previous !== "--host" && previous !== "--port";
});

const targetPath = positionalArgs[0];
const host = readOption("host") ?? process.env.TELEMETRY_HOST ?? "localhost";
const portRaw = readOption("port") ?? process.env.TELEMETRY_PORT ?? "8080";
const port = Number.parseInt(portRaw, 10);

if (!targetPath || !Number.isFinite(port)) {
  console.error(`
Usage:

npm run dev -- <path-to-kata> [--host <host>] [--port <port>]

Example:
npm run dev -- /Users/me/katas/roman --host localhost --port 8080
`);

  process.exit(1);
}

startWebSocketServer(host, port);
console.log(`Flowtide backend listening on ws://${host}:${port}`);

startWatcher(targetPath);