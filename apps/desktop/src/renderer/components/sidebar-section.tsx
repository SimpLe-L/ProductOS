import type React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SidebarSection({
  children,
  className,
  onToggle,
  open,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onToggle: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <div className={cn("grid content-start gap-1 px-2.5 pb-3", className)}>
      <Button
        className="h-7 justify-start gap-1.5 px-2 text-[11px] font-bold uppercase text-muted-foreground"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{title}</span>
      </Button>
      {open && children}
    </div>
  );
}
