"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageIcon, AlertCircle, Plus, FileVideo, ArrowUpDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AttachmentProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

export default function AttachmentSection({ jobpackId, structureId, sowId, reportNo }: AttachmentProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'anomaly_ref_no',
    direction: 'asc'
  });
  const supabase = createClient();

  useEffect(() => {
    if (sowId) {
      fetchMissingAttachments();
    }
  }, [sowId, reportNo]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedRecords = () => {
    if (!sortConfig) return records;

    return [...records].sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      // Handle nested or complex fields
      if (sortConfig.key === 'findings') {
        valA = a.insp_records?.inspection_data?.findings || a.insp_records?.inspection_data?.finding || "";
        valB = b.insp_records?.inspection_data?.findings || b.insp_records?.inspection_data?.finding || "";
      }

      // Natural Sort for anomaly_ref_no
      if (sortConfig.key === 'anomaly_ref_no') {
        const strA = String(valA || "");
        const strB = String(valB || "");
        return sortConfig.direction === 'asc' 
          ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
          : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedRecords = getSortedRecords();

  const [anomalyRecords, setAnomalyRecords] = useState<any[]>([]);
  const [findingRecords, setFindingRecords] = useState<any[]>([]);
  const [otherRecords, setOtherRecords] = useState<any[]>([]);

  const fetchMissingAttachments = async () => {
    setLoading(true);
    try {
      // 1. Get all anomalies/findings for this specific Jobpack, Structure, and Report No
      const { data: allAnomalies, error: aError } = await supabase
        .from("insp_anomalies")
        .select(`
          anomaly_id,
          anomaly_ref_no,
          defect_description,
          defect_type_code,
          inspection_id,
          record_category,
          insp_records!inner (
            jobpack_id,
            structure_id,
            sow_report_no,
            insp_id,
            inspection_data
          )
        `)
        .eq("insp_records.jobpack_id", jobpackId)
        .eq("insp_records.structure_id", structureId)
        .eq("insp_records.sow_report_no", reportNo);

      if (aError) throw aError;

      // 2. Get all COMPLETED inspection records (to find "Other")
      const { data: allInspRecords } = await supabase
        .from("insp_records")
        .select(`
          insp_id,
          inspection_data,
          inspection_type:inspection_type_id (name, code),
          component:component_id (q_id)
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .eq("sow_report_no", reportNo)
        .eq("status", "COMPLETED");

      // 3. Get all attachment references
      const anomalyIds = (allAnomalies || []).map(a => a.anomaly_id).filter(Boolean);
      const inspectionIds = Array.from(new Set([
        ...(allAnomalies || []).map(a => a.inspection_id).filter(Boolean),
        ...(allInspRecords || []).map(r => r.insp_id).filter(Boolean)
      ]));
      
      const filterParts = [];
      if (anomalyIds.length > 0) {
        filterParts.push(`and(source_type.ilike.anomaly,source_id.in.(${anomalyIds.join(",")}))`);
      }
      if (inspectionIds.length > 0) {
        filterParts.push(`and(source_type.ilike.inspection,source_id.in.(${inspectionIds.join(",")}))`);
      }

      let attachments: any[] = [];
      if (filterParts.length > 0) {
        const { data, error: attError } = await supabase
          .from("attachment")
          .select("source_id, source_type, meta, name, path")
          .or(filterParts.join(","));
        if (attError) throw attError;
        attachments = data || [];
      }

      // 4. Analyze function
      const analyzeRecord = (rec: any, isAnomaly: boolean = true) => {
        const aId = isAnomaly ? String(rec.anomaly_id) : null;
        const iId = String(rec.inspection_id || rec.insp_id);
        
        const recAtts = attachments.filter(att => {
          const type = att.source_type?.toUpperCase();
          const sid = String(att.source_id);
          const isAnom = isAnomaly && type === 'ANOMALY' && sid === aId;
          const isInsp = type === 'INSPECTION' && sid === iId;
          return isAnom || isInsp;
        });
        
        const checkMedia = (regex: RegExp, mimePrefix: string) => {
          return recAtts.some(att => {
            const meta = att.meta as any;
            const type = (meta?.file_type || meta?.type || meta?.mime || "").toLowerCase();
            const name = (att.name || "").toLowerCase();
            const path = (meta?.file_path || "").toLowerCase();
            const url = (meta?.file_url || att.path || "").toLowerCase();
            return type.startsWith(mimePrefix) || regex.test(name) || regex.test(path) || regex.test(url);
          });
        };

        const hasImage = checkMedia(/\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff)$/i, "image/");
        const hasVideo = checkMedia(/\.(mp4|mov|avi|wmv|mkv|flv|webm|m4v)$/i, "video/");

        if (!hasImage || !hasVideo) {
          return {
            ...rec,
            missingImage: !hasImage,
            missingVideo: !hasVideo
          };
        }
        return null;
      };

      // Categorize
      const anomalies: any[] = [];
      const findings: any[] = [];
      const others: any[] = [];

      allAnomalies?.forEach(a => {
        const analyzed = analyzeRecord(a, true);
        if (analyzed) {
          if (a.record_category?.toUpperCase() === 'FINDING') {
            findings.push(analyzed);
          } else {
            anomalies.push(analyzed);
          }
        }
      });

      // Filter for Other (completed inspections without an anomaly entry)
      const anomalyInspIds = new Set(allAnomalies?.map(a => a.inspection_id).filter(Boolean));
      allInspRecords?.forEach(r => {
        if (!anomalyInspIds.has(r.insp_id)) {
          const analyzed = analyzeRecord(r, false);
          if (analyzed) others.push(analyzed);
        }
      });

      setAnomalyRecords(anomalies);
      setFindingRecords(findings);
      setOtherRecords(others);
      setRecords([...anomalies, ...findings, ...others]);
    } catch (err) {
      console.error("QAQC Attachment Error:", err);
      toast.error("Failed to check for missing attachments");
    } finally {
      setLoading(false);
    }
  };

  const [uploading, setUploading] = useState<string | null>(null); // anomaly_id
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAnomaly) return;

    setUploading(selectedAnomaly.anomaly_id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("source_type", "anomaly");
      formData.append("source_id", String(selectedAnomaly.anomaly_id));
      formData.append("title", file.name);
      formData.append("description", `QAQC Upload: ${selectedAnomaly.anomaly_ref_no}`);

      const res = await fetch("/api/attachment", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      toast.success("Attachment uploaded successfully");
      fetchMissingAttachments(); // Refresh the list
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload attachment");
    } finally {
      setUploading(null);
      setSelectedAnomaly(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (anomaly: any) => {
    setSelectedAnomaly(anomaly);
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-purple-600" />
                Missing Attachments
              </CardTitle>
              <CardDescription>
                Categorized records requiring photographic and video evidence.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">{anomalyRecords.length} Anomalies</Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">{findingRecords.length} Findings</Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">{otherRecords.length} Other</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*,video/*" />
          
          <Tabs defaultValue="anomalies" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 h-11 p-1 bg-slate-100/50 dark:bg-slate-800/50">
              <TabsTrigger value="anomalies" className="font-bold data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm">
                Anomalies ({anomalyRecords.length})
              </TabsTrigger>
              <TabsTrigger value="findings" className="font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">
                Findings ({findingRecords.length})
              </TabsTrigger>
              <TabsTrigger value="other" className="font-bold data-[state=active]:bg-white data-[state=active]:text-slate-600 data-[state=active]:shadow-sm">
                Other Records ({otherRecords.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="anomalies">
              <MissingRecordsTable 
                records={anomalyRecords} 
                uploading={uploading} 
                triggerUpload={triggerUpload} 
                requestSort={requestSort}
                type="anomaly"
              />
            </TabsContent>

            <TabsContent value="findings">
              <MissingRecordsTable 
                records={findingRecords} 
                uploading={uploading} 
                triggerUpload={triggerUpload} 
                requestSort={requestSort}
                type="finding"
              />
            </TabsContent>

            <TabsContent value="other">
              <MissingRecordsTable 
                records={otherRecords} 
                uploading={uploading} 
                triggerUpload={triggerUpload} 
                requestSort={requestSort}
                type="other"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function MissingRecordsTable({ records, uploading, triggerUpload, requestSort, type }: any) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-slate-50/50">
        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
          <AlertCircle className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="font-semibold text-slate-900 dark:text-white">All Clear!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">No missing attachments in this category.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <ScrollArea className="h-[550px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort(type === 'other' ? 'q_id' : 'anomaly_ref_no')}>
                <div className="flex items-center gap-2">
                  {type === 'other' ? 'Component QID' : 'Reference'}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('findings')}>
                <div className="flex items-center gap-2">
                  {type === 'other' ? 'Inspection Findings' : 'Details'}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Status / Missing</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((rec: any) => {
              const findings = rec.insp_records?.inspection_data?.findings || 
                              rec.inspection_data?.findings || 
                              rec.inspection_data?.observation || "-";

              return (
                <TableRow key={rec.anomaly_id || rec.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className={cn("font-bold", type === 'anomaly' ? "text-red-600" : type === 'finding' ? "text-amber-600" : "text-blue-600 font-mono")}>
                        {type === 'other' ? (rec.component?.q_id || `REC #${rec.insp_id}`) : rec.anomaly_ref_no}
                      </span>
                      <span className="text-[10px] text-muted-foreground">ID: {rec.anomaly_id || rec.insp_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1 max-w-[400px]">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] py-0 h-4 bg-slate-100">
                          {rec.defect_type_code || rec.inspection_type?.name || "N/A"}
                        </Badge>
                      </div>
                      <div className="line-clamp-2 italic text-slate-600">"{findings}"</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{rec.defect_description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {rec.missingImage && (
                        <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 gap-1.5 px-2 font-normal">
                          <ImageIcon className="h-3 w-3" /> Image Missing
                        </Badge>
                      )}
                      {rec.missingVideo && (
                        <Badge variant="destructive" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 gap-1.5 px-2 font-normal">
                          <FileVideo className="h-3 w-3" /> Video Missing
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {uploading === (rec.anomaly_id || rec.insp_id) ? (
                        <Button disabled variant="outline" size="sm" className="h-8">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Uploading...
                        </Button>
                      ) : (
                        <>
                          {rec.missingImage && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-red-200 hover:bg-red-50" onClick={() => triggerUpload(rec)}>
                              <Plus className="h-3 w-3" /> Image
                            </Button>
                          )}
                          {rec.missingVideo && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-amber-200 hover:bg-amber-50" onClick={() => triggerUpload(rec)}>
                              <Plus className="h-3 w-3" /> Video
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
