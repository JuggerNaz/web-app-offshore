"use client";

import { useState } from "react";
import {
  Loader2, Download, Save, FolderOpen, Edit, Trash2, Search, Sparkles, Zap,
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

export function StepResults({ category, selectedFields, computedFields, data, count, loading, truncated, templateName }: {
  category: string; selectedFields: string[]; computedFields: ComputedField[];
  data: Record<string, any>[]; count: number; loading: boolean; truncated: boolean;
  templateName?: string;
}) {
  const [tableSearch, setTableSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [jumpPage, setJumpPage] = useState("");
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

  const effectivePageSize = pageSize === -1 ? (filteredData.length || 1) : pageSize;
  const pagedData = filteredData.slice(page * effectivePageSize, (page + 1) * effectivePageSize);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / effectivePageSize));

  const handleExportQuick = (format: ExportFormat) => {
    const filename = (templateName || `${category}_results_${new Date().toISOString().slice(0, 10)}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    exportQueryResults({
      filename,
      format,
      columns,
      data: filteredData,
    });
    toast.success(`Exported ${filteredData.length.toLocaleString()} records to ${format.toUpperCase()}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Retrieving Data...</p>
          <p className="text-sm text-slate-400 mt-1">Fetching records from database in fast batches</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Query Results</h2>
            {templateName ? (
              <Badge variant="outline" className="gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 px-2.5 py-0.5 text-xs font-semibold rounded-lg">
                <Sparkles className="w-3 h-3 text-violet-500" />
                Template: <span className="font-bold text-slate-900 dark:text-white">{templateName}</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-2.5 py-0.5 text-xs font-semibold rounded-lg">
                <Zap className="w-3 h-3 text-cyan-500" />
                {cat.label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-bold text-cyan-600">{filteredData.length.toLocaleString()}</span> record{filteredData.length !== 1 ? "s" : ""} loaded
            {tableSearch && data.length !== filteredData.length && (
              <span className="text-xs text-slate-400 ml-1.5">(filtered from {data.length.toLocaleString()} total)</span>
            )}
            {truncated && <span className="text-amber-500 ml-2 font-bold">(capped at 50,000 maximum)</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Quick Export Button Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <Button
              size="sm"
              onClick={() => handleExportQuick("xlsx")}
              className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm flex items-center gap-1.5"
              title="Export all records to Excel (.xls/.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportQuick("csv")}
              className="h-8 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white rounded-lg"
              title="Export to CSV"
            >
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportQuick("json")}
              className="h-8 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white rounded-lg"
              title="Export to JSON"
            >
              JSON
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative w-44">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search results..." 
              value={tableSearch} 
              onChange={e => { setTableSearch(e.target.value); setPage(0); }} 
              className="pl-9 rounded-xl text-sm h-9 bg-white dark:bg-slate-900" 
            />
          </div>
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700 w-14">#</th>
                    {columns.map(col => (
                      <th key={col.key} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-cyan-50/40 dark:hover:bg-cyan-900/10 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400 font-mono font-bold">
                        {(page * effectivePageSize + rowIdx + 1).toLocaleString()}
                      </td>
                      {columns.map(col => {
                        const val = row[col.key];
                        const isDateKey = col.key.endsWith("_date") || col.key.endsWith("_at") || ["inst_date", "start_date", "end_date", "disc_date", "inspection_date"].includes(col.key);
                        let formattedVal = val;
                        if (isDateKey && val && typeof val === "string" && val.length >= 10 && !isNaN(Date.parse(val))) {
                          if (val.includes("T")) {
                            const d = new Date(val);
                            const datePart = d.toISOString().split("T")[0];
                            const timePart = d.toTimeString().split(" ")[0].substring(0, 5);
                            formattedVal = timePart !== "00:00" ? `${datePart} ${timePart}` : datePart;
                          }
                        }

                        return (
                          <td key={col.key} className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[220px] truncate whitespace-nowrap text-xs">
                            {formattedVal === null || formattedVal === undefined || formattedVal === "" ? <span className="text-slate-300 dark:text-slate-600 italic">—</span>
                              : typeof formattedVal === "boolean" ? <Badge variant={formattedVal ? "default" : "outline"} className="text-[10px]">{formattedVal ? "Yes" : "No"}</Badge>
                              : typeof formattedVal === "object" ? <span className="text-xs font-mono text-slate-400">{JSON.stringify(formattedVal).substring(0, 50)}...</span>
                              : String(formattedVal)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enhanced Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                Showing <strong className="text-slate-700 dark:text-slate-200">{(page * effectivePageSize + 1).toLocaleString()}</strong>–<strong className="text-slate-700 dark:text-slate-200">{Math.min((page + 1) * effectivePageSize, filteredData.length).toLocaleString()}</strong> of <strong className="text-slate-700 dark:text-slate-200">{filteredData.length.toLocaleString()}</strong> records
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={-1}>All ({filteredData.length.toLocaleString()})</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 px-2 text-xs font-bold" 
                  disabled={page === 0} 
                  onClick={() => setPage(0)}
                  title="First Page"
                >
                  « First
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 px-2.5 text-xs font-bold" 
                  disabled={page === 0} 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                >
                  ‹ Prev
                </Button>
                
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 px-2">
                  Page {page + 1} / {totalPages}
                </span>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 px-2.5 text-xs font-bold" 
                  disabled={page >= totalPages - 1} 
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  Next ›
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 px-2 text-xs font-bold" 
                  disabled={page >= totalPages - 1} 
                  onClick={() => setPage(totalPages - 1)}
                  title="Last Page"
                >
                  Last »
                </Button>

                {/* Jump to page */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = parseInt(jumpPage, 10);
                    if (!isNaN(target) && target >= 1 && target <= totalPages) {
                      setPage(target - 1);
                      setJumpPage("");
                    }
                  }}
                  className="flex items-center gap-1 ml-2"
                >
                  <Input 
                    placeholder="Go to" 
                    value={jumpPage} 
                    onChange={(e) => setJumpPage(e.target.value)}
                    className="h-7 w-14 text-xs font-mono text-center px-1 rounded-lg" 
                  />
                  <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold">
                    Go
                  </Button>
                </form>
              </div>
            )}
          </div>
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
