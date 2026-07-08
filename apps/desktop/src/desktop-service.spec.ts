import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockAgentProvider } from "@productos/agent";
import { DesktopService } from "./desktop-service.js";

describe("DesktopService", () => {
  it("persists a workspace across service instances", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const firstSession = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Research Agent": "# Research\n\nPersisted research.",
      }),
    });

    const created = await firstSession.createWorkspace({
      name: "AI Interview Platform",
      description: "Desktop persistence test",
      idea: "我想做一个 AI 面试平台",
    });
    await firstSession.runAgent({ agent: "research" });
    await firstSession.saveArtifact("IDEA", `${created.artifacts.IDEA}\nEdited after creation.`);

    const secondSession = new DesktopService({ workspaceBaseDir });
    const loaded = await secondSession.loadWorkspace();

    expect(loaded).toMatchObject({
      name: "AI Interview Platform",
      description: "Desktop persistence test",
    });
    expect(loaded?.artifacts.IDEA).toContain("Edited after creation.");
    expect(loaded?.artifacts.RESEARCH).toContain("Persisted research.");
    expect(loaded?.runs.length).toBe(1);
  });

  it("lists and opens multiple workspaces", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await service.createWorkspace({
      name: "First Product",
      idea: "First idea",
    });
    await service.createWorkspace({
      name: "Second Product",
      idea: "Second idea",
    });

    const workspaces = await service.listWorkspaces();
    expect(workspaces.map((workspace) => workspace.id).sort()).toEqual(["first-product", "second-product"]);

    const opened = await service.openWorkspace("first-product");
    expect(opened.artifacts.IDEA).toBe("First idea\n");
  });

  it("runs the full MVP chain from the desktop service", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Research Agent": "# Research\n\nDesktop research.",
        "Competitor Agent": "# Competitors\n\nDesktop competitors.",
        "Vision Agent": "# Vision\n\nDesktop vision.",
        "Roadmap Agent": "# Roadmap\n\nDesktop roadmap.",
        "PRD Agent": "# PRD\n\nDesktop PRD.",
        "Task Agent": "# Tasks\n\n- Desktop task.",
      }),
    });

    await service.createWorkspace({
      name: "AI Interview Platform",
      idea: "我想做一个 AI 面试平台",
    });
    const completed = await service.runMvpChain();

    expect(completed.artifacts.RESEARCH).toContain("Desktop research.");
    expect(completed.artifacts.COMPETITORS).toContain("Desktop competitors.");
    expect(completed.artifacts.VISION).toContain("Desktop vision.");
    expect(completed.artifacts.ROADMAP).toContain("Desktop roadmap.");
    expect(completed.artifacts.PRD).toContain("Desktop PRD.");
    expect(completed.artifacts.TASKS).toContain("Desktop task.");
    expect(completed.runs).toHaveLength(6);
    expect(completed.completedStates).toEqual(["RESEARCH", "COMPETITORS", "VISION", "ROADMAP", "PRD", "TASKS"]);
  });

  it("returns null before a workspace exists", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await expect(service.loadWorkspace()).resolves.toBeNull();
  });
});
