"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, History, Book, Check, Search, X, Loader2, Copy } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface FindingsSuggestionEngineProps {
  supabase: any;
  componentType: string;
  inspectionTypeCode: string;
  onSelect: (finding: string) => void;
  currentFinding: string;
}

// Standard dictionary of offshore inspection findings
const STANDARD_FINDINGS: Record<string, string[]> = {
  "GENERAL": [
    "General condition appears good with no significant defects observed.",
    "Component is in satisfactory condition at the time of inspection.",
    "No significant anomalies or areas of concern noted during the survey.",
  ],
  "MARINE_GROWTH": [
    "Light filamentous marine growth observed covering approximately 20% of the surface area.",
    "Moderate hard marine growth (barnacles/tubeworms) noted, thickness approximately 10-20mm.",
    "Heavy calcareous marine growth covering 100% of the component surface.",
    "Marine growth removed for close visual inspection; base material appears intact.",
  ],
  "COATING": [
    "Coating system appears intact with minimal signs of degradation.",
    "Localized coating breakdown observed with minor surface corrosion (Grade Re 3).",
    "Significant coating loss noted with pitting corrosion evident on the substrate.",
    "Calcareous deposits noted beneath loose coating flakes.",
  ],
  "CORROSION": [
    "Minor surface oxidation/rust staining observed; no loss of section detected.",
    "Active corrosion noted with significant scaling; UT thickness readings recommended.",
    "Localized pitting corrosion observed; maximum pit depth estimated at 2mm.",
  ],
  "ANODE": [
    "Anode shows approximately 25% depletion; remaining material appears secure.",
    "Anode is heavily depleted (approx. 75%); replacement should be considered in next campaign.",
    "Anode core bar is visible; depletion estimated at >90%.",
    "Anode appears secure with good electrical continuity to the structure.",
  ],
  "WELD": [
    "Weld profile appears smooth and consistent with no visible surface-breaking defects.",
    "Minor undercut noted at the weld toe; no further action required at this stage.",
    "Significant erosion/corrosion observed at the weld heat-affected zone (HAZ).",
  ],
  "DEBRIS": [
    "Metallic debris (scaffolding tube/grating) observed on the seabed near the structure base.",
    "Non-metallic debris (cement bag/plastic shroud) noted partially buried in the silt.",
    "Scrapped wire rope observed coiled on the seabed; no contact with the structure.",
    "Unknown metallic object noted; item appears to be legacy construction debris.",
    "Debris item is in close proximity to the component; potential snagging hazard.",
  ],
  "SEABED_SURVEY": [
    "Active gas seepage (moderate bubbles) observed from the seabed.",
    "Intermittent gas seepage noted; no associated cratering observed.",
    "Small crater (estimated 1m diameter) observed; likely from legacy activities.",
    "Depression/Scour observed near the component base; approx. 0.5m deep.",
    "Seabed appears clear of any significant debris or anomalies in the immediate vicinity.",
  ]
};

