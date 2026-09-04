"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  MoreVertical,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ComponentIntegrityItem = {
  id: number;
  comp_id?: number;
  structure_id?: number;
  q_id: string;
  id_no: string;
  code: string | null;
  metadata?: any;
  s_node?: any;
  f_node?: any;
  s_leg?: any;
  f_leg?: any;
  elv_1?: any;
  elv_2?: any;
  kp?: any;
  fp_kp?: any;
  start_kp?: any;
  end_kp?: any;
  is_deleted?: boolean | null;
  [key: string]: any;
};

export type MissingFieldInfo = {
  key: "start_node" | "end_node" | "start_leg" | "end_leg" | "elv_1" | "elv_2" | "kp_fp";
  label: string;
  category: "nodes" | "legs" | "elevations" | "location";
};

export function getMissingIntegrityFields(
  comp: ComponentIntegrityItem,
  isPipeline?: boolean
): MissingFieldInfo[] {
  const meta = comp.metadata || {};
  const missing: MissingFieldInfo[] = [];

  const isEmpty = (val: any) =>
    val === undefined || val === null || String(val).trim() === "";

  if (isPipeline) {
    // For Pipeline structure type:
    // Pipeline components do NOT have Start/End Node, Elevation 1/2, or Start/End Leg.
    // Instead, audit for missing KP / FP location data.
    const code = String(comp.code || "").toUpperCase();
    if (code === "PP") {
      const startKp = meta.start_kp ?? meta.kp_start ?? meta.s_kp ?? comp.start_kp;
      const endKp = meta.end_kp ?? meta.kp_end ?? meta.f_kp ?? comp.end_kp;
      if (isEmpty(startKp) && isEmpty(endKp)) {
        const kp = meta.kp ?? meta.fp_kp ?? meta.fp ?? comp.kp;
        if (isEmpty(kp)) {
          missing.push({ key: "kp_fp", label: "KP / FP Location", category: "location" });
        }
      }
    } else {
      const kp = meta.kp ?? meta.fp_kp ?? meta.fp ?? meta.start_kp ?? comp.kp ?? comp.fp_kp;
      if (isEmpty(kp)) {
        missing.push({ key: "kp_fp", label: "KP / FP Location", category: "location" });
      }
    }
    return missing;
  }

  // Standard Platform structure audit
  const sNode = meta.s_node ?? meta.start_node ?? comp.s_node;
  if (isEmpty(sNode)) {
    missing.push({ key: "start_node", label: "Start Node", category: "nodes" });
  }

  const fNode = meta.f_node ?? meta.end_node ?? comp.f_node;
  if (isEmpty(fNode)) {
    missing.push({ key: "end_node", label: "End Node", category: "nodes" });
  }

  const sLeg = meta.s_leg ?? meta.start_leg ?? comp.s_leg;
  if (isEmpty(sLeg)) {
    missing.push({ key: "start_leg", label: "Start Leg", category: "legs" });
  }

  const fLeg = meta.f_leg ?? meta.end_leg ?? comp.f_leg;
  if (isEmpty(fLeg)) {
    missing.push({ key: "end_leg", label: "End Leg", category: "legs" });
  }

  const elv1 = meta.elv_1 ?? meta.elevation_1 ?? comp.elv_1;
  if (isEmpty(elv1)) {
    missing.push({ key: "elv_1", label: "Elevation 1", category: "elevations" });
  }

  const elv2 = meta.elv_2 ?? meta.elevation_2 ?? comp.elv_2;
  if (isEmpty(elv2)) {
    missing.push({ key: "elv_2", label: "Elevation 2", category: "elevations" });
  }

  return missing;
}

interface ComponentIntegrityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: ComponentIntegrityItem[];
  isPipeline?: boolean;
  structureType?: string;
  onEditComponent?: (component: ComponentIntegrityItem) => void;
  onDuplicateComponent?: (component: ComponentIntegrityItem) => void;
  onArchiveComponent?: (component: ComponentIntegrityItem) => void;
}

