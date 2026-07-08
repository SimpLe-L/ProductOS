import { z } from "zod";

export const artifactTypes = [
  "IDEA",
  "RESEARCH",
  "COMPETITORS",
  "VISION",
  "ROADMAP",
  "PRD",
  "TASKS",
  "TECH_DESIGN",
] as const;

export const artifactTypeSchema = z.enum(artifactTypes);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export interface Artifact {
  type: ArtifactType;
  content: string;
  updatedAt: string;
}

export const artifactFileByType: Record<ArtifactType, string> = {
  IDEA: "idea.md",
  RESEARCH: "research.md",
  COMPETITORS: "competitors.md",
  VISION: "vision.md",
  ROADMAP: "roadmap.md",
  PRD: "prd.md",
  TASKS: "tasks.md",
  TECH_DESIGN: "tech-design.md",
};

export function artifactFileName(type: ArtifactType): string {
  return artifactFileByType[artifactTypeSchema.parse(type)];
}

export function parseArtifactType(type: string): ArtifactType {
  return artifactTypeSchema.parse(type);
}

