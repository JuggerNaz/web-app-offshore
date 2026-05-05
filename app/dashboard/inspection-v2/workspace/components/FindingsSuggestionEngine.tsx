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
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"history" | "standard">("history");

  useEffect(() => {
    if (isOpen && tab === "history" && history.length === 0) {
      fetchHistory();
    }
  }, [isOpen, tab]);

  const fetchHistory = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      // Query unique findings for similar components and inspection types
      const { data, error } = await supabase
        .from("insp_records")
        .select("inspection_data")
        .eq("inspection_type_code", inspectionTypeCode)
        .not("inspection_data->findings", "is", null)
        .limit(50);

      if (error) throw error;

      if (data) {
        const uniqueFindings = Array.from(new Set(
          data.map((r: any) => r.inspection_data?.findings || r.inspection_data?.observation)
            .filter(Boolean)
            .filter((f: string) => f.length > 5)
        )) as string[];
        setHistory(uniqueFindings);
      }
    } catch (err) {
      console.error("Error fetching finding history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStandard = React.useMemo(() => {
    const all = Object.values(STANDARD_FINDINGS).flat();
    if (!searchQuery) return all;
    return all.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const filteredHistory = React.useMemo(() => {
    if (!searchQuery) return history;
    return history.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [history, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Suggestions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-slate-200" align="end">
        <div className="flex flex-col h-[400px]">
          {/* Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Findings Assistant</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold bg-white text-blue-600 border-blue-100 uppercase">
              {inspectionTypeCode}
            </Badge>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search suggestions..."
                className="pl-8 h-8 text-xs bg-white border-slate-200 focus-visible:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 p-1 bg-slate-50/50">
            <button
              onClick={() => setTab("history")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "history" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <History className="w-3 h-3" />
              HISTORY
            </button>
            <button
              onClick={() => setTab("standard")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "standard" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Book className="w-3 h-3" />
              STANDARD
            </button>
          </div>

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
                        onSelect(item);
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group relative"
                    >
                      <div className="text-[11px] font-medium text-slate-700 leading-relaxed pr-6">
                        {item}
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
                  {Object.entries(STANDARD_FINDINGS).map(([category, items]) => {
                    const filteredItems = searchQuery 
                      ? items.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                      : items;
                    
                    if (filteredItems.length === 0) return null;

                    return (
                      <div key={category} className="space-y-1.5">
                        <div className="px-2 py-0.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-blue-500 bg-blue-50/30">
                          {category.replace("_", " ")}
                        </div>
                        {filteredItems.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              onSelect(item);
                              setIsOpen(false);
                            }}
                            className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group relative"
                          >
                            <div className="text-[11px] font-medium text-slate-700 leading-relaxed pr-6">
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
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Click to apply to findings</span>
            <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black text-slate-500 hover:text-red-500" onClick={() => setIsOpen(false)}>
              CLOSE
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
