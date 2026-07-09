import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  DesktopWorkspaceListItem,
  DesktopWorkspaceSummary,
  MvpArtifactType,
} from "../shared.js";
import {
  agentButtonLabels,
  agentByArtifact,
  defaultInspectorOpen,
  defaultSidebarOpen,
  providerDefaults,
  type ActivityId,
  type CenterMode,
  type InspectorSectionId,
  type SidebarSectionId,
} from "./app-config.js";
import {
  errorToMessage,
  formatElapsed,
  formatVerificationConfig,
  parseVerificationDraft,
} from "./app-utils.js";
import { createBrowserPreviewApi } from "./browser-preview-api.js";
import { ActivityBar as ActivityRail } from "./components/activity-bar.js";
import { CenterPane } from "./components/center-pane.js";
import { WorkspaceInspector } from "./components/workspace-inspector.js";
import { WorkspaceSidebar } from "./components/workspace-sidebar.js";

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
  const [viewMode, setViewMode] = useState<CenterMode>("artifact");
  const [activeActivity, setActiveActivity] = useState<ActivityId>("workspace");
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [inspectorOpen, setInspectorOpen] = useState(defaultInspectorOpen);
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
      setActiveActivity("inbox");
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
      setActiveActivity("runs");
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function selectArtifact(type: MvpArtifactType, activity: ActivityId = "artifacts") {
    setSelectedArtifact(type);
    setViewMode("artifact");
    setActiveActivity(activity);
    setSelectedLog(null);
    setSelectedRun(null);
  }

  function selectActivity(activity: ActivityId) {
    setActiveActivity(activity);

    if (activity === "workspace") {
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      return;
    }

    if (activity === "artifacts") {
      setViewMode("artifact");
      setSelectedLog(null);
      setSelectedRun(null);
      return;
    }

    if (activity === "research") {
      selectArtifact("RESEARCH", "research");
      return;
    }

    if (activity === "tasks") {
      selectArtifact("TASKS", "tasks");
      return;
    }

    if (activity === "dev") {
      selectArtifact("TECH_DESIGN", "dev");
      return;
    }

    if (activity === "inbox" || activity === "runs" || activity === "settings") {
      setViewMode(activity === "settings" ? "settings" : "inbox");
      setSelectedLog(null);
      setSelectedRun(null);
    }
  }

  function toggleSidebarSection(section: SidebarSectionId) {
    setSidebarOpen((current) => ({ ...current, [section]: !current[section] }));
  }

  function toggleInspectorSection(section: InspectorSectionId) {
    setInspectorOpen((current) => ({ ...current, [section]: !current[section] }));
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
      <main
        className={cn(
          "grid h-full min-w-0 bg-background",
          isActivityCollapsed
            ? "grid-cols-[60px_292px_minmax(420px,1fr)_340px]"
            : "grid-cols-[188px_292px_minmax(420px,1fr)_340px]",
          "max-[1180px]:grid-cols-[60px_260px_minmax(380px,1fr)] max-[820px]:grid-cols-[52px_minmax(0,1fr)]"
        )}
      >
        <ActivityRail
          activeActivity={activeActivity}
          collapsed={isActivityCollapsed}
          isSystemOpen={isSystemOpen}
          onSelect={selectActivity}
          onToggleCollapsed={() => setIsActivityCollapsed((current) => !current)}
          onToggleSystem={() => setIsSystemOpen((current) => !current)}
        />

        <WorkspaceSidebar
          busy={busy}
          completedCount={completedCount}
          onCreateWorkspace={createBlankWorkspace}
          onOpenWorkspace={openWorkspace}
          onRunMvpChain={runMvpChain}
          onRunPlanning={runPlanning}
          onSelectArtifact={selectArtifact}
          onToggleSection={toggleSidebarSection}
          selectedArtifact={selectedArtifact}
          sidebarOpen={sidebarOpen}
          viewMode={viewMode}
          workspace={workspace}
          workspaceList={workspaceList}
        />

        <CenterPane
          activeActivity={activeActivity}
          busy={busy}
          canRunSelected={canRunSelected}
          draft={draft}
          onCheckProvider={() => refreshProviderHealth(providerDraft ?? providerConfig)}
          onDraftChange={setDraft}
          onOpenLog={openLog}
          onOpenRun={openRun}
          onProviderChange={selectProvider}
          onProviderDraftChange={setProviderDraft}
          onRunSelected={() => runAgent(selectedArtifact)}
          onSaveArtifact={saveArtifact}
          onSaveProvider={() => saveProviderConfig()}
          onSaveVerification={saveVerificationConfig}
          onVerificationDraftChange={setVerificationDraft}
          providerConfig={providerConfig}
          providerDraft={providerDraft}
          providerHealth={providerHealth}
          saveState={saveState}
          selectedArtifact={selectedArtifact}
          selectedLog={selectedLog}
          selectedRun={selectedRun}
          verificationDraft={verificationDraft}
          viewMode={viewMode}
          workspace={workspace}
        />

        <WorkspaceInspector
          activeProvider={activeProvider}
          activeRun={activeRun}
          elapsedSeconds={elapsedSeconds}
          inspectorOpen={inspectorOpen}
          onCheckProvider={() => providerDraft && refreshProviderHealth(providerDraft)}
          onOpenLog={openLog}
          onOpenRun={openRun}
          onProviderChange={selectProvider}
          onProviderDraftChange={setProviderDraft}
          onSaveProvider={() => saveProviderConfig()}
          onSaveVerification={saveVerificationConfig}
          onSelectArtifact={selectArtifact}
          onToggleSection={toggleInspectorSection}
          onVerificationDraftChange={setVerificationDraft}
          providerDraft={providerDraft}
          providerHealth={providerHealth}
          runCount={runCount}
          runEvents={runEvents}
          selectedArtifact={selectedArtifact}
          verificationDraft={verificationDraft}
          workspace={workspace}
        />

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
