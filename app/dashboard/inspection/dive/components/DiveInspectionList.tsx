"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2, Eye, EyeOff, AlertTriangle, CheckCircle2, FileClock, History, Paperclip, FileText, Search, ArrowUpDown } from "lucide-react";
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
    tapeId?: number;
    diveNo?: string;
    jobpackId?: string | number;
    sowReportNumber?: string;
    structureId?: number;
    selectedType?: string | null;
    onEdit: (record: any) => void;
    onDelete?: () => void;
    timestamp?: string; // Force refresh
}

export default function DiveInspectionList({
    diveJobId,
    componentId,
    tapeId,
    diveNo,
    jobpackId,
    sowReportNumber,
    structureId,
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
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'inspection_date',
        direction: 'desc'
    });

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
    }, [diveJobId, componentId, tapeId, diveNo, jobpackId, sowReportNumber, structureId, selectedType, timestamp, supabase]);

    async function fetchRecords() {
        setLoading(true);
        try {
            console.log("Fetching inspection records...", { diveJobId, componentId, sowReportNumber, timestamp });

            let query = supabase
                .from('insp_records')
                .select(`
                    *,
                    inspection_type!left(id, code, name),
                    structure_components:component_id!left (q_id),
                    insp_dive_jobs!left(dive_no, jobpack_id, job_no),
                    insp_video_tapes!left(tape_no),
                    insp_anomalies!left(anomaly_ref_no)
                `)
                .order('inspection_date', { ascending: false })
                .order('inspection_time', { ascending: false })
                .order('insp_id', { ascending: false });

            if (diveJobId) {
                query = query.eq('dive_job_id', diveJobId);
            } else if (componentId) {
                query = query.eq('component_id', componentId);
            }

            if (sowReportNumber) {
                query = query.eq('sow_report_no', sowReportNumber);
            }

            if (structureId) {
                query = query.eq('structure_id', structureId);
            }

            // Filter by tape if provided
            if (tapeId) {
                query = query.eq('tape_id', tapeId);
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

    async function generateAnomalyReportBlob(printFriendly?: boolean) {
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
                returnBlob: true,
                printFriendly: printFriendly || false
            };

            return await generateDefectAnomalyReport(
                jp,
                str,
                record.sow_report_no || "",
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
            // Get the record we're about to delete so we know its component/sow context
            const recordToDelete = records.find(r => r.insp_id === id);

            // 1. Delete associated video log
            const { error: logError } = await supabase
                .from('insp_video_logs')
                .delete()
                .eq('inspection_id', id);

            if (logError) console.error("Error deleting video log:", logError);

            // 2. Delete the inspection record
            const { error } = await supabase
                .from('insp_records')
                .delete()
                .eq('insp_id', id);

            if (error) throw error;

            // 3. After deletion, check if any remaining insp_records exist for this
            //    component + sow_report_no. If none remain, reset u_sow_items to 'pending'.
            if (recordToDelete?.component_id && recordToDelete?.sow_report_no) {
                const { count: remaining } = await supabase
                    .from('insp_records')
                    .select('*', { count: 'exact', head: true })
                    .eq('component_id', recordToDelete.component_id)
                    .eq('sow_report_no', recordToDelete.sow_report_no)
                    .neq('insp_id', id); // exclude the just-deleted one (DB may lag)

                if ((remaining ?? 0) === 0) {
                    // No inspection records left — reset SOW item status back to pending
                    const { error: sowResetError } = await supabase
                        .from('u_sow_items')
                        .update({
                            status: 'pending',
                            notes: null,
                            last_inspection_date: null
                        })
                        .eq('report_number', recordToDelete.sow_report_no)
                        .eq('component_id', recordToDelete.component_id);

                    if (sowResetError) {
                        console.error('Error resetting SOW item status:', sowResetError);
                    }
                }
            } else if (recordToDelete?.component_id && recordToDelete?.dive_job_id) {
                // Fallback: use dive_job to find sow_report_no
                const diveJob = recordToDelete.insp_dive_jobs;
                const sowReportNo = diveJob?.sow_report_no || recordToDelete.sow_report_no;
                if (sowReportNo) {
                    const { count: remaining } = await supabase
                        .from('insp_records')
                        .select('*', { count: 'exact', head: true })
                        .eq('component_id', recordToDelete.component_id)
                        .eq('sow_report_no', sowReportNo);

                    if ((remaining ?? 0) === 0) {
                        await supabase
                            .from('u_sow_items')
                            .update({ 
                                status: 'pending', 
                                notes: null, 
                                last_inspection_date: null
                            })
                            .eq('report_number', sowReportNo)
                            .eq('component_id', recordToDelete.component_id);
                    }
                }
            }

            toast.success("Record deleted");
            setRecords(prev => prev.filter(r => r.insp_id !== id));
            if (onDelete) onDelete();
        } catch (error) {
            console.error("Error deleting record:", error);
            toast.error("Failed to delete record");
        }
    }

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedRecords = useMemo(() => {
        const sorted = [...records];
        sorted.sort((a, b) => {
            let aVal: any;
            let bVal: any;

            switch (sortConfig.key) {
                case 'inspection_date':
                    aVal = new Date(`${a.inspection_date}T${a.inspection_time || '00:00:00'}`).getTime();
                    bVal = new Date(`${b.inspection_date}T${b.inspection_time || '00:00:00'}`).getTime();
                    break;
                case 'type':
                    aVal = (a.inspection_type?.name || '').toLowerCase();
                    bVal = (b.inspection_type?.name || '').toLowerCase();
                    break;
                case 'component':
                    aVal = (a.structure_components?.q_id || '').toLowerCase();
                    bVal = (b.structure_components?.q_id || '').toLowerCase();
                    break;
                case 'elev':
                    aVal = parseFloat(a.elevation || a.fp_kp || 0);
                    bVal = parseFloat(b.elevation || b.fp_kp || 0);
                    break;
                case 'status':
                    aVal = a.has_anomaly ? 2 : (a.status === 'COMPLETED' ? 1 : 0);
                    bVal = b.has_anomaly ? 2 : (b.status === 'COMPLETED' ? 1 : 0);
                    break;
                case 'anomaly_ref':
                    aVal = (a.insp_anomalies?.[0]?.anomaly_ref_no || '').toLowerCase();
                    bVal = (b.insp_anomalies?.[0]?.anomaly_ref_no || '').toLowerCase();
                    break;
                case 'cp_reading':
                    aVal = parseFloat(a.inspection_data?.cp_rdg ?? a.inspection_data?.cp_reading_mv ?? a.inspection_data?.cp ?? -9999);
                    bVal = parseFloat(b.inspection_data?.cp_rdg ?? b.inspection_data?.cp_reading_mv ?? b.inspection_data?.cp ?? -9999);
                    break;
                case 'dive_no':
                    aVal = (a.insp_dive_jobs?.dive_no || a.insp_dive_jobs?.job_no || '').toLowerCase();
                    bVal = (b.insp_dive_jobs?.dive_no || b.insp_dive_jobs?.job_no || '').toLowerCase();
                    break;
                case 'tape_no':
                    aVal = (a.insp_video_tapes?.tape_no || '').toLowerCase();
                    bVal = (b.insp_video_tapes?.tape_no || '').toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [records, sortConfig]);

    const displayRecords = useMemo(() => {
        if (!searchQuery) return sortedRecords;
        const q = searchQuery.toLowerCase();
        return sortedRecords.filter(r => {
            const type = (r.inspection_type?.name || "").toLowerCase();
            const component = (r.structure_components?.q_id || "").toLowerCase();
            const refNo = (r.insp_anomalies?.[0]?.anomaly_ref_no || "").toLowerCase();
            const cp = (r.inspection_data?.cp_rdg ?? r.inspection_data?.cp_reading_mv ?? r.inspection_data?.cp ?? "").toString().toLowerCase();
            const diveNo = (r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.job_no || "").toLowerCase();
            const tapeNo = (r.insp_video_tapes?.tape_no || "").toLowerCase();

            return type.includes(q) || component.includes(q) || refNo.includes(q) || cp.includes(q) || diveNo.includes(q) || tapeNo.includes(q);
        });
    }, [sortedRecords, searchQuery]);

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
            <div className="p-2 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Smart filter records..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs bg-white dark:bg-slate-950"
                    />
                </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b z-10">
                        <tr>
                            <th className="px-2 py-1.5 text-left w-22 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('inspection_date')}>
                                <div className="flex items-center gap-1">
                                    Date <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-left w-32 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('type')}>
                                <div className="flex items-center gap-1">
                                    Type <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-left w-24 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('component')}>
                                <div className="flex items-center gap-1">
                                    Component <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-left w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('anomaly_ref')}>
                                <div className="flex items-center gap-1">
                                    Anomaly Ref <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-center w-20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('cp_reading')}>
                                <div className="flex items-center gap-1 justify-center">
                                    CP <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-center w-20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('dive_no')}>
                                <div className="flex items-center gap-1 justify-center">
                                    Dive <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-center w-20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('tape_no')}>
                                <div className="flex items-center gap-1 justify-center">
                                    Tape <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-center w-16 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('elev')}>
                                <div className="flex items-center gap-1 justify-center">
                                    Elev <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-center w-20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-1 justify-center">
                                    Status <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </th>
                            <th className="px-2 py-1.5 text-right w-16">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayRecords.map((record) => {
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
                                        <div className="flex flex-col gap-0.5 max-w-[140px]">
                                            {record.inspection_type?.name ? (
                                                <>
                                                    <span className="font-bold text-xs truncate leading-tight" title={record.inspection_type.name}>
                                                        {record.inspection_type.name}
                                                    </span>
                                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-medium w-fit uppercase text-muted-foreground border-slate-200 dark:border-slate-800">
                                                        {record.inspection_type_code || record.inspection_type.code || 'UNK'}
                                                    </Badge>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] h-4 px-1 font-normal w-fit uppercase">
                                                    {record.inspection_type_code || record.inspection_type?.code || 'UNK'}
                                                </Badge>
                                            )}
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
                                    <td className="px-2 py-1.5 align-top">
                                        {record.insp_anomalies?.[0]?.anomaly_ref_no ? (
                                            <Badge variant="destructive" className="text-[9px] h-4 px-1 font-mono">
                                                {record.insp_anomalies[0].anomaly_ref_no}
                                            </Badge>
                                        ) : '-'}
                                    </td>
                                    <td className="px-2 py-1.5 align-top text-center font-mono text-[10px]">
                                        {record.inspection_data?.cp_rdg ?? record.inspection_data?.cp_reading_mv ?? record.inspection_data?.cp ?? '-'}
                                    </td>
                                    <td className="px-2 py-1.5 align-top text-center text-[10px]">
                                        {record.insp_dive_jobs?.dive_no || record.insp_dive_jobs?.job_no || '-'}
                                    </td>
                                    <td className="px-2 py-1.5 align-top text-center text-[10px] whitespace-nowrap">
                                        {record.insp_video_tapes?.tape_no || '-'}
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
