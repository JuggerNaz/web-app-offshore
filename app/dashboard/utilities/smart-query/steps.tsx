"use client";

import { useState, useEffect } from "react";
import {
  Building2, Puzzle, Package, ClipboardList, ClipboardCheck,
  AlertTriangle, Search, Clock, ChevronUp, ChevronDown, Plus, Trash2, Sparkles, GripVertical, ListFilter, Loader2,
  ArrowUp, ArrowDown, ArrowUpDown, Check, X, ArrowLeftRight, CheckCheck, ListOrdered, MoveRight, MoveLeft,
  ChevronsUpDown, SlidersHorizontal, RefreshCw, Eye, EyeOff, LayoutGrid, Columns, ArrowDownAZ, RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  QUERY_CATEGORIES, COMPUTED_OPERATIONS, QUERY_OPERATORS,
  getOperatorsForType, getOperationsForType, parseNaturalLanguage,
  type CategoryDef, type FieldDef, type ComputedField, type SortRule, type ConditionRule,
} from "@/utils/smart-query-schema";

const ICON_MAP: Record<string, any> = {
  Building2, Puzzle, Package, ClipboardList, ClipboardCheck, AlertTriangle, Search, Clock,
};

// ─── STEP 1: CATEGORY ──────────────────────────────────────────────────────────

