"use client";

import {
  Home,
  Package,
  BrickWall,
  Layers2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  MapPin,
  Settings,
  FileText,
  Compass,
  Database,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MenuLinkProps {
  href: string;
  isCollapsed?: boolean;
  label: string;
  icon: React.ReactNode;
  text: string;
  isChild?: boolean;
  actionHref?: string;
}

interface MenuGroupProps {
  label: string;
  icon: React.ReactNode;
  isCollapsed?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const DashboardMenu = ({ isCollapsed }: { isCollapsed?: boolean }) => {
  return (
    <TooltipProvider>
      <nav className="space-y-4 px-2">
        {/* OVERVIEW */}
        <div className="space-y-1">
          {!isCollapsed && (
            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Overview
            </h4>
          )}
          <MenuLink
            href="/dashboard"
            isCollapsed={isCollapsed}
            label="Analytics"
            icon={<Layers2 className="h-4 w-4" />}
            text="Analytics"
          />
        </div>

        {/* ASSET MANAGEMENT */}
        <div className="space-y-1">
          {!isCollapsed && (
            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 mt-4">
              Asset Management
            </h4>
          )}

          {isCollapsed ? (
            <MenuLink
              href="/dashboard/field"
              isCollapsed={isCollapsed}
              label="Field Assets"
              icon={<MapPin className="h-4 w-4" />}
              text="Field Assets"
            />
          ) : (
            <MenuGroup
              label="Field Assets"
              icon={<MapPin className="h-4 w-4" />}
              isCollapsed={isCollapsed}
              defaultOpen={true}
            >
              <MenuLink
                href="/dashboard/field"
                isCollapsed={isCollapsed}
                label="Map Overview"
                icon={<Compass className="h-4 w-4" />}
                text="Map Overview"
                isChild
              />
              <MenuLink
                href="/dashboard/field/platform"
                isCollapsed={isCollapsed}
                label="Platforms"
                icon={<Layers2 className="h-4 w-4" />}
                text="Platforms"
                isChild
                actionHref="/dashboard/field/platform/new"
              />
              <MenuLink
                href="/dashboard/field/pipeline"
                isCollapsed={isCollapsed}
                label="Pipelines"
                icon={<FileText className="h-4 w-4" />}
                text="Pipelines"
                isChild
                actionHref="/dashboard/field/pipeline/new"
              />
            </MenuGroup>
          )}
        </div>

        {/* EXECUTION */}
        <div className="space-y-1">
          {!isCollapsed && (
            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 mt-4">
              Execution
            </h4>
          )}
          <MenuLink
            href="/dashboard/jobpack"
            isCollapsed={isCollapsed}
            label="Work Packages"
            icon={<Package className="h-4 w-4" />}
            text="Work Packages"
          />
          <MenuLink
            href="/dashboard/planning"
            isCollapsed={isCollapsed}
            label="Planning"
            icon={<Calendar className="h-4 w-4" />}
            text="Planning"
          />
          <MenuLink
            href="/dashboard/reports"
            isCollapsed={isCollapsed}
            label="Reports"
            icon={<FileText className="h-4 w-4" />}
            text="Reports"
          />
        </div>

        {/* UTILITIES */}
        <div className="space-y-1">
          {!isCollapsed && (
            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 mt-4">
              Utilities
            </h4>
          )}
          <MenuLink
            href="/dashboard/utilities/library"
            isCollapsed={isCollapsed}
            label="Library"
            icon={<Database className="h-4 w-4" />}
            text="Library"
          />
        </div>
      </nav>
    </TooltipProvider>
  );
};

const MenuGroup = ({ label, icon, isCollapsed, children, defaultOpen = false }: MenuGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const pathname = usePathname();
  const isActive = pathname?.startsWith(`/dashboard/${label.toLowerCase()}`);

  if (isCollapsed) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent text-accent-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 transition-transform" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 pl-6">{children}</CollapsibleContent>
    </Collapsible>
  );
};

const MenuLink = (props: MenuLinkProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === props.href;

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.actionHref) {
      router.push(props.actionHref);
    }
  };

  const linkContent = (
    <div className="relative group">
      <Link
        href={props.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "text-muted-foreground",
          props.isCollapsed && "justify-center",
          props.isChild && "py-1.5 text-xs",
          props.actionHref && !props.isCollapsed && "pr-8"
        )}
      >
        {props.icon}
        {!props.isCollapsed && <span>{props.text}</span>}
      </Link>
      {props.actionHref && !props.isCollapsed && (
        <button
          onClick={handleActionClick}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-accent/50",
            isActive && "hover:bg-primary-foreground/20"
          )}
          aria-label={`Add new ${props.label.toLowerCase()}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  if (props.isCollapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          <p className="font-medium">{props.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
};

export { DashboardMenu };
