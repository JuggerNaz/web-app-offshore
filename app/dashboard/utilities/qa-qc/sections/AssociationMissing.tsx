"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon, AlertCircle, Share2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ComponentEditDialog } from "@/components/dialogs/component-edit-dialog";

interface AssociationProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function AssociationSection({ jobpackId, structureId, sowId, reportNo }: AssociationProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchMissingAssociations();
  }, [jobpackId, structureId, sowId, reportNo]);

  const fetchMissingAssociations = async () => {
    setLoading(true);
    try {
      // 1. Get components involved in inspection records for this context, specifically secondary components
      const { data: inspRecords, error: inspError } = await supabase
        .from("insp_records")
        .select(`
          insp_id,
          component_id,
          inspection_type:inspection_type_id (
            name,
            code
          ),
          component:component_id (
            id,
            q_id,
            code,
            comp_id,
            metadata
          )
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo);

      if (inspError) throw inspError;

      // Map of component type codes to friendly names
      const typeMap: Record<string, string> = {
        "CL": "Clamp",
        "SW": "Support Weld",
        "WN": "Support Weld",
        "CG": "Conductor Guide",
        "CD": "Conductor Guide",
        "CGF": "Conductor Guide Frame",
        "CF": "Conductor Guide Frame"
      };

      // 2. Filter components that are secondary codes AND missing association
      const missing = (inspRecords || [])
        .filter(rec => {
          const comp = (rec as any).component;
          if (!comp) return false;
          // Only check secondary components
          if (!["CL", "SW", "WN", "CG", "CGF", "CD", "CF"].includes(comp.code)) return false;
          // Check if unlinked
          return !comp.metadata?.associated_comp_id;
        })
        .map(rec => {
          const comp = (rec as any).component;
          const typeData = Array.isArray(rec.inspection_type) ? rec.inspection_type[0] : rec.inspection_type;
          return {
            ...comp,
            inspectionTypeName: typeData?.name || typeData?.code || "Unknown",
            componentTypeName: typeMap[comp.code] || comp.code || "Unknown"
          };
        });

      // Group by component ID to avoid showing the same unlinked component multiple times
      const uniqueMap = new Map();
      missing.forEach(m => {
        if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
      });

      setRecords(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error("Association Error:", err);
      toast.error("Failed to check for component associations");
    } finally {
      setLoading(false);
    }
  };

  const handleFix = (rec: any) => {
    setSelectedRecord(rec);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-500" />
              Missing Component Association
            </CardTitle>
            <CardDescription>
              Secondary components (Clamps, Welds, Guides) involved in current inspections that are not linked to a parent member.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            {records.length} Unlinked
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Full Integrity</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">All secondary components are correctly associated.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Inspection Type</TableHead>
                    <TableHead>Component QID</TableHead>
                    <TableHead>Component Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-xs uppercase">{rec.inspectionTypeName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-black text-blue-600">{rec.q_id || rec.comp_id}</span>
                        <span className="text-[10px] text-slate-500 italic">{rec.metadata?.description || "No description"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800 font-bold text-[10px] uppercase">
                        {rec.componentTypeName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold"
                        onClick={() => handleFix(rec)}
                      >
                        <LinkIcon className="h-3 w-3" /> Link Parent
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        )}
      </CardContent>

      <ComponentEditDialog
        component={selectedRecord}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            fetchMissingAssociations();
          }
        }}
        defaultTab="specifications2"
      />
    </Card>
  );
}
