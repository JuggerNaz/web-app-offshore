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
  Printer,
  FileText,
  Loader2,
  X,
  Sparkles,
  ChevronRight,
  Tag,
  Compass,
  SlidersHorizontal,
  Anchor,
  Layers3
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

type CategoryFilter = "ALL" | "INSPECTIONS" | "ASSETS" | "JOBPACKS" | "ANOMALIES" | "COMPONENTS";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<CategoryFilter>("ALL");
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

  // Handle print button click on an inspection or anomaly result
  const handlePrintClick = (e: React.MouseEvent, item: SearchResult) => {
    e.stopPropagation();
    e.preventDefault();

    if (item.type === "anomaly") {
      openReportPreview(item, {
        templateId: "anomaly-report",
        label: `Defect & Anomaly Report (${item.title})`,
        code: "ANOMALY",
        mode: item.inspMode || "DIVING",
      });
      return;
    }

    if (!item.inspectionTypeCode || !item.jobpackId || !item.structureId) {
      toast.error("Missing inspection metadata for report generation");
      return;
    }

    const templates = getTemplatesForInspectionType(
      item.inspectionTypeCode,
      item.inspMode
    );

    if (templates.length === 1) {
      openReportPreview(item, templates[0]);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTemplatePickerAnchor({ top: rect.bottom + 4, left: Math.min(rect.left, typeof window !== "undefined" ? window.innerWidth - 300 : rect.left) });
      setTemplatePickerItem(item);
    }
  };

  const openReportPreview = (item: SearchResult, template: ReportTemplateOption) => {
    setTemplatePickerItem(null);
    setTemplatePickerAnchor(null);
    setActiveReportCtx({ item, template });
    setReportPreviewTitle(`${template.label}`);
    setReportPreviewFileName(`${item.inspectionTypeCode}_${item.sowReportNo || item.id}_report.pdf`);
    setReportPreviewOpen(true);
  };

  const generateActiveReport = async (printFriendly: boolean, showSignatures: boolean): Promise<Blob | void> => {
    if (!activeReportCtx) return;
    const { item, template } = activeReportCtx;

    try {
      return await generateReportFromSearch(
        {
          inspId: item.inspId || (typeof item.id === "number" ? item.id : Number(item.id) || 0),
          anomalyId: item.type === "anomaly" ? (typeof item.id === "number" ? item.id : Number(item.id) || item.inspId || 0) : undefined,
          inspectionTypeCode: item.inspectionTypeCode || "ANOMALY",
          jobpackId: item.jobpackId || 0,
          structureId: item.structureId || 0,
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

  // Helper for category badge icons
  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "platform":
        return (
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
        );
      case "pipeline":
        return (
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
            <Wind className="h-4 w-4" />
          </div>
        );
      case "jobpack":
        return (
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Briefcase className="h-4 w-4" />
          </div>
        );
      case "component":
        return (
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
            <Layers className="h-4 w-4" />
          </div>
        );
      case "inspection":
        return (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <ClipboardCheck className="h-4 w-4" />
          </div>
        );
      case "anomaly":
        return (
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 shrink-0">
            <Command className="h-4 w-4" />
          </div>
        );
    }
  };

  // Filtered results by active tab
  const filteredResults = React.useMemo(() => {
    if (activeCategory === "ALL") return results;
    if (activeCategory === "INSPECTIONS") return results.filter((r) => r.type === "inspection");
    if (activeCategory === "ASSETS") return results.filter((r) => r.type === "platform" || r.type === "pipeline");
    if (activeCategory === "JOBPACKS") return results.filter((r) => r.type === "jobpack");
    if (activeCategory === "ANOMALIES") return results.filter((r) => r.type === "anomaly");
    if (activeCategory === "COMPONENTS") return results.filter((r) => r.type === "component");
    return results;
  }, [results, activeCategory]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setTemplatePickerItem(null);
            setTemplatePickerAnchor(null);
            setQuery("");
            setResults([]);
            setActiveCategory("ALL");
          }
        }}
      >
        <DialogContent className="overflow-hidden p-0 shadow-2xl border border-slate-200/80 dark:border-slate-800 max-w-3xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl rounded-[2rem] transition-all">
          <div className="sr-only">
            <DialogTitle>OmniSearch & Inspection Reports Hub</DialogTitle>
            <DialogDescription>
              Search platforms, pipelines, jobpacks, inspection tasks, and anomalies.
            </DialogDescription>
          </div>

          <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-[2rem]">
            {/* Top Search Input Box */}
            <div className="relative flex flex-col border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/60 dark:to-slate-950 p-4 gap-3">
              <div className="flex items-center px-3">
                <Search className="mr-3.5 h-5 w-5 shrink-0 text-blue-500/80" />
                <CommandPrimitive.Input
                  placeholder="Search RMGI, GVI, Platform, Jobpack, Anomaly, or SOW #..."
                  value={query}
                  onValueChange={handleSearch}
                  className="flex h-11 w-full rounded-xl bg-transparent text-base font-semibold outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setResults([]); }}
                    className="mr-2 p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {loading ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-2xs">
                    <Command className="h-3 w-3" />
                    <span>K</span>
                  </div>
                )}
              </div>

              {/* Category Filter Pills (shown when query >= 2) */}
              {query.length >= 2 && results.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 overflow-x-auto scrollbar-none pt-1">
                  {[
                    { id: "ALL", label: "All Results", count: results.length },
                    { id: "INSPECTIONS", label: "Inspections", count: results.filter((r) => r.type === "inspection").length },
                    { id: "ASSETS", label: "Assets", count: results.filter((r) => r.type === "platform" || r.type === "pipeline").length },
                    { id: "JOBPACKS", label: "Jobpacks", count: results.filter((r) => r.type === "jobpack").length },
                    { id: "ANOMALIES", label: "Anomalies", count: results.filter((r) => r.type === "anomaly").length },
                    { id: "COMPONENTS", label: "Components", count: results.filter((r) => r.type === "component").length },
                  ]
                    .filter((cat) => cat.id === "ALL" || cat.count > 0)
                    .map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id as CategoryFilter)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
                          activeCategory === cat.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                            : "bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <span>{cat.label}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none",
                            activeCategory === cat.id
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {cat.count}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Results List */}
            <CommandPrimitive.List className="max-h-[420px] overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
              {loading && results.length === 0 && (
                <div className="py-16 text-center text-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-9 w-9 text-blue-500 animate-spin" />
                    <p className="text-slate-600 dark:text-slate-300 font-bold text-base">Searching Offshore Database...</p>
                    <p className="text-xs text-slate-400">Scanning Platforms, SOW Reports, Inspections, and Anomalies</p>
                  </div>
                </div>
              )}

              <CommandPrimitive.Empty className={cn("py-16 text-center text-sm", loading && "hidden")}>
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-700 dark:text-slate-200 font-bold text-base">No results found for &quot;{query}&quot;</p>
                    <p className="text-xs text-slate-400 mt-1">Try searching for an inspection type like <code className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono">RMGI</code>, <code className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono">GVI</code>, <code className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono">UTWT</code> or Platform Title</p>
                  </div>
                </div>
              </CommandPrimitive.Empty>

              {(() => {
                if (filteredResults.length === 0) return null;

                const assets = filteredResults.filter((r) => r.type === "platform" || r.type === "pipeline");
                const jobpacks = filteredResults.filter((r) => r.type === "jobpack");
                const components = filteredResults.filter((r) => r.type === "component");
                const anomalies = filteredResults.filter((r) => r.type === "anomaly");
                const inspections = filteredResults.filter((r) => r.type === "inspection");

                const inspectionsByYear: Record<string, SearchResult[]> = {};
                inspections.forEach((item) => {
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

                const renderSearchItem = (item: SearchResult) => {
                  const templates = item.type === "inspection" && item.inspectionTypeCode
                    ? getTemplatesForInspectionType(item.inspectionTypeCode, item.inspMode)
                    : [];

                  return (
                    <CommandPrimitive.Item
                      key={`${item.type}-${item.id}`}
                      value={`${item.title} ${item.subtitle}`}
                      onSelect={() => onSelect(item.url)}
                      className="group flex cursor-pointer select-none items-center rounded-2xl p-3.5 mb-2 text-sm outline-none transition-all duration-200 border border-transparent hover:border-blue-500/20 aria-selected:border-blue-500/30 aria-selected:bg-gradient-to-r aria-selected:from-blue-50/90 aria-selected:to-indigo-50/50 dark:aria-selected:from-blue-950/40 dark:aria-selected:to-indigo-950/20 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    >
                      {getIcon(item.type)}

                      <div className="flex flex-col flex-1 overflow-hidden ml-3.5 pr-2">
                        {/* Title Row with Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black tracking-tight text-slate-900 dark:text-slate-100 group-aria-selected:text-blue-700 dark:group-aria-selected:text-blue-400 text-sm uppercase">
                            {item.title}
                          </span>

                          {/* Inspection Mode Badge (ROV / DIVING) */}
                          {item.type === "inspection" && item.inspMode && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-2xs",
                                item.inspMode === "ROV"
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                  : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                              )}
                            >
                              {item.inspMode}
                            </span>
                          )}

                          {/* SOW Report No Pill */}
                          {item.sowReportNo && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                              SOW #{item.sowReportNo}
                            </span>
                          )}
                        </div>

                        {/* Subtitle / Metrics Bar */}
                        {item.subtitle && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-1 leading-relaxed">
                            {item.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Action Right Section */}
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {/* Print Button for Inspection & Anomaly Results */}
                        {(item.type === "inspection" || item.type === "anomaly") && (
                          <button
                            onClick={(e) => handlePrintClick(e, item)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 font-bold text-xs border hover:scale-105 active:scale-95 shadow-sm cursor-pointer",
                              item.type === "anomaly"
                                ? "bg-rose-500/10 hover:bg-rose-600 dark:bg-rose-500/20 dark:hover:bg-rose-600 text-rose-700 hover:text-white dark:text-rose-400 dark:hover:text-white border-rose-500/30 hover:border-rose-600"
                                : "bg-emerald-500/10 hover:bg-emerald-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-600 text-emerald-700 hover:text-white dark:text-emerald-400 dark:hover:text-white border-emerald-500/30 hover:border-emerald-600"
                            )}
                            title={item.type === "anomaly" ? "Print Anomaly Report PDF" : "Generate Inspection Report PDF"}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print</span>
                            {templates.length > 1 && (
                              <span className="ml-0.5 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-emerald-700 text-white">
                                {templates.length}
                              </span>
                            )}
                          </button>
                        )}

                        {/* View Arrow Button */}
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-400 group-aria-selected:bg-blue-600 group-aria-selected:text-white transition-all duration-200">
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </CommandPrimitive.Item>
                  );
                };

                return (
                  <>
                    {/* Inspection Tasks grouped by Year */}
                    {sortedYears.map((year) => (
                      <CommandPrimitive.Group
                        key={year}
                        heading={`📋 Inspection Tasks (Year ${year})`}
                        className="px-2 py-2 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                      >
                        {inspectionsByYear[year].map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    ))}

                    {/* Assets Group */}
                    {assets.length > 0 && (
                      <CommandPrimitive.Group
                        heading="🏢 Offshore Assets (Platforms & Pipelines)"
                        className="px-2 py-2 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400"
                      >
                        {assets.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {/* Jobpacks Group */}
                    {jobpacks.length > 0 && (
                      <CommandPrimitive.Group
                        heading="💼 Jobpacks & Scope of Work"
                        className="px-2 py-2 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400"
                      >
                        {jobpacks.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {/* Anomalies Group */}
                    {anomalies.length > 0 && (
                      <CommandPrimitive.Group
                        heading="⚠️ Findings & Anomalies"
                        className="px-2 py-2 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400"
                      >
                        {anomalies.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}

                    {/* Components Group */}
                    {components.length > 0 && (
                      <CommandPrimitive.Group
                        heading="🧩 Structure Components (QIDs)"
                        className="px-2 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
                      >
                        {components.map(renderSearchItem)}
                      </CommandPrimitive.Group>
                    )}
                  </>
                );
              })()}

              {/* Quick Actions Screen when Query < 2 */}
              {query.length < 2 && (
                <div className="p-3 space-y-4">
                  <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Quick Navigation Modules
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Click to navigate directly</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 px-1">
                    {[
                      {
                        label: "Platforms",
                        sub: "Field Assets",
                        icon: <Building2 className="h-4 w-4 text-blue-500" />,
                        url: "/dashboard/field/platform",
                        badge: "Assets"
                      },
                      {
                        label: "Pipelines",
                        sub: "Riser & Lines",
                        icon: <Wind className="h-4 w-4 text-cyan-500" />,
                        url: "/dashboard/field/pipeline",
                        badge: "Assets"
                      },
                      {
                        label: "Jobpacks",
                        sub: "Work Packages",
                        icon: <Briefcase className="h-4 w-4 text-amber-500" />,
                        url: "/dashboard/jobpack",
                        badge: "Planning"
                      },
                      {
                        label: "ROV Workspace",
                        sub: "ROV Inspection",
                        icon: <ClipboardCheck className="h-4 w-4 text-purple-500" />,
                        url: "/dashboard/inspection-v2/workspace?mode=ROV",
                        badge: "ROV"
                      },
                      {
                        label: "Diving Workspace",
                        sub: "Diving Inspection",
                        icon: <Anchor className="h-4 w-4 text-emerald-500" />,
                        url: "/dashboard/inspection-v2/workspace?mode=DIVING",
                        badge: "Diving"
                      },
                      {
                        label: "Anomalies",
                        sub: "Defects & Findings",
                        icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
                        url: "/dashboard/utilities/anomalies-findings",
                        badge: "Defects"
                      },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => onSelect(action.url)}
                        className="group flex flex-col p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-500/10 transition-colors">
                            {action.icon}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            {action.badge}
                          </span>
                        </div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {action.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {action.sub}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search Hint Footer */}
                  <div className="mt-2 p-3 rounded-2xl bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Pro Tip: Type <code className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">RMGI</code>, <code className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">GVI</code>, <code className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">UTWT</code> or Platform Title to search tasks & reports.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>

          {/* Template Picker Popover */}
          {templatePickerItem && templatePickerAnchor && (
            <div
              className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
              style={{
                top: Math.min(templatePickerAnchor.top, typeof window !== "undefined" ? window.innerHeight - 340 : templatePickerAnchor.top),
                left: Math.max(16, Math.min(templatePickerAnchor.left, typeof window !== "undefined" ? window.innerWidth - 300 : templatePickerAnchor.left))
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-[300px] max-h-[340px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl p-2.5 custom-scrollbar">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Select Report Template
                  </span>
                  <button
                    onClick={() => { setTemplatePickerItem(null); setTemplatePickerAnchor(null); }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-blue-900/30 transition-all duration-150 group/tmpl border border-transparent hover:border-blue-500/20 cursor-pointer my-0.5"
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover/tmpl:bg-blue-600 group-hover/tmpl:text-white transition-colors shrink-0">
                      <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover/tmpl:text-white transition-colors" />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover/tmpl:text-blue-600 dark:group-hover/tmpl:text-blue-400 truncate transition-colors">
                        {tmpl.label}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        CODE: {tmpl.code}
                      </span>
                    </div>
                    <Printer className="h-4 w-4 text-slate-400 group-hover/tmpl:text-blue-600 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Preview Dialog */}
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
