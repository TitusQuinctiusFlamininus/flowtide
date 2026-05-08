const snapshots = new Map<string, string>();
const testSnapshots = new Map<string, Set<string>>();

export function getPrevious(path: string) {
  return snapshots.get(path) || "";
}

export function saveSnapshot(
  path: string,
  content: string
) {
  snapshots.set(path, content);
}

export function getPreviousTests(path: string): Set<string> {
  return testSnapshots.get(path) ?? new Set();
}

export function saveTestSnapshot(path: string, tests: string[]) {
  testSnapshots.set(path, new Set(tests));
}