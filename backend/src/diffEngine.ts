import { diffLines } from "diff";

export function computeLOC(
  before: string,
  after: string
) {
  const changes = diffLines(before, after);

  let added = 0;
  let removed = 0;

  for (const part of changes) {
    const count = part.count || 0;

    if (part.added) added += count;
    if (part.removed) removed += count;
  }

  return { added, removed };
}