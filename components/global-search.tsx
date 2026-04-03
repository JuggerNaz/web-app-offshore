"use client";

import * as React from "react";
import { 
  Search, 
  Building2, 
  Wind, 
  Briefcase, 
  ClipboardCheck, 
  AlertTriangle, 
  FileImage, 
  Command,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { useRouter } from "next/navigation";
import { searchGlobal, SearchResult } from "@/lib/search-actions";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearch = React.useCallback(async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchGlobal(val);
      setResults(data);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSelect = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "platform": return <Building2 className="mr-3 h-4 w-4 text-blue-500" />;
      case "pipeline": return <Wind className="mr-3 h-4 w-4 text-cyan-500" />;
      case "jobpack": return <Briefcase className="mr-3 h-4 w-4 text-amber-500" />;
      case "inspection": return <ClipboardCheck className="mr-3 h-4 w-4 text-emerald-500" />;
      case "anomaly": return <AlertTriangle className="mr-3 h-4 w-4 text-rose-500" />;
      case "media": return <FileImage className="mr-3 h-4 w-4 text-purple-500" />;
      default: return <Command className="mr-3 h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl border-none max-w-2xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl rounded-[2rem]">
        <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-[2rem]">
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white/50 dark:bg-slate-900/50">
            <Search className="mr-3 h-5 w-5 shrink-0 text-slate-400 opacity-50" />
            <CommandPrimitive.Input
              placeholder="Search assets, jobpacks, or anomalies..."
              value={query}
              onValueChange={handleSearch}
              className="flex h-10 w-full rounded-md bg-transparent text-lg font-medium outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {loading ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            )}
          </div>
          <CommandPrimitive.List className="max-h-[350px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
            <CommandPrimitive.Empty className="py-12 text-center text-sm">
              <div className="flex flex-col items-center gap-2">
                <Search className="h-8 w-8 text-slate-200 dark:text-slate-800" />
                <p className="text-slate-400 font-medium">No results found for "{query}"</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Try searching "legs:4" or "qid:123"</p>
              </div>
            </CommandPrimitive.Empty>
            
            {results.length > 0 && (
              <CommandPrimitive.Group heading="Global Results" className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                {results.map((item) => (
                  <CommandPrimitive.Item
                    key={`${item.type}-${item.id}`}
                    value={`${item.title} ${item.subtitle}`}
                    onSelect={() => onSelect(item.url)}
                    className="flex cursor-pointer select-none items-center rounded-2xl px-4 py-3 text-sm outline-none aria-selected:bg-blue-50 dark:aria-selected:bg-blue-900/20 aria-selected:text-blue-700 dark:aria-selected:text-blue-400 transition-all duration-200 group"
                  >
                    {getIcon(item.type)}
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 group-aria-selected:text-blue-700 dark:group-aria-selected:text-blue-400 truncate uppercase">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5 opacity-80">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-aria-selected:opacity-100 transition-opacity translate-x-2 group-aria-selected:translate-x-0" />
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}
            
            {query.length < 2 && (
              <div className="p-4 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-700 px-2 pb-2 border-b border-slate-50 dark:border-slate-900/50">
                  Quick Actions
                </div>
                <div className="grid grid-cols-2 gap-3 px-2">
                  {[
                    { label: "Platforms", icon: <Building2 className="h-4 w-4" />, url: "/dashboard/field/platform" },
                    { label: "Jobpacks", icon: <Briefcase className="h-4 w-4" />, url: "/dashboard/jobpack" },
                    { label: "Anomalies", icon: <AlertTriangle className="h-4 w-4" />, url: "/dashboard/inspection/anomalies" },
                    { label: "Settings", icon: <Command className="h-4 w-4" />, url: "/dashboard/settings" },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => onSelect(action.url)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        {action.icon}
                      </div>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
