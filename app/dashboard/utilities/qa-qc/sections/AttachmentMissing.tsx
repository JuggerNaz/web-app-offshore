"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageIcon, AlertCircle, Plus, FileVideo, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

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
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedRecords = getSortedRecords();

  const fetchMissingAttachments = async () => {
    setLoading(true);
    try {
      // 1. Get all anomalies for this specific Jobpack, Structure, and Report No
      const { data: anomalies, error: aError } = await supabase
        .from("insp_anomalies")
        .select(`
          anomaly_id,
          anomaly_ref_no,
          defect_description,
          defect_type_code,
          inspection_id,
          insp_records!inner (
            jobpack_id,
            structure_id,
            sow_report_no,
            insp_id
          )
        `)
        .eq("insp_records.jobpack_id", jobpackId)
        .eq("insp_records.structure_id", structureId)
        .eq("insp_records.sow_report_no", reportNo);

      if (aError) throw aError;

      // 2. Get all attachment references (Anomaly level and Inspection level)
      const anomalyIds = anomalies.map(a => a.anomaly_id).filter(Boolean);
      const inspectionIds = Array.from(new Set(anomalies.map(a => a.inspection_id).filter(Boolean)));
      
      if (anomalyIds.length === 0 && inspectionIds.length === 0) {
        setRecords([]);
        return;
      }

      // Build OR query for multiple source types and IDs
      let query = supabase.from("attachment").select("source_id, source_type, meta, name, path");
      
      const filterParts = [];
      if (anomalyIds.length > 0) {
        filterParts.push(`and(source_type.ilike.anomaly,source_id.in.(${anomalyIds.join(",")}))`);
      }
      if (inspectionIds.length > 0) {
        filterParts.push(`and(source_type.ilike.inspection,source_id.in.(${inspectionIds.join(",")}))`);
      }

      const { data: attachments, error: attError } = await query.or(filterParts.join(","));

      if (attError) throw attError;

      // 3. Analyze each anomaly for missing types
      console.log(`[QAQC] Found ${anomalies.length} anomalies and ${attachments?.length || 0} attachments.`);
      
      const missing: any[] = [];
      anomalies.forEach(anomaly => {
        const aId = String(anomaly.anomaly_id);
        const iId = String(anomaly.inspection_id);
        
        const anomalyAtts = (attachments || []).filter(att => {
          const type = att.source_type?.toUpperCase();
          const sid = String(att.source_id);
          const isAnom = type === 'ANOMALY' && sid === aId;
          const isInsp = type === 'INSPECTION' && sid === iId;
          return isAnom || isInsp;
        });
        
        const hasImage = anomalyAtts.some(att => {
          const meta = att.meta as any;
          const type = (meta?.file_type || meta?.type || meta?.mime || "").toLowerCase();
          const name = (att.name || "").toLowerCase();
          const path = (meta?.file_path || "").toLowerCase();
          const url = (meta?.file_url || att.path || "").toLowerCase();
          
          const isImageMime = type.startsWith("image/") || type === "photo";
          const imageRegex = /\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff)$/i;
          const isImageExt = imageRegex.test(name) || imageRegex.test(path) || imageRegex.test(url);
          
          return isImageMime || isImageExt;
        });
        
        const hasVideo = anomalyAtts.some(att => {
          const meta = att.meta as any;
          const type = (meta?.file_type || meta?.type || meta?.mime || "").toLowerCase();
          const name = (att.name || "").toLowerCase();
          const path = (meta?.file_path || "").toLowerCase();
          const url = (meta?.file_url || att.path || "").toLowerCase();
          
          const isVideoMime = type.startsWith("video/");
          const videoRegex = /\.(mp4|mov|avi|wmv|mkv|flv|webm|m4v)$/i;
          const isVideoExt = videoRegex.test(name) || videoRegex.test(path) || videoRegex.test(url);
          
          return isVideoMime || isVideoExt;
        });

        if (!hasImage || !hasVideo) {
          missing.push({
            ...anomaly,
            missingImage: !hasImage,
            missingVideo: !hasVideo
          });
        }
      });

      setRecords(missing);
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
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-purple-600" />
              Missing Attachments
            </CardTitle>
            <CardDescription>
              Anomaly records requiring photographic and video evidence.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
            {records.length} Records Incomplete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
          accept="image/*,video/*"
        />
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">All Clear!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">All anomalies have both image and video attachments.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('anomaly_ref_no')}>
                      <div className="flex items-center gap-2">
                        Anomaly Ref
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('findings')}>
                      <div className="flex items-center gap-2">
                        Defect Details
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Status / Missing</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.map((rec) => {
                    const findings = rec.insp_records?.inspection_data?.findings || 
                                    rec.insp_records?.inspection_data?.finding || 
                                    rec.insp_records?.inspection_data?.observation || "-";

                    return (
                      <TableRow key={rec.anomaly_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-medium whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{rec.anomaly_ref_no}</span>
                            <span className="text-[10px] text-muted-foreground">ID: {rec.anomaly_id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1 max-w-[400px]">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] py-0 h-4 bg-slate-100">Type: {rec.defect_type_code || "N/A"}</Badge>
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
                            {uploading === rec.anomaly_id ? (
                              <Button disabled variant="outline" size="sm" className="h-8">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Uploading...
                              </Button>
                            ) : (
                              <>
                                {rec.missingImage && (
                                  <Button variant="outline" size="sm" className="h-8 gap-1.5 border-red-200 hover:bg-red-50 dark:border-red-900/40" onClick={() => triggerUpload(rec)}>
                                    <Plus className="h-3 w-3" /> Image
                                  </Button>
                                )}
                                {rec.missingVideo && (
                                  <Button variant="outline" size="sm" className="h-8 gap-1.5 border-amber-200 hover:bg-amber-50 dark:border-amber-900/40" onClick={() => triggerUpload(rec)}>
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
        )}
      </CardContent>
    </Card>
  );
}
