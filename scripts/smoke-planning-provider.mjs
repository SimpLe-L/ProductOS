#!/usr/bin/env node
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  MockAgentProvider,
  NativeCliAgentProvider,
  PlanningOutputParseError,
  runPlanningAgent,
} from "../packages/agent/dist/index.js";
import { FileWorkflowEngine } from "../packages/workflow/dist/index.js";
import { FileWorkspaceEngine } from "../packages/workspace/dist/index.js";

const providerDefaults = {
  mock: { command: "", args: [] },
  codex: { command: "codex", args: ["exec", "--skip-git-repo-check", "-"] },
  "claude-code": { command: "claude", args: ["-p"] },
  "gemini-cli": { command: "gemini", args: ["-p"] },
  opencode: { command: "opencode", args: ["run"] },
};

const artifactTypes = ["RESEARCH", "COMPETITORS", "VISION", "ROADMAP", "PRD", "TASKS"];

const options = parseArgs(process.argv.slice(2));
const providerName = options.provider ?? "mock";
const defaults = providerDefaults[providerName];

if (!defaults) {
  console.error(`Unknown provider: ${providerName}`);
  process.exit(2);
}

const baseDir = path.resolve(options.baseDir ?? path.join(tmpdir(), "openfounder-planning-smoke"));
const workspaceName = options.name ?? `Planning Smoke ${new Date().toISOString().replace(/[:.]/g, "-")}`;
const idea = options.idea ?? "I want to build an AI interview platform for software engineers.";
const timeoutMs = Number(options.timeoutMs ?? "600000");
const command = options.command ?? defaults.command;
const commandArgs = options.args ? splitArgs(options.args) : defaults.args;

await mkdir(baseDir, { recursive: true });

const workspaceEngine = new FileWorkspaceEngine(baseDir);
const workflowEngine = new FileWorkflowEngine();
const workspace = await workspaceEngine.createWorkspace({
  baseDir,
  name: workspaceName,
  idea,
});
const provider =
  providerName === "mock"
    ? new MockAgentProvider()
    : new NativeCliAgentProvider({
        name: providerName,
        command,
        args: commandArgs,
        timeoutMs,
      });

const startedAt = Date.now();

try {
  const result = await runPlanningAgent({
    workspace: workspace.ref,
    provider,
    workspaceEngine,
    workflowEngine,
  });
  const durationMs = Date.now() - startedAt;
  const artifacts = {};

  for (const type of artifactTypes) {
    const artifact = await workspaceEngine.readArtifact(workspace.ref, type);
    artifacts[type] = {
      bytes: Buffer.byteLength(artifact.content, "utf8"),
      firstHeading: artifact.content.split("\n").find((line) => line.startsWith("#")) ?? "",
    };
  }

  const runs = await readdir(path.join(workspace.ref.rootPath, "runs"));
  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: providerName,
        command: providerName === "mock" ? "mock" : [command, ...commandArgs].join(" "),
        durationMs,
        workspace: workspace.ref.rootPath,
        runRecordPath: result.runRecordPath,
        runCount: runs.filter((file) => file.endsWith(".md")).length,
        artifacts,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const durationMs = Date.now() - startedAt;
  const failure = {
    ok: false,
    provider: providerName,
    command: providerName === "mock" ? "mock" : [command, ...commandArgs].join(" "),
    durationMs,
    workspace: workspace.ref.rootPath,
    error: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof PlanningOutputParseError) {
    let rawPath = error.rawOutputPath;
    if (!rawPath) {
      rawPath = path.join(workspace.ref.rootPath, "logs", "planning-raw-output.md");
      await writeFile(rawPath, error.rawOutput, "utf8");
    }
    failure.rawOutputPath = rawPath;
    failure.runRecordPath = error.runRecordPath;
    failure.missingFiles = error.missingFiles;
    failure.rawOutputBytes = Buffer.byteLength(error.rawOutput, "utf8");
  }

  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function splitArgs(value) {
  return value.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}
