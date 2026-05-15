import fs from "fs";
import os from "os";
import path from "path";

import {
  parseCargo,
  parseDotnet,
  parseElmTest,
  parseGradle,
  parseJestVitest,
  parseMaven,
  parseMinitest,
  parsePytest,
  parseRSpec,
  parseStack,
  parseSwiftTest,
} from "./parsers";
import type { DetectedProject, ParsedTestResult, TestRunner } from "./types";
import { execCommand, findUp, findUpByEntry } from "./utils";

const UNITY_TEST_TIMEOUT_MS = 15 * 60_000;

interface UnityDiscoveryCounts {
  regular: number;
  unity: number;
  total: number;
}

interface UnityRegularRunnerOutput {
  passed: number;
  failed: number;
  total: number;
  discoveredRegular: number;
  discoveredUnity: number;
  executedRegular: number;
  failures?: string[];
  error?: string;
}

function compactFailureLine(line: string): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function parseIntSafe(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseXmlAttr(tag: string, attr: string): number {
  const re = new RegExp(`${attr}\\s*=\\s*"(\\d+)"`, "i");
  return parseIntSafe(tag.match(re)?.[1]);
}

function parseUnityTestResultsXml(xml: string): ParsedTestResult {
  const testRunTag = xml.match(/<test-run\b[^>]*>/i)?.[0] ?? "";
  const total = parseXmlAttr(testRunTag, "total");
  const passed = parseXmlAttr(testRunTag, "passed");
  const failed = parseXmlAttr(testRunTag, "failed");

  if (total > 0 || passed > 0 || failed > 0) {
    return { passed, failed, total: total || passed + failed };
  }

  const passedCases = (xml.match(/<test-case\b[^>]*\bresult\s*=\s*"Passed"[^>]*>/gi) || []).length;
  const failedCases = (xml.match(/<test-case\b[^>]*\bresult\s*=\s*"Failed"[^>]*>/gi) || []).length;
  return { passed: passedCases, failed: failedCases, total: passedCases + failedCases };
}

function resolveUnityExecutable(): string | null {
  const envCandidates = [
    process.env.FLOWTIDE_UNITY_PATH,
    process.env.UNITY_PATH,
    process.env.UNITY_EXECUTABLE,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const hubRoot = "/Applications/Unity/Hub/Editor";
  if (fs.existsSync(hubRoot)) {
    try {
      const versions = fs.readdirSync(hubRoot).sort((a, b) => b.localeCompare(a));
      for (const version of versions) {
        const candidate = path.join(hubRoot, version, "Unity.app", "Contents", "MacOS", "Unity");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch {
      // ignore and continue with legacy path checks
    }
  }

  const legacyCandidate = "/Applications/Unity/Unity.app/Contents/MacOS/Unity";
  return fs.existsSync(legacyCandidate) ? legacyCandidate : null;
}

function findUnityProjectRoot(filePath: string): string | null {
  const match = findUpByEntry(filePath, (entry) => entry === "ProjectSettings" || entry === "Assets");
  if (!match) return null;

  const hasAssets = fs.existsSync(path.join(match.root, "Assets"));
  const hasProjectSettings = fs.existsSync(path.join(match.root, "ProjectSettings"));
  return hasAssets && hasProjectSettings ? match.root : null;
}

function discoverUnityTestBuckets(root: string): UnityDiscoveryCounts {
  const assetsRoot = path.join(root, "Assets");
  if (!fs.existsSync(assetsRoot)) {
    return { regular: 0, unity: 0, total: 0 };
  }

  let regular = 0;
  let unity = 0;
  const stack = [assetsRoot];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".cs")) {
        continue;
      }

      const normalized = fullPath.replace(/\\/g, "/");
      if (!/\/(tests?|unittests?|editor)\//i.test(normalized)) {
        continue;
      }

      let code = "";
      try {
        code = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const unityMatches = code.match(/\[(?:\s*(?:UnityEngine\.TestTools\.)?UnityTest\b[^\]]*)\]/g) || [];
      const regularMatches = code.match(/\[(?:\s*(?:NUnit\.Framework\.)?(?:Test|TestCase)\b[^\]]*)\]/g) || [];
      unity += unityMatches.length;
      regular += regularMatches.length;
    }
  }

  return { regular, unity, total: regular + unity };
}

