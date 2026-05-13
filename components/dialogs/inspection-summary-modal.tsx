"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ChevronRight, ChevronDown, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import inspectionTypesData from "@/utils/types/inspection-types.json";
import { cn } from "@/lib/utils";

// Build a code -> name map from the bundled JSON (same source as inspection page)
const inspTypeMap: Record<string, string> = {};
if ((inspectionTypesData as any).inspectionTypes) {
  (inspectionTypesData as any).inspectionTypes.forEach((t: any) => {
    inspTypeMap[t.code] = t.name;
  });
}

function resolveInspTypeName(insp: any): string {
  // Try the joined relation first
  if (insp.inspection_type?.name) return insp.inspection_type.name;
  // Fall back to the bundled JSON map
  if (insp.inspection_type_code && inspTypeMap[insp.inspection_type_code])
    return inspTypeMap[insp.inspection_type_code];
  // Last resort: show the raw code
  return insp.inspection_type_code || "N/A";
}

type InspectionSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspections: any[];
  structureId?: string | number;
};

export function InspectionSummaryModal({
  open,
  onOpenChange,
  inspections,
  structureId,
}: InspectionSummaryModalProps) {
  // Group inspections by jobpack name — mirrors the inspection page grouping
  const grouped = inspections.reduce((acc: Record<string, any[]>, insp: any) => {
    const key = insp.jobpack?.name || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(insp);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-950 border-slate-800 text-slate-200 p-0 rounded-[1.5rem]">
        <DialogHeader className="p-6 border-b border-slate-800">
          <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Inspection Records
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {inspections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <p className="font-black uppercase tracking-widest text-xs">No Records Found</p>
            </div>
          ) : (
            Object.entries(grouped).map(([jobpackName, items]) => (
              <CollapsibleJobPack key={jobpackName} name={jobpackName} items={items as any[]} structureId={structureId} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CollapsibleJobPack({ name, items, structureId }: { name: string; items: any[]; structureId?: string | number }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200"
    >
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 transition-all duration-300",
              isOpen ? "rotate-90 border-blue-500/50 bg-blue-500/10 text-blue-400" : "text-slate-500"
            )}>
              <ChevronRight className="h-4 w-4" />
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300">
              {name}
            </h3>
          </div>
          <span className="text-[10px] font-black text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {items.length} {items.length === 1 ? 'Record' : 'Records'}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-800 bg-slate-950/40 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-950/50 shadow-inner">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Code</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((insp, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-800 last:border-0 hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-4 py-3 text-[11px] font-bold text-slate-400 whitespace-nowrap">
                    {insp.inspection_date
                      ? format(new Date(insp.inspection_date), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[11px] font-black text-white">
                    {resolveInspTypeName(insp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {insp.inspection_type_code || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border",
                      insp.status === "COMPLETED" || insp.status === "DONE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}>
                      {insp.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        const jpId = insp.jobpack?.id || insp.jobpack_id;
                        const jpName = encodeURIComponent(insp.jobpack?.name || `JP-${jpId}`);
                        const sowReport = encodeURIComponent(insp.sow_report_no || '');
                        const mode = insp.rov_job_id ? 'ROV' : 'DIVING';
                        if (jpId && structureId) {
                          const url = `/dashboard/inspection-v2/workspace?jobpack=${jpId}&structure=${structureId}&jpName=${jpName}&sowReport=${sowReport}&compId=${insp.component_id}&recordId=${insp.insp_id}&mode=${mode}`;
                          window.open(url, '_blank');
                        }
                      }}
                      disabled={!(insp.jobpack?.id || insp.jobpack_id) || !structureId}
                      className={cn(
                        "h-7 w-7 inline-flex items-center justify-center rounded-lg transition-colors",
                        (insp.jobpack?.id || insp.jobpack_id) && structureId
                          ? "bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white"
                          : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                      )}
                      title="View Inspection Record"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
