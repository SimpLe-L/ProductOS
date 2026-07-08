import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileWorkspaceEngine } from "./index.js";

describe("FileWorkspaceEngine", () => {
  it("creates a workspace with metadata, knowledge, runs, logs, and an idea artifact", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workspace-"));
    const engine = new FileWorkspaceEngine(baseDir);

    const workspace = await engine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      description: "AI Interview SaaS",
      idea: "I want to build an AI interview platform.",
    });

    expect(workspace.ref.id).toBe("ai-interview-platform");
    expect(workspace.project.name).toBe("AI Interview Platform");
    expect(workspace.workflow.currentState).toBe("IDEA");
    expect(workspace.history).toHaveLength(1);

    const loaded = await engine.loadWorkspace("ai-interview-platform");
    expect(loaded.project.description).toBe("AI Interview SaaS");

    const idea = await engine.readArtifact(loaded.ref, "IDEA");
    expect(idea.content).toContain("AI interview platform");

    await expect(readFile(path.join(loaded.ref.rootPath, "knowledge", "product.md"), "utf8")).resolves.toContain("Product");
    await expect(readFile(path.join(loaded.ref.rootPath, "runs", ".keep"), "utf8")).rejects.toThrow();
  });

  it("writes, reads, and deletes artifacts", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workspace-"));
    const engine = new FileWorkspaceEngine(baseDir);
    const workspace = await engine.createWorkspace({
      baseDir,
      name: "Demo Product",
    });

    await engine.writeArtifact({
      workspace: workspace.ref,
      type: "RESEARCH",
      content: "# Research\n\nMarket notes",
    });

    await expect(engine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      type: "RESEARCH",
      content: "# Research\n\nMarket notes\n",
    });

    await engine.deleteArtifact(workspace.ref, "RESEARCH");
    await expect(engine.readArtifact(workspace.ref, "RESEARCH")).rejects.toThrow();
  });

  it("loads a workspace by absolute path", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workspace-"));
    const engine = new FileWorkspaceEngine();
    const workspace = await engine.createWorkspace({
      baseDir,
      name: "Path Loaded Product",
    });

    await expect(engine.loadWorkspace(workspace.ref.rootPath)).resolves.toMatchObject({
      project: {
        id: "path-loaded-product",
      },
    });
  });

  it("writes run records under runs", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workspace-"));
    const engine = new FileWorkspaceEngine(baseDir);
    const workspace = await engine.createWorkspace({
      baseDir,
      name: "Run Product",
    });

    const runPath = await engine.writeRunRecord({
      workspace: workspace.ref,
      title: "Research Run",
      agentName: "Research Agent",
      inputArtifacts: ["IDEA"],
      outputArtifacts: ["RESEARCH"],
      providerName: "mock",
      prompt: "Research this idea.",
      output: "Research output",
      filesUpdated: ["research.md"],
      startedAt: "2026-07-08T00:00:00.000Z",
      completedAt: "2026-07-08T00:00:01.000Z",
    });

    await expect(readFile(runPath, "utf8")).resolves.toContain("# Research Run");
    expect(path.basename(runPath)).toContain("research-agent");
  });
});
