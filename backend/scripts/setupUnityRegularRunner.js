const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const backendRoot = path.resolve(__dirname, "..");
const runnerRoot = path.join(backendRoot, "tools", "unity-regular-test-runner");
const projectPath = path.join(runnerRoot, "UnityRegularTestRunner.csproj");
const outputDir = path.join(runnerRoot, "dist");

function hasDotnet() {
  const result = spawnSync("dotnet", ["--version"], {
    cwd: backendRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function main() {
  if (!fs.existsSync(projectPath)) {
    console.log("[flowtide] Unity regular test runner project not found; skipping setup.");
    return;
  }

  if (!hasDotnet()) {
    console.log("[flowtide] dotnet SDK not found; skipping Unity regular test runner build.");
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const publishArgs = [
    "publish",
    projectPath,
    "--configuration",
    "Release",
    "--output",
    outputDir,
    "--nologo",
  ];

  const publish = spawnSync("dotnet", publishArgs, {
    cwd: backendRoot,
    stdio: "inherit",
  });

  if (publish.status !== 0) {
    console.warn("[flowtide] Unity regular test runner build failed; runtime will use dotnet run fallback.");
    return;
  }

  console.log(`[flowtide] Unity regular test runner published to ${outputDir}`);
}

main();
