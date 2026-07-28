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
  Layers,
  Command,
  ArrowRight,
  Hourglass,
  Printer,
  FileText,
  Loader2,
  X
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { useRouter } from "next/navigation";
import { searchGlobal, SearchResult } from "@/lib/search-actions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportPreviewDialog } from "@/components/ReportPreviewDialog";
import { cn } from "@/lib/utils";
import {
  getTemplatesForInspectionType,
  generateReportFromSearch,
  type ReportTemplateOption,
} from "@/lib/search-report-generator";
import { toast } from "sonner";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Print / template picker state
  const [templatePickerItem, setTemplatePickerItem] = React.useState<SearchResult | null>(null);
  const [templatePickerAnchor, setTemplatePickerAnchor] = React.useState<{ top: number; left: number } | null>(null);
  const [reportPreviewOpen, setReportPreviewOpen] = React.useState(false);
  const [reportPreviewTitle, setReportPreviewTitle] = React.useState("");
  const [reportPreviewFileName, setReportPreviewFileName] = React.useState("");
  const [activeReportCtx, setActiveReportCtx] = React.useState<{
    item: SearchResult;
    template: ReportTemplateOption;
  } | null>(null);

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

  // Close template picker on Escape
  React.useEffect(() => {
    if (!templatePickerItem) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setTemplatePickerItem(null);
        setTemplatePickerAnchor(null);
      }
    };
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [templatePickerItem]);

  // Close template picker on outside click
  React.useEffect(() => {
    if (!templatePickerItem) return;
    const onClick = () => {
      setTemplatePickerItem(null);
      setTemplatePickerAnchor(null);
    };
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("click", onClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", onClick);
    };
  }, [templatePickerItem]);

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
    setTemplatePickerItem(null);
    setTemplatePickerAnchor(null);
    router.push(url);
  };

  // Handle print button click on an inspection result
  const handlePrintClick = (e: React.MouseEvent, item: SearchResult) => {
    e.stopPropagation();
    e.preventDefault();

    if (!item.inspectionTypeCode || !item.jobpackId || !item.structureId) {
      toast.error("Missing inspection metadata for report generation");
      return;
    }

    const templates = getTemplatesForInspectionType(
      item.inspectionTypeCode,
      item.inspMode
    );

    if (templates.length === 1) {
      // Single template → open preview directly
      openReportPreview(item, templates[0]);
    } else {
      // Multiple templates → show picker
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTemplatePickerAnchor({ top: rect.bottom + 4, left: rect.right - 240 });
      setTemplatePickerItem(item);
    }
  };

  // Open report preview with selected template
  const openReportPreview = (item: SearchResult, template: ReportTemplateOption) => {
    setTemplatePickerItem(null);
    setTemplatePickerAnchor(null);
    setActiveReportCtx({ item, template });
    setReportPreviewTitle(`${template.label}`);
    setReportPreviewFileName(`${item.inspectionTypeCode}_${item.id}_report.pdf`);
    setReportPreviewOpen(true);
  };

  // Generate report blob for ReportPreviewDialog
  const generateActiveReport = async (printFriendly: boolean, showSignatures: boolean): Promise<Blob | void> => {
    if (!activeReportCtx) return;
    const { item, template } = activeReportCtx;

    try {
      return await generateReportFromSearch(
        {
          inspId: Number(item.id),
          inspectionTypeCode: item.inspectionTypeCode!,
          jobpackId: item.jobpackId!,
          structureId: item.structureId!,
          sowReportNo: item.sowReportNo,
          mode: item.inspMode || "DIVING",
        },
        template.templateId,
        printFriendly,
        showSignatures
      );
    } catch (error) {
      console.error("Report generation error:", error);
      toast.error("Failed to generate report");
    }
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "platform": return <Building2 className="mr-3 h-4 w-4 text-blue-500" />;
      case "pipeline": return <Wind className="mr-3 h-4 w-4 text-cyan-500" />;
      case "jobpack": return <Briefcase className="mr-3 h-4 w-4 text-amber-500" />;
      case "component": return <Layers className="mr-3 h-4 w-4 text-indigo-500" />;
      case "inspection": return <ClipboardCheck className="mr-3 h-4 w-4 text-emerald-500" />;
      case "anomaly": return <AlertTriangle className="mr-3 h-4 w-4 text-rose-500" />;
      case "media": return <FileImage className="mr-3 h-4 w-4 text-purple-500" />;
      default: return <Command className="mr-3 h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTemplatePickerItem(null); setTemplatePickerAnchor(null); } }}>
        <DialogContent className="overflow-hidden p-0 shadow-2xl border-none max-w-2xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl rounded-[2rem]">
          <div className="sr-only">
            <DialogTitle>Global Search</DialogTitle>
            <DialogDescription>
              Search for assets, field data, and anomalies across the platform.
            </DialogDescription>
          </div>
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
                <Hourglass className="ml-2 h-4 w-4 animate-bounce text-blue-500" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                  <Command className="h-3 w-3" />
                  <span>K</span>
                </div>
              )}
            </div>
            <CommandPrimitive.List className="max-h-[350px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
              {loading && results.length === 0 && (
                <div className="py-12 text-center text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Hourglass className="h-8 w-8 text-blue-400 animate-spin" />
                    <p className="text-slate-400 font-medium animate-pulse">Searching the deep database...</p>
                  </div>
                </div>
              )}
              <CommandPrimitive.Empty className={cn("py-12 text-center text-sm", loading && "hidden")}>
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-slate-200 dark:text-slate-800" />
                  <p className="text-slate-400 font-medium">No results found for &quot;{query}&quot;</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Try searching &quot;legs:4&quot; or &quot;qid:123&quot;</p>
                </div>
              </CommandPrimitive.Empty>
              
              {(() => {
                if (results.length === 0) return null;

                const assets = results.filter(r => r.type === "platform" || r.type === "pipeline");
                const jobpacks = results.filter(r => r.type === "jobpack");
                const components = results.filter(r => r.type === "component");
                const anomalies = results.filter(r => r.type === "anomaly");
                const inspections = results.filter(r => r.type === "inspection");

                const inspectionsByYear: Record<string, SearchResult[]> = {};
                inspections.forEach(item => {
                  const year = item.year || "Unknown Year";
                  if (!inspectionsByYear[year]) {
                    inspectionsByYear[year] = [];
                  }
                  inspectionsByYear[year].push(item);
                });

                const sortedYears = Object.keys(inspectionsByYear).sort((a, b) => {
                  if (a === "Unknown Year") return 1;
                  if (b === "Unknown Year") return -1;
                  return b.localeCompare(a);
                });

                const renderSearchItem = (item: SearchResult) => (
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
                    {/* Print button for inspection results */}
                    {item.type === "inspection" && item.inspectionTypeCode && (
                      <button
                        onClick={(e) => handlePrintClick(e, item)}
                        className="ml-2 p-1.5 rounded-xl bg-slate-100/80 hover:bg-emerald-100 dark:bg-slate-800/80 dark:hover:bg-emerald-900/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-all duration-200 hover:scale-110 active:scale-95 shrink-0 border border-slate-200/60 dark:border-slate-700/60 shadow-xs"
                        title="Print inspection report"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-aria-selected:opacity-100 transition-opacity translate-x-2 group-aria-selected:translate-x-0" />
                  </CommandPrimitive.Item>
                );

                return (
                  <>
                    {assets.length > 0 && (
                      <CommandPrimitive.Group heading="Assets (Platforms & Pipelines)" className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                        {assets.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {jobpacks.length > 0 && (
                      <CommandPrimitive.Group heading="Jobpacks" className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                        {jobpacks.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {components.length > 0 && (
                      <CommandPrimitive.Group heading="Components" className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                        {components.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {anomalies.length > 0 && (
                      <CommandPrimitive.Group heading="Anomalies" className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                        {anomalies.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {sortedYears.map(year => (
                      <CommandPrimitive.Group key={year} heading={`Inspections (Year ${year})`} className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                        {inspectionsByYear[year].map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    ))}
                  </>
                );
              })()}
              
              {query.length < 2 && (
                <div className="p-4 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-700 px-2 pb-2 border-b border-slate-50 dark:border-slate-900/50">
                    Quick Actions
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-2">
                    {[
                      { label: "Platforms", icon: <Building2 className="h-4 w-4" />, url: "/dashboard/field/platform" },
                      { label: "Jobpacks", icon: <Briefcase className="h-4 w-4" />, url: "/dashboard/jobpack" },
                      { label: "Anomalies", icon: <AlertTriangle className="h-4 w-4" />, url: "/dashboard/utilities/anomalies-findings" },
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

          {/* Template Picker Popover (rendered as a fixed overlay inside the dialog) */}
          {templatePickerItem && templatePickerAnchor && (
            <div
              className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
              style={{
                top: Math.min(templatePickerAnchor.top, typeof window !== "undefined" ? window.innerHeight - 340 : templatePickerAnchor.top),
                left: Math.max(16, Math.min(templatePickerAnchor.left, typeof window !== "undefined" ? window.innerWidth - 300 : templatePickerAnchor.left))
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-[280px] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 custom-scrollbar">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Select Report Template
                    </span>
                    <button
                      onClick={() => { setTemplatePickerItem(null); setTemplatePickerAnchor(null); }}
                      className="p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {getTemplatesForInspectionType(
                  templatePickerItem.inspectionTypeCode!,
                  templatePickerItem.inspMode
                ).map((tmpl) => (
                  <button
                    key={tmpl.templateId}
                    onClick={(e) => {
                      e.stopPropagation();
                      openReportPreview(templatePickerItem!, tmpl);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 group/tmpl"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover/tmpl:bg-blue-100 dark:group-hover/tmpl:bg-blue-900/30 transition-colors shrink-0">
                      <FileText className="h-3.5 w-3.5 text-slate-400 group-hover/tmpl:text-blue-500 transition-colors" />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover/tmpl:text-blue-700 dark:group-hover/tmpl:text-blue-400 truncate transition-colors">
                        {tmpl.label}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        {tmpl.code}
                      </span>
                    </div>
                    <Printer className="h-3.5 w-3.5 text-slate-300 group-hover/tmpl:text-blue-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Preview Dialog — rendered outside the search dialog to avoid z-index conflicts */}
      <ReportPreviewDialog
        open={reportPreviewOpen}
        onOpenChange={setReportPreviewOpen}
        title={reportPreviewTitle}
        fileName={reportPreviewFileName}
        generateReport={generateActiveReport}
      />
    </>
  );
}
