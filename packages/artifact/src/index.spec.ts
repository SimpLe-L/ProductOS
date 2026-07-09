import { describe, expect, it } from "vitest";
import { artifactFileName, parseArtifactType } from "./index.js";

describe("artifact mapping", () => {
  it("maps every MVP artifact to a stable markdown file", () => {
    expect(artifactFileName("IDEA")).toBe("idea.md");
    expect(artifactFileName("RESEARCH")).toBe("research.md");
    expect(artifactFileName("COMPETITORS")).toBe("competitors.md");
    expect(artifactFileName("VISION")).toBe("vision.md");
    expect(artifactFileName("ROADMAP")).toBe("roadmap.md");
    expect(artifactFileName("PRD")).toBe("prd.md");
    expect(artifactFileName("TASKS")).toBe("tasks.md");
    expect(artifactFileName("TECH_DESIGN")).toBe("tech-design.md");
    expect(artifactFileName("IMPLEMENTATION")).toBe("implementation.md");
    expect(artifactFileName("EXECUTION")).toBe("execution.md");
  });

  it("rejects unknown artifact types", () => {
    expect(() => parseArtifactType("CHAT")).toThrow();
  });
});
