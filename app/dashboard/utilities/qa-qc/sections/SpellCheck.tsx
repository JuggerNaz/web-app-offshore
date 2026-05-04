"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, SpellCheck, ExternalLink, Edit3, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SpellCheckProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

// Expanded dictionary of offshore terms to avoid false positives
const OFFSHORE_TERMS = new Set([
  // Abbreviations & Codes
  "anom", "rov", "uwdl", "gvi", "cvi", "cp", "fmd", "acfm", "mpi", "ut", "dsvp", "lat", "msl", "elp", "kp", "el", "fw", "aft", "port", "stbd", "fwd", "mgi",
  // Structural Terms
  "jacket", "riser", "clamp", "caisson", "j-tube", "jtube", "bellmouth", "conductor", "anode", "weld", "flange", "bolt", "nut", "valve", "pipeline", "spool", "mattress", "grout", "scour", "debris", "plegs", "dleg", "cslot", "pile", "cladding", "seam", "butt", "conical", "transition", "gusset", "brace", "diagonal", "horizontal", "vertical", "member", "leg", "nodal", "node", "brace", "platform", "deck", "topside", "subsea", "splash", "zone", "boat", "landing", "fender", "ladder", "structure",
  // Inspection Findings
  "marine", "growth", "hard", "soft", "barnacle", "mussel", "tubeworm", "corrosion", "pitting", "coating", "crack", "dent", "gouge", "leak", "bubble", "seepage", "pitting", "waste", "thickness", "nominal", "actual", "cathodic", "protection", "general", "measured", "depth", "elevation", "orientation", "clockwise", "anticlockwise", "location", "structural", "criteria", "observation", "description", "report", "finding", "anomaly", "reference", "threshold", "inspection"
]);

const KNOWN_TYPOS = new Set([
  "rier", "anomly", "desct", "testng", "clmap", "flang", "pittin", "corr", "remov", "installa", "observ"
]);

