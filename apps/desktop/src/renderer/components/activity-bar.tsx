import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { activityItems, systemItems, type ActivityId } from "../app-config.js";

export function ActivityBar({
  activeActivity,
  collapsed,
  isSystemOpen,
  onSelect,
  onToggleCollapsed,
  onToggleSystem,
}: {
  activeActivity: ActivityId;
  collapsed: boolean;
  isSystemOpen: boolean;
  onSelect: (activity: ActivityId) => void;
  onToggleCollapsed: () => void;
  onToggleSystem: () => void;
}) {
  return (
    <aside className={cn("flex min-h-0 min-w-0 flex-col border-r border-border bg-[var(--color-bg-tertiary)]", collapsed && "items-center", "max-[1180px]:items-center")}>
      <div className={cn("flex h-[42px] items-center gap-2.5 px-4", collapsed && "justify-center px-0", "max-[1180px]:justify-center max-[1180px]:px-0")}>
        <div className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-background text-[9px] font-extrabold text-primary shadow-[0_0_14px_var(--color-accent-dim)]">
          OF
        </div>
        <strong className={cn("min-w-0 truncate text-[15px] font-semibold text-foreground", collapsed && "hidden", "max-[1180px]:hidden")}>
          OpenFounder
        </strong>
      </div>

      <ScrollArea className="flex-1">
        <nav className={cn("grid gap-0.5 px-2.5 py-2", collapsed && "justify-items-center px-2", "max-[1180px]:justify-items-center max-[1180px]:px-2")}>
          {activityItems.map((item) => (
            <ActivityButton
              key={item.label}
              active={activeActivity === item.id}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              onClick={() => onSelect(item.id)}
            />
          ))}
        </nav>
      </ScrollArea>

      <Separator />
      <div className={cn("grid gap-0.5 px-2.5 py-2", collapsed && "justify-items-center px-2", "max-[1180px]:justify-items-center max-[1180px]:px-2")}>
        <Button
          className={cn(
            "h-7 justify-start gap-1.5 px-2 text-[11px] font-bold uppercase text-muted-foreground",
            collapsed && "size-9 justify-center px-0",
            "max-[1180px]:size-9 max-[1180px]:justify-center max-[1180px]:px-0",
          )}
          variant="ghost"
          size="sm"
          onClick={onToggleSystem}
          aria-expanded={isSystemOpen}
        >
          {isSystemOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className={cn(collapsed && "hidden", "max-[1180px]:hidden")}>System</span>
        </Button>
        {isSystemOpen &&
          systemItems.map((item) => (
            <ActivityButton
              key={item.label}
              active={activeActivity === item.id}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              onClick={() => onSelect(item.id)}
            />
          ))}
      </div>

      <Separator />
      <div className={cn("grid grid-cols-[1fr_auto] gap-1 px-2.5 py-2.5", collapsed && "grid-cols-1 justify-items-center px-2", "max-[1180px]:grid-cols-1 max-[1180px]:justify-items-center max-[1180px]:px-2")}>
        <ActivityButton
          active={activeActivity === "settings"}
          collapsed={collapsed}
          icon={Settings}
          label="Settings"
          onClick={() => onSelect("settings")}
        />
        <Button
          className="size-8 text-muted-foreground max-[1180px]:hidden"
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </Button>
      </div>
    </aside>
  );
}

function ActivityButton({
  active = false,
  collapsed,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex h-8 items-center justify-start gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-[1180px]:size-9 max-[1180px]:justify-center max-[1180px]:px-0",
          collapsed && "size-9 justify-center px-0",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
        aria-label={label}
        onClick={onClick}
      >
        <Icon size={16} />
        <span className={cn(collapsed && "hidden", "max-[1180px]:hidden")}>{label}</span>
      </TooltipTrigger>
      <TooltipContent className={cn(!collapsed && "min-[1181px]:hidden")} side="right">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
