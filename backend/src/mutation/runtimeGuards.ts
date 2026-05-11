import path from "path";

const suppressedPaths = new Map<string, number>();
const SUPPRESSION_WINDOW_MS = 5000;

function normalize(filePath: string) {
  return path.resolve(filePath);
}

export function isPathMutationSuppressed(filePath: string) {
  const key = normalize(filePath);
  const until = suppressedPaths.get(key);

  if (!until) {
    return false;
  }

  if (until <= Date.now()) {
    suppressedPaths.delete(key);
    return false;
  }

  return true;
}

export async function withMutationPathSuppressed<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const key = normalize(filePath);
  const until = Date.now() + SUPPRESSION_WINDOW_MS;
  suppressedPaths.set(key, until);

  try {
    return await fn();
  } finally {
    suppressedPaths.set(key, Date.now() + SUPPRESSION_WINDOW_MS);
  }
}