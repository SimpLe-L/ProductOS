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
import { cn } from "@/lib/utils";
import type {
  CreateWorkspaceRequest,
  DesktopApi,
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
};

const artifactDescriptions: Record<MvpArtifactType, string> = {
  IDEA: "Raw founder notes and product intent.",
  RESEARCH: "Market and user research synthesis.",
  COMPETITORS: "Comparable products and positioning.",
  VISION: "Product direction and narrative.",
  ROADMAP: "Sequenced milestones and scope.",
  PRD: "Requirements for build planning.",
  TASKS: "Execution tasks for implementation.",
};

const artifactFiles: Record<MvpArtifactType, string> = {
  IDEA: "idea.md",
  RESEARCH: "research.md",
  COMPETITORS: "competitors.md",
  VISION: "vision.md",
  ROADMAP: "roadmap.md",
  PRD: "prd.md",
  TASKS: "tasks.md",
};

const agentByArtifact: Partial<Record<MvpArtifactType, RunAgentRequest["agent"]>> = {
  RESEARCH: "research",
  COMPETITORS: "competitor",
  VISION: "vision",
  ROADMAP: "roadmap",
  PRD: "prd",
  TASKS: "task",
};

const agentButtonLabels: Partial<Record<MvpArtifactType, string>> = {
  RESEARCH: "Run Research",
  COMPETITORS: "Run Competitor",
  VISION: "Run Vision",
  ROADMAP: "Run Roadmap",
  PRD: "Run PRD",
  TASKS: "Run Tasks",
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

export function App() {
  const api: DesktopApi = useMemo(() => window.openFounder ?? createBrowserPreviewApi(), []);
  const [workspace, setWorkspace] = useState<DesktopWorkspaceSummary | null>(null);
  const [workspaceList, setWorkspaceList] = useState<DesktopWorkspaceListItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<MvpArtifactType>("IDEA");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>("Loading");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    Promise.all([api.listWorkspaces(), api.loadWorkspace()]).then(async ([list, loaded]) => {
      if (!loaded) {
        const created = await api.createWorkspace({
          name: "Untitled Product",
          description: "Local product workspace",
          idea: "# Idea\n\n",
        });
        const nextList = await api.listWorkspaces();
        setWorkspaceList(nextList);
        setWorkspace(created);
        setDraft(created.artifacts.IDEA);
        setBusy(null);
        return;
      }

      setWorkspaceList(list);
      setWorkspace(loaded);
      setDraft(loaded.artifacts.IDEA);
      setBusy(null);
    });
  }, [api]);

  useEffect(() => {
    setDraft(workspace?.artifacts[selectedArtifact] ?? "");
  }, [workspace, selectedArtifact]);

  async function createWorkspace(input: CreateWorkspaceRequest) {
    setBusy("Creating workspace");
    const created = await api.createWorkspace(input);
    setWorkspaceList(await api.listWorkspaces());
    setWorkspace(created);
    setSelectedArtifact("IDEA");
    setDraft(created.artifacts.IDEA);
    setBusy(null);
  }

  async function createBlankWorkspace() {
    await createWorkspace({
      name: `Untitled Product ${workspaceList.length + 1}`,
      description: "Local product workspace",
      idea: "# Idea\n\n",
    });
  }

  async function saveArtifact() {
    if (!workspace) return;
    setBusy("Saving artifact");
    const updated = await api.saveArtifact(selectedArtifact, draft);
    setWorkspace(updated);
    setSaveState("saved");
    setBusy(null);
    window.setTimeout(() => setSaveState("idle"), 900);
  }

  async function runAgent(type: MvpArtifactType) {
    const agent = agentByArtifact[type];
    if (!workspace || !agent) return;

    setBusy(agentButtonLabels[type] ?? "Running agent");
    await api.saveArtifact(selectedArtifact, draft);
    const updated = await api.runAgent({ agent });
    setWorkspace(updated);
    setSelectedArtifact(type);
    setDraft(updated.artifacts[type]);
    setBusy(null);
  }

  async function runMvpChain() {
    if (!workspace) return;

    setBusy("Running MVP chain");
    await api.saveArtifact(selectedArtifact, draft);
    const updated = await api.runMvpChain();
    setWorkspace(updated);
    setSelectedArtifact("TASKS");
    setDraft(updated.artifacts.TASKS);
    setBusy(null);
  }

  async function openWorkspace(id: string) {
    setBusy("Opening workspace");
    const opened = await api.openWorkspace(id);
    setWorkspace(opened);
    setSelectedArtifact("IDEA");
    setDraft(opened.artifacts.IDEA);
    setBusy(null);
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
                        type === selectedArtifact && "bg-sidebar-accent text-primary"
                      )}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedArtifact(type)}
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
            <Button className="w-full" onClick={runMvpChain} disabled={!workspace}>
              {busy === "Running MVP chain" ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              <span>Run Chain</span>
            </Button>
          </div>
        </section>

        <section className="grid min-h-0 min-w-0 grid-rows-[42px_auto_1fr] bg-background">
          <header className="flex items-center justify-between gap-3.5 border-b border-border px-5 max-[820px]:px-3">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{workspace.name}</span>
              <span>/</span>
              <strong className="truncate font-semibold text-foreground">
                {artifactFiles[selectedArtifact]}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveArtifact} aria-label="Save artifact">
                <Save size={15} />
                <span className="max-[820px]:hidden">{saveState === "saved" ? "Saved" : "Save"}</span>
              </Button>
              {canRunSelected && (
                <Button size="sm" onClick={() => runAgent(selectedArtifact)}>
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
                  <span className="max-[820px]:hidden">{agentButtonLabels[selectedArtifact]}</span>
                </Button>
              )}
            </div>
          </header>

          <div className="flex min-h-[120px] items-start justify-between gap-5 px-7 py-6 max-[820px]:min-h-[104px] max-[820px]:px-4 max-[820px]:py-4">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">Artifact</span>
              <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-normal text-foreground max-[820px]:text-[22px]">
                {artifactLabels[selectedArtifact]}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {artifactDescriptions[selectedArtifact]}
              </p>
            </div>
            <Badge
              className="h-6 shrink-0 gap-1.5 rounded-full border-border bg-card/60 text-muted-foreground max-[820px]:hidden"
              variant="outline"
            >
              <CircleDot size={13} />
              {workspace.completedStates.includes(selectedArtifact) ? "Complete" : "Editable"}
            </Badge>
          </div>

          <Textarea
            className="h-full min-h-0 resize-none rounded-none border-x-0 border-b-0 bg-card/55 px-7 py-6 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0 max-[820px]:px-4 max-[820px]:py-4"
            value={draft}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
            placeholder={selectedArtifact === "IDEA" ? "Write the product idea here..." : ""}
            spellCheck={false}
          />
        </section>

        <aside className="grid min-h-0 min-w-0 grid-rows-[minmax(250px,auto)_minmax(150px,1fr)_minmax(120px,auto)] border-l border-border bg-sidebar max-[1180px]:hidden">
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
                  onClick={() => setSelectedArtifact(type)}
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
            <RunList
              empty="No runs yet."
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
              items={workspace.logs.map((log) => ({
                id: log.fileName,
                title: log.fileName,
                updatedAt: log.updatedAt,
              }))}
            />
          </InspectorCard>
        </aside>

        {busy && busy !== "Loading" && (
          <div className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground px-3 py-2 text-xs text-background shadow-xl">
            <Loader2 className="animate-spin" size={15} />
            <span>{busy}</span>
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
}: {
  empty: string;
  items: Array<{ id: string; title: string; updatedAt: string }>;
}) {
  if (items.length === 0) {
    return <p className="m-0 text-[11px] text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-0">
      {items.map((item) => (
        <article className="grid gap-1 border-b border-border/80 py-2.5" key={item.id}>
          <strong className="[overflow-wrap:anywhere] text-xs font-semibold text-foreground">
            {item.title}
          </strong>
          <span className="text-[11px] text-muted-foreground">
            {new Date(item.updatedAt).toLocaleString()}
          </span>
        </article>
      ))}
    </div>
  );
}

function createBrowserPreviewApi(): DesktopApi {
  let workspace: DesktopWorkspaceSummary | null = null;

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
    async runAgent(input) {
      const loaded = ensureWorkspace();
      const target = {
        research: "RESEARCH",
        competitor: "COMPETITORS",
        vision: "VISION",
        roadmap: "ROADMAP",
        prd: "PRD",
        task: "TASKS",
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
    async runMvpChain() {
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
  };
}
