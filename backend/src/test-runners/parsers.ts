import type { ParsedTestResult } from "./types";

export function parseDotnet(output: string): ParsedTestResult {
  const totalFromNUnit = parseInt(output.match(/Total\s+tests\s*:\s*(\d+)/i)?.[1] ?? "0");
  const totalFromVSTest = parseInt(output.match(/\bTotal\s*:\s*(\d+)/i)?.[1] ?? "0");
  const total = totalFromNUnit || totalFromVSTest;
  const passed = parseInt(output.match(/\bPassed\s*:\s*(\d+)/i)?.[1] ?? "0");
  const failedExplicit = parseInt(output.match(/\bFailed\s*:\s*(\d+)/i)?.[1] ?? "0");
  const failed = failedExplicit || (total > 0 ? Math.max(total - passed, 0) : 0);

  if (total > 0 || passed > 0 || failed > 0) {
    return { passed, failed, total: total > 0 ? total : passed + failed };
  }

  const fallbackPassed = parseInt(output.match(/(\d+)\s+test[s]?\s+passed/i)?.[1] ?? "0");
  const fallbackFailed = parseInt(output.match(/(\d+)\s+test[s]?\s+failed/i)?.[1] ?? "0");
  return { passed: fallbackPassed, failed: fallbackFailed, total: fallbackPassed + fallbackFailed };
}

export function parseMaven(output: string): ParsedTestResult {
  let passed = 0;
  let failed = 0;
  let total = 0;
  const re = /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(output)) !== null) {
    const run = parseInt(match[1]);
    const failures = parseInt(match[2]);
    const errors = parseInt(match[3]);
    total += run;
    failed += failures + errors;
    passed += run - failures - errors;
  }
  return { passed, failed, total };
}

export function parseGradle(output: string): ParsedTestResult {
  const match = output.match(/(\d+)\s+tests?\s+completed(?:,\s*(\d+)\s+failed)?/i);
  if (!match) return { passed: 0, failed: 0, total: 0 };
  const total = parseInt(match[1]);
  const failed = parseInt(match[2] ?? "0");
  return { passed: total - failed, failed, total };
}

export function parsePytest(output: string): ParsedTestResult {
  const match = output.match(/(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+error)?/i);
  if (!match || (!match[1] && !match[2] && !match[3])) {
    return { passed: 0, failed: 0, total: 0 };
  }
  const passed = parseInt(match[1] ?? "0");
  const failed = parseInt(match[2] ?? "0") + parseInt(match[3] ?? "0");
  return { passed, failed, total: passed + failed };
}

export function parseCargo(output: string): ParsedTestResult {
  const match = output.match(/test result:.*?(\d+)\s+passed;\s*(\d+)\s+failed/i);
  if (!match) return { passed: 0, failed: 0, total: 0 };
  const passed = parseInt(match[1]);
  const failed = parseInt(match[2]);
  return { passed, failed, total: passed + failed };
}

export function parseStack(output: string): ParsedTestResult {
  const hspec = output.match(/(\d+)\s+examples?,\s*(\d+)\s+failures?/i);
  if (hspec) {
    const total = parseInt(hspec[1]);
    const failed = parseInt(hspec[2]);
    return { passed: total - failed, failed, total };
  }

  const passed = (output.match(/\bOK\b/g) || []).length;
  const failed = (output.match(/\bFAIL\b/g) || []).length;
  return { passed, failed, total: passed + failed };
}

export function parseElmTest(output: string): ParsedTestResult {
  const passed = parseInt(output.match(/Passed:\s*(\d+)/i)?.[1] ?? "0");
  const failed = parseInt(output.match(/Failed:\s*(\d+)/i)?.[1] ?? "0");
  return { passed, failed, total: passed + failed };
}

export function parseRSpec(output: string): ParsedTestResult {
  const match = output.match(/(\d+)\s+examples?,\s*(\d+)\s+failures?/i);
  if (!match) return { passed: 0, failed: 0, total: 0 };
  const total = parseInt(match[1]);
  const failed = parseInt(match[2]);
  return { passed: total - failed, failed, total };
}

export function parseMinitest(output: string): ParsedTestResult {
  const match = output.match(/(\d+)\s+runs?,\s*\d+\s+assertions?,\s*(\d+)\s+failures?,\s*(\d+)\s+errors?/i);
  if (!match) return { passed: 0, failed: 0, total: 0 };
  const total = parseInt(match[1]);
  const failed = parseInt(match[2]) + parseInt(match[3]);
  return { passed: total - failed, failed, total };
}

export function parseSwiftTest(output: string): ParsedTestResult {
  const match = output.match(/executed\s+(\d+)\s+tests?,\s+with\s+(\d+)\s+failures?/i);
  if (!match) return { passed: 0, failed: 0, total: 0 };
  const total = parseInt(match[1]);
  const failed = parseInt(match[2]);
  return { passed: total - failed, failed, total };
}

export function parseJestVitest(output: string): ParsedTestResult {
  const summary = output.match(/Tests?:\s*((?:\d+\s+\w+,?\s*)+)/i);
  if (summary) {
    const block = summary[1];
    const passed = parseInt(block.match(/(\d+)\s+passed/i)?.[1] ?? "0");
    const failed = parseInt(block.match(/(\d+)\s+failed/i)?.[1] ?? "0");
    const total = parseInt(block.match(/(\d+)\s+total/i)?.[1] ?? String(passed + failed));
    return { passed, failed, total };
  }

  const passed = parseInt(output.match(/(\d+)\s+passing/i)?.[1] ?? "0");
  const failed = parseInt(output.match(/(\d+)\s+failing/i)?.[1] ?? "0");
  return { passed, failed, total: passed + failed };
}
