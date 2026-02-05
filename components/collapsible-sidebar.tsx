"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutPanelLeft, Compass, Settings } from "lucide-react";
import { DashboardMenu } from "./menu";
import { DashboardFooter } from "./footer";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { UserSidebar } from "./user-sidebar";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function CollapsibleSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("OFFSHORE");
  const [departmentName, setDepartmentName] = useState("Data Management");

  // Load company settings from API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/company-settings");
        if (response.ok) {
          const { data } = await response.json();
          if (data.logo_url) {
            setCompanyLogo(data.logo_url);
          }
          if (data.company_name) {
            setCompanyName(data.company_name);
          }
          if (data.department_name) {
            setDepartmentName(data.department_name);
          }
        }
      } catch (error) {
        console.error("Error loading company settings:", error);
      }
    };

    // Load on mount
    loadSettings();

    // Listen for settings changes
    window.addEventListener("companySettingsChanged", loadSettings);

    return () => {
      window.removeEventListener("companySettingsChanged", loadSettings);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out border-r relative",
        "bg-white dark:bg-slate-950 shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand Header */}
      {/* Brand Header */}
      <div className={cn(
        "flex items-center overflow-hidden transition-all duration-300 py-6",
        isCollapsed ? "justify-center" : "justify-center"
      )}>
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center transition-transform hover:scale-105 active:scale-95 group",
            isCollapsed ? "gap-0" : "flex-col gap-2"
          )}
        >
          <div className="relative">
            {companyLogo ? (
              <div className={cn(
                "rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all border-2 border-white dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-1",
                isCollapsed ? "h-10 w-10" : "h-16 w-16"
              )}>
                <Image
                  src={companyLogo}
                  alt="Company Logo"
                  width={isCollapsed ? 40 : 64}
                  height={isCollapsed ? 40 : 64}
                  className="object-contain w-full h-full"
                />
              </div>
            ) : (
              <div className={cn(
                "flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all",
                isCollapsed ? "h-10 w-10" : "h-16 w-16"
              )}>
                <Compass className={cn(
                  isCollapsed ? "h-6 w-6" : "h-10 w-10"
                )} />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 bg-emerald-500" />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 text-center leading-tight">
                {companyName}
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                {departmentName}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Global Action / Search Placeholder could go here */}

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        <DashboardMenu isCollapsed={isCollapsed} />
      </div>

      <div className="px-6">
        <Separator className="opacity-50" />
      </div>

      {/* User Support & Account */}
      <div className="flex flex-col gap-1 py-4">
        {/* Settings Link */}
        <div className="px-4">
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:bg-slate-100 dark:hover:bg-slate-800",
              isCollapsed ? "justify-center px-2" : "justify-start"
            )}
          >
            <Settings className="h-4 w-4 text-slate-400" />
            {!isCollapsed && (
              <span className="text-slate-600 dark:text-slate-400">Settings</span>
            )}
          </Link>
        </div>

        <UserSidebar isCollapsed={isCollapsed} />

        {/* Toggle Button - Float Style */}
        <div className="px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(
              "h-10 w-full flex items-center gap-3 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800 border-none shadow-none",
              isCollapsed ? "justify-center" : "justify-start px-4 text-slate-400"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            ) : (
              <>
                <LayoutPanelLeft className="h-4 w-4" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Toggle Sidebar</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
      `}</style>
    </div>
  );
}
