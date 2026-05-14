import { execa } from "execa";
import fs from "fs";
import path from "path";

import type { TestRunResult } from "./types";

export const EMPTY_RESULT: TestRunResult = {
  passed: 0,
  failed: 0,
  total: 0,
  unavailable: 0,
  top_failures: [],
  duration_ms: 0,
};

export function findUp(
  from: string,
  sentinels: string[],
  maxDepth = Number.POSITIVE_INFINITY
): { root: string; matched: string } | null {
  let dir = path.dirname(from);
  for (let i = 0; i < maxDepth; i++) {
    for (const sentinel of sentinels) {
      if (fs.existsSync(path.join(dir, sentinel))) {
        return { root: dir, matched: sentinel };
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function findUpByEntry(
  from: string,
  matchesEntry: (entryName: string) => boolean,
  maxDepth = Number.POSITIVE_INFINITY
): { root: string } | null {
  let dir = path.dirname(from);
  for (let i = 0; i < maxDepth; i++) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      entries = [];
    }
    if (entries.some(matchesEntry)) {
      return { root: dir };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function execCommand(
  cmd: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
  timeoutMs = 60_000
): Promise<string> {
  try {
    const result = await execa(cmd, args, {
      cwd,
      reject: false,
      timeout: timeoutMs,
      env: { ...process.env, FORCE_COLOR: "0", ...extraEnv },
    });
    return result.stdout + "\n" + result.stderr;
  } catch {
    return "";
  }
}