function resolveUnityRegularTestAssembly(root: string): string | null {
  const scriptAssembliesDir = path.join(root, "Library", "ScriptAssemblies");
  if (!fs.existsSync(scriptAssembliesDir)) {
    return null;
  }

  const preferred = path.join(scriptAssembliesDir, "Validatorcore.Unity.EditModeTests.dll");
  if (fs.existsSync(preferred)) {
    return preferred;
  }

  try {
    const candidates = fs
      .readdirSync(scriptAssembliesDir)
      .filter((entry) => entry.toLowerCase().endsWith("editmodetests.dll"));
    if (candidates.length === 0) return null;
    return path.join(scriptAssembliesDir, candidates[0]);
  } catch {
    return null;
  }
}

async function runUnityRegularTestsViaReflection(root: string): Promise<ParsedTestResult | null> {
  const testAssemblyPath = resolveUnityRegularTestAssembly(root);
  if (!testAssemblyPath) {
    return null;
  }

  const backendRoot = path.resolve(__dirname, "../..");
  const runnerProject = path.resolve(backendRoot, "tools", "unity-regular-test-runner", "UnityRegularTestRunner.csproj");
  const runnerDll = path.resolve(backendRoot, "tools", "unity-regular-test-runner", "dist", "UnityRegularTestRunner.dll");
  if (!fs.existsSync(runnerProject) && !fs.existsSync(runnerDll)) {
    return null;
  }

  const raw = fs.existsSync(runnerDll)
    ? await execCommand(
      "dotnet",
      [runnerDll, root, testAssemblyPath],
      backendRoot,
      {},
      UNITY_TEST_TIMEOUT_MS
    )
    : await execCommand(
      "dotnet",
      [
        "run",
        "--project",
        runnerProject,
        "--configuration",
        "Release",
        "--",
        root,
        testAssemblyPath,
      ],
      backendRoot,
      {},
      UNITY_TEST_TIMEOUT_MS
    );

  const markerLine = raw
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith("FLOWTIDE_JSON:"));

  if (!markerLine) {
    return null;
  }

  try {
    const parsed = JSON.parse(markerLine.slice("FLOWTIDE_JSON:".length)) as UnityRegularRunnerOutput;
    const passed = Number(parsed.passed) || 0;
    const failed = Number(parsed.failed) || 0;
    const discoveredRegular = Number(parsed.discoveredRegular) || 0;
    const executedRegular = Number(parsed.executedRegular) || 0;
    const unavailable = Math.max(discoveredRegular - executedRegular, 0);
    const top_failures = (parsed.failures ?? []).slice(0, 3).map(compactFailureLine);

    if (parsed.error) {
      console.warn(`[runTests] Unity regular test runner error: ${parsed.error}`);
    }

    return {
      passed,
      failed,
      total: passed + failed,
      unavailable,
      top_failures,
    };
  } catch {
    return null;
  }
}

