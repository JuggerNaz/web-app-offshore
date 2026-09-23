"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    History, 
    Trash2, 
    Edit, 
    Clock, 
    Video, 
    Film,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Layers,
    AlertCircle,
    CheckCircle2,
    Play,
    Square,
    Pause,
    Bookmark,
    FileText,
    Eye,
    EyeOff,
    Search,
    X,
    Filter,
    ChevronsUpDown,
    Camera,
    Plus,
    RefreshCw,
    Calendar,
    Sparkles,
    Check,
    ArrowRight
} from "lucide-react";
import { formatClientDateTime, toDatetimeLocalString, toUtcIsoTimestamp, parseClientDate, parseDbDate } from "@/utils/client-date";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TapeLogEventsProps {
    videoEvents: any[];
    handleDeleteEvent: (id: string, logType: string, realId: number) => void;
    onEditEvent: (ev: any) => void;
    expanded?: boolean;
    setExpanded?: (v: boolean) => void;
    isFloating?: boolean;
    inline?: boolean;
    onRefresh?: () => void;
}

const STANDARD_ACTIONS = [
    { value: "START TAPE", dbCode: "NEW_LOG_START", label: "Start Tape", color: "emerald", icon: Play },
    { value: "STOP TAPE", dbCode: "END", label: "Stop Tape", color: "rose", icon: Square },
    { value: "PAUSE", dbCode: "PAUSE", label: "Pause Tape", color: "amber", icon: Pause },
    { value: "RESUME", dbCode: "RESUME", label: "Resume Tape", color: "blue", icon: Play },
    { value: "START TASK", dbCode: "START_TASK", label: "Start Task", color: "cyan", icon: Bookmark },
    { value: "STOP TASK", dbCode: "STOP_TASK", label: "Stop Task", color: "indigo", icon: Bookmark },
    { value: "NOTE", dbCode: "NOTE", label: "Note / Remark", color: "purple", icon: FileText },
    { value: "PRE-INSPECTION", dbCode: "PRE_INSPECTION", label: "Pre-Inspection", color: "sky", icon: Camera },
    { value: "POST-INSPECTION", dbCode: "POST_INSPECTION", label: "Post-Inspection", color: "teal", icon: Camera },
    { value: "INTRODUCTION", dbCode: "INTRODUCTION", label: "Introduction", color: "slate", icon: Video },
    { value: "CUSTOM", dbCode: "CUSTOM", label: "Custom Event", color: "violet", icon: Layers },
];