export default function SpellCheckSection({ jobpackId, structureId, sowId, reportNo }: SpellCheckProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [fixingRecord, setFixingRecord] = useState<any>(null);
  const [fixedText, setFixedText] = useState("");
  const [isFixing, setIsFixing] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
      fetchFindings();
    }
  }, [sowId, reportNo]);

  const fetchFindings = async () => {
    setLoading(true);
    try {
      // Get ALL inspection records for this specific Jobpack, Structure, and Report No
      const { data, error } = await supabase
        .from("insp_records")
        .select(`
          insp_id,
          description,
          inspection_data,
          rov_job_id,
          dive_job_id,
          inspection_type:inspection_type_id (
            name,
            code
          )
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo);

      if (error) throw error;

      // Process for potential spelling issues
      const processed = (data || []).map(rec => {
        // Priority: Root description column, then JSONB keys
        const findings = rec.description || 
                        rec.inspection_data?.findings || 
                        rec.inspection_data?.finding || 
                        rec.inspection_data?.observation || 
                        rec.inspection_data?.remarks || 
                        rec.inspection_data?.overall_condition || 
                        rec.inspection_data?.component_condition || 
                        rec.inspection_data?.description || "";
        
        const combinedText = `${findings}`;
        const words = combinedText.split(/\s+/) || [];
        
        const potentialIssues = words.filter((word: string) => {
          // Clean the word: remove common punctuation at start/end
          const clean = word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
          
          if (clean.length < 3) return false; // ignore very short words
          if (OFFSHORE_TERMS.has(clean)) return false;
          
          // Explicitly flag known typos (like "rier")
          if (KNOWN_TYPOS.has(clean)) return true;
          
          // Basic heuristic: words with very few vowels relative to length
          const vowelCount = (clean.match(/[aeiouy]/g) || []).length;
          const ratio = vowelCount / clean.length;
          
          if (vowelCount === 0) return true;
          // Words with few vowels relative to length (typos like 'tsting' or 'desct')
          if (clean.length >= 4 && ratio < 0.25) return true;
          if (clean.length > 20) return true;
          
          return false;
        });
        
        // Determine mode
        const mode = rec.rov_job_id ? "ROV" : (rec.dive_job_id ? "Diving" : "N/A");
        const typeData = Array.isArray(rec.inspection_type) ? rec.inspection_type[0] : rec.inspection_type;
        
        return { 
          ...rec, 
          findings,
          mode,
          inspectionTypeName: typeData?.name || typeData?.code || "Unknown",
          potentialIssues: Array.from(new Set(potentialIssues)) // unique issues
        };
      }).filter(rec => rec.potentialIssues.length > 0);

      setRecords(processed);
    } catch (err) {
      console.error("Spell Check Error:", err);
      toast.error("Failed to load data for spell check");
    } finally {
      setLoading(false);
    }
  };

  const handleFixClick = (rec: any) => {
    setFixingRecord(rec);
    setFixedText(rec.findings);
  };

  const handleSaveFix = async () => {
    if (!fixingRecord) return;
    
    setIsFixing(true);
    try {
      let updatePayload: any = {};
      
      // If root description matches original findings, update it there
      if (fixingRecord.description === fixingRecord.findings) {
        updatePayload.description = fixedText;
      } else {
        // Otherwise update the appropriate key in inspection_data
        const findingsKey = fixingRecord.inspection_data?.findings ? 'findings' : 
                           (fixingRecord.inspection_data?.finding ? 'finding' : 
                           (fixingRecord.inspection_data?.observation ? 'observation' : 
                           (fixingRecord.inspection_data?.remarks ? 'remarks' : 
                           (fixingRecord.inspection_data?.overall_condition ? 'overall_condition' : 
                           (fixingRecord.inspection_data?.component_condition ? 'component_condition' : 
                           (fixingRecord.inspection_data?.description ? 'description' : 'findings'))))));
        
        updatePayload.inspection_data = {
          ...fixingRecord.inspection_data,
          [findingsKey]: fixedText
        };
      }

      const { error } = await supabase
        .from("insp_records")
        .update(updatePayload)
        .eq("insp_id", fixingRecord.insp_id);

      if (error) throw error;

      toast.success("Inspection record updated successfully");
      setFixingRecord(null);
      fetchFindings(); // Refresh the list
    } catch (err) {
      console.error("Error updating record:", err);
      toast.error("Failed to update record");
    } finally {
      setIsFixing(false);
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
              <SpellCheck className="h-5 w-5 text-blue-600" />
              Spelling Review
            </CardTitle>
            <CardDescription>
              Scanning inspection findings for potential typos or unusual terms.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            {records.length} Potential Issues
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">All Findings Clean!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">No spelling issues detected in the selected inspection records.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[200px]">Inspection Type</TableHead>
                    <TableHead className="w-[100px]">Mode</TableHead>
                    <TableHead>Findings Context</TableHead>
                    <TableHead>Suspect Words</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => (
                    <TableRow key={rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-semibold text-slate-900 dark:text-white">
                        {rec.inspectionTypeName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "font-medium",
                          rec.mode === "ROV" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-green-600 border-green-200 bg-green-50"
                        )}>
                          {rec.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="italic text-slate-600 dark:text-slate-300 max-w-[400px]">
                          "{rec.findings}"
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rec.potentialIssues.map((word: string, i: number) => (
                            <Badge key={i} variant="secondary" className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px]">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 hover:bg-blue-600 hover:text-white border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                          onClick={() => handleFixClick(rec)}
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Fix
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

      <Dialog open={!!fixingRecord} onOpenChange={(open) => !open && setFixingRecord(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SpellCheck className="h-5 w-5 text-blue-600" />
              Fix Spelling
            </DialogTitle>
            <DialogDescription>
              Correct the spelling for {fixingRecord?.inspectionTypeName} inspection findings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="findings" className="text-sm font-semibold">
                Findings Description
              </Label>
              <Textarea
                id="findings"
                value={fixedText}
                onChange={(e) => setFixedText(e.target.value)}
                placeholder="Enter corrected findings..."
                className="min-h-[150px] text-sm leading-relaxed"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 w-full mb-1">Suspect Words to Check:</span>
                {fixingRecord?.potentialIssues.map((word: string, i: number) => (
                  <Badge key={i} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixingRecord(null)}>
              Cancel
            </Button>
            <Button 
              className="gap-2 bg-blue-600 hover:bg-blue-700" 
              onClick={handleSaveFix}
              disabled={isFixing}
            >
              {isFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
