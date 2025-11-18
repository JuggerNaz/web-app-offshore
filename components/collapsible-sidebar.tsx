"use client";

import { useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { DashboardMenu } from "./menu";
import { DashboardFooter } from "./footer";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

export function CollapsibleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-screen transition-all duration-300 ease-in-out border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        {!isCollapsed && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold text-lg transition-colors hover:text-primary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">WA</span>
            </div>
            <span className="truncate">Web App Offshore</span>
          </Link>
        )}
        {isCollapsed && (
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 mx-auto"
          >
            <span className="text-sm font-bold">WA</span>
          </Link>
        )}
      </div>

      {/* Toggle Button */}
      <div className={cn("flex items-center px-3 py-2", isCollapsed && "justify-center")}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "h-8 transition-all hover:bg-accent",
            isCollapsed ? "w-8 px-0" : "w-full justify-start"
          )}
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 mr-2" />
              <span className="text-xs">Collapse sidebar</span>
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto py-2">
        <DashboardMenu isCollapsed={isCollapsed} />
      </div>

      <Separator />

      {/* Footer */}
      {!isCollapsed && <DashboardFooter />}
    </div>
  );
}