export const TapeLogEvents: React.FC<TapeLogEventsProps> = ({
    videoEvents: initialVideoEvents,
    handleDeleteEvent,
    onEditEvent,
    expanded,
    setExpanded,
    isFloating = false,
    inline = false,
    onRefresh,
}) => {
    const supabase = useMemo(() => createClient(), []);

    // Local events list synchronized with initial prop
    const [localEvents, setLocalEvents] = useState<any[]>(initialVideoEvents || []);

    useEffect(() => {
        setLocalEvents(initialVideoEvents || []);
    }, [initialVideoEvents]);

    const [selectedTapeFilter, setSelectedTapeFilter] = useState<string>("ALL");
    const [showInspectionLogs, setShowInspectionLogs] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [expandedTapes, setExpandedTapes] = useState<Set<string>>(new Set());
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [hasInitializedExpand, setHasInitializedExpand] = useState<boolean>(false);

    // Add Missing Tape Log Dialog State
    const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Form State for Add / Edit
    const [formTapeNo, setFormTapeNo] = useState<string>("");
    const [formCustomTapeNo, setFormCustomTapeNo] = useState<string>("");
    const [formChapterNo, setFormChapterNo] = useState<string>("1");
    const [formCustomChapterNo, setFormCustomChapterNo] = useState<string>("");
    const [formAction, setFormAction] = useState<string>("START TAPE");
    const [formEventTime, setFormEventTime] = useState<string>("");
    const [formTimecode, setFormTimecode] = useState<string>("00:00:00");
    const [formRemarks, setFormRemarks] = useState<string>("");
    const [formEditingId, setFormEditingId] = useState<{ id: string; realId: number; logType: string } | null>(null);
    const [isAutoDateCalculated, setIsAutoDateCalculated] = useState<boolean>(true);

    const formatSecondsToTimecode = (totalSeconds: number): string => {
        const s = Math.max(0, Math.floor(totalSeconds));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const timecodeToSeconds = (tc: string): number => {
        if (!tc) return 0;
        const parts = tc.split(":").map(p => parseInt(p, 10) || 0);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parseInt(tc, 10) || 0;
    };

    // Sort events latest first
    const sortedEvents = useMemo(() => {
        return [...localEvents].sort((a, b) => {
            const timeA = a.eventTime ? new Date(a.eventTime).getTime() : 0;
            const timeB = b.eventTime ? new Date(b.eventTime).getTime() : 0;
            if (timeA === timeB) {
                return (b.realId || b.id || 0) - (a.realId || a.id || 0);
            }
            return timeB - timeA;
        });
    }, [localEvents]);

    // Distinct tapes summary
    const distinctTapes = useMemo(() => {
        const tapeCounts: Record<string, { total: number; tapeLogs: number; inspLogs: number; chapters: Set<string> }> = {};
        sortedEvents.forEach(ev => {
            const tNo = ev.tapeNo && ev.tapeNo !== "N/A" ? ev.tapeNo : "Unassigned";
            const chNo = ev.chapterNo != null && String(ev.chapterNo) !== "N/A" ? String(ev.chapterNo) : "1";
            if (!tapeCounts[tNo]) {
                tapeCounts[tNo] = { total: 0, tapeLogs: 0, inspLogs: 0, chapters: new Set() };
            }
            tapeCounts[tNo].total += 1;
            tapeCounts[tNo].chapters.add(chNo);
            const isInsp = ev.logType === "insp" || ev.action === "INSPECTION" || ev.action === "ANOMALY" || ev.action === "DEFECT";
            if (isInsp) {
                tapeCounts[tNo].inspLogs += 1;
            } else {
                tapeCounts[tNo].tapeLogs += 1;
            }
        });
        return tapeCounts;
    }, [sortedEvents]);

    // Available tape list for dropdowns
    const availableTapeList = useMemo(() => {
        return Object.keys(distinctTapes).filter(t => t !== "Unassigned").sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        );
    }, [distinctTapes]);

    // Filter events by selected tape, show/hide inspection logs, and search query
    const filteredEvents = useMemo(() => {
        let list = sortedEvents;

        // 1. Tape filter
        if (selectedTapeFilter !== "ALL") {
            list = list.filter(ev => {
                const tNo = ev.tapeNo && ev.tapeNo !== "N/A" ? ev.tapeNo : "Unassigned";
                return tNo === selectedTapeFilter;
            });
        }

        // 2. Inspection log show/hide
        if (!showInspectionLogs) {
            list = list.filter(ev => {
                const isInsp = ev.logType === "insp" || ev.action === "INSPECTION" || ev.action === "ANOMALY" || ev.action === "DEFECT";
                return !isInsp;
            });
        }

        // 3. Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(ev => {
                const actionMatch = (ev.action || "").toLowerCase().includes(q);
                const tapeMatch = (ev.tapeNo || "").toLowerCase().includes(q);
                const chMatch = (String(ev.chapterNo || "")).toLowerCase().includes(q);
                const timeMatch = (ev.time || "").toLowerCase().includes(q);
                const remarksMatch = (ev.remarks || "").toLowerCase().includes(q);
                const diveMatch = (ev.diveNo || "").toLowerCase().includes(q);
                const structMatch = (ev.structure || "").toLowerCase().includes(q);
                return actionMatch || tapeMatch || chMatch || timeMatch || remarksMatch || diveMatch || structMatch;
            });
        }

        return list;
    }, [sortedEvents, selectedTapeFilter, showInspectionLogs, searchQuery]);

    // Build hierarchical tree: Tape -> Chapter -> Events
    const treeData = useMemo(() => {
        const tapesMap: Record<string, {
            tapeNo: string;
            tapeId?: string | number;
            diveNo: string;
            structure: string;
            chapters: Record<string, typeof filteredEvents>;
            sortedChapterKeys: string[];
            totalCount: number;
            tapeCount: number;
            inspCount: number;
        }> = {};

        filteredEvents.forEach(ev => {
            const tNo = ev.tapeNo && ev.tapeNo !== "N/A" ? ev.tapeNo : "Unassigned";
            const chNo = ev.chapterNo != null && String(ev.chapterNo) !== "N/A" ? String(ev.chapterNo) : "No Chapter";

            if (!tapesMap[tNo]) {
                tapesMap[tNo] = {
                    tapeNo: tNo,
                    tapeId: ev.tapeId || ev.tape_id,
                    diveNo: ev.diveNo || "N/A",
                    structure: ev.structure || "N/A",
                    chapters: {},
                    sortedChapterKeys: [],
                    totalCount: 0,
                    tapeCount: 0,
                    inspCount: 0,
                };
            }

            if (!tapesMap[tNo].chapters[chNo]) {
                tapesMap[tNo].chapters[chNo] = [];
            }

            tapesMap[tNo].chapters[chNo].push(ev);
            tapesMap[tNo].totalCount += 1;

            const isInsp = ev.logType === "insp" || ev.action === "INSPECTION" || ev.action === "ANOMALY" || ev.action === "DEFECT";
            if (isInsp) tapesMap[tNo].inspCount += 1;
            else tapesMap[tNo].tapeCount += 1;
        });

        // Sort tapes
        const sortedTapeKeys = Object.keys(tapesMap).sort((a, b) => {
            if (a === "Unassigned") return 1;
            if (b === "Unassigned") return -1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });

        // Sort chapters in each tape descending
        sortedTapeKeys.forEach(tKey => {
            const chMap = tapesMap[tKey].chapters;
            tapesMap[tKey].sortedChapterKeys = Object.keys(chMap).sort((a, b) => {
                if (a === "No Chapter") return 1;
                if (b === "No Chapter") return -1;
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numB - numA;
                }
                return b.localeCompare(a);
            });
        });

        return {
            tapesMap,
            sortedTapeKeys,
        };
    }, [filteredEvents]);

    // Auto-expand all top-level tapes on first load
    useEffect(() => {
        if (!hasInitializedExpand && treeData.sortedTapeKeys.length > 0) {
            setExpandedTapes(new Set(treeData.sortedTapeKeys));
            const allChs = new Set<string>();
            treeData.sortedTapeKeys.forEach(tKey => {
                treeData.tapesMap[tKey].sortedChapterKeys.forEach(ch => {
                    allChs.add(`${tKey}___${ch}`);
                });
            });
            setExpandedChapters(allChs);
            setHasInitializedExpand(true);
        }
    }, [treeData, hasInitializedExpand]);

    const toggleTapeExpand = (tapeKey: string) => {
        setExpandedTapes(prev => {
            const next = new Set(prev);
            if (next.has(tapeKey)) next.delete(tapeKey);
            else next.add(tapeKey);
            return next;
        });
    };

    const toggleChapterExpand = (tapeKey: string, chKey: string) => {
        const fullKey = `${tapeKey}___${chKey}`;
        setExpandedChapters(prev => {
            const next = new Set(prev);
            if (next.has(fullKey)) next.delete(fullKey);
            else next.add(fullKey);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedTapes(new Set(treeData.sortedTapeKeys));
        const allChs = new Set<string>();
        treeData.sortedTapeKeys.forEach(tKey => {
            treeData.tapesMap[tKey].sortedChapterKeys.forEach(ch => {
                allChs.add(`${tKey}___${ch}`);
            });
        });
        setExpandedChapters(allChs);
    };

    const collapseAll = () => {
        setExpandedTapes(new Set());
        setExpandedChapters(new Set());
    };

    const firstEvent = localEvents.find(ev => ev.tapeNo && ev.tapeNo !== "N/A") || localEvents[0];
    const commonTapeNo = firstEvent?.tapeNo || "N/A";
    const commonDiveNo = firstEvent?.diveNo || "N/A";
    const commonStructure = firstEvent?.structure || "N/A";

    const totalTapeLogsCount = useMemo(() => {
        return sortedEvents.filter(ev => !(ev.logType === "insp" || ev.action === "INSPECTION" || ev.action === "ANOMALY" || ev.action === "DEFECT")).length;
    }, [sortedEvents]);

    const totalInspLogsCount = useMemo(() => {
        return sortedEvents.filter(ev => (ev.logType === "insp" || ev.action === "INSPECTION" || ev.action === "ANOMALY" || ev.action === "DEFECT")).length;
    }, [sortedEvents]);

    const formatEventTime = (timeStr?: string | null) => {
        if (!timeStr) return "-";
        return formatClientDateTime(timeStr, "MMM dd, HH:mm:ss");
    };

    // Auto compute Date & Time and Timecode based on selected Tape No, Chapter No, and Action
    const computeAutoDateTimeAndCounter = (targetTape: string, targetChapter: string, targetAction: string) => {
        const effectiveTape = targetTape === "__NEW__" ? formCustomTapeNo : targetTape;
        const effectiveChapter = targetChapter === "__NEW__" ? formCustomChapterNo : targetChapter;

        // Find all events for this tape and chapter
        const matchingEvents = sortedEvents.filter(ev => {
            const tNo = ev.tapeNo && ev.tapeNo !== "N/A" ? ev.tapeNo : "";
            const chNo = ev.chapterNo != null ? String(ev.chapterNo) : "";
            return tNo.trim().toUpperCase() === (effectiveTape || "").trim().toUpperCase() &&
                   chNo.trim() === (effectiveChapter || "").trim();
        });

        const sortedChronological = [...matchingEvents].sort((a, b) => {
            const tA = a.eventTime ? new Date(a.eventTime).getTime() : 0;
            const tB = b.eventTime ? new Date(b.eventTime).getTime() : 0;
            return tA - tB;
        });

        const startEvent = sortedChronological.find(ev => 
            (ev.action || "").toUpperCase().includes("START") && (ev.action || "").toUpperCase().includes("TAPE")
        );

        let suggestedDate: Date;
        let suggestedTimecode = "00:00:00";

        if (targetAction === "START TAPE") {
            if (startEvent && startEvent.eventTime) {
                suggestedDate = new Date(startEvent.eventTime);
            } else if (sortedChronological.length > 0 && sortedChronological[0].eventTime) {
                // If there are other events, suggest 1 minute before first event
                suggestedDate = new Date(new Date(sortedChronological[0].eventTime).getTime() - 60000);
            } else {
                // Check if other chapters in this tape exist
                const tapeEvents = sortedEvents.filter(ev => (ev.tapeNo || "").trim().toUpperCase() === (effectiveTape || "").trim().toUpperCase());
                if (tapeEvents.length > 0 && tapeEvents[0].eventTime) {
                    suggestedDate = new Date(new Date(tapeEvents[0].eventTime).getTime() + 10 * 60000);
                } else {
                    suggestedDate = new Date();
                }
            }
            suggestedTimecode = "00:00:00";
        } else if (targetAction === "STOP TAPE") {
            if (sortedChronological.length > 0) {
                const latestEv = sortedChronological[sortedChronological.length - 1];
                if (latestEv.eventTime) {
                    suggestedDate = new Date(new Date(latestEv.eventTime).getTime() + 5 * 60000); // 5 mins after last event
                } else {
                    suggestedDate = new Date();
                }

                if (startEvent && startEvent.eventTime) {
                    const startAt = new Date(startEvent.eventTime).getTime();
                    const endAt = suggestedDate.getTime();
                    const diff = Math.max(0, Math.floor((endAt - startAt) / 1000));
                    suggestedTimecode = formatSecondsToTimecode(diff);
                } else if (latestEv.time) {
                    const lastSecs = timecodeToSeconds(latestEv.time);
                    suggestedTimecode = formatSecondsToTimecode(lastSecs + 300);
                } else {
                    suggestedTimecode = "00:15:00";
                }
            } else {
                suggestedDate = new Date();
                suggestedTimecode = "00:15:00";
            }
        } else {
            // General event, Pause, Resume, Task, Note
            if (sortedChronological.length > 0) {
                const latestEv = sortedChronological[sortedChronological.length - 1];
                if (latestEv.eventTime) {
                    suggestedDate = new Date(new Date(latestEv.eventTime).getTime() + 60000);
                } else {
                    suggestedDate = new Date();
                }

                if (startEvent && startEvent.eventTime) {
                    const startAt = new Date(startEvent.eventTime).getTime();
                    const currAt = suggestedDate.getTime();
                    const diff = Math.max(0, Math.floor((currAt - startAt) / 1000));
                    suggestedTimecode = formatSecondsToTimecode(diff);
                } else if (latestEv.time) {
                    const lastSecs = timecodeToSeconds(latestEv.time);
                    suggestedTimecode = formatSecondsToTimecode(lastSecs + 60);
                }
            } else {
                suggestedDate = new Date();
                suggestedTimecode = "00:00:00";
            }
        }

        const localIso = toDatetimeLocalString(suggestedDate.toISOString());
        return {
            eventTime: localIso,
            timecode: suggestedTimecode,
        };
    };

    // Open Add Modal with smart defaults
    const handleOpenAddModal = (defaultTape?: string, defaultChapter?: string) => {
        const tape = defaultTape || (availableTapeList.length > 0 ? availableTapeList[0] : commonTapeNo !== "N/A" ? commonTapeNo : "");
        const chaptersForTape = tape && distinctTapes[tape] ? Array.from(distinctTapes[tape].chapters) : ["1"];
        const chapter = defaultChapter || (chaptersForTape.length > 0 ? chaptersForTape[0] : "1");
        
        setFormTapeNo(tape);
        setFormCustomTapeNo("");
        setFormChapterNo(chapter);
        setFormCustomChapterNo("");
        setFormAction("START TAPE");
        setFormRemarks("");
        setFormEditingId(null);
        setIsAutoDateCalculated(true);

        const computed = computeAutoDateTimeAndCounter(tape, chapter, "START TAPE");
        setFormEventTime(computed.eventTime);
        setFormTimecode(computed.timecode);

        setIsAddModalOpen(true);
    };

    // Open Edit Modal for a specific event
    const handleOpenEditModal = (ev: any) => {
        setFormEditingId({ id: ev.id, realId: ev.realId, logType: ev.logType || "video_log" });
        setFormTapeNo(ev.tapeNo || commonTapeNo);
        setFormChapterNo(String(ev.chapterNo || "1"));
        setFormAction(ev.action || "START TAPE");
        setFormTimecode(ev.time || "00:00:00");
        setFormRemarks(ev.remarks || "");
        setIsAutoDateCalculated(false);

        if (ev.eventTime) {
            setFormEventTime(toDatetimeLocalString(ev.eventTime));
        } else {
            setFormEventTime(toDatetimeLocalString(new Date().toISOString()));
        }

        setIsEditModalOpen(true);
    };

    // When tape, chapter, or action changes in Add Modal, update auto suggestion
    const handleAddFormChange = (newTape: string, newChapter: string, newAction: string) => {
        setFormTapeNo(newTape);
        setFormChapterNo(newChapter);
        setFormAction(newAction);

        if (isAutoDateCalculated) {
            const computed = computeAutoDateTimeAndCounter(newTape, newChapter, newAction);
            setFormEventTime(computed.eventTime);
            setFormTimecode(computed.timecode);
        }
    };

    // When user manually edits Date & Time, recalculate timecode counter if chapter start exists
    const handleDateTimeChange = (newLocalVal: string) => {
        setFormEventTime(newLocalVal);
        setIsAutoDateCalculated(false);

        if (!newLocalVal) return;
        const effectiveTape = formTapeNo === "__NEW__" ? formCustomTapeNo : formTapeNo;
        const effectiveChapter = formChapterNo === "__NEW__" ? formCustomChapterNo : formChapterNo;

        // Find chapter start event
        const matchingEvents = sortedEvents.filter(ev => {
            const tNo = ev.tapeNo && ev.tapeNo !== "N/A" ? ev.tapeNo : "";
            const chNo = ev.chapterNo != null ? String(ev.chapterNo) : "";
            return tNo.trim().toUpperCase() === (effectiveTape || "").trim().toUpperCase() &&
                   chNo.trim() === (effectiveChapter || "").trim();
        });

        const startEvent = matchingEvents.find(ev => 
            (ev.action || "").toUpperCase().includes("START") && (ev.action || "").toUpperCase().includes("TAPE")
        );

        if (startEvent && startEvent.eventTime && formAction !== "START TAPE") {
            const startDate = parseDbDate(startEvent.eventTime);
            const userDate = parseClientDate(newLocalVal);
            const diffSecs = Math.max(0, Math.floor((userDate.getTime() - startDate.getTime()) / 1000));
            setFormTimecode(formatSecondsToTimecode(diffSecs));
        }
    };

    // Recalculate button trigger
    const triggerRecalculate = () => {
        const computed = computeAutoDateTimeAndCounter(formTapeNo, formChapterNo, formAction);
        setFormEventTime(computed.eventTime);
        setFormTimecode(computed.timecode);
        setIsAutoDateCalculated(true);
        toast.info("Auto-calculated Date & Time from Chapter timeline");
    };

    // Save Log Event (Add / Update)
    const handleSaveLogEvent = async () => {
        const effectiveTapeNo = (formTapeNo === "__NEW__" ? formCustomTapeNo : formTapeNo).trim();
        const effectiveChapterNo = parseInt((formChapterNo === "__NEW__" ? formCustomChapterNo : formChapterNo).trim(), 10) || 1;

        if (!effectiveTapeNo) {
            toast.error("Please specify a valid Tape Number");
            return;
        }

        if (!formEventTime) {
            toast.error("Please enter a valid Date & Time");
            return;
        }

        setIsSubmitting(true);
        try {
            const isoEventTime = toUtcIsoTimestamp(formEventTime);
            const totalCounterSecs = timecodeToSeconds(formTimecode);

            // Map UI action to standard DB event_type code
            const matchedStandard = STANDARD_ACTIONS.find(a => a.value === formAction || a.label === formAction);
            let dbEventType = matchedStandard?.dbCode || formAction;
            if (formAction === "START TAPE") dbEventType = "NEW_LOG_START";
            if (formAction === "STOP TAPE") dbEventType = "END";
            if (formAction === "PAUSE") dbEventType = "PAUSE";
            if (formAction === "RESUME") dbEventType = "RESUME";

            if (isEditModalOpen && formEditingId) {
                // UPDATE existing event
                if (formEditingId.logType === "video_log") {
                    const { error: updErr } = await supabase
                        .from("insp_video_logs")
                        .update({
                            event_type: dbEventType,
                            event_time: isoEventTime,
                            timecode_start: formTimecode,
                            tape_counter_start: totalCounterSecs,
                            remarks: formRemarks,
                        })
                        .eq("video_log_id", formEditingId.realId);

                    if (updErr) throw updErr;

                    // Update local state
                    setLocalEvents(prev => prev.map(ev => {
                        if (ev.id === formEditingId.id) {
                            return {
                                ...ev,
                                action: formAction,
                                time: formTimecode,
                                eventTime: isoEventTime,
                                remarks: formRemarks,
                                tape_counter_start: totalCounterSecs,
                            };
                        }
                        return ev;
                    }));

                    toast.success("Tape log event updated successfully");
                } else if (formEditingId.logType === "insp") {
                    // Forward to parent inspection edit handler
                    onEditEvent({
                        id: formEditingId.realId,
                        time: formTimecode,
                        action: formAction,
                        eventTime: isoEventTime,
                        remarks: formRemarks,
                    });
                }
                setIsEditModalOpen(false);
            } else {
                // INSERT new tape log event
                // 1. Find or create matching tape in insp_video_tapes
                let targetTapeId: number | null = null;
                const { data: existingTape } = await supabase
                    .from("insp_video_tapes")
                    .select("tape_id")
                    .eq("tape_no", effectiveTapeNo)
                    .eq("chapter_no", effectiveChapterNo)
                    .maybeSingle();

                if (existingTape) {
                    targetTapeId = existingTape.tape_id;
                } else {
                    const user = (await supabase.auth.getUser()).data.user;
                    const { data: newTape, error: tapeErr } = await supabase
                        .from("insp_video_tapes")
                        .insert({
                            tape_no: effectiveTapeNo,
                            chapter_no: effectiveChapterNo,
                            tape_type: "DIGITAL - PRIMARY",
                            status: "ACTIVE",
                            cr_user: user?.id || "system",
                        })
                        .select("tape_id")
                        .single();

                    if (tapeErr) {
                        console.warn("[TapeLogEvents] Could not insert new tape record, using fallback:", tapeErr.message);
                    } else if (newTape) {
                        targetTapeId = newTape.tape_id;
                    }
                }

                // 2. Insert into insp_video_logs
                const insertPayload: any = {
                    event_type: dbEventType,
                    event_time: isoEventTime,
                    timecode_start: formTimecode,
                    tape_counter_start: totalCounterSecs,
                    remarks: formRemarks,
                };
                if (targetTapeId) insertPayload.tape_id = targetTapeId;

                const { data: insertedLog, error: logErr } = await supabase
                    .from("insp_video_logs")
                    .insert(insertPayload)
                    .select("video_log_id")
                    .single();

                if (logErr) throw logErr;

                // Optimistically add to local state
                const optimisticNewEvent = {
                    id: `log_${insertedLog?.video_log_id || Date.now()}`,
                    realId: insertedLog?.video_log_id || 0,
                    time: formTimecode,
                    action: formAction,
                    logType: "video_log",
                    eventTime: isoEventTime,
                    tape_id: targetTapeId,
                    tapeNo: effectiveTapeNo,
                    chapterNo: String(effectiveChapterNo),
                    diveNo: commonDiveNo,
                    structure: commonStructure,
                    remarks: formRemarks,
                    tape_counter_start: totalCounterSecs,
                };

                setLocalEvents(prev => [optimisticNewEvent, ...prev]);
                
                // Ensure the tape and chapter are expanded in the tree
                setExpandedTapes(prev => new Set(prev).add(effectiveTapeNo));
                setExpandedChapters(prev => new Set(prev).add(`${effectiveTapeNo}___${effectiveChapterNo}`));

                toast.success(`Added ${formAction} to Tape: ${effectiveTapeNo} (Ch ${effectiveChapterNo})`);
                setIsAddModalOpen(false);
            }

            if (onRefresh) onRefresh();
        } catch (err: any) {
            console.error("[TapeLogEvents] Save Error:", err);
            toast.error(`Failed to save log event: ${err?.message || "Unknown error"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getActionStyle = (action: string) => {
        const act = (action || "").toUpperCase();
        if (act.includes("START") && act.includes("TAPE")) {
            return {
                badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                dot: "bg-emerald-500 shadow-emerald-500/50 shadow-sm",
                icon: <Play className="w-3 h-3 text-emerald-400" />,
                textColor: "text-emerald-400 font-bold",
            };
        }
        if (act.includes("STOP") && act.includes("TAPE")) {
            return {
                badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                dot: "bg-rose-500 shadow-rose-500/50 shadow-sm",
                icon: <Square className="w-3 h-3 text-rose-400" />,
                textColor: "text-rose-400 font-bold",
            };
        }
        if (act.includes("PAUSE") || act.includes("RESUME")) {
            return {
                badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                dot: "bg-amber-500 shadow-amber-500/50 shadow-sm",
                icon: <Pause className="w-3 h-3 text-amber-400" />,
                textColor: "text-amber-400 font-bold",
            };
        }
        if (act.includes("ANOMALY") || act.includes("DEFECT")) {
            return {
                badge: "bg-red-500/15 text-red-400 border-red-500/40 shadow-sm",
                dot: "bg-red-500 animate-pulse shadow-red-500/50 shadow-sm",
                icon: <AlertCircle className="w-3 h-3 text-red-400" />,
                textColor: "text-red-400 font-black",
            };
        }
        if (act.includes("INSPECTION")) {
            return {
                badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                dot: "bg-blue-500 shadow-blue-500/50 shadow-sm",
                icon: <Camera className="w-3 h-3 text-blue-400" />,
                textColor: "text-blue-400 font-bold",
            };
        }
        if (act.includes("CHAPTER") || act.includes("TASK")) {
            return {
                badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
                dot: "bg-purple-500 shadow-purple-500/50 shadow-sm",
                icon: <Bookmark className="w-3 h-3 text-purple-400" />,
                textColor: "text-purple-400 font-bold",
            };
        }
        return {
            badge: "bg-slate-800 text-slate-300 border-slate-700",
            dot: "bg-slate-400",
            icon: <Clock className="w-3 h-3 text-slate-400" />,
            textColor: "text-slate-300",
        };
    };

    const renderTreeView = () => {
        const tapeKeys = Object.keys(distinctTapes).sort((a, b) => {
            if (a === "Unassigned") return 1;
            if (b === "Unassigned") return -1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });

        return (
            <div className="flex flex-col gap-3 min-h-0">
                {/* 1. Header Toolbar: Search + Show/Hide Toggle + Add Log + Expand/Collapse */}
                <div className="bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 shadow-lg flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search events, chapters, timecodes, remarks..."
                                className="h-8 pl-8 pr-7 text-xs bg-slate-800/80 border-slate-700/80 text-slate-100 placeholder:text-slate-500 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Toggle Show/Hide Inspection Logs */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowInspectionLogs(!showInspectionLogs)}
                            className={`h-8 px-2.5 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                                showInspectionLogs
                                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30 hover:text-blue-300 shadow-sm"
                                    : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                        >
                            {showInspectionLogs ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{showInspectionLogs ? "Inspection Logs: Shown" : "Inspection Logs: Hidden"}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 font-mono">
                                {totalInspLogsCount}
                            </span>
                        </Button>

                        {/* + Add Tape Log Button */}
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenAddModal()}
                            className="h-8 px-3 text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg shadow-md shadow-emerald-900/30 border border-emerald-500/30 flex items-center gap-1.5 shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Add Tape Log</span>
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        {/* Expand / Collapse All */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={expandAll}
                            className="h-7 px-2 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                            title="Expand all tree branches"
                        >
                            Expand All
                        </Button>
                        <span className="text-slate-700">|</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={collapseAll}
                            className="h-7 px-2 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                            title="Collapse all tree branches"
                        >
                            Collapse All
                        </Button>
                    </div>
                </div>

                {/* 2. Tape Pills Filter Bar */}
                {tapeKeys.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setSelectedTapeFilter("ALL")}
                            className={`px-3 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all shrink-0 flex items-center gap-2 border ${
                                selectedTapeFilter === "ALL"
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            }`}
                        >
                            <Video className="w-3.5 h-3.5" />
                            All Tapes
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                                selectedTapeFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                            }`}>
                                {filteredEvents.length}
                            </span>
                        </button>

                        {tapeKeys.map(tNo => {
                            const stats = distinctTapes[tNo];
                            const isSelected = selectedTapeFilter === tNo;
                            return (
                                <button
                                    key={tNo}
                                    type="button"
                                    onClick={() => setSelectedTapeFilter(tNo)}
                                    className={`px-3 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all shrink-0 flex items-center gap-2 border ${
                                        isSelected
                                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20"
                                            : "bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                    }`}
                                >
                                    <Film className="w-3.5 h-3.5 text-cyan-400 opacity-80" />
                                    <span className="truncate max-w-[200px]">{tNo}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                                        isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                                    }`}>
                                        {showInspectionLogs ? stats.total : stats.tapeLogs}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 3. Tree View Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 min-h-[300px]">
                    {treeData.sortedTapeKeys.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center text-slate-500 gap-3 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                            <History className="w-12 h-12 opacity-30 text-blue-400" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">No Video Log Events Found</p>
                                <p className="text-xs text-slate-600">
                                    {searchQuery ? "No events match your search query." : "No records or tape events have been logged yet."}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <Button size="sm" onClick={() => handleOpenAddModal()} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Missing Tape Log
                                </Button>
                                {searchQuery && (
                                    <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="text-xs border-slate-700">
                                        Clear Search
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        treeData.sortedTapeKeys.map(tKey => {
                            const tapeData = treeData.tapesMap[tKey];
                            const isTapeExpanded = expandedTapes.has(tKey);

                            return (
                                <div 
                                    key={tKey} 
                                    className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-md transition-all"
                                >
                                    {/* Level 1: Tape Header Node */}
                                    <div
                                        onClick={() => toggleTapeExpand(tKey)}
                                        className="p-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/60 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between border-b border-slate-800/80 select-none transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-6 h-6 rounded-md bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:border-blue-400 transition-colors">
                                                {isTapeExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </div>
                                            {isTapeExpanded ? (
                                                <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                                            ) : (
                                                <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                                            )}
                                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                <span className="text-xs font-black uppercase text-slate-100 tracking-wide truncate">
                                                    Tape: <span className="text-cyan-400 font-mono">{tKey}</span>
                                                </span>
                                                {tapeData.diveNo && tapeData.diveNo !== "N/A" && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                                                        Dive: {tapeData.diveNo}
                                                    </span>
                                                )}
                                                {tapeData.structure && tapeData.structure !== "N/A" && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-500/30 font-bold uppercase">
                                                        {tapeData.structure}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Quick Add Log to this Tape */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenAddModal(tKey);
                                                }}
                                                className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 transition-colors"
                                                title="Add log to this tape"
                                            >
                                                <Plus className="w-3 h-3" /> Log
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                {tapeData.sortedChapterKeys.length} {tapeData.sortedChapterKeys.length === 1 ? "Chapter" : "Chapters"}
                                            </span>
                                            <span className="text-[10px] font-black text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-800/60 font-mono">
                                                {tapeData.totalCount} {tapeData.totalCount === 1 ? "event" : "events"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Level 2 & 3: Chapters & Events Tree Body */}
                                    {isTapeExpanded && (
                                        <div className="p-3 space-y-3 bg-slate-950/40">
                                            {tapeData.sortedChapterKeys.map(chKey => {
                                                const chapterEvents = tapeData.chapters[chKey];
                                                const fullChKey = `${tKey}___${chKey}`;
                                                const isChapterExpanded = expandedChapters.has(fullChKey);

                                                return (
                                                    <div 
                                                        key={fullChKey}
                                                        className="ml-3 sm:ml-5 border-l-2 border-slate-800 pl-3 sm:pl-4 space-y-2 relative before:content-[''] before:absolute before:left-[-2px] before:top-3 before:w-3 before:h-[2px] before:bg-slate-800"
                                                    >
                                                        {/* Chapter Node Header */}
                                                        <div
                                                            onClick={() => toggleChapterExpand(tKey, chKey)}
                                                            className="p-2 bg-slate-900/90 hover:bg-slate-800/80 rounded-lg border border-slate-800/90 cursor-pointer flex items-center justify-between transition-all select-none group/ch shadow-sm"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-slate-400 group-hover/ch:text-purple-400 transition-colors">
                                                                    {isChapterExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                </div>
                                                                <Bookmark className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                                <span className="text-[11px] font-black uppercase text-slate-200 tracking-wider">
                                                                    {chKey === "No Chapter" ? "General Log" : `Chapter: ${chKey}`}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenAddModal(tKey, chKey);
                                                                    }}
                                                                    className="px-2 py-0.5 text-[9px] font-bold rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-colors"
                                                                    title="Add log to this chapter"
                                                                >
                                                                    <Plus className="w-2.5 h-2.5" /> Add
                                                                </button>
                                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-950/50 text-purple-300 border border-purple-800/40">
                                                                    {chapterEvents.length} {chapterEvents.length === 1 ? "event" : "events"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Level 3: Leaf Event Items */}
                                                        {isChapterExpanded && (
                                                            <div className="space-y-1.5 ml-2 sm:ml-3 pl-2 sm:pl-3 border-l-2 border-slate-800/50">
                                                                {chapterEvents.map((ev, idx) => {
                                                                    const style = getActionStyle(ev.action);

                                                                    return (
                                                                        <div
                                                                            key={ev.id || idx}
                                                                            className="group/ev relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-slate-900/80 hover:bg-slate-850 rounded-lg border border-slate-800/90 hover:border-slate-700 shadow-sm transition-all animate-in fade-in slide-in-from-top-1"
                                                                        >
                                                                            {/* Left: Timecode + Action Badge + Description */}
                                                                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                                                                {/* Timecode Pill */}
                                                                                <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-[11px] font-black shrink-0 tracking-wider shadow-inner">
                                                                                    {ev.time || "00:00:00"}
                                                                                </div>

                                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        {/* Action Pill */}
                                                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${style.badge}`}>
                                                                                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                                                            {ev.action}
                                                                                        </span>

                                                                                        {/* Component / Structure Tag if available */}
                                                                                        {ev.structure && ev.structure !== "N/A" && (
                                                                                            <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                                                                                                {ev.structure}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Timestamp & Remarks */}
                                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-1 flex-wrap">
                                                                                        <div className="flex items-center gap-1 text-slate-500">
                                                                                            <Clock className="w-3 h-3" />
                                                                                            <span>{formatEventTime(ev.eventTime)}</span>
                                                                                        </div>

                                                                                        {ev.remarks && ev.remarks !== "-" && (
                                                                                            <span className="text-slate-300 font-normal italic truncate max-w-md">
                                                                                                • {ev.remarks}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Right: Actions */}
                                                                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto opacity-80 sm:opacity-0 group-hover/ev:opacity-100 transition-opacity">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleOpenEditModal(ev)}
                                                                                    className="h-7 px-2 text-[10px] font-bold text-slate-400 hover:text-blue-400 hover:bg-blue-950/50 rounded-md border border-slate-800"
                                                                                    title="Edit event details"
                                                                                >
                                                                                    <Edit className="w-3 h-3 mr-1" /> Edit
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)}
                                                                                    className="h-7 px-2 text-[10px] font-bold text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-md border border-slate-800"
                                                                                    title="Delete event"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3 mr-1" /> Del
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    // Render Add / Edit Modal
    const renderAddEditModal = () => {
        const isOpen = isAddModalOpen || isEditModalOpen;
        const isEdit = isEditModalOpen;
        const availableChapters = formTapeNo && distinctTapes[formTapeNo] 
            ? Array.from(distinctTapes[formTapeNo].chapters) 
            : ["1"];

        return (
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                }
            }}>
                <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100 shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
                        <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-100">
                            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {isEdit ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </div>
                            <span>{isEdit ? "Edit Tape Log Event" : "Add Missing Tape Log Event"}</span>
                        </DialogTitle>
                        <p className="text-[11px] text-slate-400 mt-1">
                            {isEdit 
                                ? "Modify video counter timecode, status action, wall-clock date & time, or remarks." 
                                : "Select the target Tape, Chapter, standard action, and adjust the auto-calculated date & time."}
                        </p>
                    </DialogHeader>

                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {/* 1. Tape and Chapter Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tape Number</Label>
                                {isEdit ? (
                                    <Input 
                                        value={formTapeNo} 
                                        disabled 
                                        className="h-9 text-xs bg-slate-900/60 border-slate-800 text-slate-400 font-mono"
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <select
                                            value={formTapeNo}
                                            onChange={(e) => handleAddFormChange(e.target.value, formChapterNo, formAction)}
                                            className="w-full h-9 px-3 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            {availableTapeList.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value="__NEW__">+ Custom / New Tape No...</option>
                                        </select>
                                        {formTapeNo === "__NEW__" && (
                                            <Input
                                                value={formCustomTapeNo}
                                                onChange={(e) => setFormCustomTapeNo(e.target.value)}
                                                placeholder="Enter Tape Number (e.g. AM26-016-01 / BEP-A / V001R)"
                                                className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-100 font-mono"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Chapter Number</Label>
                                {isEdit ? (
                                    <Input 
                                        value={formChapterNo} 
                                        disabled 
                                        className="h-9 text-xs bg-slate-900/60 border-slate-800 text-slate-400 font-mono"
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <select
                                            value={formChapterNo}
                                            onChange={(e) => handleAddFormChange(formTapeNo, e.target.value, formAction)}
                                            className="w-full h-9 px-3 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-purple-400 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            {availableChapters.map(ch => (
                                                <option key={ch} value={ch}>Chapter {ch}</option>
                                            ))}
                                            <option value="__NEW__">+ New Chapter Number...</option>
                                        </select>
                                        {formChapterNo === "__NEW__" && (
                                            <Input
                                                type="number"
                                                min="1"
                                                value={formCustomChapterNo}
                                                onChange={(e) => setFormCustomChapterNo(e.target.value)}
                                                placeholder="Chapter Number (e.g. 12)"
                                                className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-100 font-mono"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Action Selector (Standard List) */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Action / Status Event</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {STANDARD_ACTIONS.map((act) => {
                                    const IconComp = act.icon;
                                    const isSelected = formAction === act.value;
                                    return (
                                        <button
                                            key={act.value}
                                            type="button"
                                            onClick={() => {
                                                if (isEdit) setFormAction(act.value);
                                                else handleAddFormChange(formTapeNo, formChapterNo, act.value);
                                            }}
                                            className={`p-2 rounded-lg text-left text-xs font-bold transition-all flex items-center gap-2 border ${
                                                isSelected
                                                    ? "bg-blue-600/25 border-blue-500 text-white shadow-sm ring-1 ring-blue-500"
                                                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white"
                                            }`}
                                        >
                                            <IconComp className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                            <span className="truncate">{act.label}</span>
                                            {isSelected && <Check className="w-3 h-3 ml-auto text-blue-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Wall Clock Date & Time (with Auto-Calculation & manual editing) */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                    Wall Clock (Date & Time)
                                </Label>
                                <div className="flex items-center gap-1.5">
                                    {isAutoDateCalculated && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                                            <Sparkles className="w-2.5 h-2.5" /> Auto-suggested
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={triggerRecalculate}
                                        className="h-6 px-1.5 text-[9px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 rounded"
                                        title="Recalculate Date & Time based on chapter timeline"
                                    >
                                        <RefreshCw className="w-2.5 h-2.5 mr-1" /> Recalculate
                                    </Button>
                                </div>
                            </div>

                            <Input
                                type="datetime-local"
                                step="1"
                                value={formEventTime}
                                onChange={(e) => handleDateTimeChange(e.target.value)}
                                className="h-9 text-xs font-mono font-bold bg-slate-950 border-slate-700 text-slate-100 focus-visible:ring-blue-500"
                            />
                            <p className="text-[10px] text-slate-400 italic">
                                Timestamp auto-adapts based on Tape & Chapter timeline; you can freely adjust it anytime.
                            </p>
                        </div>

                        {/* 4. Video Counter / Timecode */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                Video Counter Timecode (HH:MM:SS)
                            </Label>
                            <Input
                                value={formTimecode}
                                onChange={(e) => setFormTimecode(e.target.value)}
                                placeholder="00:00:00"
                                className="h-9 text-sm font-mono font-black text-cyan-400 bg-slate-900 border-slate-800"
                            />
                        </div>

                        {/* 5. Remarks */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Remarks / Notes (Optional)</Label>
                            <Textarea
                                value={formRemarks}
                                onChange={(e) => setFormRemarks(e.target.value)}
                                placeholder="Add any details, reason for log entry, or notes..."
                                rows={2}
                                className="text-xs bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setIsAddModalOpen(false);
                                setIsEditModalOpen(false);
                            }}
                            className="text-xs text-slate-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveLogEvent}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20"
                        >
                            {isSubmitting ? "Saving..." : isEdit ? "Update Event" : "Save Tape Log Event"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    if (inline) {
        return (
            <div className="h-full flex flex-col bg-slate-950/80">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {renderTreeView()}
                </div>
                {renderAddEditModal()}
            </div>
        );
    }

    return (
        <div className="border border-slate-800 rounded-lg bg-slate-950 flex flex-col transition-all duration-300">
            {/* Trigger Button / Header */}
            <div 
                className="bg-slate-900/90 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition-colors border-b border-slate-800 rounded-t-lg"
                onClick={() => setExpanded?.(true)}
            >
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Video Log Events</span>
                    {sortedEvents.length > 0 && (
                        <span className="bg-blue-900/40 text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-blue-800/40">{sortedEvents.length}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {sortedEvents.length > 0 ? (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-950/50 border border-blue-800/40 rounded text-[9px] font-bold text-blue-300 uppercase tracking-tight">
                            <span className="opacity-60">{sortedEvents[0].time}</span>
                            <span>{sortedEvents[0].action}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-500 italic font-medium px-2">Ready to record...</span>
                    )}
                </div>
            </div>

            {/* Popup Dialog with Tree View */}
            <Dialog open={expanded} onOpenChange={setExpanded}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-slate-800 shadow-2xl">
                    <DialogHeader className="p-4 border-b border-slate-800 bg-slate-900 shrink-0 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-slate-100">
                                <div className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-sm">
                                    <History className="w-4 h-4" />
                                </div>
                                <span>Video Log Event History</span>
                            </DialogTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                            <span className="px-2.5 py-0.5 rounded-md bg-blue-950 text-blue-400 border border-blue-800/60">Tape: {commonTapeNo}</span>
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/60">Dive: {commonDiveNo}</span>
                            <span className="px-2.5 py-0.5 rounded-md bg-purple-950 text-purple-400 border border-purple-800/60">Struct: {commonStructure}</span>
                            <span className="ml-auto text-slate-500 font-mono text-[9px] font-bold">
                                Total Events: {sortedEvents.length} (Tape: {totalTapeLogsCount} | Insp: {totalInspLogsCount})
                            </span>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-4">
                        {renderTreeView()}
                    </div>
                </DialogContent>
            </Dialog>

            {renderAddEditModal()}
        </div>
    );
};
