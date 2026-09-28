"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ThemeSwitcherProps {
  variant?: "dropdown" | "segmented";
}

const ThemeSwitcher = ({ variant = "dropdown" }: ThemeSwitcherProps) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
    );
  }

  const ICON_SIZE = 14;

  if (variant === "segmented") {
    return (
      <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === "light"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Sun size={ICON_SIZE} className={theme === "light" ? "text-amber-500" : ""} />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === "dark"
              ? "bg-slate-900 text-white shadow-sm border border-slate-700"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Moon size={ICON_SIZE} className={theme === "dark" ? "text-blue-400" : ""} />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            theme === "system"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Laptop size={ICON_SIZE} className={theme === "system" ? "text-blue-500" : ""} />
          <span>System</span>
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 flex items-center gap-1.5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {theme === "light" ? (
            <>
              <Sun key="light" size={ICON_SIZE} className="text-amber-500" />
              <span className="text-xs font-semibold capitalize">Light</span>
            </>
          ) : theme === "dark" ? (
            <>
              <Moon key="dark" size={ICON_SIZE} className="text-blue-400" />
              <span className="text-xs font-semibold capitalize">Dark</span>
            </>
          ) : (
            <>
              <Laptop key="system" size={ICON_SIZE} className="text-slate-400" />
              <span className="text-xs font-semibold capitalize">System</span>
            </>
          )}
          <ChevronDown size={12} className="opacity-50 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-32" align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(e) => setTheme(e)}>
          <DropdownMenuRadioItem className="flex items-center gap-2 cursor-pointer font-medium text-xs" value="light">
            <Sun size={ICON_SIZE} className="text-amber-500" /> <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex items-center gap-2 cursor-pointer font-medium text-xs" value="dark">
            <Moon size={ICON_SIZE} className="text-blue-400" /> <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex items-center gap-2 cursor-pointer font-medium text-xs" value="system">
            <Laptop size={ICON_SIZE} className="text-slate-400" /> <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };

