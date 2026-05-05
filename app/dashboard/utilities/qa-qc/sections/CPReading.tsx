"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap, AlertCircle, RefreshCcw, Edit, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CPProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function CPReadingSection({ jobpackId, structureId, sowId, reportNo }: CPProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [fixingRecord, setFixingRecord] = useState<any>(null);
  const [manualCP, setManualCP] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
  fetchCPIssues();
    }
  }, [sowId, reportNo]);

  const fetchCPIssues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("insp_records")
        .select(`
          insp_id,
          component_id,
          inspection_data,
          status,
          description,
          inspection_type:inspection_type_id (
            name,
            code
          ),
          component:component_id (
            q_id,
            id_no
          )
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo);

      if (error) throw error;

      const issues = (data || []).map(rec => {
        const iData = rec.inspection_data || {};
        
        // Comprehensive list of possible CP keys used across different forms/methods
        const cpKeys = ["cp_reading", "cp_rdg", "CP Rdg (mV)", "cp_reading_mv", "cp"];
        let cp = null;
        let activeCpKey = "";
        
        for (const key of cpKeys) {
          if (iData[key] !== undefined && iData[key] !== null && iData[key] !== "") {
            cp = iData[key];
            activeCpKey = key;
            break;
          }
        }

        const findings = iData.findings || 
                        iData.finding || 
                        iData.observation || 
                        iData.component_condition || 
                        rec.description || "";
        
        let type = "";
        // Check for positive value (greater than 0) that should be negative
        if (cp && !cp.toString().startsWith("-") && !isNaN(parseFloat(cp)) && parseFloat(cp) > 0) {
          type = "Missing Negative Sign";
        } else if (!cp && findings.toLowerCase().includes("cp") && rec.status !== "INCOMPLETE") {
          type = "Mentioned in Finding, Field Empty";
        }

        const typeData = Array.isArray(rec.inspection_type) ? rec.inspection_type[0] : rec.inspection_type;
        return type ? { 
          ...rec, 
          issueType: type, 
          cpValue: cp, 
          cpKey: activeCpKey,
          findings,
          inspectionTypeName: typeData?.name || typeData?.code || "Unknown",
          componentQid: (rec as any).component?.q_id || "N/A"
        } : null;
      }).filter(x => x !== null);

      setRecords(issues);
    } catch (err) {
      toast.error("Failed to check for CP reading issues");
    } finally {
      setLoading(false);
    }
  };

  const fixSign = async (rec: any) => {
    setIsUpdating(true);
    try {
      const val = String(rec.cpValue);
      const newVal = val.startsWith("-") ? val : `-${val}`;
      
      const iData = rec.inspection_data || {};
      const cpKey = rec.cpKey || (iData["CP Rdg (mV)"] !== undefined ? "CP Rdg (mV)" : "cp_reading");
      
      const { error } = await supabase
        .from("insp_records")
        .update({
          inspection_data: {
            ...iData,
            [cpKey]: newVal
          }
        })
        .eq("insp_id", rec.insp_id);

      if (error) throw error;
      
      toast.success(`Fixed sign for record #${rec.insp_id}`);
      fetchCPIssues();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update record");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualUpdate = async () => {
    if (!fixingRecord || !manualCP) return;
    
    setIsUpdating(true);
    try {
      const iData = fixingRecord.inspection_data || {};
      // Use existing key or fallback to default
      const cpKey = fixingRecord.cpKey || (iData["CP Rdg (mV)"] !== undefined ? "CP Rdg (mV)" : "cp_reading");
      
      const { error } = await supabase
        .from("insp_records")
        .update({
          inspection_data: {
            ...iData,
            [cpKey]: manualCP
          }
        })
        .eq("insp_id", fixingRecord.insp_id);

      if (error) throw error;
      
      toast.success("CP reading updated");
      setFixingRecord(null);
      fetchCPIssues();
    } catch (err) {
      toast.error("Failed to update record");
    } finally {
      setIsUpdating(false);
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
              <Zap className="h-5 w-5 text-amber-500" />
              CP Reading Integrity
            </CardTitle>
            <CardDescription>
              Validating Cathodic Protection readings for missing negative signs and inconsistent data.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {records.length} Issues
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">CP Data Verified</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">All CP readings follow standard conventions.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>CP Reading</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-xs uppercase">{rec.inspectionTypeName}</span>
                        <span className="text-[10px] text-slate-400">ID: #{rec.insp_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-black text-blue-600">{rec.componentQid}</span>
                        <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{(rec as any).component?.id_no}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "font-mono font-bold",
                        rec.issueType === "Missing Negative Sign" ? "text-red-600 border-red-200 bg-red-50" : "text-amber-600 border-amber-200 bg-amber-50"
                      )}>
                        {rec.cpValue || "EMPTY"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs italic text-slate-500 max-w-[200px] truncate" title={rec.findings}>
                      "{rec.findings || "No findings"}"
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tighter">
                        {rec.issueType === "Missing Negative Sign" ? "Sign Error" : "Missing Data"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {rec.issueType === "Missing Negative Sign" ? (
                        <Button 
                          onClick={() => fixSign(rec)}
                          disabled={isUpdating}
                          variant="outline" 
                          size="sm" 
                          className="gap-2 border-green-200 text-green-600 hover:bg-green-50"
                        >
                          {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                          Add -ve Sign
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                          onClick={() => {
                            setFixingRecord(rec);
                            setManualCP("");
                          }}
                        >
                          <Edit className="h-3 w-3" /> Fix Field
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        )}
      </CardContent>

      <Dialog open={!!fixingRecord} onOpenChange={(open) => !open && setFixingRecord(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Update CP Reading
            </DialogTitle>
            <DialogDescription>
              Enter the correct CP reading (mV) for record #{fixingRecord?.insp_id}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-sm italic text-slate-500 mb-2">
              "{fixingRecord?.findings}"
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp_val" className="text-xs font-bold uppercase tracking-widest text-slate-500">CP Value (mV)</Label>
              <Input
                id="cp_val"
                type="text"
                placeholder="-1050"
                value={manualCP}
                onChange={(e) => setManualCP(e.target.value)}
                className="font-mono h-11"
              />
              <p className="text-[10px] text-slate-400">Standard readings are usually negative (e.g., -1050 mV).</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFixingRecord(null)}>Cancel</Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700 gap-2" 
              onClick={handleManualUpdate}
              disabled={isUpdating || !manualCP}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
