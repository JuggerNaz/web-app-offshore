"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, FileText, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EmptyFindingsProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function EmptyFindingsSection({ jobpackId, structureId, sowId, reportNo }: EmptyFindingsProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [updatingRec, setUpdatingRec] = useState<any>(null);
  const [newFinding, setNewFinding] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
  fetchEmptyFindings();
    }
  }, [sowId, reportNo]);

  const fetchEmptyFindings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("insp_records")
        .select(`
          insp_id,
          component_id,
          inspection_data,
          status,
          inspection_type:inspection_type_id (
            name,
            code
          ),
          component:component_id (
            q_id
          )
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo)
        .eq("status", "COMPLETED"); // Only check completed ones

      if (error) throw error;

      const empty = (data || []).filter(rec => {
        const iData = rec.inspection_data || {};
        // Check multiple possible finding keys
        const findings = iData.findings || iData.finding || iData.observation || iData.component_condition || "";
        return findings.trim() === "";
      });

      setRecords(empty);
    } catch (err) {
      toast.error("Failed to check for empty findings");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!updatingRec || !newFinding.trim()) return;
    
    setIsSaving(true);
    try {
      const iData = updatingRec.inspection_data || {};
      
      // Update both 'findings' and 'component_condition' for consistency
      const { error } = await supabase
        .from("insp_records")
        .update({
          inspection_data: {
            ...iData,
            findings: newFinding,
            component_condition: newFinding
          }
        })
        .eq("insp_id", updatingRec.insp_id);

      if (error) throw error;
      
      toast.success(`Findings updated for record #${updatingRec.insp_id}`);
      setUpdatingRec(null);
      setNewFinding("");
      fetchEmptyFindings();
    } catch (err) {
      toast.error("Failed to update findings");
    } finally {
      setIsSaving(false);
    }
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
              <FileText className="h-5 w-5 text-slate-500" />
              Empty Inspection Findings
            </CardTitle>
            <CardDescription>
              Completed inspection records that are missing descriptive condition findings.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800">
            {records.length} Empty Records
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">All Records Populated</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Every completed inspection has descriptive findings.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Inspection Type</TableHead>
                    <TableHead>Component QID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-xs uppercase">
                          {(Array.isArray(rec.inspection_type) ? rec.inspection_type[0] : rec.inspection_type)?.name || 
                           (Array.isArray(rec.inspection_type) ? rec.inspection_type[0] : rec.inspection_type)?.code || "Unknown"}
                        </span>
                        <span className="text-[10px] text-slate-400">ID: #{rec.insp_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-black text-blue-600">{(rec as any).component?.q_id || rec.component_id || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 font-bold text-[10px] tracking-tight">
                        {rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2 text-blue-600 hover:bg-blue-50 font-bold"
                        onClick={() => {
                          setUpdatingRec(rec);
                          setNewFinding("");
                        }}
                      >
                        <Edit2 className="h-3 w-3" /> Update Finding
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

      <Dialog open={!!updatingRec} onOpenChange={(open) => !open && setUpdatingRec(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-600" />
              Update Inspection Findings
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase font-black text-slate-400">Component</Label>
                  <p className="font-bold text-sm text-blue-600">{(updatingRec as any)?.component?.q_id || updatingRec?.component_id}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-black text-slate-400">Inspection Type</Label>
                  <p className="font-bold text-xs truncate">
                    {(Array.isArray(updatingRec?.inspection_type) ? updatingRec?.inspection_type[0] : updatingRec?.inspection_type)?.name}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="findings" className="text-xs font-bold uppercase text-slate-500">Inspection Findings / Remarks</Label>
              <Textarea
                id="findings"
                placeholder="Enter findings based on visual inspection..."
                className="min-h-[120px] font-medium"
                value={newFinding}
                onChange={(e) => setNewFinding(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 italic">This will update the findings for record #{updatingRec?.insp_id}.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdatingRec(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold" 
              onClick={handleUpdate}
              disabled={isSaving || !newFinding.trim()}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Finding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
