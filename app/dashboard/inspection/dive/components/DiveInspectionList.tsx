"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Eye, EyeOff, AlertTriangle, CheckCircle2, FileClock, History, Paperclip, FileText } from "lucide-react";
import { generateInspectionReport } from "@/utils/report-generators/inspection-report";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateDefectAnomalyReport } from "@/utils/report-generators/defect-anomaly-report";
import { getReportHeaderData } from "@/utils/company-settings";
import { ReportPreviewDialog } from "@/components/ReportPreviewDialog";

interface DiveInspectionListProps {
    diveJobId?: number;
    componentId?: number;
    diveNo?: string;
    jobpackId?: string | number;
    selectedType?: string | null;
    onEdit: (record: any) => void;
    onDelete?: () => void;
    timestamp?: string; // Force refresh
}

export default function DiveInspectionList({
    diveJobId,
    componentId,
    diveNo,
    jobpackId,
    selectedType,
    onEdit,
    onDelete,
    timestamp
}: DiveInspectionListProps) {
    const supabase = createClient();
    const [records, setRecords] = useState<any[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (diveJobId || componentId || (diveNo && jobpackId)) {
            fetchRecords();
        } else {
            setRecords([]);
        }

        // Realtime subscription setup
        const channel = supabase
            .channel(`insp_records_list_${diveJobId || componentId || 'global'}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'insp_records',
                    filter: diveJobId ? `dive_job_id=eq.${diveJobId}` : undefined
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    fetchRecords();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [diveJobId, componentId, diveNo, jobpackId, selectedType, timestamp, supabase]);

    async function fetchRecords() {
        setLoading(true);
        try {
            console.log("Fetching inspection records...", { diveJobId, componentId, timestamp });

            let query = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type!left(id, code, name),
                    structure_components:component_id!left (q_id),
                    insp_dive_jobs!left(dive_no, jobpack_id)
                `)
                .order('inspection_date', { ascending: false })
                .order('inspection_time', { ascending: false })
                .order('insp_id', { ascending: false });

            if (diveJobId) {
                query = query.eq('dive_job_id', diveJobId);
            } else if (componentId) {
                query = query.eq('component_id', componentId);
            }

            if (selectedType) {
                // If the selected type is a name like "General Visual Inspection", we might need inner join or logic
                // But usually we filter by code if we can.
                // assuming assignedTasks uses code or name. Let's try flexible search or exact match on code first.
                // Or filtered clientside if simple.
                // Let's filter clientside to be safer with "selectedType" string matching either code or name
            }

            const { data, error } = await query;

            if (error) throw error;

            let filtered = data || [];
            if (selectedType) {
                const search = selectedType.toLowerCase();
                filtered = filtered.filter(r =>
                    r.inspection_type_code?.toLowerCase() === search ||
                    r.inspection_type?.code?.toLowerCase() === search ||
                    r.inspection_type?.name?.toLowerCase() === search
                );
            }

            // Fetch attachment counts
            const ids = filtered.map(r => r.insp_id);
            if (ids.length > 0) {
                const { data: attData } = await supabase
                    .from('attachment')
                    .select('source_id')
                    .eq('source_type', 'inspection')
                    .in('source_id', ids);

                const counts: Record<number, number> = {};
                attData?.forEach((a: any) => {
                    counts[a.source_id] = (counts[a.source_id] || 0) + 1;
                });

                // Append count to record object for easy access
                filtered = filtered.map(r => ({
                    ...r,
                    _attachment_count: counts[r.insp_id] || 0
                }));
            }

            console.log(`Fetched ${filtered.length} records`);
            setRecords(filtered);
            if (timestamp) {
                // toast.info("List refreshed");
            }
        } catch (error) {
            console.error("Error fetching inspection records:", error);
            toast.error("Failed to load inspection records");
        } finally {
            setLoading(false);
        }
    }

    function handlePrintAnomaly(record: any) {
        setPreviewRecord(record);
        setPreviewOpen(true);
    }

    async function generateAnomalyReportBlob() {
        if (!previewRecord) return;
        const record = previewRecord;

        try {
            const settings = await getReportHeaderData();

            // Reconstruct minimal context
            const jpId = record.insp_dive_jobs?.jobpack_id || jobpackId;
            const strId = record.structure_id;

            const jp = { id: jpId, name: "Project Reference", metadata: {} };
            const str = { id: strId, field_name: "Field", str_name: "Structure" };

            const config = {
                reportNoPrefix: "ANOMALY",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "System", date: new Date().toLocaleDateString() },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: false, text: "", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                inspectionId: record.insp_id,
                returnBlob: true
            };

            return await generateDefectAnomalyReport(
                jp,
                str,
                "",
                {
                    company_name: settings.companyName,
                    logo_url: settings.companyLogo || undefined,
                    departmentName: settings.departmentName
                } as any,
                config
            );
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate report");
            throw error;
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Are you sure you want to delete this inspection record? This cannot be undone.")) return;

        try {
            // first delete associated video log if any (manual cascade since DB is set to SET NULL)
            const { error: logError } = await supabase
                .from('insp_video_logs')
                .delete()
                .eq('inspection_id', id);

            if (logError) console.error("Error deleting video log:", logError);

            // then delete the record
            const { error } = await supabase
                .from('insp_records')
                .delete()
                .eq('insp_id', id);

            if (error) throw error;

            toast.success("Record deleted");
            // Refresh list
            setRecords(prev => prev.filter(r => r.insp_id !== id));
            if (onDelete) onDelete();
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Failed to delete record");
        }
    }

    if (loading) {
        return <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Refreshing records...</div>;
    }

    if (records.length === 0) {
        return (
            <div className="p-8 text-center border-t border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-sm text-muted-foreground">No inspection records found.</p>
                <Button variant="outline" size="sm" onClick={fetchRecords} className="mt-2">Refresh List</Button>
            </div>
        );
    }

    return (
        <div className="border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/20">
            <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
                        <tr>
                            <th className="px-2 py-1.5 text-left w-22">
                                <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={fetchRecords} title="Click to refresh">
                                    Date <History className="h-3 w-3" />
                                </span>
                            </th>
                            <th className="px-2 py-1.5 text-left w-24">Type</th>
                            <th className="px-2 py-1.5 text-left w-24">Component</th>
                            <th className="px-2 py-1.5 text-center w-16">Elev/KP</th>
                            <th className="px-2 py-1.5 text-center w-20">Status</th>
                            <th className="px-2 py-1.5 text-right w-16">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {records.map((record) => {
                            const isSelected = componentId && record.component_id === componentId;

                            // Format helper for counter
                            const formatCounter = (val: any) => {
                                if (val === null || val === undefined || val === '') return null;
                                // If string with colon, assume timecode
                                if (typeof val === 'string' && val.includes(':')) return val;
                                // If number, convert seconds to HH:MM:SS
                                const sec = Number(val);
                                if (!isNaN(sec)) {
                                    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                                    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                                    const s = Math.floor(sec % 60).toString().padStart(2, '0');
                                    return `${h}:${m}:${s}`;
                                }
                                return val;
                            };

                            return (
                                <tr
                                    key={record.insp_id}
                                    className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group text-xs ${isSelected
                                        ? 'bg-blue-50/60 dark:bg-blue-900/20 border-l-2 border-blue-500'
                                        : 'border-l-2 border-transparent'
                                        }`}
                                >
                                    <td className="px-2 py-1.5 align-top whitespace-nowrap text-muted-foreground">
                                        {record.inspection_date ? format(new Date(record.inspection_date), 'dd MMM') : '-'}
                                        <div className="text-[10px] opacity-70">{record.inspection_time?.slice(0, 5)}</div>
                                    </td>
                                    <td className="px-2 py-1.5 align-top font-medium">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal w-fit">
                                                {record.inspection_type_code || record.inspection_type?.code || 'UNK'}
                                            </Badge>
                                            {(record.inspection_data?._meta_timecode || record.tape_count_no) && (
                                                <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                                    {formatCounter(record.inspection_data?._meta_timecode || record.tape_count_no)}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 align-top font-medium text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="truncate max-w-[90px]" title={record.structure_components?.q_id}>
                                                {record.structure_components?.q_id || '-'}
                                            </div>
                                            {record._attachment_count > 0 && (
                                                <div title={`${record._attachment_count} Attachment(s)`}>
                                                    <Paperclip className="h-3 w-3 text-blue-500 shrink-0" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 align-top text-center text-[10px] text-muted-foreground whitespace-nowrap">
                                        {record.elevation ? `${record.elevation}m` : (record.fp_kp || '-')}
                                    </td>
                                    <td className="px-2 py-1.5 align-top text-center flex justify-center">
                                        {record.has_anomaly ? (
                                            <div title="Anomaly Found" className="flex items-center justify-center h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/30">
                                                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                            </div>
                                        ) : record.status === 'COMPLETED' ? (
                                            <div title="Inspected / Completed" className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                            </div>
                                        ) : (
                                            <div title="Incomplete / Draft" className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                                <FileClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                        )}

                                    </td>
                                    <td className="px-2 py-1.5 align-top text-right">
                                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {record.has_anomaly ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-blue-600"
                                                            title="Print Reports"
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => generateInspectionReport(record.insp_id)}>
                                                            <FileText className="mr-2 h-3 w-3" />
                                                            Inspection Report
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePrintAnomaly(record)} className="text-red-600 focus:text-red-600">
                                                            <AlertTriangle className="mr-2 h-3 w-3" />
                                                            Defect / Anomaly Report
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-blue-600"
                                                    onClick={() => generateInspectionReport(record.insp_id)}
                                                    title="Print Report"
                                                >
                                                    <FileText className="h-3 w-3" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-blue-600"
                                                onClick={() => onEdit(record)}
                                                title="Edit Record"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-red-600"
                                                onClick={() => handleDelete(record.insp_id)}
                                                title="Delete Record"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div >
            <ReportPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                title="Anomaly Report Preview"
                fileName={`Anomaly_Report_${previewRecord?.anomaly_ref_no || 'Draft'}`}
                generateReport={generateAnomalyReportBlob}
            />
        </div>

    );
}
