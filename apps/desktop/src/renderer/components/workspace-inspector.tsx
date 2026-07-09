import type React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  DesktopAgentRunEvent,
  DesktopProviderConfig,
  DesktopProviderHealth,
  DesktopProviderKind,
  DesktopWorkspaceSummary,
  MvpArtifactType,
} from "../../shared.js";
import {
  artifactFiles,
  artifactLabels,
  type InspectorSectionId,
} from "../app-config.js";
import { formatElapsed } from "../app-utils.js";
import { ProviderSettingsPanel } from "./provider-settings-panel.js";
import { RunList } from "./run-list.js";
import { mvpArtifactTypes } from "../../shared.js";

interface ActiveRunState {
  label: string;
  provider: DesktopProviderKind;
  startedAt: number;
}

export function WorkspaceInspector({
  activeProvider,
  activeRun,
  elapsedSeconds,
  inspectorOpen,
  onCheckProvider,
  onOpenLog,
  onOpenRun,
  onProviderChange,
  onProviderDraftChange,
  onSaveProvider,
  onSaveVerification,
  onSelectArtifact,
  onToggleSection,
  onVerificationDraftChange,
  providerDraft,
  providerHealth,
  runCount,
  runEvents,
  selectedArtifact,
  verificationDraft,
  workspace,
}: {
  activeProvider: DesktopProviderKind;
  activeRun: ActiveRunState | null;
  elapsedSeconds: number;
  inspectorOpen: Record<InspectorSectionId, boolean>;
  onCheckProvider: () => void;
  onOpenLog: (fileName: string) => void;
  onOpenRun: (fileName: string) => void;
  onProviderChange: (provider: DesktopProviderKind) => void;
  onProviderDraftChange: (config: DesktopProviderConfig) => void;
  onSaveProvider: () => void;
  onSaveVerification: () => void;
  onSelectArtifact: (type: MvpArtifactType) => void;
  onToggleSection: (section: InspectorSectionId) => void;
  onVerificationDraftChange: (value: string) => void;
  providerDraft: DesktopProviderConfig | null;
  providerHealth: DesktopProviderHealth | null;
  runCount: number;
  runEvents: DesktopAgentRunEvent[];
  selectedArtifact: MvpArtifactType;
  verificationDraft: string;
  workspace: DesktopWorkspaceSummary;
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-l border-border bg-sidebar max-[1180px]:hidden">
      <InspectorCard
        open={inspectorOpen.provider}
        title="Provider"
        value={activeProvider}
        onToggle={() => onToggleSection("provider")}
      >
        {providerDraft && (
          <ProviderSettingsPanel
            providerDraft={providerDraft}
            providerHealth={providerHealth}
            verificationDraft={verificationDraft}
            compact
            onCheck={onCheckProvider}
            onProviderChange={onProviderChange}
            onProviderDraftChange={onProviderDraftChange}
            onSaveProvider={onSaveProvider}
            onSaveVerification={onSaveVerification}
            onVerificationDraftChange={onVerificationDraftChange}
          />
        )}
      </InspectorCard>

      <InspectorCard
        open={inspectorOpen.workflow}
        title="Workflow"
        value={workspace.currentState}
        onToggle={() => onToggleSection("workflow")}
      >
        <div className="grid gap-1">
          {mvpArtifactTypes.map((type) => (
            <Button
              key={type}
              className={cn(
                "h-[42px] justify-start border-l-2 border-transparent px-2 text-left text-muted-foreground",
                workspace.completedStates.includes(type) && "border-l-green-700 text-foreground",
                type === selectedArtifact && "border-l-primary bg-sidebar-accent text-foreground",
              )}
              variant="ghost"
              size="sm"
              onClick={() => onSelectArtifact(type)}
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

      <InspectorCard
        open={inspectorOpen.runs}
        title="Runs"
        value={runCount}
        onToggle={() => onToggleSection("runs")}
      >
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
                        event.stream === "stderr" && "text-destructive",
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
          onOpen={onOpenRun}
          items={workspace.runs.map((run) => ({
            id: run.fileName,
            title: run.title,
            updatedAt: run.updatedAt,
          }))}
        />
      </InspectorCard>

      <InspectorCard
        open={inspectorOpen.logs}
        title="Logs"
        value={workspace.logs.length}
        onToggle={() => onToggleSection("logs")}
      >
        <RunList
          empty="No logs yet."
          onOpen={onOpenLog}
          items={workspace.logs.map((log) => ({
            id: log.fileName,
            title: log.title,
            updatedAt: log.updatedAt,
          }))}
        />
      </InspectorCard>
    </aside>
  );
}

function InspectorCard({
  children,
  onToggle,
  open,
  title,
  value,
}: {
  children: React.ReactNode;
  onToggle: () => void;
  open: boolean;
  title: string;
  value: string | number;
}) {
  return (
    <Card className="min-h-0 shrink-0 rounded-none border-0 border-b border-border bg-transparent shadow-none ring-0">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <button
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md px-1 py-1 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onToggle}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="text-[11px] font-semibold">{title}</span>
          <CardTitle className="truncate text-xs font-semibold text-foreground">{value}</CardTitle>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="min-h-0 px-4 pb-4">
          <ScrollArea className="max-h-[420px] pr-2">{children}</ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