export function ComponentIntegrityModal({
  open,
  onOpenChange,
  components,
  isPipeline = false,
  structureType,
  onEditComponent,
  onDuplicateComponent,
  onArchiveComponent,
}: ComponentIntegrityModalProps) {
  const isPipe = isPipeline || structureType?.toLowerCase() === "pipeline";
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"ALL" | "nodes" | "legs" | "elevations" | "location">("ALL");

  // Calculate audit results for all components
  const auditResults = useMemo(() => {
    return (components || []).map((comp) => {
      const missing = getMissingIntegrityFields(comp, isPipe);
      return {
        component: comp,
        missing,
        hasMissing: missing.length > 0,
      };
    });
  }, [components, isPipe]);

  const incompleteComponents = useMemo(() => {
    return auditResults.filter((res) => res.hasMissing);
  }, [auditResults]);

  // Filter based on search query and category
  const filteredList = useMemo(() => {
    return incompleteComponents.filter((item) => {
      const qId = item.component.q_id || "";
      const idNo = item.component.id_no || "";
      const code = item.component.code || "";

      const matchesSearch =
        qId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeCategory === "ALL") return true;

      return item.missing.some((m) => m.category === activeCategory);
    });
  }, [incompleteComponents, searchQuery, activeCategory]);

  // Category counts
  const nodesMissingCount = useMemo(
    () => incompleteComponents.filter((i) => i.missing.some((m) => m.category === "nodes")).length,
    [incompleteComponents]
  );
  const legsMissingCount = useMemo(
    () => incompleteComponents.filter((i) => i.missing.some((m) => m.category === "legs")).length,
    [incompleteComponents]
  );
  const elevationsMissingCount = useMemo(
    () => incompleteComponents.filter((i) => i.missing.some((m) => m.category === "elevations")).length,
    [incompleteComponents]
  );
  const locationMissingCount = useMemo(
    () => incompleteComponents.filter((i) => i.missing.some((m) => m.category === "location")).length,
    [incompleteComponents]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-950 border-slate-800 text-slate-200 p-0 rounded-[1.5rem] shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                Component Integrity
                {isPipe && (
                  <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-full uppercase">
                    Pipeline Mode
                  </span>
                )}
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {isPipe
                  ? "Review pipeline components missing required KP / FP location data"
                  : "Review components missing required nodes, legs, or elevation data"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 w-fit">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Issue Count:
            </span>
            <span
              className={cn(
                "text-xs font-black px-2 py-0.5 rounded-md",
                incompleteComponents.length > 0
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              )}
            >
              {incompleteComponents.length} / {components.length}
            </span>
          </div>
        </DialogHeader>

        {/* Filter Bar & Search */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 group max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input
              placeholder="Search incomplete components by Q ID or System ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveCategory("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeCategory === "ALL"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              All ({incompleteComponents.length})
            </button>

            {isPipe ? (
              <button
                onClick={() => setActiveCategory("location")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  activeCategory === "location"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                )}
              >
                KP / FP ({locationMissingCount})
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveCategory("nodes")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                    activeCategory === "nodes"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  )}
                >
                  Nodes ({nodesMissingCount})
                </button>
                <button
                  onClick={() => setActiveCategory("legs")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                    activeCategory === "legs"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  )}
                >
                  Legs ({legsMissingCount})
                </button>
                <button
                  onClick={() => setActiveCategory("elevations")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                    activeCategory === "elevations"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  )}
                >
                  Elevations ({elevationsMissingCount})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {incompleteComponents.length === 0 ? (
                <>
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    100% Component Integrity Verified
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    {isPipe
                      ? "All pipeline components have complete and valid KP / FP location data registered."
                      : "All components have complete Start Node, End Node, Start Leg, End Leg, Elevation 1, and Elevation 2 values."}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-10 w-10 text-slate-600 mb-2" />
                  <p className="font-black text-slate-400 uppercase tracking-widest text-xs">
                    No Matching Incomplete Components
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    Try clearing search query or changing active filter.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Q ID
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      System ID No
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Type
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Missing Fields
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredList.map(({ component: comp, missing }) => (
                    <tr
                      key={comp.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-4 py-3 align-middle font-black text-sm text-white">
                        {comp.q_id}
                      </td>
                      <td className="px-4 py-3 align-middle font-mono text-xs text-slate-400 font-bold">
                        {comp.id_no}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {comp.code || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          {missing.map((f) => (
                            <span
                              key={f.key}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                f.category === "location" &&
                                  "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
                                f.category === "nodes" &&
                                  "bg-amber-500/10 text-amber-400 border-amber-500/30",
                                f.category === "legs" &&
                                  "bg-orange-500/10 text-orange-400 border-orange-500/30",
                                f.category === "elevations" &&
                                  "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              )}
                            >
                              {f.category === "location" ? (
                                <Compass className="h-3 w-3 shrink-0 text-cyan-400" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                              )}
                              {f.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px] rounded-[1.2rem] p-2 shadow-2xl bg-slate-900 border-slate-800 text-slate-200">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">
                              Management
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem
                              className="rounded-lg py-2.5 font-bold cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditComponent?.(comp);
                              }}
                            >
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-lg py-2.5 font-bold cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateComponent?.(comp);
                              }}
                            >
                              Duplicate Data
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={cn(
                                "rounded-lg py-2.5 font-bold cursor-pointer transition-colors focus:bg-slate-800",
                                comp.is_deleted ? "text-blue-400 focus:text-blue-400" : "text-red-400 focus:text-red-400"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchiveComponent?.(comp);
                              }}
                            >
                              {comp.is_deleted ? "Restore Records" : "Archive Records"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

