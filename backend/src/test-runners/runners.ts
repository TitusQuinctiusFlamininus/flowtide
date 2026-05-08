import fs from "fs";
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
import type { DetectedProject, TestRunner } from "./types";
import { execCommand, findUp, findUpByEntry } from "./utils";

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

export const builtInTestRunners: TestRunner[] = [
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
    detect: sentinelDetect("pytest", ["pytest.ini", "setup.cfg", "pyproject.toml", "setup.py"]),
    execute: commandRunner("python", ["-m", "pytest", "--tb=no", "-q"]),
    parse: parsePytest,
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
