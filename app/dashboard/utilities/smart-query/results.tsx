"use client";

import { useState } from "react";
import {
  Loader2, Download, Save, FolderOpen, Edit, Trash2, Search, Sparkles,
  FileSpreadsheet, FileText, Braces, Code, ChevronDown, RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { QUERY_CATEGORIES, QUERY_OPERATORS, type ConditionRule, type SortRule, type ComputedField } from "@/utils/smart-query-schema";
import { exportQueryResults, FORMAT_OPTIONS, type ExportFormat } from "@/utils/smart-query-export";
import { toast } from "sonner";

// ─── STEP 6: RESULTS ────────────────────────────────────────────────────────────

export function StepResults({ category, selectedFields, computedFields, data, count, loading, truncated }: {
  category: string; selectedFields: string[]; computedFields: ComputedField[];
  data: Record<string, any>[]; count: number; loading: boolean; truncated: boolean;
}) {
  const [tableSearch, setTableSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const cat = QUERY_CATEGORIES.find(c => c.id === category);
  if (!cat) return null;

  const columns = [
    ...cat.fields.filter(f => selectedFields.includes(f.key)).map(f => ({ key: f.key, label: f.label })),
    ...computedFields.filter(cf => cf.name).map(cf => ({ key: cf.name, label: cf.name })),
  ];

  const filteredData = tableSearch
    ? data.filter(row => columns.some(c => {
        const val = row[c.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(tableSearch.toLowerCase());
      }))
    : data;

  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredData.length / pageSize);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Retrieving Data...</p>
          <p className="text-sm text-slate-400 mt-1">Querying database records</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Query Results</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-bold text-cyan-600">{count.toLocaleString()}</span> record{count !== 1 ? "s" : ""} found
            {truncated && <span className="text-amber-500 ml-2">(showing first 10,000)</span>}
          </p>
        </div>
        <div className="relative w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search results..." value={tableSearch} onChange={e => { setTableSearch(e.target.value); setPage(0); }} className="pl-9 rounded-xl text-sm h-9" />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No records match your criteria</p>
          <p className="text-sm mt-1">Try adjusting your filters or selecting different fields</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-800/80 backdrop-blur">
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700 w-12">#</th>
                    {columns.map(col => (
                      <th key={col.key} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/5 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono">{page * pageSize + rowIdx + 1}</td>
                      {columns.map(col => {
                        const val = row[col.key];
                        return (
                          <td key={col.key} className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate whitespace-nowrap">
                            {val === null || val === undefined ? <span className="text-slate-300 italic">—</span>
                              : typeof val === "boolean" ? <Badge variant={val ? "default" : "outline"} className="text-[10px]">{val ? "Yes" : "No"}</Badge>
                              : typeof val === "object" ? <span className="text-xs font-mono text-slate-400">{JSON.stringify(val).substring(0, 50)}...</span>
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredData.length)} of {filteredData.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-xs text-slate-500 px-2">Page {page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── STEP 7: SAVE & EXPORT ──────────────────────────────────────────────────────

interface SaveExportProps {
  category: string;
  selectedFields: string[];
  computedFields: ComputedField[];
  sorting: SortRule[];
  conditions: ConditionRule[];
  data: Record<string, any>[];
  savedQueries: any[];
  onLoadQuery: (config: any) => void;
  onRefreshSaved: () => void;
  currentQueryId?: string;
}

const FORMAT_ICONS: Record<string, any> = { FileSpreadsheet, FileText, Braces, Code };

export function StepSaveExport(props: SaveExportProps) {
  const { category, selectedFields, computedFields, sorting, conditions, data, savedQueries, onLoadQuery, onRefreshSaved, currentQueryId } = props;
  const [queryName, setQueryName] = useState("");
  const [queryDesc, setQueryDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const cat = QUERY_CATEGORIES.find(c => c.id === category);

  const columns = [
    ...(cat?.fields.filter(f => selectedFields.includes(f.key)).map(f => ({ key: f.key, label: f.label })) || []),
    ...computedFields.filter(cf => cf.name).map(cf => ({ key: cf.name, label: cf.name })),
  ];

  const handleSave = async () => {
    if (!queryName.trim()) { toast.error("Please enter a query name"); return; }
    setSaving(true);
    try {
      const config = { category, selectedFields, computedFields, sorting, conditions };
      const res = await fetch("/api/smart-query/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentQueryId, name: queryName, description: queryDesc, config }),
      });
      if (res.ok) {
        toast.success(currentQueryId ? "Query updated!" : "Query saved!");
        onRefreshSaved();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch { toast.error("Error saving query"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved query?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/smart-query/saved?id=${id}`, { method: "DELETE" });
      toast.success("Query deleted");
      onRefreshSaved();
    } catch { toast.error("Error deleting"); }
    finally { setDeleting(null); }
  };

  const handleExport = () => {
    if (data.length === 0) { toast.error("No data to export"); return; }
    const timestamp = new Date().toISOString().slice(0, 10);
    exportQueryResults({ filename: `smart_query_${category}_${timestamp}`, format: exportFormat, columns, data });
    toast.success(`Exported as ${exportFormat.toUpperCase()}`);
  };

  return (
    <div className="space-y-8">
      {/* Save Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Save className="w-5 h-5 text-cyan-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Save Query Template</h2>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] uppercase text-slate-400 font-bold">Query Name *</Label>
              <Input value={queryName} onChange={e => setQueryName(e.target.value)} placeholder="My inspection query..." className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-slate-400 font-bold">Description</Label>
              <Input value={queryDesc} onChange={e => setQueryDesc(e.target.value)} placeholder="Optional description..." className="rounded-xl mt-1" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : currentQueryId ? "Update Query" : "Save Query"}
          </Button>
        </div>
      </div>

      {/* Saved Queries List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Saved Queries</h2>
          <Badge variant="outline" className="text-[10px]">{savedQueries.length}</Badge>
        </div>
        {savedQueries.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No saved queries yet</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
            {savedQueries.map((sq: any) => (
              <div key={sq.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">{sq.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{sq.description || "No description"} · {new Date(sq.updated_at || sq.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs gap-1" onClick={() => onLoadQuery(sq)}>
                    <RotateCcw className="w-3 h-3" /> Load
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(sq.id)} disabled={deleting === sq.id}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Export Results</h2>
          <Badge variant="outline" className="text-[10px]">{data.length} rows</Badge>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {FORMAT_OPTIONS.map(fmt => (
              <button key={fmt.value} onClick={() => setExportFormat(fmt.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  exportFormat === fmt.value
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                <FileSpreadsheet className={cn("w-5 h-5", exportFormat === fmt.value ? "text-emerald-600" : "text-slate-400")} />
                <span className={cn("text-[10px] font-bold", exportFormat === fmt.value ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500")}>{fmt.label}</span>
              </button>
            ))}
          </div>
          <Button onClick={handleExport} disabled={data.length === 0} className="rounded-xl gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4" /> Export as {FORMAT_OPTIONS.find(f => f.value === exportFormat)?.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
