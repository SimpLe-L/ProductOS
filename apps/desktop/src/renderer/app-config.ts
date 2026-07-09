import {
  ClipboardList,
  Code2,
  FileText,
  History,
  Inbox,
  MessageSquare,
  Search,
} from "lucide-react";
import type {
  DesktopProviderConfig,
  DesktopProviderKind,
  MvpArtifactType,
  RunAgentRequest,
} from "../shared.js";

export const artifactLabels: Record<MvpArtifactType, string> = {
  IDEA: "Idea",
  RESEARCH: "Research",
  COMPETITORS: "Competitors",
  VISION: "Vision",
  ROADMAP: "Roadmap",
  PRD: "PRD",
  TASKS: "Tasks",
  TECH_DESIGN: "Tech Design",
  IMPLEMENTATION: "Implementation",
  EXECUTION: "Execution",
};

export const artifactDescriptions: Record<MvpArtifactType, string> = {
  IDEA: "Raw founder notes and product intent.",
  RESEARCH: "Market and user research synthesis.",
  COMPETITORS: "Comparable products and positioning.",
  VISION: "Product direction and narrative.",
  ROADMAP: "Sequenced milestones and scope.",
  PRD: "Requirements for build planning.",
  TASKS: "Execution tasks for implementation.",
  TECH_DESIGN: "Architecture and implementation design.",
  IMPLEMENTATION: "Coding-stage handoff and validation plan.",
  EXECUTION: "Code execution report and verification results.",
};

export const artifactFiles: Record<MvpArtifactType, string> = {
  IDEA: "idea.md",
  RESEARCH: "research.md",
  COMPETITORS: "competitors.md",
  VISION: "vision.md",
  ROADMAP: "roadmap.md",
  PRD: "prd.md",
  TASKS: "tasks.md",
  TECH_DESIGN: "tech-design.md",
  IMPLEMENTATION: "implementation.md",
  EXECUTION: "execution.md",
};

export const agentByArtifact: Partial<Record<MvpArtifactType, RunAgentRequest["agent"]>> = {
  RESEARCH: "research",
  COMPETITORS: "competitor",
  VISION: "vision",
  ROADMAP: "roadmap",
  PRD: "prd",
  TASKS: "task",
  TECH_DESIGN: "tech-design",
  IMPLEMENTATION: "implementation",
  EXECUTION: "execution",
};

export const agentButtonLabels: Partial<Record<MvpArtifactType, string>> = {
  RESEARCH: "Run Research",
  COMPETITORS: "Run Competitor",
  VISION: "Run Vision",
  ROADMAP: "Run Roadmap",
  PRD: "Run PRD",
  TASKS: "Run Tasks",
  TECH_DESIGN: "Run Tech Design",
  IMPLEMENTATION: "Run Implementation",
  EXECUTION: "Run Execution",
};

export const activityItems = [
  { id: "workspace", label: "Workspace", icon: MessageSquare },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "research", label: "Research", icon: Search },
  { id: "artifacts", label: "Artifacts", icon: FileText },
] as const;

export const systemItems = [
  { id: "runs", label: "Runs", icon: History },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "dev", label: "Dev", icon: Code2 },
] as const;

export type ActivityId = (typeof activityItems)[number]["id"] | (typeof systemItems)[number]["id"] | "settings";
export type CenterMode = "artifact" | "log" | "run" | "inbox" | "settings";
export type SidebarSectionId = "projects" | "artifacts";
export type InspectorSectionId = "provider" | "workflow" | "runs" | "logs";

export const defaultSidebarOpen: Record<SidebarSectionId, boolean> = {
  projects: true,
  artifacts: true,
};

export const defaultInspectorOpen: Record<InspectorSectionId, boolean> = {
  provider: true,
  workflow: true,
  runs: true,
  logs: true,
};

export const providerOptions: Array<{ label: string; value: DesktopProviderKind }> = [
  { label: "Mock", value: "mock" },
  { label: "Codex", value: "codex" },
];

export const providerDefaults: Record<DesktopProviderKind, Pick<DesktopProviderConfig, "command" | "args">> = {
  mock: { command: "", args: [] },
  codex: { command: "codex", args: ["exec", "--skip-git-repo-check", "-"] },
  "claude-code": { command: "claude", args: ["-p"] },
  "gemini-cli": { command: "gemini", args: ["-p"] },
  opencode: { command: "opencode", args: ["run"] },
};
