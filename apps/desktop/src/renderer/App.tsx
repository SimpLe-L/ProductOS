import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Code2,
  FileText,
  Folder,
  History,
  Inbox,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CreateWorkspaceRequest,
  DesktopAgentRunEvent,
  DesktopApi,
  DesktopLogDetail,
  DesktopProviderConfig,
  DesktopProviderHealth,
  DesktopProviderKind,
  DesktopRunDetail,
  DesktopVerificationConfig,
  DesktopWorkspaceListItem,
  DesktopWorkspaceSummary,
  MvpArtifactType,
  RunAgentRequest,
} from "../shared.js";
import { mvpArtifactTypes } from "../shared.js";

const artifactLabels: Record<MvpArtifactType, string> = {
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

const artifactDescriptions: Record<MvpArtifactType, string> = {
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

const artifactFiles: Record<MvpArtifactType, string> = {
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

const agentByArtifact: Partial<Record<MvpArtifactType, RunAgentRequest["agent"]>> = {
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

const agentButtonLabels: Partial<Record<MvpArtifactType, string>> = {
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

const activityItems = [
  { label: "Workspace", icon: MessageSquare, active: true },
  { label: "Inbox", icon: Inbox },
  { label: "Research", icon: Search },
  { label: "Artifacts", icon: FileText },
];

const systemItems = [
  { label: "Runs", icon: History },
  { label: "Tasks", icon: ClipboardList },
  { label: "Dev", icon: Code2 },
];

const providerOptions: Array<{ label: string; value: DesktopProviderKind }> = [
  { label: "Mock", value: "mock" },
  { label: "Codex", value: "codex" },
  { label: "Claude", value: "claude-code" },
  { label: "Gemini", value: "gemini-cli" },
  { label: "OpenCode", value: "opencode" },
];

const providerDefaults: Record<DesktopProviderKind, Pick<DesktopProviderConfig, "command" | "args">> = {
  mock: { command: "", args: [] },
  codex: { command: "codex", args: ["exec", "--skip-git-repo-check", "-"] },
  "claude-code": { command: "claude", args: ["-p"] },
  "gemini-cli": { command: "gemini", args: ["-p"] },
  opencode: { command: "opencode", args: ["run"] },
};

interface ActiveRunState {
  label: string;
  provider: DesktopProviderKind;
  startedAt: number;
}

export function App() {
  const api: DesktopApi = useMemo(() => window.openFounder ?? createBrowserPreviewApi(), []);
  const [workspace, setWorkspace] = useState<DesktopWorkspaceSummary | null>(null);
  const [workspaceList, setWorkspaceList] = useState<DesktopWorkspaceListItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<MvpArtifactType>("IDEA");
  const [viewMode, setViewMode] = useState<"artifact" | "log" | "run">("artifact");
  const [selectedLog, setSelectedLog] = useState<DesktopLogDetail | null>(null);
  const [selectedRun, setSelectedRun] = useState<DesktopRunDetail | null>(null);
  const [providerConfig, setProviderConfig] = useState<DesktopProviderConfig | null>(null);
  const [providerDraft, setProviderDraft] = useState<DesktopProviderConfig | null>(null);
  const [providerHealth, setProviderHealth] = useState<DesktopProviderHealth | null>(null);
  const [verificationDraft, setVerificationDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>("Loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [activeRun, setActiveRun] = useState<ActiveRunState | null>(null);
  const [runEvents, setRunEvents] = useState<DesktopAgentRunEvent[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    Promise.all([api.listWorkspaces(), api.loadWorkspace(), api.getProviderConfig()]).then(async ([list, loaded, provider]) => {
      setProviderConfig(provider);
      setProviderDraft(provider);
      api.checkProviderHealth().then(setProviderHealth).catch((error: unknown) => {
        setProviderHealth({
          provider: provider.provider,
          ok: false,
          command: provider.command,
          message: "Provider health check failed.",
          details: errorToMessage(error),
          checkedAt: new Date().toISOString(),
        });
      });

      if (!loaded) {
        const created = await api.createWorkspace({
          name: "Untitled Product",
          description: "Local product workspace",
          idea: "# Idea\n\n",
        });
        const nextList = await api.listWorkspaces();
        setWorkspaceList(nextList);
        setWorkspace(created);
        setVerificationDraft(formatVerificationConfig(await api.getVerificationConfig()));
        setDraft(created.artifacts.IDEA);
        setBusy(null);
        return;
      }

      setWorkspaceList(list);
      setWorkspace(loaded);
      setVerificationDraft(formatVerificationConfig(await api.getVerificationConfig()));
      setDraft(loaded.artifacts.IDEA);
      setBusy(null);
    });
  }, [api]);

  useEffect(() => {
    return api.onAgentRunEvent((event) => {
      setRunEvents((current) => [...current.slice(-79), event]);
    });
  }, [api]);

  useEffect(() => {
    if (viewMode === "artifact") {
      setDraft(workspace?.artifacts[selectedArtifact] ?? "");
    }
  }, [workspace, selectedArtifact, viewMode]);

  useEffect(() => {
    if (!activeRun) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - activeRun.startedAt) / 1000)));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(timer);
  }, [activeRun]);

  async function createWorkspace(input: CreateWorkspaceRequest) {
    setErrorMessage(null);
    setBusy("Creating workspace");
    try {
      const created = await api.createWorkspace(input);
      setWorkspaceList(await api.listWorkspaces());
      setWorkspace(created);
      setVerificationDraft(formatVerificationConfig(await api.getVerificationConfig()));
      setSelectedArtifact("IDEA");
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      setDraft(created.artifacts.IDEA);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function createBlankWorkspace() {
    await createWorkspace({
      name: `Untitled Product ${workspaceList.length + 1}`,
      description: "Local product workspace",
      idea: "# Idea\n\n",
    });
  }

  async function saveArtifact() {
    if (!workspace || viewMode !== "artifact") return;
    setErrorMessage(null);
    setBusy("Saving artifact");
    try {
      const updated = await api.saveArtifact(selectedArtifact, draft);
      setWorkspace(updated);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 900);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function runAgent(type: MvpArtifactType) {
    const agent = agentByArtifact[type];
    if (!workspace || !agent) return;

    setErrorMessage(null);
    const runLabel = agentButtonLabels[type] ?? "Running agent";
    setBusy(runLabel);
    setRunEvents([]);
    setActiveRun({
      label: runLabel,
      provider: providerConfig?.provider ?? "mock",
      startedAt: Date.now(),
    });
    try {
      await api.saveArtifact(selectedArtifact, draft);
      const updated = await api.runAgent({ agent });
      setWorkspace(updated);
      setSelectedArtifact(type);
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      setDraft(updated.artifacts[type]);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
      await refreshCurrentWorkspace();
    } finally {
      setActiveRun(null);
      setBusy(null);
    }
  }

  async function runPlanning() {
    if (!workspace) return;

    const previousRunFiles = new Set(workspace.runs.map((run) => run.fileName));
    const previousLogFiles = new Set(workspace.logs.map((log) => log.fileName));
    setErrorMessage(null);
    setBusy("Running Planning");
    setRunEvents([]);
    setActiveRun({
      label: "Running Planning",
      provider: providerConfig?.provider ?? "mock",
      startedAt: Date.now(),
    });
    try {
      await api.saveArtifact(selectedArtifact, draft);
      const updated = await api.runPlanning();
      setWorkspace(updated);
      setSelectedArtifact("TASKS");
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      setDraft(updated.artifacts.TASKS);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
      const refreshed = await refreshCurrentWorkspace();
      if (refreshed) {
        await openNewestDiagnostic(refreshed, previousRunFiles, previousLogFiles);
      }
    } finally {
      setActiveRun(null);
      setBusy(null);
    }
  }

  async function runMvpChain() {
    if (!workspace) return;

    setErrorMessage(null);
    setBusy("Running MVP chain");
    setRunEvents([]);
    setActiveRun({
      label: "Running MVP chain",
      provider: providerConfig?.provider ?? "mock",
      startedAt: Date.now(),
    });
    try {
      await api.saveArtifact(selectedArtifact, draft);
      const updated = await api.runMvpChain();
      setWorkspace(updated);
      setSelectedArtifact("EXECUTION");
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      setDraft(updated.artifacts.EXECUTION);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
      await refreshCurrentWorkspace();
    } finally {
      setActiveRun(null);
      setBusy(null);
    }
  }

  async function refreshCurrentWorkspace(): Promise<DesktopWorkspaceSummary | null> {
    if (!workspace) return null;

    try {
      const refreshed = await api.openWorkspace(workspace.id);
      setWorkspace(refreshed);
      return refreshed;
    } catch {
      // Keep the original failure visible; this refresh is best-effort after failed runs.
      return null;
    }
  }

  async function openNewestDiagnostic(
    refreshed: DesktopWorkspaceSummary,
    previousRunFiles: Set<string>,
    previousLogFiles: Set<string>,
  ) {
    const newRun = refreshed.runs.find((run) => !previousRunFiles.has(run.fileName));
    if (newRun) {
      try {
        const detail = await api.readRun(newRun.fileName);
        setSelectedRun(detail);
        setSelectedLog(null);
        setViewMode("run");
        return;
      } catch {
        // Fall through to logs; the visible error still comes from the failed run.
      }
    }

    const newLog = refreshed.logs.find((log) => !previousLogFiles.has(log.fileName));
    if (newLog) {
      try {
        const detail = await api.readLog(newLog.fileName);
        setSelectedLog(detail);
        setSelectedRun(null);
        setViewMode("log");
      } catch {
        // Keep the refreshed workspace visible if the diagnostic read fails.
      }
    }
  }

  async function openWorkspace(id: string) {
    setErrorMessage(null);
    setBusy("Opening workspace");
    try {
      const opened = await api.openWorkspace(id);
      setWorkspace(opened);
      setVerificationDraft(formatVerificationConfig(await api.getVerificationConfig()));
      setSelectedArtifact("IDEA");
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      setDraft(opened.artifacts.IDEA);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function selectProvider(provider: DesktopProviderKind) {
    const defaults = providerDefaults[provider];
    const next = {
      provider,
      command: defaults.command,
      args: defaults.args,
      timeoutMs: providerDraft?.timeoutMs ?? 120_000,
    };
    setProviderDraft(next);
    await saveProviderConfig(next);
  }

  async function saveProviderConfig(input = providerDraft) {
    if (!input) return;
    setErrorMessage(null);
    setBusy("Saving provider");
    try {
      const updated = await api.setProviderConfig(input);
      setProviderConfig(updated);
      setProviderDraft(updated);
      await refreshProviderHealth(updated);
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveVerificationConfig() {
    setErrorMessage(null);
    setBusy("Saving verification");
    try {
      const updated = await api.setVerificationConfig(parseVerificationDraft(verificationDraft));
      setVerificationDraft(formatVerificationConfig(updated));
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function refreshProviderHealth(config = providerConfig) {
    if (!config) return;
    setProviderHealth(null);
    try {
      setProviderHealth(await api.checkProviderHealth());
    } catch (error) {
      setProviderHealth({
        provider: config.provider,
        ok: false,
        command: config.command,
        message: "Provider health check failed.",
        details: errorToMessage(error),
        checkedAt: new Date().toISOString(),
      });
    }
  }

  async function openLog(fileName: string) {
    setErrorMessage(null);
    setBusy("Opening log");
    try {
      const log = await api.readLog(fileName);
      setSelectedLog(log);
      setSelectedRun(null);
      setViewMode("log");
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function openRun(fileName: string) {
    setErrorMessage(null);
    setBusy("Opening run");
    try {
      const run = await api.readRun(fileName);
      setSelectedRun(run);
      setSelectedLog(null);
      setViewMode("run");
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (busy === "Loading") {
    return (
      <div className="grid min-h-full auto-cols-max grid-flow-col place-content-center items-center gap-2.5 bg-background text-[13px] text-muted-foreground">
        <Sparkles size={20} />
        <span>Opening OpenFounder</span>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="grid min-h-full auto-cols-max grid-flow-col place-content-center items-center gap-2.5 bg-background text-[13px] text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
        <span>Preparing workspace</span>
      </div>
    );
  }

  const currentAgent = agentByArtifact[selectedArtifact];
  const canRunSelected = Boolean(currentAgent);
  const completedCount = workspace.completedStates.length;
  const runCount = workspace.runs.length;
  const activeProvider = providerConfig?.provider ?? "mock";

  return (
    <TooltipProvider>
      <main className="grid h-full min-w-0 grid-cols-[188px_292px_minmax(420px,1fr)_330px] bg-background max-[1180px]:grid-cols-[60px_260px_minmax(380px,1fr)] max-[820px]:grid-cols-[52px_minmax(0,1fr)]">
        <ActivityBar />

        <section className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_1fr_auto] border-r border-border bg-sidebar max-[820px]:hidden">
          <header className="flex min-h-14 items-center justify-between gap-2.5 px-4 pb-2 pt-3">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground">Workspace</span>
              <h1 className="mt-0.5 truncate text-base font-semibold leading-tight text-foreground">
                {workspace.name}
              </h1>
            </div>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={createBlankWorkspace}
                aria-label="New workspace"
              >
                <Plus size={16} />
              </TooltipTrigger>
              <TooltipContent>New workspace</TooltipContent>
            </Tooltip>
          </header>

          <div className="mx-4 mb-3 [overflow-wrap:anywhere] text-[11px] leading-relaxed text-muted-foreground">
            {workspace.rootPath}
          </div>

          {workspaceList.length > 0 && (
            <SidebarSection title="Projects">
              <div className="grid gap-0.5">
                {workspaceList.map((item) => (
                  <Button
                    key={item.id}
                    className={cn(
                      "grid h-8 grid-cols-[auto_minmax(0,1fr)] justify-start gap-2 px-2 text-muted-foreground",
                      item.id === workspace.id && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    variant="ghost"
                    size="sm"
                    onClick={() => openWorkspace(item.id)}
                  >
                    <Folder size={14} />
                    <span className="truncate text-left">{item.name}</span>
                  </Button>
                ))}
              </div>
            </SidebarSection>
          )}

          <SidebarSection className="min-h-0 overflow-hidden" title="Artifacts">
            <ScrollArea className="h-full">
              <nav className="grid gap-0.5 pr-1" aria-label="Artifacts">
                {mvpArtifactTypes.map((type) => {
                  const complete = workspace.completedStates.includes(type);
                  return (
                    <Button
                      key={type}
                      className={cn(
                        "grid h-8 grid-cols-[auto_minmax(0,1fr)_auto] justify-start gap-2 px-2 text-muted-foreground",
                        viewMode === "artifact" && type === selectedArtifact && "bg-sidebar-accent text-primary"
                      )}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedArtifact(type);
                        setViewMode("artifact");
                        setSelectedLog(null);
                        setSelectedRun(null);
                      }}
                    >
                      <FileText size={14} />
                      <span className="truncate text-left">{artifactFiles[type]}</span>
                      {complete && <Check className="text-green-700" size={14} />}
                    </Button>
                  );
                })}
              </nav>
            </ScrollArea>
          </SidebarSection>

          <div className="grid gap-2.5 border-t border-border p-3.5">
            <div>
              <span className="block text-2xl font-bold leading-none text-foreground">{completedCount}</span>
              <p className="mt-1 text-xs text-muted-foreground">completed</p>
            </div>
            <Button className="w-full" onClick={runPlanning} disabled={!workspace || Boolean(busy)}>
              {busy === "Running Planning" ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              <span>Run Planning</span>
            </Button>
            <Button className="w-full" variant="outline" onClick={runMvpChain} disabled={!workspace || Boolean(busy)}>
              {busy === "Running MVP chain" ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Play size={15} />
              )}
              <span>Legacy Chain</span>
            </Button>
          </div>
        </section>

        <section className="grid min-h-0 min-w-0 grid-rows-[42px_auto_1fr] bg-background">
          <header className="flex items-center justify-between gap-3.5 border-b border-border px-5 max-[820px]:px-3">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{workspace.name}</span>
              <span>/</span>
              <strong className="truncate font-semibold text-foreground">
                {viewMode === "log" && selectedLog
                  ? selectedLog.fileName
                  : viewMode === "run" && selectedRun
                    ? selectedRun.fileName
                    : artifactFiles[selectedArtifact]}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === "artifact" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveArtifact}
                  disabled={Boolean(busy)}
                  aria-label="Save artifact"
                >
                  <Save size={15} />
                  <span className="max-[820px]:hidden">{saveState === "saved" ? "Saved" : "Save"}</span>
                </Button>
              )}
              {viewMode === "artifact" && canRunSelected && (
                <Button size="sm" onClick={() => runAgent(selectedArtifact)} disabled={Boolean(busy)}>
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
                  <span className="max-[820px]:hidden">{agentButtonLabels[selectedArtifact]}</span>
                </Button>
              )}
            </div>
          </header>

          <div className="flex min-h-[120px] items-start justify-between gap-5 px-7 py-6 max-[820px]:min-h-[104px] max-[820px]:px-4 max-[820px]:py-4">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {viewMode === "log" ? "Log" : viewMode === "run" ? "Run" : "Artifact"}
              </span>
              <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-normal text-foreground max-[820px]:text-[22px]">
                {viewMode === "log" && selectedLog
                  ? selectedLog.title
                  : viewMode === "run" && selectedRun
                    ? selectedRun.title
                    : artifactLabels[selectedArtifact]}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {viewMode === "log" && selectedLog
                  ? `Updated ${new Date(selectedLog.updatedAt).toLocaleString()}`
                  : viewMode === "run" && selectedRun
                    ? `Updated ${new Date(selectedRun.updatedAt).toLocaleString()}`
                    : artifactDescriptions[selectedArtifact]}
              </p>
            </div>
            <Badge
              className="h-6 shrink-0 gap-1.5 rounded-full border-border bg-card/60 text-muted-foreground max-[820px]:hidden"
              variant="outline"
            >
              <CircleDot size={13} />
              {viewMode === "log" || viewMode === "run"
                ? "Read only"
                : workspace.completedStates.includes(selectedArtifact)
                  ? "Complete"
                  : "Editable"}
            </Badge>
          </div>

          {viewMode === "log" && selectedLog ? (
            <ScrollArea className="min-h-0 border-t border-border bg-card/55">
              <pre className="whitespace-pre-wrap px-7 py-6 font-mono text-sm leading-relaxed text-foreground max-[820px]:px-4 max-[820px]:py-4">
                {selectedLog.content}
              </pre>
            </ScrollArea>
          ) : viewMode === "run" && selectedRun ? (
            <ScrollArea className="min-h-0 border-t border-border bg-card/55">
              <pre className="whitespace-pre-wrap px-7 py-6 font-mono text-sm leading-relaxed text-foreground max-[820px]:px-4 max-[820px]:py-4">
                {selectedRun.content}
              </pre>
            </ScrollArea>
          ) : (
            <Textarea
              className="h-full min-h-0 resize-none rounded-none border-x-0 border-b-0 bg-card/55 px-7 py-6 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0 max-[820px]:px-4 max-[820px]:py-4"
              value={draft}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
              placeholder={selectedArtifact === "IDEA" ? "Write the product idea here..." : ""}
              spellCheck={false}
            />
          )}
        </section>

        <aside className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(250px,auto)_minmax(150px,1fr)_minmax(120px,auto)] border-l border-border bg-sidebar max-[1180px]:hidden">
          <InspectorCard title="Provider" value={activeProvider}>
            {providerDraft && (
              <div className="grid gap-3">
                <div
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-xs",
                    providerHealth?.ok
                      ? "border-green-700/30 bg-green-700/5 text-foreground"
                      : "border-destructive/30 bg-destructive/5 text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {providerHealth ? providerHealth.message : "Checking provider..."}
                    </span>
                    <Button
                      className="h-6 px-2 text-[11px]"
                      variant="outline"
                      size="xs"
                      onClick={() => refreshProviderHealth(providerDraft)}
                    >
                      Check
                    </Button>
                  </div>
                  {providerHealth?.details && (
                    <p className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                      {providerHealth.details}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {providerOptions.map((option) => (
                    <Button
                      key={option.value}
                      className={cn(
                        "h-7 justify-start px-2 text-xs",
                        providerDraft.provider === option.value && "bg-primary text-primary-foreground"
                      )}
                      variant={providerDraft.provider === option.value ? "default" : "outline"}
                      size="xs"
                      onClick={() => selectProvider(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="provider-command">
                    Command
                  </label>
                  <Input
                    id="provider-command"
                    className="h-7 text-xs"
                    disabled={providerDraft.provider === "mock"}
                    value={providerDraft.command}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setProviderDraft({ ...providerDraft, command: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="provider-args">
                    Args
                  </label>
                  <Input
                    id="provider-args"
                    className="h-7 text-xs"
                    disabled={providerDraft.provider === "mock"}
                    value={providerDraft.args.join(" ")}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setProviderDraft({
                        ...providerDraft,
                        args: event.target.value
                          .split(" ")
                          .map((arg) => arg.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="provider-timeout">
                      Timeout ms
                    </label>
                    <Input
                      id="provider-timeout"
                      className="h-7 text-xs"
                      inputMode="numeric"
                      value={providerDraft.timeoutMs}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        setProviderDraft({
                          ...providerDraft,
                          timeoutMs: Number(event.target.value) || 120_000,
                        })
                      }
                    />
                  </div>
                  <Button className="h-7" size="xs" variant="outline" onClick={() => saveProviderConfig()}>
                    Save
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="verification-commands">
                    Verification
                  </label>
                  <Textarea
                    id="verification-commands"
                    className="min-h-20 resize-none px-2 py-1.5 font-mono text-[11px]"
                    value={verificationDraft}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setVerificationDraft(event.target.value)
                    }
                    placeholder="Typecheck: pnpm typecheck"
                    spellCheck={false}
                  />
                  <Button className="h-7 justify-self-end" size="xs" variant="outline" onClick={saveVerificationConfig}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </InspectorCard>

          <InspectorCard title="Workflow" value={workspace.currentState}>
            <div className="grid gap-1">
              {mvpArtifactTypes.map((type) => (
                <Button
                  key={type}
                  className={cn(
                    "h-[42px] justify-start border-l-2 border-transparent px-2 text-left text-muted-foreground",
                    workspace.completedStates.includes(type) && "border-l-green-700 text-foreground",
                    type === selectedArtifact && "border-l-primary bg-sidebar-accent text-foreground"
                  )}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedArtifact(type);
                    setViewMode("artifact");
                    setSelectedLog(null);
                    setSelectedRun(null);
                  }}
                >
                  <span className="grid min-w-0">
                    <span className="truncate text-[13px] font-medium">{artifactLabels[type]}</span>
                    <span className="truncate text-[11px] font-normal text-muted-foreground">
                      {artifactFiles[type]}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </InspectorCard>

          <InspectorCard title="Runs" value={runCount}>
            {activeRun && (
              <div className="mb-2.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between gap-2 text-foreground">
                  <span className="font-semibold">{activeRun.label}</span>
                  <span>{formatElapsed(elapsedSeconds)}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Provider: {activeRun.provider}</p>
                {runEvents.length > 0 && (
                  <ScrollArea className="mt-2 max-h-28 rounded-md border border-border bg-background/70">
                    <div className="grid gap-1 p-2 font-mono text-[11px] leading-relaxed">
                      {runEvents.slice(-8).map((event, index) => (
                        <div
                          className={cn(
                            "grid grid-cols-[42px_minmax(0,1fr)] gap-1",
                            event.stream === "stderr" && "text-destructive"
                          )}
                          key={`${event.timestamp}-${index}`}
                        >
                          <span className="uppercase text-muted-foreground">{event.stream}</span>
                          <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {event.content.trimEnd() || " "}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
            <RunList
              empty="No runs yet."
              onOpen={openRun}
              items={workspace.runs.map((run) => ({
                id: run.fileName,
                title: run.title,
                updatedAt: run.updatedAt,
              }))}
            />
          </InspectorCard>

          <InspectorCard title="Logs" value={workspace.logs.length}>
            <RunList
              empty="No logs yet."
              onOpen={openLog}
              items={workspace.logs.map((log) => ({
                id: log.fileName,
                title: log.title,
                updatedAt: log.updatedAt,
              }))}
            />
          </InspectorCard>
        </aside>

        {busy && busy !== "Loading" && (
          <div className="fixed bottom-4 right-4 inline-flex max-w-[320px] items-center gap-2 rounded-lg border border-foreground/20 bg-foreground px-3 py-2 text-xs text-background shadow-xl">
            <Loader2 className="animate-spin" size={15} />
            <span>
              {activeRun ? `${activeRun.label} · ${activeRun.provider} · ${formatElapsed(elapsedSeconds)}` : busy}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="fixed bottom-4 left-1/2 max-w-xl -translate-x-1/2 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-xs text-foreground shadow-xl">
            <strong className="mr-2 text-destructive">Error</strong>
            <span>{errorMessage}</span>
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}

function ActivityBar() {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-[var(--color-bg-tertiary)] max-[1180px]:items-center">
      <div className="flex h-[42px] items-center gap-2.5 px-4 max-[1180px]:justify-center max-[1180px]:px-0">
        <div className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-background text-[9px] font-extrabold text-primary shadow-[0_0_14px_var(--color-accent-dim)]">
          OF
        </div>
        <strong className="min-w-0 truncate text-[15px] font-semibold text-foreground max-[1180px]:hidden">
          OpenFounder
        </strong>
      </div>

      <ScrollArea className="flex-1">
        <nav className="grid gap-0.5 px-2.5 py-2 max-[1180px]:justify-items-center max-[1180px]:px-2">
          {activityItems.map((item) => (
            <ActivityButton
              key={item.label}
              active={Boolean(item.active)}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="grid gap-0.5 px-2.5 py-2 max-[1180px]:justify-items-center max-[1180px]:px-2">
        <Button
          className="h-7 justify-start gap-1.5 px-2 text-[11px] font-bold uppercase text-muted-foreground max-[1180px]:size-9 max-[1180px]:justify-center max-[1180px]:px-0"
          variant="ghost"
          size="sm"
        >
          <ChevronDown size={14} />
          <span className="max-[1180px]:hidden">System</span>
        </Button>
        {systemItems.map((item) => (
          <ActivityButton key={item.label} icon={item.icon} label={item.label} />
        ))}
      </div>

      <Separator />
      <div className="grid grid-cols-[1fr_auto] gap-1 px-2.5 py-2.5 max-[1180px]:grid-cols-1 max-[1180px]:justify-items-center max-[1180px]:px-2">
        <ActivityButton icon={Settings} label="Settings" />
        <Button
          className="size-8 text-muted-foreground max-[1180px]:hidden"
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </Button>
      </div>
    </aside>
  );
}

function ActivityButton({
  active = false,
  icon: Icon,
  label,
}: {
  active?: boolean;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex h-8 items-center justify-start gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-[1180px]:size-9 max-[1180px]:justify-center max-[1180px]:px-0",
          active && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        aria-label={label}
      >
        <Icon size={16} />
        <span className="max-[1180px]:hidden">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="min-[1181px]:hidden" side="right">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarSection({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div className={cn("grid content-start gap-1 px-2.5 pb-3", className)}>
      <Button
        className="h-7 justify-start gap-1.5 px-2 text-[11px] font-bold uppercase text-muted-foreground"
        variant="ghost"
        size="sm"
      >
        <ChevronDown size={13} />
        <span>{title}</span>
      </Button>
      {children}
    </div>
  );
}

function InspectorCard({
  children,
  title,
  value,
}: {
  children: React.ReactNode;
  title: string;
  value: string | number;
}) {
  return (
    <Card className="min-h-0 rounded-none border-0 border-b border-border bg-transparent shadow-none ring-0">
      <CardHeader className="flex-row items-baseline justify-between px-4 pb-2 pt-4">
        <span className="text-[11px] font-semibold text-muted-foreground">{title}</span>
        <CardTitle className="text-xs font-semibold text-foreground">{value}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 px-4 pb-4">
        <ScrollArea className="max-h-full">{children}</ScrollArea>
      </CardContent>
    </Card>
  );
}

function RunList({
  empty,
  items,
  onOpen,
}: {
  empty: string;
  items: Array<{ id: string; title: string; updatedAt: string }>;
  onOpen?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="m-0 text-[11px] text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-0">
      {items.map((item) => {
        const content = (
          <>
          <strong className="[overflow-wrap:anywhere] text-xs font-semibold text-foreground">
            {item.title}
          </strong>
          <span className="text-[11px] text-muted-foreground">
            {new Date(item.updatedAt).toLocaleString()}
          </span>
          </>
        );

        return onOpen ? (
          <button
            className="grid gap-1 border-b border-border/80 py-2.5 text-left transition-colors hover:text-primary"
            key={item.id}
            onClick={() => onOpen(item.id)}
          >
            {content}
          </button>
        ) : (
          <article className="grid gap-1 border-b border-border/80 py-2.5" key={item.id}>
            {content}
          </article>
        );
      })}
    </div>
  );
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatVerificationConfig(config: DesktopVerificationConfig): string {
  return config.commands
    .map((command) => `${command.name}: ${[command.command, ...command.args].join(" ")}`)
    .join("\n");
}

function parseVerificationDraft(value: string): DesktopVerificationConfig {
  return {
    commands: value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        const name = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const commandLine = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
        const [command = "", ...args] = commandLine.split(/\s+/).filter(Boolean);

        return {
          name: name || command,
          command,
          args,
        };
      })
      .filter((command) => command.command.length > 0),
  };
}

function createBrowserPreviewApi(): DesktopApi {
  let workspace: DesktopWorkspaceSummary | null = null;
  let previewProviderConfig: DesktopProviderConfig = {
    provider: "mock",
    command: "",
    args: [],
    timeoutMs: 120_000,
  };
  let previewVerificationConfig: DesktopVerificationConfig = {
    commands: [],
  };

  function ensureWorkspace() {
    if (!workspace) {
      throw new Error("No workspace loaded.");
    }

    return workspace;
  }

  return {
    async listWorkspaces() {
      return workspace
        ? [
            {
              id: workspace.id,
              name: workspace.name,
              description: workspace.description,
              rootPath: workspace.rootPath,
              updatedAt: new Date().toISOString(),
            },
          ]
        : [];
    },
    async openWorkspace() {
      return ensureWorkspace();
    },
    async loadWorkspace() {
      return workspace;
    },
    async createWorkspace(input) {
      workspace = {
        id: "preview",
        name: input.name,
        description: input.description ?? "",
        rootPath: "~/OpenFounder/preview",
        currentState: "IDEA",
        completedStates: [],
        artifacts: {
          IDEA: `${input.idea}\n`,
          RESEARCH: "",
          COMPETITORS: "",
          VISION: "",
          ROADMAP: "",
          PRD: "",
          TASKS: "",
          TECH_DESIGN: "",
          IMPLEMENTATION: "",
          EXECUTION: "",
        },
        runs: [],
        logs: [],
      };
      return workspace;
    },
    async saveArtifact(type, content) {
      const loaded = ensureWorkspace();
      loaded.artifacts[type] = content.endsWith("\n") ? content : `${content}\n`;
      return { ...loaded };
    },
    async getProviderConfig() {
      return { ...previewProviderConfig, args: [...previewProviderConfig.args] };
    },
    async setProviderConfig(config) {
      previewProviderConfig = { ...config, args: [...config.args] };
      return { ...previewProviderConfig, args: [...previewProviderConfig.args] };
    },
    async checkProviderHealth() {
      return {
        provider: previewProviderConfig.provider,
        ok: previewProviderConfig.provider === "mock",
        command: previewProviderConfig.command || "mock",
        message:
          previewProviderConfig.provider === "mock"
            ? "Mock provider is ready."
            : "Provider health checks run in Electron.",
        details:
          previewProviderConfig.provider === "mock"
            ? "Mock mode uses deterministic local output."
            : "Open the Electron app to check local CLI availability.",
        checkedAt: new Date().toISOString(),
      };
    },
    async getVerificationConfig() {
      return {
        commands: previewVerificationConfig.commands.map((command) => ({
          ...command,
          args: [...command.args],
        })),
      };
    },
    async setVerificationConfig(config) {
      previewVerificationConfig = {
        commands: config.commands.map((command) => ({
          ...command,
          args: [...command.args],
        })),
      };
      return this.getVerificationConfig();
    },
    async readRun(fileName) {
      const loaded = ensureWorkspace();
      const found = loaded.runs.find((run) => run.fileName === fileName);
      if (!found) {
        throw new Error(`Run not found: ${fileName}`);
      }

      return {
        ...found,
        content: `# ${found.title}\n\nPreview run record for ${fileName}.\n`,
      };
    },
    async readLog(fileName) {
      const loaded = ensureWorkspace();
      const found = loaded.logs.find((log) => log.fileName === fileName);
      if (!found) {
        throw new Error(`Log not found: ${fileName}`);
      }

      return {
        ...found,
        content: `# ${found.title}\n\nPreview log detail for ${fileName}.\n`,
      };
    },
    async runAgent(input) {
      const loaded = ensureWorkspace();
      const target = {
        planning: "TASKS",
        research: "RESEARCH",
        competitor: "COMPETITORS",
        vision: "VISION",
        roadmap: "ROADMAP",
        prd: "PRD",
        task: "TASKS",
        "tech-design": "TECH_DESIGN",
        implementation: "IMPLEMENTATION",
        execution: "EXECUTION",
      }[input.agent] as MvpArtifactType;
      loaded.artifacts[target] = `# ${artifactLabels[target]}\n\nGenerated preview content for ${loaded.name}.\n`;
      loaded.completedStates = Array.from(new Set([...loaded.completedStates, target]));
      loaded.runs.unshift({
        fileName: `${Date.now()}-${input.agent}.md`,
        title: `${artifactLabels[target]} Run`,
        updatedAt: new Date().toISOString(),
      });
      return { ...loaded };
    },
    async runPlanning() {
      const loaded = ensureWorkspace();
      const generated: Array<[MvpArtifactType, string]> = [
        ["RESEARCH", "Research"],
        ["COMPETITORS", "Competitors"],
        ["VISION", "Vision"],
        ["ROADMAP", "Roadmap"],
        ["PRD", "PRD"],
        ["TASKS", "Tasks"],
      ];

      for (const [type, label] of generated) {
        loaded.artifacts[type] = `# ${label}\n\nGenerated planning preview content for ${loaded.name}.\n`;
        loaded.completedStates = Array.from(new Set([...loaded.completedStates, type]));
      }

      loaded.runs.unshift({
        fileName: `${Date.now()}-planning-agent.md`,
        title: "Planning Agent Run",
        updatedAt: new Date().toISOString(),
      });

      return { ...loaded };
    },
    async runMvpChain() {
      const loaded = ensureWorkspace();
      const generated: Array<[MvpArtifactType, string]> = [
        ["RESEARCH", "Research"],
        ["COMPETITORS", "Competitors"],
        ["VISION", "Vision"],
        ["ROADMAP", "Roadmap"],
        ["PRD", "PRD"],
        ["TASKS", "Tasks"],
        ["TECH_DESIGN", "Tech Design"],
        ["IMPLEMENTATION", "Implementation"],
        ["EXECUTION", "Execution"],
      ];

      for (const [type, label] of generated) {
        loaded.artifacts[type] = `# ${label}\n\nGenerated preview content for ${loaded.name}.\n`;
        loaded.completedStates = Array.from(new Set([...loaded.completedStates, type]));
        loaded.runs.unshift({
          fileName: `${Date.now()}-${type.toLowerCase()}.md`,
          title: `${label} Run`,
          updatedAt: new Date().toISOString(),
        });
      }

      return { ...loaded };
    },
    onAgentRunEvent() {
      return () => undefined;
    },
  };
}
