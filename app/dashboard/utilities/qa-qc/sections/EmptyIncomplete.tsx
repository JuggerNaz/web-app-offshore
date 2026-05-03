"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, AlertCircle, Edit } from "lucide-react";
import { toast } from "sonner";

interface EmptyIncompleteProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function EmptyIncompleteSection({ jobpackId, structureId, sowId, reportNo }: EmptyIncompleteProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
      fetchEmptyIncomplete();
    }
  }, [sowId, reportNo]);

  const fetchEmptyIncomplete = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("insp_records")
        .select("insp_id, component_id, inspection_data, status")
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo)
        .eq("status", "INCOMPLETE");

      if (error) throw error;

      const empty = (data || []).filter(rec => {
        const reason = rec.inspection_data?.incomplete_reason;
        return !reason || reason.trim() === "";
      });

      setRecords(empty);
    } catch (err) {
      toast.error("Failed to check for empty incomplete data");
    } finally {
      setLoading(false);
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
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Empty Incomplete Data
            </CardTitle>
            <CardDescription>
              Records flagged as "INCOMPLETE" that are missing a documented reason.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {records.length} Missing Reasons
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">All Reasons Documented</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Every incomplete record has a justification.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Component ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => (
                    <TableRow key={rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-medium">#{rec.insp_id}</TableCell>
                      <TableCell>{rec.component_id || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50">
                          <Edit className="h-3 w-3" /> Add Reason
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
    </Card>
  );
}