export function FindingsSuggestionEngine({
  supabase,
  componentType,
  inspectionTypeCode,
  onSelect,
  currentFinding
}: FindingsSuggestionEngineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<{ text: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"history" | "standard">("history");
  const [showAll, setShowAll] = useState(false);

  // Helper to determine recommended categories based on inspectionTypeCode and componentType
  const recommendedCategories = React.useMemo(() => {
    const code = (inspectionTypeCode || "").toUpperCase().trim();
    const comp = (componentType || "").toUpperCase().trim();
    const recommended = new Set<string>(["GENERAL"]);

    // Marine Growth
    if (
      code.includes("MGI") || 
      code.includes("CLEAN") || 
      code.includes("GROWTH") ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      comp.includes("RIS") || 
      comp.includes("AN") || 
      comp.includes("WLD") ||
      comp.includes("MEMBER") ||
      comp.includes("CAISSON") ||
      comp.includes("CONDUCTOR") ||
      comp.includes("RISER")
    ) {
      recommended.add("MARINE_GROWTH");
    }

    // Coating
    if (
      code.includes("COAT") || 
      code === "PL_CO" ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      comp.includes("RIS") || 
      comp.includes("CL") ||
      comp.includes("MEMBER") ||
      comp.includes("CAISSON") ||
      comp.includes("CONDUCTOR") ||
      comp.includes("RISER") ||
      comp.includes("CLAMP")
    ) {
      recommended.add("COATING");
    }

    // Corrosion
    if (
      code.includes("CORR") || 
      code.includes("UT") || 
      code === "ACFMC" || 
      code === "PL_CO" ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      comp.includes("RIS") || 
      comp.includes("CL") ||
      comp.includes("WLD") ||
      comp.includes("AN") ||
      comp.includes("MEMBER") ||
      comp.includes("CAISSON") ||
      comp.includes("CONDUCTOR") ||
      comp.includes("RISER") ||
      comp.includes("CLAMP") ||
      comp.includes("WELD") ||
      comp.includes("ANODE")
    ) {
      recommended.add("CORROSION");
    }

    // Anode
    if (
      code.includes("ANODE") || 
      code.includes("CP") || 
      comp.includes("AN") || 
      comp.includes("ANODE")
    ) {
      recommended.add("ANODE");
    }

    // Weld
    if (
      code.includes("WELD") || 
      code === "ACFMC" || 
      code.includes("NDT") || 
      code.includes("MPI") ||
      comp.includes("WLD") || 
      comp.includes("WELD") || 
      comp.includes("NODE")
    ) {
      recommended.add("WELD");
    }

    // Debris & Seabed Survey
    if (
      code.includes("SEABED") || 
      code.includes("SBD") || 
      code === "RSEAB" || 
      code === "RWDI" ||
      comp.includes("SD") || 
      comp.includes("SEABED") || 
      comp.includes("SBD")
    ) {
      recommended.add("DEBRIS");
      recommended.add("SEABED_SURVEY");
    }

    // Fallbacks
    if (code === "GVINS" || code === "CVINS") {
      recommended.add("MARINE_GROWTH");
      recommended.add("COATING");
      recommended.add("CORROSION");
      recommended.add("DEBRIS");
    }

    return Array.from(recommended);
  }, [inspectionTypeCode, componentType]);

  useEffect(() => {
    if (isOpen && tab === "history" && history.length === 0) {
      fetchHistory();
    }
  }, [isOpen, tab]);

  const fetchHistory = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      // Query database findings matching both inspection_type_code AND component_type
      let query = supabase
        .from("insp_records")
        .select("description, finding, inspection_data")
        .eq("inspection_type_code", inspectionTypeCode);

      if (componentType) {
        query = query.eq("component_type", componentType.toUpperCase().trim());
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      let finalData = data;
      // If we searched with componentType filter and got no results, try fallback without componentType to be helpful
      if (componentType && (!data || data.length === 0)) {
        const fallbackRes = await supabase
          .from("insp_records")
          .select("description, finding, inspection_data")
          .eq("inspection_type_code", inspectionTypeCode)
          .limit(200);
        if (fallbackRes.data) {
          finalData = fallbackRes.data;
        }
      }

      if (finalData) {
        const counts: Record<string, number> = {};
        finalData.forEach((r: any) => {
          const text = (r.description || r.finding || r.inspection_data?.findings || r.inspection_data?.observation || "").trim();
          if (text && text.length > 5) {
            counts[text] = (counts[text] || 0) + 1;
          }
        });

        const sortedItems = Object.entries(counts)
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count);

        setHistory(sortedItems);
      }
    } catch (err) {
      console.error("Error fetching finding history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const displayStandardCategories = React.useMemo(() => {
    const entries = Object.entries(STANDARD_FINDINGS);
    if (showAll) return entries;
    return entries.filter(([category]) => recommendedCategories.includes(category));
  }, [recommendedCategories, showAll]);

  const filteredHistory = React.useMemo(() => {
    if (!searchQuery) return history;
    return history.filter(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [history, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Suggestions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" align="end">
        <div className="flex flex-col h-[400px]">
          {/* Header */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Findings Assistant</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 uppercase">
              {inspectionTypeCode}
            </Badge>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search suggestions..."
                className="pl-8 h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 dark:text-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 p-1 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={() => setTab("history")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "history" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700" 
                  : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <History className="w-3 h-3" />
              HISTORY
            </button>
            <button
              onClick={() => setTab("standard")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "standard" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700" 
                  : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Book className="w-3 h-3" />
              STANDARD
            </button>
          </div>

          {/* Recommended vs All Toggle Switch */}
          {tab === "standard" && (
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {showAll ? "All Suggestions" : "AI Recommended Only"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="h-5 px-2 text-[8px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-950"
              >
                {showAll ? "AI Recommended" : "Show All"}
              </Button>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Analyzing History...</span>
                </div>
              ) : tab === "history" ? (
                filteredHistory.length > 0 ? (
                  filteredHistory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelect(item.text);
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative flex flex-col gap-1"
                    >
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed pr-6">
                        {item.text}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-blue-500/70 dark:text-blue-400/70 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-950/50 px-1 py-0.5 rounded">
                          Used {item.count} {item.count === 1 ? "time" : "times"}
                        </span>
                      </div>
                      <Copy className="absolute top-2.5 right-2.5 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                    <History className="w-10 h-10 text-slate-200 mb-3" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">No historical data found for this component type.</span>
                  </div>
                )
              ) : (
                <div className="space-y-4 pt-1">
                  {displayStandardCategories
                    .sort(([catA], [catB]) => {
                      if (inspectionTypeCode === 'RSEAB') {
                        if (catA === 'SEABED_SURVEY') return -1;
                        if (catB === 'SEABED_SURVEY') return 1;
                        if (catA === 'DEBRIS') return -1;
                        if (catB === 'DEBRIS') return 1;
                      }
                      // Sort recommended categories first if showAll is true
                      if (showAll) {
                        const recA = recommendedCategories.includes(catA);
                        const recB = recommendedCategories.includes(catB);
                        if (recA && !recB) return -1;
                        if (!recA && recB) return 1;
                      }
                      return 0;
                    })
                    .map(([category, items]) => {
                      const filteredItems = searchQuery 
                        ? items.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                        : items;
                      
                      if (filteredItems.length === 0) return null;

                      return (
                        <div key={category} className="space-y-1.5">
                          <div className="px-2 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l-2 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 flex items-center justify-between">
                            <span>{category.replace("_", " ")}</span>
                            {recommendedCategories.includes(category) && (
                              <Badge variant="outline" className="text-[7px] py-0 px-1 font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30 uppercase tracking-tighter bg-blue-50/30">
                                Recommended
                              </Badge>
                            )}
                          </div>
                          {filteredItems.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                onSelect(item);
                                setIsOpen(false);
                              }}
                              className="w-full text-left p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative"
                            >
                              <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed pr-6">
                                {item}
                              </div>
                              <Copy className="absolute top-2.5 right-2.5 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Click to apply to findings</span>
            <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" onClick={() => setIsOpen(false)}>
              CLOSE
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
