import { Check, FileText, Folder, Loader2, Play, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  DesktopWorkspaceListItem,
  DesktopWorkspaceSummary,
  MvpArtifactType,
} from "../../shared.js";
import { mvpArtifactTypes } from "../../shared.js";
import {
  artifactFiles,
  type CenterMode,
  type SidebarSectionId,
} from "../app-config.js";
import { SidebarSection } from "./sidebar-section.js";

export function WorkspaceSidebar({
  busy,
  completedCount,
  onCreateWorkspace,
  onOpenWorkspace,
  onRunMvpChain,
  onRunPlanning,
  onSelectArtifact,
  onToggleSection,
  selectedArtifact,
  sidebarOpen,
  viewMode,
  workspace,
  workspaceList,
}: {
  busy: string | null;
  completedCount: number;
  onCreateWorkspace: () => void;
  onOpenWorkspace: (id: string) => void;
  onRunMvpChain: () => void;
  onRunPlanning: () => void;
  onSelectArtifact: (type: MvpArtifactType) => void;
  onToggleSection: (section: SidebarSectionId) => void;
  selectedArtifact: MvpArtifactType;
  sidebarOpen: Record<SidebarSectionId, boolean>;
  viewMode: CenterMode;
  workspace: DesktopWorkspaceSummary;
  workspaceList: DesktopWorkspaceListItem[];
}) {
  return (
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
            onClick={onCreateWorkspace}
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
        <SidebarSection
          open={sidebarOpen.projects}
          title="Projects"
          onToggle={() => onToggleSection("projects")}
        >
          <div className="grid gap-0.5">
            {workspaceList.map((item) => (
              <Button
                key={item.id}
                className={cn(
                  "grid h-8 grid-cols-[auto_minmax(0,1fr)] justify-start gap-2 px-2 text-muted-foreground",
                  item.id === workspace.id && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
                variant="ghost"
                size="sm"
                onClick={() => onOpenWorkspace(item.id)}
              >
                <Folder size={14} />
                <span className="truncate text-left">{item.name}</span>
              </Button>
            ))}
          </div>
        </SidebarSection>
      )}

      <SidebarSection
        className="min-h-0 overflow-hidden"
        open={sidebarOpen.artifacts}
        title="Artifacts"
        onToggle={() => onToggleSection("artifacts")}
      >
        <ScrollArea className="h-full">
          <nav className="grid gap-0.5 pr-1" aria-label="Artifacts">
            {mvpArtifactTypes.map((type) => {
              const complete = workspace.completedStates.includes(type);
              return (
                <Button
                  key={type}
                  className={cn(
                    "grid h-8 grid-cols-[auto_minmax(0,1fr)_auto] justify-start gap-2 px-2 text-muted-foreground",
                    viewMode === "artifact" && type === selectedArtifact && "bg-sidebar-accent text-primary",
                  )}
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectArtifact(type)}
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
        <Button className="w-full" onClick={onRunPlanning} disabled={Boolean(busy)}>
          {busy === "Running Planning" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Sparkles size={15} />
          )}
          <span>Run Planning</span>
        </Button>
        <Button className="w-full" variant="outline" onClick={onRunMvpChain} disabled={Boolean(busy)}>
          {busy === "Running MVP chain" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Play size={15} />
          )}
          <span>Legacy Chain</span>
        </Button>
      </div>
    </section>
  );
}