export function StepCategory({ 
  value, 
  onChange,
  savedQueries = [],
  onLoadQuery,
  onDeleteQuery
}: { 
  value: string; 
  onChange: (v: string) => void;
  savedQueries?: any[];
  onLoadQuery?: (sq: any) => void;
  onDeleteQuery?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDeleteQuery || !confirm("Delete this saved query?")) return;
    setDeleting(id);
    await onDeleteQuery(id);
    setDeleting(null);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Select Data Category</h2>
          <p className="text-sm text-slate-500 mt-1">Choose the type of data you want to query to start from scratch</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUERY_CATEGORIES.map(cat => {
            const Icon = ICON_MAP[cat.icon] || Building2;
            const selected = value === cat.id;
            return (
              <button key={cat.id} onClick={() => onChange(cat.id)}
                className={cn(
                  "group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 text-center",
                  selected
                    ? "border-cyan-500 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 shadow-lg shadow-cyan-500/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md bg-white dark:bg-slate-900/50"
                )}>
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                  selected
                    ? "bg-gradient-to-br from-cyan-500 to-violet-500 text-white shadow-lg"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className={cn("font-bold text-sm", selected ? "text-cyan-600 dark:text-cyan-400" : "text-slate-700 dark:text-slate-300")}>{cat.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{cat.description}</p>
                </div>
                {selected && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Access to Saved Queries */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-500">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Or load a Saved Query</h2>
            <p className="text-xs text-slate-500">Resume from your saved templates</p>
          </div>
        </div>
        
        {savedQueries.length === 0 ? (
          <div className="p-6 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/20">
            <p className="text-sm text-slate-400 font-medium">No saved queries found</p>
            <p className="text-xs text-slate-500 mt-1">Create a query and save it on Step 7 to access it here later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedQueries.map((sq: any) => (
              <div key={sq.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300 truncate">{sq.name}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{sq.description || "No description provided"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[9px] text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20">{sq.config?.category}</Badge>
                    <span className="text-[10px] text-slate-400">{new Date(sq.updated_at || sq.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button variant="default" size="sm" className="rounded-lg h-8 text-xs gap-1 bg-violet-600 hover:bg-violet-700" onClick={() => onLoadQuery?.(sq)}>
                    Load Query
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-600 px-2" onClick={() => handleDelete(sq.id)} disabled={deleting === sq.id}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STEP 2: FIELDS WITH DRAG-AND-DROP REORDERING & ENHANCED GUI ───────────────

export function StepFields({ category, selected, onChange }: { category: string; selected: string[]; onChange: (v: string[]) => void }) {
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"dual" | "grid">("dual");
  const [draggedItem, setDraggedItem] = useState<{ key: string; source: "available" | "selected"; index?: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isOverSelectedPanel, setIsOverSelectedPanel] = useState(false);

  const cat = QUERY_CATEGORIES.find(c => c.id === category);
  if (!cat) return null;

  // Split into available & selected definitions
  const fieldMap = new Map(cat.fields.map(f => [f.key, f]));
  const selectedFieldDefs = selected.map(k => fieldMap.get(k)).filter(Boolean) as FieldDef[];

  // Filter available fields
  const availableFields = cat.fields.filter(f => {
    const matchesSearch = f.label.toLowerCase().includes(searchAvailable.toLowerCase()) || 
                          f.key.toLowerCase().includes(searchAvailable.toLowerCase());
    const matchesType = typeFilter === "all" || f.dataType === typeFilter;
    return matchesSearch && matchesType;
  });

  // Filter selected fields for search in right panel
  const displayedSelectedDefs = selectedFieldDefs.filter(f => 
    !searchSelected || 
    f.label.toLowerCase().includes(searchSelected.toLowerCase()) || 
    f.key.toLowerCase().includes(searchSelected.toLowerCase())
  );

  const toggleField = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const addField = (key: string, targetIndex?: number) => {
    if (selected.includes(key)) return;
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= selected.length) {
      const next = [...selected];
      next.splice(targetIndex, 0, key);
      onChange(next);
    } else {
      onChange([...selected, key]);
    }
  };

  const removeField = (key: string) => {
    onChange(selected.filter(k => k !== key));
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= selected.length) return;
    const next = [...selected];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  const moveToTop = (index: number) => {
    moveField(index, 0);
  };

  const moveToBottom = (index: number) => {
    moveField(index, selected.length - 1);
  };

  const selectAll = () => {
    onChange(cat.fields.map(f => f.key));
  };

  const selectMatching = () => {
    const newKeys = availableFields.map(f => f.key).filter(k => !selected.includes(k));
    onChange([...selected, ...newKeys]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const sortAlphabetical = () => {
    const sorted = [...selected].sort((a, b) => {
      const labelA = fieldMap.get(a)?.label || a;
      const labelB = fieldMap.get(b)?.label || b;
      return labelA.localeCompare(labelB);
    });
    onChange(sorted);
  };

  const resetToDefaultOrder = () => {
    const originalOrder = cat.fields.map(f => f.key).filter(k => selected.includes(k));
    onChange(originalOrder);
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, key: string, source: "available" | "selected", index?: number) => {
    setDraggedItem({ key, source, index });
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDropOnItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.source === "selected" && draggedItem.index !== undefined) {
      moveField(draggedItem.index, targetIndex);
    } else if (draggedItem.source === "available") {
      if (!selected.includes(draggedItem.key)) {
        addField(draggedItem.key, targetIndex);
      } else {
        const currentIndex = selected.indexOf(draggedItem.key);
        moveField(currentIndex, targetIndex);
      }
    }
    setDraggedItem(null);
    setDragOverIndex(null);
    setIsOverSelectedPanel(false);
  };

  const handleDropOnPanel = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.source === "available" && !selected.includes(draggedItem.key)) {
      addField(draggedItem.key);
    }
    setDraggedItem(null);
    setDragOverIndex(null);
    setIsOverSelectedPanel(false);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
    setIsOverSelectedPanel(false);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "number": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "date": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "boolean": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-sky-500/10 text-sky-500 border-sky-500/20";
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Mode Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ListOrdered className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black text-white">Select & Arrange Columns</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Drag fields to reorder how columns appear in your query results & Excel exports.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-slate-400">Selected:</span>
            <span className="font-mono font-bold text-cyan-400">{selected.length}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 font-mono">{cat.fields.length}</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-xl bg-slate-800/90 p-1 border border-slate-700">
            <button
              onClick={() => setViewMode("dual")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                viewMode === "dual"
                  ? "bg-cyan-500 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              Studio Order View
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                viewMode === "grid"
                  ? "bg-cyan-500 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid View
            </button>
          </div>
        </div>
      </div>

      {viewMode === "dual" ? (
        /* ════════════════════ DUAL-PANEL STUDIO VIEW (DRAG & DROP) ════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ◄ LEFT PANEL: AVAILABLE FIELDS POOL (5 COLS) */}
          <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 space-y-3.5 flex flex-col h-[560px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">Available Pool</span>
                <Badge variant="outline" className="text-[10px] font-mono text-slate-400 bg-slate-800/50">
                  {cat.fields.length - selected.length} unselected
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2"
                  onClick={selectAll}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add All
                </Button>
                {searchAvailable && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs text-slate-400 hover:text-white px-2"
                    onClick={selectMatching}
                  >
                    Add Matching
                  </Button>
                )}
              </div>
            </div>

            {/* Search & Type Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter available fields..."
                  value={searchAvailable}
                  onChange={e => setSearchAvailable(e.target.value)}
                  className="pl-8 text-xs h-8 rounded-xl bg-slate-950/70 border-slate-800 text-slate-200 placeholder:text-slate-500"
                />
                {searchAvailable && (
                  <button 
                    onClick={() => setSearchAvailable("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
                {["all", "text", "number", "date", "boolean"].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium capitalize shrink-0 transition-colors",
                      typeFilter === t
                        ? "bg-slate-700 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    )}
                  >
                    {t === "all" ? "All Types" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Fields List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              {availableFields.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Search className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">No fields match your search filter</p>
                </div>
              ) : (
                availableFields.map(field => {
                  const isSelected = selected.includes(field.key);
                  const selectedIndex = selected.indexOf(field.key);

                  return (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field.key, "available")}
                      onDragEnd={handleDragEnd}
                      onClick={() => toggleField(field.key)}
                      className={cn(
                        "group relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-cyan-500/30 bg-cyan-950/20 text-cyan-200 opacity-60 hover:opacity-100"
                          : "border-slate-800/90 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-850 text-slate-300 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 cursor-grab active:cursor-grabbing" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate group-hover:text-white transition-colors">
                            {field.label}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{field.key}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase font-mono font-bold", getTypeBadgeColor(field.dataType))}>
                          {field.dataType}
                        </Badge>
                        {isSelected ? (
                          <div className="flex items-center gap-1 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3" />
                            <span>#{selectedIndex + 1}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addField(field.key);
                            }}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-white flex items-center justify-center text-slate-400 transition-colors"
                            title="Add to column sequence"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ► RIGHT PANEL: SELECTED & ORDERED FIELDS SEQUENCE (7 COLS) */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              setIsOverSelectedPanel(true);
            }}
            onDragLeave={() => setIsOverSelectedPanel(false)}
            onDrop={handleDropOnPanel}
            className={cn(
              "lg:col-span-6 bg-slate-900/80 rounded-2xl border p-4 space-y-3.5 flex flex-col h-[560px] transition-all",
              isOverSelectedPanel ? "border-cyan-500 ring-2 ring-cyan-500/20 bg-slate-900/90" : "border-slate-800/90"
            )}
          >
            {/* Header with quick sequence tools */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400">Column Output Order</span>
                <Badge className="bg-cyan-500 text-white font-mono text-[10px] font-bold">
                  {selected.length} columns
                </Badge>
              </div>
              
              {/* Preset actions */}
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-slate-400 hover:text-white px-2"
                  onClick={sortAlphabetical}
                  title="Sort selected columns A to Z"
                  disabled={selected.length <= 1}
                >
                  <ArrowDownAZ className="w-3 h-3 mr-1" /> A-Z
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-slate-400 hover:text-white px-2"
                  onClick={resetToDefaultOrder}
                  title="Reset to category schema order"
                  disabled={selected.length <= 1}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                  onClick={clearAll}
                  disabled={selected.length === 0}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            </div>

            {/* Selected Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter selected order list..."
                value={searchSelected}
                onChange={e => setSearchSelected(e.target.value)}
                className="pl-8 text-xs h-8 rounded-xl bg-slate-950/70 border-slate-800 text-slate-200 placeholder:text-slate-500"
              />
              {searchSelected && (
                <button 
                  onClick={() => setSearchSelected("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Draggable Ordered List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              {selected.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                    <ListOrdered className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">No Columns Selected</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                    Click or drag fields from the left to build your table column order.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-4 rounded-xl text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={selectAll}
                  >
                    Select All Recommended
                  </Button>
                </div>
              ) : (
                displayedSelectedDefs.map((field, idx) => {
                  const actualIndex = selected.indexOf(field.key);
                  const isBeingDragged = draggedItem?.key === field.key;
                  const isDropTarget = dragOverIndex === actualIndex;

                  return (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field.key, "selected", actualIndex)}
                      onDragOver={(e) => handleDragOverItem(e, actualIndex)}
                      onDrop={(e) => handleDropOnItem(e, actualIndex)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative flex items-center justify-between p-2.5 rounded-xl border transition-all select-none bg-slate-950/70",
                        isDropTarget && "border-cyan-400 ring-2 ring-cyan-400/30 scale-[1.01] bg-cyan-950/30",
                        isBeingDragged && "opacity-40 border-dashed border-cyan-500",
                        !isDropTarget && !isBeingDragged && "border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      )}
                    >
                      {/* Drag Handle & Order Badge */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div 
                          className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-cyan-400 rounded transition-colors"
                          title="Drag to reorder column position"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Position Number */}
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {actualIndex + 1}
                        </div>

                        {/* Title & Key */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                            {field.label}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{field.key}</p>
                        </div>
                      </div>

                      {/* Controls (Move Up/Down, DataType, Delete) */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase font-mono font-bold hidden sm:inline-flex", getTypeBadgeColor(field.dataType))}>
                          {field.dataType}
                        </Badge>

                        {/* Move Up */}
                        <button
                          onClick={() => moveField(actualIndex, actualIndex - 1)}
                          disabled={actualIndex === 0}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Move column left / up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          onClick={() => moveField(actualIndex, actualIndex + 1)}
                          disabled={actualIndex === selected.length - 1}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Move column right / down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeField(field.key)}
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
                          title="Remove from query"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════ GRID SELECTOR VIEW ════════════════════ */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search fields by name or database key..."
                value={searchAvailable}
                onChange={e => setSearchAvailable(e.target.value)}
                className="pl-9 rounded-xl bg-slate-900 border-slate-800 text-slate-200"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-700" onClick={selectAll}>Select All</Button>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-700" onClick={clearAll}>Clear</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-2">
            {cat.fields
              .filter(f => !searchAvailable || f.label.toLowerCase().includes(searchAvailable.toLowerCase()) || f.key.toLowerCase().includes(searchAvailable.toLowerCase()))
              .map(field => {
                const isSelected = selected.includes(field.key);
                const orderIndex = selected.indexOf(field.key);
                return (
                  <div
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer",
                      isSelected
                        ? "border-cyan-500/50 bg-cyan-950/30 text-white shadow-sm shadow-cyan-500/10"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-850 text-slate-300"
                    )}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold truncate", isSelected ? "text-cyan-300" : "text-slate-300")}>
                        {field.label}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{field.key}</p>
                    </div>
                    {isSelected && (
                      <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] font-mono shrink-0">
                        #{orderIndex + 1}
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn("text-[9px] shrink-0 uppercase font-mono", getTypeBadgeColor(field.dataType))}>
                      {field.dataType}
                    </Badge>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Helper Footer Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
        <p>
          💡 Tip: Drag and drop items in <span className="text-cyan-400 font-semibold">Column Output Order</span> or use <span className="text-slate-300 font-semibold">↑ / ↓</span> to customize your table layout.
        </p>
        <span className="font-mono font-bold text-slate-400">
          {selected.length} columns active
        </span>
      </div>
    </div>
  );
}

// ─── STEP 3: COMPUTED FIELDS ────────────────────────────────────────────────────

export function StepComputed({ category, selectedFields, computed, onChange }: {
  category: string; selectedFields: string[]; computed: ComputedField[]; onChange: (v: ComputedField[]) => void;
}) {
  const cat = QUERY_CATEGORIES.find(c => c.id === category);
  if (!cat) return null;
  const availFields = cat.fields.filter(f => selectedFields.includes(f.key));

  const addComputed = () => {
    onChange([...computed, { name: "", sourceField: "", operation: "", params: {} }]);
  };

  const update = (idx: number, patch: Partial<ComputedField>) => {
    const next = [...computed];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => onChange(computed.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Calculated Fields</h2>
          <p className="text-sm text-slate-500 mt-1">Add computed columns (optional)</p>
        </div>
        <Button onClick={addComputed} size="sm" className="rounded-xl gap-1 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      {computed.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No calculated fields. Click "Add" or skip to next step.</p>
        </div>
      )}
      <div className="space-y-3">
        {computed.map((cf, idx) => {
          const srcField = cat.fields.find(f => f.key === cf.sourceField);
          const ops = srcField ? getOperationsForType(srcField.dataType) : COMPUTED_OPERATIONS;
          const selectedOp = COMPUTED_OPERATIONS.find(o => o.id === cf.operation);

          return (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                <Input placeholder="Field name (alias)" value={cf.name} onChange={e => update(idx, { name: e.target.value })} className="rounded-lg text-sm flex-1" />
                <Button variant="ghost" size="icon" className="shrink-0 text-red-400 hover:text-red-600" onClick={() => remove(idx)}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase text-slate-400">Source Field</Label>
                  <select value={cf.sourceField} onChange={e => update(idx, { sourceField: e.target.value, operation: "", params: {} })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                    <option value="">Select field...</option>
                    {availFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-slate-400">Operation</Label>
                  <select value={cf.operation} onChange={e => update(idx, { operation: e.target.value, params: {} })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                    <option value="">Select operation...</option>
                    {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {selectedOp && selectedOp.params.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedOp.params.map(p => (
                    <div key={p.name}>
                      <Label className="text-[10px] uppercase text-slate-400">{p.label}</Label>
                      <Input type={p.type === "number" ? "number" : "text"}
                        value={cf.params[p.name] ?? ""} onChange={e => update(idx, { params: { ...cf.params, [p.name]: p.type === "number" ? Number(e.target.value) : e.target.value } })}
                        className="rounded-lg text-sm mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── STEP 4: SORTING ────────────────────────────────────────────────────────────

export function StepSorting({ category, selectedFields, computedFields, sorting, onChange }: {
  category: string; selectedFields: string[]; computedFields: ComputedField[]; sorting: SortRule[]; onChange: (v: SortRule[]) => void;
}) {
  const cat = QUERY_CATEGORIES.find(c => c.id === category);
  if (!cat) return null;
  const allFields = [
    ...cat.fields.filter(f => selectedFields.includes(f.key)).map(f => ({ key: f.key, label: f.label })),
    ...computedFields.filter(cf => cf.name).map(cf => ({ key: cf.name, label: cf.name })),
  ];

  const add = () => onChange([...sorting, { field: "", direction: "asc" }]);
  const update = (idx: number, patch: Partial<SortRule>) => {
    const next = [...sorting];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => onChange(sorting.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...sorting];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Sort Order</h2>
          <p className="text-sm text-slate-500 mt-1">Define how results should be ordered (optional)</p>
        </div>
        <Button onClick={add} size="sm" className="rounded-xl gap-1 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0">
          <Plus className="w-4 h-4" /> Add Sort
        </Button>
      </div>
      {sorting.length === 0 && (
        <div className="text-center py-12 text-slate-400"><p className="text-sm">No sorting rules. Results will be in default order.</p></div>
      )}
      <div className="space-y-2">
        {sorting.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <Badge variant="outline" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-[10px]">{idx + 1}</Badge>
            <select value={s.field} onChange={e => update(idx, { field: e.target.value })}
              className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
              <option value="">Select field...</option>
              {allFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <Button variant={s.direction === "asc" ? "default" : "outline"} size="sm" className="rounded-lg text-xs gap-1" onClick={() => update(idx, { direction: s.direction === "asc" ? "desc" : "asc" })}>
              {s.direction === "asc" ? <><ChevronUp className="w-3 h-3" /> ASC</> : <><ChevronDown className="w-3 h-3" /> DESC</>}
            </Button>
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" disabled={idx === 0}><ChevronUp className="w-3 h-3" /></button>
              <button onClick={() => move(idx, 1)} className="text-slate-400 hover:text-slate-600 disabled:opacity-30" disabled={idx === sorting.length - 1}><ChevronDown className="w-3 h-3" /></button>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 text-red-400 hover:text-red-600 h-8 w-8" onClick={() => remove(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VALUE SUGGESTER ─────────────────────────────────────────────────────────

function ValueSuggester({ category, field, onSelect }: { category: string, field: string, onSelect: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setValues([]);
    setSearch("");
  }, [category, field]);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && field) {
      setLoading(true);
      try {
        const res = await fetch(`/api/smart-query/values?category=${category}&field=${field}`);
        const data = await res.json();
        if (data.values) setValues(data.values);
      } catch (e) {
         toast.error("Failed to fetch suggestions");
      } finally {
        setLoading(false);
      }
    }
  };

  const filtered = values.filter(v => String(v).toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0 text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20" title="Suggest Values">
          <ListFilter className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 rounded-xl shadow-xl overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" align="start">
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
           <Input 
             placeholder="Search values..." 
             className="h-8 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" 
             value={search} onChange={e => setSearch(e.target.value)} 
           />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1.5 custom-scrollbar">
          {loading ? (
             <div className="py-8 flex flex-col items-center justify-center gap-2">
               <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
               <span className="text-xs text-slate-400">Loading suggestions...</span>
             </div>
          ) : filtered.length === 0 ? (
             <div className="py-6 text-center text-xs text-slate-400">No matching values found</div>
          ) : (
             filtered.map((val, i) => (
               <button key={i} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg truncate transition-colors text-slate-700 dark:text-slate-300 font-medium"
                 onClick={() => { onSelect(String(val)); setOpen(false); }}>
                 {val === "" ? <span className="text-slate-400 italic">(Empty)</span> : String(val)}
               </button>
             ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── STEP 5: CONDITIONS ─────────────────────────────────────────────────────────

export function StepConditions({ category, selectedFields, conditions, onChange }: {
  category: string; selectedFields: string[]; conditions: ConditionRule[]; onChange: (v: ConditionRule[]) => void;
}) {
  const [nlInput, setNlInput] = useState("");
  const [mode, setMode] = useState<"visual" | "ai">("visual");
  const cat = QUERY_CATEGORIES.find(c => c.id === category);
  if (!cat) return null;
  const availFields = cat.fields;

  const add = () => onChange([...conditions, { field: "", operator: "eq", value: "", logic: "AND" }]);
  const update = (idx: number, patch: Partial<ConditionRule>) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => onChange(conditions.filter((_, i) => i !== idx));

  const parseNL = () => {
    if (!nlInput.trim()) return;
    const parsed = parseNaturalLanguage(nlInput, availFields);
    if (parsed.length > 0) {
      onChange([...conditions, ...parsed]);
      setNlInput("");
      toast.success(`Added ${parsed.length} condition(s)`);
    } else {
      toast.error("Could not understand filter. Please try rephrasing (e.g. 'status is completed'). Make sure you mention a selected field.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Filter Conditions</h2>
        <p className="text-sm text-slate-500 mt-1">Define criteria to filter your data (optional)</p>
      </div>
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button onClick={() => setMode("visual")} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", mode === "visual" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500")}>Visual Builder</button>
        <button onClick={() => setMode("ai")} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", mode === "ai" ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-sm" : "text-slate-500")}>
          <Sparkles className="w-3 h-3" /> AI Natural Language
        </button>
      </div>

      {mode === "ai" && (
        <div className="space-y-3 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
          <Label className="text-xs font-bold text-violet-600 dark:text-violet-400">Describe your filter in plain English</Label>
          <textarea value={nlInput} onChange={e => setNlInput(e.target.value)}
            placeholder='e.g. "status is completed and priority equals P1"'
            className="w-full h-20 rounded-xl border border-violet-200 dark:border-violet-700 bg-white dark:bg-slate-900 p-3 text-sm resize-none focus:ring-2 focus:ring-violet-500/20 outline-none" />
          <Button onClick={parseNL} size="sm" className="rounded-xl gap-1 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0">
            <Sparkles className="w-3 h-3" /> Parse & Add Conditions
          </Button>
        </div>
      )}

      <div className="space-y-2">
          {conditions.map((cond, idx) => {
            const fieldDef = cat.fields.find(f => f.key === cond.field);
            const operators = fieldDef ? getOperatorsForType(fieldDef.dataType) : QUERY_OPERATORS;
            const opDef = QUERY_OPERATORS.find(o => o.id === cond.operator);
            return (
              <div key={idx} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                {idx > 0 && (
                  <select value={cond.logic || "AND"} onChange={e => update(idx, { logic: e.target.value as "AND" | "OR" })}
                    className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs font-bold w-16">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <div className="flex items-center gap-1">
                  <select value={cond.field} onChange={e => update(idx, { field: e.target.value, operator: "eq", value: "", transform: "" })}
                    className="h-9 rounded-l-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm min-w-[140px] border-r-0 focus:ring-0">
                    <option value="">Field...</option>
                    {availFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  {fieldDef && (fieldDef.dataType === 'date' || fieldDef.dataType === 'text') && (
                    <select value={cond.transform || ""} onChange={e => update(idx, { transform: e.target.value })}
                      className="h-9 rounded-r-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-[10px] font-bold uppercase text-violet-600 focus:ring-0 cursor-pointer">
                      <option value="">Normal</option>
                      {fieldDef.dataType === 'date' && <><option value="year">Year</option><option value="month">Month</option></>}
                      {fieldDef.dataType === 'text' && <><option value="uppercase">Upper</option><option value="length">Length</option></>}
                    </select>
                  )}
                </div>
                <select value={cond.operator} onChange={e => update(idx, { operator: e.target.value })}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm min-w-[120px]">
                  {operators.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                {opDef && opDef.requiresValue && (
                  <div className="flex items-center gap-1.5">
                    <Input value={cond.value} onChange={e => update(idx, { value: e.target.value })} placeholder="Value..."
                      type={cond.transform === "year" ? "number" : fieldDef?.dataType === "number" ? "number" : fieldDef?.dataType === "date" ? "date" : "text"}
                      className="h-9 rounded-lg text-sm w-32" />
                    {cond.field && (
                      <ValueSuggester 
                        category={category} 
                        field={cond.field} 
                        onSelect={(val) => update(idx, { value: val })} 
                      />
                    )}
                    {opDef.valueCount === 2 && (
                      <><span className="text-xs text-slate-400">to</span>
                        <Input value={cond.value2 || ""} onChange={e => update(idx, { value2: e.target.value })} placeholder="Value 2..."
                          type={fieldDef?.dataType === "number" ? "number" : "text"} className="h-9 rounded-lg text-sm w-32" /></>
                    )}
                  </div>
                )}
                <Button variant="ghost" size="icon" className="shrink-0 text-red-400 hover:text-red-600 h-8 w-8" onClick={() => remove(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            );
          })}
          <Button onClick={add} variant="outline" size="sm" className="rounded-xl gap-1"><Plus className="w-3 h-3" /> Add Condition</Button>
        </div>
      {conditions.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Active Filters</p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c, i) => {
              const fl = cat.fields.find(f => f.key === c.field);
              const ol = QUERY_OPERATORS.find(o => o.id === c.operator);
              return (
                <Badge key={i} variant="outline" className="text-xs gap-1 py-1 px-2 bg-white dark:bg-slate-900">
                  {i > 0 && <span className="text-violet-500 font-bold">{c.logic}</span>}
                  <span className="font-bold">
                    {fl?.label || c.field}
                    {c.transform && <span className="ml-1 text-[9px] px-1 bg-violet-100 text-violet-600 rounded">{c.transform.toUpperCase()}</span>}
                  </span>
                  <span className="text-cyan-600">{ol?.symbol || c.operator}</span>
                  {c.value && <span className="text-slate-600 dark:text-slate-400 font-mono">{c.value}</span>}
                  {c.value2 && <span className="text-slate-600 dark:text-slate-400">→ {c.value2}</span>}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
