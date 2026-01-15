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
      <div className={cn(
        "flex items-center h-20 px-6 overflow-hidden transition-all duration-300",
        isCollapsed ? "justify-center" : "justify-start"
      )}>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group"
        >
          <div className="relative">
            {companyLogo ? (
              <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all border-2 border-white dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-1">
                <Image
                  src={companyLogo}
                  alt="Company Logo"
                  width={40}
                  height={40}
                  className="object-contain w-full h-full"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                <Compass className="h-6 w-6" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 bg-emerald-500" />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-black text-lg leading-tight tracking-tight text-slate-900 dark:text-slate-100 flex items-center">
                {companyName}
                <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold tracking-widest uppercase">
                  Pro
                </span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Data Management
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
