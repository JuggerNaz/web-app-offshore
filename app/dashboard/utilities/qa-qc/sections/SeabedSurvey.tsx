"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Waves, AlertCircle, Edit3 } from "lucide-react";
import { toast } from "sonner";

interface SeabedSurveyProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function SeabedSurveySection({ jobpackId, structureId, sowId, reportNo }: SeabedSurveyProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
  fetchSeabedIssues();
    }
  }, [sowId, reportNo]);

  const fetchSeabedIssues = async () => {
    setLoading(true);
    try {
      // Find seabed survey records for this specific Jobpack, Structure, and Report
      const { data, error } = await supabase
        .from("insp_records")
        .select("insp_id, component_id, inspection_data, inspection_type_code")
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo)
        .in("inspection_type_code", ["SB", "SS", "SBS"]); // Typical seabed codes

      if (error) throw error;

      // Filter those missing debris details in metadata
      const missing = (data || []).filter(rec => {
        const d = rec.inspection_data || {};
        const debrisType = d.debris_type || d.debris_material || d.debris;
        return !debrisType || debrisType.trim() === "";
      });

      setRecords(missing);
    } catch (err) {
      toast.error("Failed to check for seabed survey issues");
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
              <Waves className="h-5 w-5 text-cyan-600" />
              Seabed Survey Validation
            </CardTitle>
            <CardDescription>
              Seabed survey records missing debris type or material classification.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800">
            {records.length} Missing Debris Info
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Survey Complete</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">All seabed records have debris classifications.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Type Code</TableHead>
                    <TableHead>Inspection Data Summary</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => (
                    <TableRow key={rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-medium">#{rec.insp_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-cyan-600 border-cyan-200 bg-cyan-50">
                          {rec.inspection_type_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm italic text-slate-500 truncate max-w-[300px]">
                        {JSON.stringify(rec.inspection_data)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">
                          <Edit3 className="h-3 w-3" /> Set Debris Type
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
