"use client";

import {
  Home,
  Package,
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
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
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
  badge?: string | number;
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
      <nav className="space-y-6 px-3 py-4">
        {/* Main Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Overview
            </p>
          )}
          <MenuLink
            href="/dashboard"
            isCollapsed={isCollapsed}
            label="Analytics"
            icon={<LayoutDashboard className="h-[18px] w-[18px]" />}
            text="Analytics"
          />
        </div>

        {/* Assets Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Asset Management
            </p>
          )}
          {isCollapsed ? (
            <MenuLink
              href="/dashboard/field"
              isCollapsed={isCollapsed}
              label="Field Assets"
              icon={<MapPin className="h-[18px] w-[18px]" />}
              text="Field"
            />
          ) : (
            <MenuGroup
              label="Field Assets"
              icon={<MapPin className="h-[18px] w-[18px]" />}
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

        {/* EXECUTION / OPERATIONS */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Execution
            </p>
          )}
          <MenuLink
            href="/dashboard/jobpack"
            isCollapsed={isCollapsed}
            label="Work Packages"
            icon={<Package className="h-[18px] w-[18px]" />}
            text="Work Packages"
          />
          <MenuLink
            href="/dashboard/planning"
            isCollapsed={isCollapsed}
            label="Planning"
            icon={<Calendar className="h-[18px] w-[18px]" />}
            text="Planning"
            actionHref="/dashboard/planning/form"
          />
          <MenuLink
            href="/dashboard/reports"
            isCollapsed={isCollapsed}
            label="Reports"
            icon={<FileText className="h-[18px] w-[18px]" />}
            text="Reports"
          />
        </div>

        {/* UTILITIES */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Utilities
            </p>
          )}
          <MenuLink
            href="/dashboard/utilities/library"
            isCollapsed={isCollapsed}
            label="Library"
            icon={<Database className="h-[18px] w-[18px]" />}
            text="Library"
          />
        </div>

      </nav>
    </TooltipProvider>
  );
};

const MenuGroup = ({ label, icon, isCollapsed, children, defaultOpen = false }: MenuGroupProps) => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = useMemo(() => {
    if (!mounted) return false;
    // If we are in field related pages
    if (label === "Field Assets") {
      return pathname?.includes("/dashboard/field") ?? false;
    }
    return pathname?.startsWith(`/dashboard/${label.toLowerCase()}`) ?? false;
  }, [pathname, label, mounted]);

  if (isCollapsed) {
    return null;
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-muted">
            {icon}
          </div>
          <span className="truncate">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 group",
          "hover:bg-slate-50 dark:hover:bg-slate-900/40",
          isActive ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-md transition-colors",
            isActive ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" : "bg-muted group-hover:bg-muted-foreground/10"
          )}>
            {icon}
          </div>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          ) : (
            <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 relative overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="absolute left-6 top-0 bottom-2 w-px bg-border/60" />
        <div className="space-y-1 pl-4 mt-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const MenuLink = (props: MenuLinkProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = mounted && pathname === props.href;

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.actionHref) {
      router.push(props.actionHref);
    }
  };

  const linkContent = (
    <div className="relative group/link px-1">
      <Link
        href={props.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
          isActive
            ? "bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)] ring-1 ring-blue-600/10"
            : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60",
          props.isCollapsed && "justify-center p-2.5",
          props.isChild && "py-2 text-[13px] font-normal",
          props.actionHref && !props.isCollapsed && "pr-10"
        )}
      >
        <div className={cn(
          "transition-colors",
          isActive ? "text-inherit" : "text-muted-foreground group-hover/link:text-foreground"
        )}>
          {props.icon}
        </div>
        {!props.isCollapsed && <span className="truncate">{props.text}</span>}

        {isActive && !props.isCollapsed && (
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-600 dark:bg-blue-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
        )}

        {props.badge && !props.isCollapsed && (
          <span className="ml-auto bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {props.badge}
          </span>
        )}
      </Link>

      {props.actionHref && !props.isCollapsed && (
        <button
          onClick={handleActionClick}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md",
            "opacity-0 group-hover/link:opacity-100 transition-all duration-200",
            "hover:bg-primary hover:text-white",
            isActive ? "text-white/70 hover:bg-white hover:text-slate-900" : "text-muted-foreground"
          )}
          aria-label={`Add new ${props.label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (props.isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={18} className="bg-slate-900 text-white border-none shadow-xl">
          <p className="font-semibold text-xs">{props.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
};

export { DashboardMenu };
