"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LinkIcon, AlertCircle, Anchor } from "lucide-react";
import { toast } from "sonner";
import { ComponentEditDialog } from "@/components/dialogs/component-edit-dialog";

interface ConductorGuideProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function ConductorGuideSection({ jobpackId, structureId, sowId, reportNo }: ConductorGuideProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchMissingGuideAssociations();
  }, [structureId]);

  const fetchMissingGuideAssociations = async () => {
    setLoading(true);
    try {
      // Find components for this structure that are Conductor Guides or Frames
      // Codes like CG (Conductor Guide), CGF (Conductor Guide Frame)
      const { data, error } = await supabase
        .from("structure_components")
        .select("*")
        .eq("structure_id", structureId)
        .in("code", ["CG", "CGF"])
        .is("is_deleted", false);

      if (error) throw error;

      // Filter those missing association in metadata to a parent "Conductor" (usually code 'CO' or 'CD')
      const missing = (data || []).filter(c => {
        const meta = c.metadata || {};
        return !meta.associated_comp_id;
      });

      setRecords(missing);
    } catch (err) {
      toast.error("Failed to check for conductor guide associations");
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
              <Anchor className="h-5 w-5 text-indigo-600" />
              Conductor Guide Association
            </CardTitle>
            <CardDescription>
              Conductor Guides and Frames that are not associated to a parent Conductor.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
            {records.length} Unlinked Guides
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Hierarchy Intact</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">All guides and frames are correctly linked to conductors.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>Type</TableHead>
                  <TableHead>Comp ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell>
                      <Badge className="bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">
                        {rec.code === "CG" ? "Guide" : "Frame"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rec.comp_id}</TableCell>
                    <TableCell className="text-sm italic text-slate-500">{rec.metadata?.description || "No description"}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        onClick={() => handleFix(rec)}
                      >
                        <LinkIcon className="h-3 w-3" /> Link Conductor
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <ComponentEditDialog
        component={selectedRecord}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            fetchMissingGuideAssociations();
          }
        }}
        defaultTab="specifications2"
      />
    </Card>
  );
}