async function runUnityCliTests(root: string): Promise<ParsedTestResult | null> {
  const unityExec = resolveUnityExecutable();
  if (!unityExec) {
    return null;
  }

  let tempDir = "";
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flowtide-unity-tests-"));
    const resultsPath = path.join(tempDir, "editmode-results.xml");

    const output = await execCommand(
      unityExec,
      [
        "-batchmode",
        "-nographics",
        "-quit",
        "-projectPath",
        root,
        "-runTests",
        "-testPlatform",
        "EditMode",
        "-testResults",
        resultsPath,
        "-logFile",
        "-",
      ],
      root,
      {},
      UNITY_TEST_TIMEOUT_MS
    );

    if (!fs.existsSync(resultsPath)) {
      if (/another Unity instance is running with this project open/i.test(output)) {
        console.warn(
          "[runTests] Unity execution skipped because project is open in another Unity instance. " +
          "Close the Unity editor for this project to collect pass/fail counts."
        );
        return null;
      }

      const discovered = discoverUnityTestBuckets(root);
      if (discovered.total > 0 && /Exiting batchmode successfully now!/i.test(output)) {
        const regularResult = await runUnityRegularTestsViaReflection(root);
        if (regularResult) {
          return {
            passed: regularResult.passed,
            failed: regularResult.failed,
            total: regularResult.total,
            unavailable: (regularResult.unavailable ?? 0) + discovered.unity,
            top_failures: regularResult.top_failures ?? [],
          };
        }

        console.warn(
          `[runTests] Unity did not emit testResults XML. Reporting discovered tests (${discovered.total}) without pass/fail execution counts.`
        );
        return {
          passed: 0,
          failed: 0,
          total: 0,
          unavailable: discovered.total,
          top_failures: [],
        };
      }

      return null;
    }

    const xml = fs.readFileSync(resultsPath, "utf-8");
    return parseUnityTestResultsXml(xml);
  } catch {
    return null;
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function sentinelDetect(kind: string, sentinels: string[]) {
  return (filePath: string): DetectedProject | null => {
    const match = findUp(filePath, sentinels);
    return match ? { kind, root: match.root } : null;
  };
}

function commandRunner(
  cmd: string,
  args: string[],
  env: Record<string, string> = {}
) {
  return (root: string) => execCommand(cmd, args, root, env);
}

function detectNpmPackage(filePath: string, dependencyName?: string): DetectedProject | null {
  const match = findUp(filePath, ["package.json"]);
  if (!match) return null;
  if (!dependencyName) {
    return { kind: "npm-jest", root: match.root };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(match.root, "package.json"), "utf-8"));
    const deps = JSON.stringify({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    return deps.includes(dependencyName) ? { kind: `npm-${dependencyName}`, root: match.root } : null;
  } catch {
    return null;
  }
}

function detectPythonProject(filePath: string): DetectedProject | null {
  if (!filePath.toLowerCase().endsWith(".py")) {
    return null;
  }

  const sentinelMatch = findUp(filePath, [
    "pytest.ini",
    "pyproject.toml",
    "setup.cfg",
    "setup.py",
    "requirements.txt",
    "Pipfile",
    "tox.ini",
  ]);
  if (sentinelMatch) {
    return { kind: "pytest", root: sentinelMatch.root };
  }

  const structureMatch = findUpByEntry(
    filePath,
    (entry) => ["tests", "test", "conftest.py", "manage.py", ".git"].includes(entry)
  );

  return structureMatch ? { kind: "pytest", root: structureMatch.root } : null;
}

function outputSuggestsCommandOrPytestMissing(output: string): boolean {
  if (!output.trim()) {
    return true;
  }

  const normalized = output.toLowerCase();
  return (
    normalized.includes("enoent") ||
    normalized.includes("command not found") ||
    normalized.includes("is not recognized as an internal or external command") ||
    normalized.includes("no module named pytest") ||
    normalized.includes("module named pytest was not found")
  );
}

interface PytestCommandAttempt {
  cmd: string;
  prefixArgs: string[];
}

interface PythonTestFileSummary {
  relativePath: string;
  testCount: number;
}

function buildPytestCommandAttempts(root: string): PytestCommandAttempt[] {
  const attempts: PytestCommandAttempt[] = [];

  const localInterpreterCandidates = [
    path.join(root, ".venv", "bin", "python"),
    path.join(root, "venv", "bin", "python"),
    path.join(root, ".venv", "Scripts", "python.exe"),
    path.join(root, "venv", "Scripts", "python.exe"),
  ];

  for (const interpreter of localInterpreterCandidates) {
    if (fs.existsSync(interpreter)) {
      attempts.push({ cmd: interpreter, prefixArgs: ["-m", "pytest"] });
    }
  }

  attempts.push(
    { cmd: "pytest", prefixArgs: [] },
    { cmd: "uv", prefixArgs: ["run", "pytest"] },
    { cmd: "poetry", prefixArgs: ["run", "pytest"] },
    { cmd: "pipenv", prefixArgs: ["run", "pytest"] },
    { cmd: "python", prefixArgs: ["-m", "pytest"] },
    { cmd: "python3", prefixArgs: ["-m", "pytest"] },
    { cmd: "py", prefixArgs: ["-m", "pytest"] }
  );

  return attempts;
}

function discoverPythonTestFiles(root: string): PythonTestFileSummary[] {
  const ignoreDirs = new Set([
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
  ]);

  const summaries: PythonTestFileSummary[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".py")) {
        continue;
      }

      let code = "";
      try {
        code = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const matches = [...code.matchAll(/\bdef\s+(test_[A-Za-z0-9_]+)\s*\(/g)];
      if (matches.length === 0) {
        continue;
      }

      const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
      summaries.push({ relativePath, testCount: matches.length });
    }
  }

  return summaries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function outputShowsPytestCollectionFailure(output: string): boolean {
  return /(error collecting|importerror|modulenotfounderror|during collection|interrupted)/i.test(output);
}

function extractPytestFailureLine(output: string): string | null {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const interesting = lines.find((line) =>
    /^ERROR\s+/i.test(line) ||
    /^FAILED\s+/i.test(line) ||
    /\bAssertionError\b/.test(line) ||
    /\bTraceback\b/.test(line)
  );

  return interesting ? compactFailureLine(interesting) : null;
}

async function runPytestAttempt(
  root: string,
  attempt: PytestCommandAttempt,
  args: string[]
): Promise<string> {
  return execCommand(attempt.cmd, [...attempt.prefixArgs, ...args], root);
}

async function executePytestWithFallback(root: string): Promise<string> {
  const attempts = buildPytestCommandAttempts(root);

  let lastOutput = "";
  let selectedAttempt: PytestCommandAttempt | null = null;

  for (const attempt of attempts) {
    const output = await runPytestAttempt(root, attempt, ["--version"]);
    if (!outputSuggestsCommandOrPytestMissing(output)) {
      selectedAttempt = attempt;
      break;
    }
    lastOutput = output;
  }

  if (!selectedAttempt) {
    return lastOutput;
  }

  const discoveredFiles = discoverPythonTestFiles(root);
  if (discoveredFiles.length === 0) {
    return runPytestAttempt(root, selectedAttempt, ["--tb=no", "-q"]);
  }

  let passed = 0;
  let failed = 0;
  let unavailable = 0;
  const topFailures: string[] = [];

  for (const file of discoveredFiles) {
    const output = await runPytestAttempt(root, selectedAttempt, ["--tb=no", "-q", file.relativePath]);
    const parsed = parsePytest(output);

    if (outputShowsPytestCollectionFailure(output)) {
      failed += file.testCount;
      const line = extractPytestFailureLine(output);
      if (line && topFailures.length < 3) {
        topFailures.push(`${file.relativePath}: ${line}`);
      }
      continue;
    }

    const boundedPassed = Math.min(parsed.passed, file.testCount);
    const boundedFailed = Math.min(parsed.failed, Math.max(file.testCount - boundedPassed, 0));
    const remainder = Math.max(file.testCount - boundedPassed - boundedFailed, 0);

    passed += boundedPassed;
    failed += boundedFailed;
    unavailable += remainder;

    if (boundedFailed > 0) {
      const line = extractPytestFailureLine(output);
      if (line && topFailures.length < 3) {
        topFailures.push(`${file.relativePath}: ${line}`);
      }
    }
  }

  const total = discoveredFiles.reduce((sum, file) => sum + file.testCount, 0);
  return JSON.stringify({
    passed,
    failed,
    total,
    unavailable,
    top_failures: topFailures,
  });
}

export const builtInTestRunners: TestRunner[] = [
  {
    kind: "unity",
    detect(filePath) {
      if (!filePath.toLowerCase().endsWith(".cs")) return null;

      const unityRoot = findUnityProjectRoot(filePath);
      if (!unityRoot) return null;

      return { kind: "unity", root: unityRoot };
    },
    async execute(root) {
      const executed = await runUnityCliTests(root);
      if (executed) {
        return JSON.stringify(executed);
      }

      const discovered = discoverUnityTestBuckets(root);
      return JSON.stringify({
        passed: 0,
        failed: 0,
        total: 0,
        unavailable: discovered.total,
        top_failures: [],
      });
    },
    parse(output) {
      try {
        const parsed = JSON.parse(output) as ParsedTestResult;
        return {
          passed: Number(parsed.passed) || 0,
          failed: Number(parsed.failed) || 0,
          total: Number(parsed.total) || 0,
          unavailable: Number(parsed.unavailable) || 0,
          top_failures: Array.isArray(parsed.top_failures)
            ? parsed.top_failures.slice(0, 3).map((entry) => compactFailureLine(String(entry)))
            : [],
        };
      } catch {
        return { passed: 0, failed: 0, total: 0, unavailable: 0, top_failures: [] };
      }
    },
  },
  {
    kind: "dotnet",
    detect(filePath) {
      const match = findUpByEntry(
        filePath,
        (entry) => entry.toLowerCase().endsWith(".sln") || entry.toLowerCase().endsWith(".csproj")
      );
      return match ? { kind: "dotnet", root: match.root } : null;
    },
    execute: commandRunner("dotnet", ["test", "--logger", "console;verbosity=normal"]),
    parse: parseDotnet,
  },
  {
    kind: "maven",
    detect: sentinelDetect("maven", ["pom.xml"]),
    execute: commandRunner("mvn", ["test", "-q", "--batch-mode"]),
    parse: parseMaven,
  },
  {
    kind: "gradle",
    detect: sentinelDetect("gradle", ["build.gradle", "build.gradle.kts"]),
    async execute(root) {
      const gradlew = fs.existsSync(path.join(root, "gradlew")) ? "./gradlew" : "gradle";
      return execCommand(gradlew, ["test", "--info"], root);
    },
    parse: parseGradle,
  },
  {
    kind: "pytest",
    detect: detectPythonProject,
    execute: executePytestWithFallback,
    parse(output) {
      try {
        const parsed = JSON.parse(output) as ParsedTestResult;
        return {
          passed: Number(parsed.passed) || 0,
          failed: Number(parsed.failed) || 0,
          total: Number(parsed.total) || 0,
          unavailable: Number(parsed.unavailable) || 0,
          top_failures: Array.isArray(parsed.top_failures)
            ? parsed.top_failures.slice(0, 3).map((entry) => compactFailureLine(String(entry)))
            : [],
        };
      } catch {
        return parsePytest(output);
      }
    },
  },
  {
    kind: "cargo",
    detect: sentinelDetect("cargo", ["Cargo.toml"]),
    execute: commandRunner("cargo", ["test", "--", "--test-output", "immediate"]),
    parse: parseCargo,
  },
  {
    kind: "stack",
    detect: sentinelDetect("stack", ["stack.yaml"]),
    execute: commandRunner("stack", ["test", "--no-interleaved-output"]),
    parse: parseStack,
  },
  {
    kind: "cabal",
    detect(filePath) {
      const match = findUpByEntry(filePath, (entry) => entry.endsWith(".cabal"));
      return match ? { kind: "cabal", root: match.root } : null;
    },
    execute: commandRunner("cabal", ["test", "--test-show-details=streaming"]),
    parse: parseStack,
  },
  {
    kind: "elm-test",
    detect: sentinelDetect("elm-test", ["elm.json"]),
    execute: commandRunner("npx", ["elm-test", "--report=console"]),
    parse: parseElmTest,
  },
  {
    kind: "swift-package",
    detect: sentinelDetect("swift-package", ["Package.swift"]),
    execute: commandRunner("swift", ["test"]),
    parse: parseSwiftTest,
  },
  {
    kind: "rspec",
    detect(filePath) {
      const match = findUp(filePath, ["Gemfile"]);
      if (!match) return null;
      try {
        const content = fs.readFileSync(path.join(match.root, "Gemfile"), "utf-8");
        return content.includes("rspec") ? { kind: "rspec", root: match.root } : null;
      } catch {
        return null;
      }
    },
    execute: commandRunner("bundle", ["exec", "rspec", "--format", "progress"]),
    parse: parseRSpec,
  },
  {
    kind: "minitest",
    detect(filePath) {
      const match = findUp(filePath, ["Gemfile"]);
      if (!match) return null;
      try {
        const content = fs.readFileSync(path.join(match.root, "Gemfile"), "utf-8");
        return content.includes("rspec") ? null : { kind: "minitest", root: match.root };
      } catch {
        return { kind: "minitest", root: match.root };
      }
    },
    execute: commandRunner("bundle", ["exec", "rake", "test"]),
    parse: parseMinitest,
  },
  {
    kind: "npm-vitest",
    detect(filePath) {
      const match = detectNpmPackage(filePath, "vitest");
      return match ? { kind: "npm-vitest", root: match.root } : null;
    },
    execute(root) {
      return execCommand("npx", ["vitest", "run", "--reporter=verbose"], root, { CI: "true" });
    },
    parse: parseJestVitest,
  },
  {
    kind: "npm-mocha",
    detect(filePath) {
      const match = detectNpmPackage(filePath, "mocha");
      return match ? { kind: "npm-mocha", root: match.root } : null;
    },
    execute(root) {
      return execCommand("npm", ["test"], root, { CI: "true" });
    },
    parse: parseJestVitest,
  },
  {
    kind: "npm-jest",
    detect(filePath) {
      const match = findUp(filePath, ["package.json"]);
      return match ? { kind: "npm-jest", root: match.root } : null;
    },
    execute(root) {
      return execCommand("npm", ["test", "--", "--passWithNoTests", "--no-coverage"], root, { CI: "true" });
    },
    parse: parseJestVitest,
  },
];

export function detectProject(filePath: string, runners: TestRunner[] = builtInTestRunners) {
  for (const runner of runners) {
    const project = runner.detect(filePath);
    if (project) {
      return { project, runner };
    }
  }
  return null;
}
