"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
  Sparkles, ChevronLeft, ChevronRight, Zap,
  Building2, ListChecks, Calculator, ArrowUpDown, Filter, Table2, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ComputedField, SortRule, ConditionRule } from "@/utils/smart-query-schema";
import { StepCategory, StepFields, StepComputed, StepSorting, StepConditions } from "./steps";
import { StepResults, StepSaveExport } from "./results";

const STEPS = [
  { id: 1, label: "Category", icon: Building2, desc: "Choose data source" },
  { id: 2, label: "Fields", icon: ListChecks, desc: "Select columns" },
  { id: 3, label: "Computed", icon: Calculator, desc: "Calculated fields" },
  { id: 4, label: "Sort", icon: ArrowUpDown, desc: "Order results" },
  { id: 5, label: "Conditions", icon: Filter, desc: "Filter data" },
  { id: 6, label: "Results", icon: Table2, desc: "View data" },
  { id: 7, label: "Save", icon: Save, desc: "Save & export" },
];

export default function SmartQueryPage() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [computedFields, setComputedFields] = useState<ComputedField[]>([]);
  const [sorting, setSorting] = useState<SortRule[]>([]);
  const [conditions, setConditions] = useState<ConditionRule[]>([]);
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<string | undefined>();

  const { data: savedData, mutate: refreshSaved } = useSWR("/api/smart-query/saved", fetcher);
  const savedQueries = savedData?.data || [];

  const canNext = useCallback(() => {
    if (step === 1) return !!category;
    if (step === 2) return selectedFields.length > 0;
    return true;
  }, [step, category, selectedFields]);

  const executeQuery = async () => {
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/smart-query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, fields: selectedFields,
          computedFields: computedFields.filter(cf => cf.name && cf.sourceField && cf.operation),
          sorting: sorting.filter(s => s.field),
          conditions: conditions.filter(c => c.field && c.operator),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResults(json.data || []);
        setResultCount(json.count || 0);
        setTruncated(json.truncated || false);
      } else {
        toast.error(json.error || "Query failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Query execution error");
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (step === 5) {
      setStep(6);
      executeQuery();
    } else if (step < 7) {
      setStep(s => s + 1);
    }
  };

  const goBack = () => { if (step > 1) setStep(s => s - 1); };

  const loadQuery = (sq: any) => {
    const cfg = sq.config;
    setCategory(cfg.category || "");
    setSelectedFields(cfg.selectedFields || []);
    setComputedFields(cfg.computedFields || []);
    setSorting(cfg.sorting || []);
    setConditions(cfg.conditions || []);
    setCurrentQueryId(sq.id);
    setStep(2);
    toast.success(`Loaded "${sq.name}" — review & modify fields as needed`);
  };

  const resetWizard = () => {
    setStep(1); setCategory(""); setSelectedFields([]); setComputedFields([]);
    setSorting([]); setConditions([]); setResults([]); setResultCount(0);
    setTruncated(false); setCurrentQueryId(undefined);
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-br from-slate-50 via-blue-50/30 to-violet-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/20 animate-in fade-in duration-700">
      <div className="max-w-[1400px] mx-auto w-full p-6 md:p-8 space-y-6 flex flex-col h-full min-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 relative">
              <Zap className="h-7 w-7" />
              <Sparkles className="h-3.5 w-3.5 absolute -top-1 -right-1 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                <span className="opacity-70">Utilities</span>
                <div className="h-1 w-1 rounded-full bg-cyan-500" />
                <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">AI-Powered</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">Smart Query</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={resetWizard}>
            <Sparkles className="w-3 h-3" /> New Query
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => { if (isDone) setStep(s.id); }}
                    disabled={!isDone && !isActive}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                      isActive ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20" :
                      isDone ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 cursor-pointer hover:shadow-md" :
                      "bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed"
                    )}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.id}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("w-4 md:w-8 h-0.5 mx-0.5 rounded-full transition-colors", isDone ? "bg-cyan-400" : "bg-slate-200 dark:bg-slate-700")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900/60 rounded-[1.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-black/20 p-6 md:p-8 overflow-y-auto custom-scrollbar">
          {step === 1 && <StepCategory 
            value={category} 
            onChange={v => { setCategory(v); setSelectedFields([]); setComputedFields([]); setSorting([]); setConditions([]); }} 
            savedQueries={savedQueries} 
            onLoadQuery={loadQuery}
            onDeleteQuery={async (id) => {
              try {
                await fetch(`/api/smart-query/saved?id=${id}`, { method: "DELETE" });
                toast.success("Query deleted");
                refreshSaved();
              } catch { toast.error("Error deleting"); }
            }}
          />}
          {step === 2 && <StepFields category={category} selected={selectedFields} onChange={setSelectedFields} />}
          {step === 3 && <StepComputed category={category} selectedFields={selectedFields} computed={computedFields} onChange={setComputedFields} />}
          {step === 4 && <StepSorting category={category} selectedFields={selectedFields} computedFields={computedFields} sorting={sorting} onChange={setSorting} />}
          {step === 5 && <StepConditions category={category} selectedFields={selectedFields} conditions={conditions} onChange={setConditions} />}
          {step === 6 && <StepResults category={category} selectedFields={selectedFields} computedFields={computedFields} data={results} count={resultCount} loading={loading} truncated={truncated} />}
          {step === 7 && <StepSaveExport category={category} selectedFields={selectedFields} computedFields={computedFields} sorting={sorting} conditions={conditions} data={results} savedQueries={savedQueries} onLoadQuery={loadQuery} onRefreshSaved={() => refreshSaved()} currentQueryId={currentQueryId} />}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between shrink-0 pt-2">
          <Button variant="outline" onClick={goBack} disabled={step === 1} className="rounded-xl gap-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            Step {step} of {STEPS.length}
          </div>
          {step < 7 ? (
            <Button onClick={goNext} disabled={!canNext()} className="rounded-xl gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all">
              {step === 5 ? <>Execute Query <Zap className="w-4 h-4" /></> : <>Next <ChevronRight className="w-4 h-4" /></>}
            </Button>
          ) : (
            <Button onClick={resetWizard} className="rounded-xl gap-2">
              <Sparkles className="w-4 h-4" /> Start New Query
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
