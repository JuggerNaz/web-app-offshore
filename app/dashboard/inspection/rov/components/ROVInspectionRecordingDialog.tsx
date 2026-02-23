"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle, Sparkles } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import {
    videoTapeIdAtom,
    videoTapeNoAtom,
    videoTimeCodeAtom,
    videoLogsAtom,
    type VideoLog
} from "@/lib/video-recorder/video-state";
import AttachmentManager, { type Attachment, type PendingFile } from "../../dive/components/AttachmentManager";

interface InspectionProperty {
    name: string;
    label: string;
    type: "text" | "number" | "select" | "boolean" | "date";
    options?: string[];
    required?: boolean;
    default?: any;
}

interface ROVInspectionRecordingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sowItem: any;
    rovJob: any;
    onSaved: () => void;
    currentRecord?: any; // To support editing later
    platformTitle?: string;
}

export default function ROVInspectionRecordingDialog({
    open,
    onOpenChange,
    sowItem,
    rovJob,
    onSaved,
    currentRecord,
    platformTitle,
    structureType = 'platform' // Default to platform if not provided
}: ROVInspectionRecordingDialogProps & { structureType?: 'platform' | 'pipeline' }) {
    const supabase = createClient();

    // Video State Atoms
    const activeTapeId = useAtomValue(videoTapeIdAtom);
    const activeTimeCode = useAtomValue(videoTimeCodeAtom);
    const setVideoLogs = useSetAtom(videoLogsAtom);

    // Form State
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [commonData, setCommonData] = useState({
        description: "",
        tapeId: "",
        tapeCounter: "",
        elevation: "",
        fpKp: "",
        isIncomplete: false,
        incompleteReason: "",
        hasAnomaly: false,
        inspectionDate: "",
        inspectionTime: "",
        // Mock ROV Data String
        rovHeading: "142.5",
        rovDepth: "45.2",
        rovPitch: "-2.4",
        rovAltitude: "12.0",
        rovRoll: "1.1",
        rovCp: "-950"
    });

    // Anomaly State
    const [anomalyData, setAnomalyData] = useState({
        id: null as number | null,
        displayRefNo: "",
        defectCode: "",
        defectType: "",
        priority: "",
        description: "",
        recommendation: "",
        isRectified: false,
        rectifiedRemarks: "",
        rectifiedDate: null as string | null,
        rectifiedBy: ""
    });

    const [defectCodes, setDefectCodes] = useState<any[]>([]);
    const [priorities, setPriorities] = useState<any[]>([]);
    const [allDefectTypes, setAllDefectTypes] = useState<any[]>([]);
    const [availableDefectTypes, setAvailableDefectTypes] = useState<any[]>([]);

    // Metadata State
    const [inspectionProperties, setInspectionProperties] = useState<InspectionProperty[]>([]);
    const [activeTapes, setActiveTapes] = useState<any[]>([]);

    // Track original state to detect removal
    const [originalHasAnomaly, setOriginalHasAnomaly] = useState(false);

    // Attachments
    const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

    // Fetch lists
    useEffect(() => {
        fetchAnomalyOptions();
    }, []);

    async function fetchAnomalyOptions() {
        // Fetch Codes (AMLY_COD)
        const { data: codes } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_COD').order('lib_desc');
        if (codes) setDefectCodes(codes);

        // Fetch Priorities (AMLY_TYP) - assuming this is priority
        const { data: prios } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_TYP').order('lib_desc');
        if (prios) setPriorities(prios);

        // Fetch Types (AMLY_FND)
        const { data: types } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_FND').order('lib_desc');
        if (types) {
            setAllDefectTypes(types);
            setAvailableDefectTypes(types); // Default to all initially
        }
    }

    // Filter Defect Types when Code changes
    useEffect(() => {
        const filterTypes = async () => {
            if (!anomalyData.defectCode || defectCodes.length === 0) {
                setAvailableDefectTypes(allDefectTypes);
                return;
            }

            const selectedCodeObj = defectCodes.find((c: any) => c.lib_desc === anomalyData.defectCode);
            if (!selectedCodeObj) {
                setAvailableDefectTypes(allDefectTypes); // Fallback
                return;
            }

            // Fetch valid combos for this Code ID
            const { data: combos } = await supabase
                .from('u_lib_combo')
                .select('code_2')
                .eq('lib_code', 'AMLYCODFND')
                .eq('code_1', selectedCodeObj.lib_id);

            if (combos && combos.length > 0) {
                const validIds = new Set(combos.map((c: any) => c.code_2));
                const filtered = allDefectTypes.filter((t: any) => validIds.has(t.lib_id));
                setAvailableDefectTypes(filtered);

                // Clear selection if current type is not valid for new code
                if (anomalyData.defectType && !validIds.has(allDefectTypes.find((t: any) => t.lib_desc === anomalyData.defectType)?.lib_id)) {
                    setAnomalyData(prev => ({ ...prev, defectType: "" }));
                }

            } else {
                // If no combos found, maybe show none or all? Usually none if strict.
                // Let's assume strict filtering:
                setAvailableDefectTypes([]);
            }
        };

        filterTypes();
    }, [anomalyData.defectCode, defectCodes, allDefectTypes]);

    useEffect(() => {
        let isMounted = true;

        const initializeForm = async () => {
            if (!open) return;

            // Determine Inspection Type ID
            const inspTypeId = sowItem?.inspection_type_id || currentRecord?.inspection_type_id || currentRecord?.inspection_type?.id;

            let defaults: Record<string, any> = {};

            // 1. Fetch Schema & Defaults
            if (inspTypeId) {
                const { data, error } = await supabase
                    .from('inspection_type')
                    .select('default_properties')
                    .eq('id', inspTypeId)
                    .single();

                if (isMounted && data?.default_properties && Array.isArray(data.default_properties)) {
                    setInspectionProperties(data.default_properties);

                    // Extract defaults
                    data.default_properties.forEach((prop: InspectionProperty) => {
                        if (prop.default !== undefined) {
                            defaults[prop.name] = prop.default;
                        }
                    });
                }
            }

            if (!isMounted) return;

            // 2. Prepare Form Data
            let newFormData: Record<string, any> = { ...defaults };

            // Re-fetch record if ID is available to ensure fresh JSON data
            let fetchedRecord = currentRecord;
            if (currentRecord?.insp_id) {
                console.log("Re-fetching record for ID:", currentRecord.insp_id);
                const { data: freshRecord, error: freshError } = await supabase
                    .from('insp_records')
                    .select('*')
                    .eq('insp_id', currentRecord.insp_id)
                    .single();

                if (freshRecord && !freshError) {
                    fetchedRecord = freshRecord;
                    console.log("Refreshed record data from DB:", freshRecord);
                } else {
                    console.error("Failed to re-fetch record:", freshError);
                }
            }

            if (fetchedRecord) {
                const formatTimecode = (val: any) => {
                    if (val === null || val === undefined || val === '') return "";
                    if (typeof val === 'string' && val.includes(':')) return val;
                    const sec = Number(val);
                    if (!isNaN(sec)) {
                        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                        const s = Math.floor(sec % 60).toString().padStart(2, '0');
                        return `${h}:${m}:${s}`;
                    }
                    return val.toString();
                };

                setCommonData({
                    description: fetchedRecord.description || "",
                    tapeId: fetchedRecord.tape_id?.toString() || "",
                    tapeCounter: (fetchedRecord.inspection_data?._meta_timecode)
                        ? fetchedRecord.inspection_data._meta_timecode
                        : formatTimecode(fetchedRecord.tape_count_no),
                    elevation: fetchedRecord.elevation?.toString() || "",
                    fpKp: fetchedRecord.fp_kp || "",
                    isIncomplete: fetchedRecord.status === 'INCOMPLETE',
                    incompleteReason: fetchedRecord.incomplete_reason || "",
                    hasAnomaly: fetchedRecord.has_anomaly || false,
                    inspectionDate: fetchedRecord.inspection_date ? fetchedRecord.inspection_date.split('T')[0] : new Date().toISOString().split('T')[0],
                    inspectionTime: fetchedRecord.inspection_time || new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    rovHeading: "142.5",
                    rovDepth: "45.2",
                    rovPitch: "-2.4",
                    rovAltitude: "12.0",
                    rovRoll: "1.1",
                    rovCp: "-950"
                });

                if (fetchedRecord.has_anomaly) {
                    setOriginalHasAnomaly(true); // Track that it originally had one
                    // Fetch existing anomaly record
                    const { data: anomalyRec } = await supabase
                        .from('insp_anomalies')
                        .select('*')
                        .eq('inspection_id', fetchedRecord.insp_id)
                        .single();

                    if (anomalyRec) {
                        setAnomalyData({
                            id: anomalyRec.anomaly_id,
                            displayRefNo: anomalyRec.anomaly_ref_no || "",
                            defectCode: anomalyRec.defect_type_code || "",
                            defectType: anomalyRec.defect_category_code || "",
                            priority: anomalyRec.priority_code || "",
                            description: anomalyRec.defect_description || "",
                            recommendation: anomalyRec.recommended_action || "",
                            isRectified: anomalyRec.is_rectified || false,
                            rectifiedRemarks: anomalyRec.rectified_remarks || "",
                            rectifiedDate: anomalyRec.rectified_date || null,
                            rectifiedBy: anomalyRec.rectified_by || ""
                        });
                    }
                }

                // Merge existing inspection_data ON TOP of defaults
                let sourceData = fetchedRecord.inspection_data;

                // Handle stringified JSON
                if (typeof sourceData === 'string') {
                    try {
                        sourceData = JSON.parse(sourceData);
                    } catch (e) {
                        console.error("Failed to parse inspection_data string:", e);
                    }
                }

                // Handle potential array corruption (if schema was saved as data)
                if (Array.isArray(sourceData)) {
                    console.warn("WARNING: inspection_data is an array! Attempting to find object data...", sourceData);
                    // Try to find the first item that is an object but NOT a schema definition (no 'name'/'type' keys)
                    const potentialData = sourceData.find(item => item && typeof item === 'object' && !item.name && !item.type);
                    if (potentialData) {
                        sourceData = potentialData;
                        console.log("Recovered data object from array:", sourceData);
                    } else {
                        // Last ditch: check if there is ANY object?
                        const anyObject = sourceData.find(item => item && typeof item === 'object');
                        if (anyObject) {
                            console.warn("Using first available object from array (might be schema):", anyObject);
                            sourceData = anyObject;
                        } else {
                            console.warn("Could not extract valid data from array. Ignoring.");
                            sourceData = {};
                        }
                    }
                }

                if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
                    console.log("Merging validated existing data:", sourceData);
                    newFormData = { ...newFormData, ...sourceData };
                }
            } else if (sowItem) {
                // New Record Setup
                setCommonData({
                    description: "",
                    tapeId: activeTapeId ? activeTapeId.toString() : "",
                    tapeCounter: activeTimeCode || "",
                    elevation: "",
                    fpKp: "",
                    isIncomplete: false,
                    incompleteReason: "",
                    hasAnomaly: false,
                    inspectionDate: new Date().toISOString().split('T')[0],
                    inspectionTime: new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    rovHeading: "142.5",
                    rovDepth: "45.2",
                    rovPitch: "-2.4",
                    rovAltitude: "12.0",
                    rovRoll: "1.1",
                    rovCp: "-950"
                });

                // Auto-fill Elevation/FPKP
                const compId = sowItem.component_id;
                if (compId) {
                    fetchComponentMeta(compId);
                }
            }

            console.log("Final Form Data to Set:", newFormData);
            setFormData(newFormData);
            fetchActiveTapes();
        };

        if (open) {
            initializeForm();
        }

        return () => { isMounted = false; };
    }, [open, sowItem, currentRecord]); // Removed activeTapeId/TimeCode to avoid reset on video tick

    async function fetchComponentMeta(componentId: number) {
        if (!componentId) return;

        try {
            console.log("Fetching meta for component:", componentId);

            // Query structure_components directly as requested
            // Note: elv_1, elv_2, kp_1, kp_2 are likely inside the metadata JSONB column based on user feedback
            const { data, error } = await supabase
                .from('structure_components')
                .select('metadata')
                .eq('id', componentId)
                .single();

            if (error) {
                console.error("Error fetching component meta:", error);
                return;
            }

            if (data && data.metadata) {
                processComponentData(data.metadata);
            }
        } catch (err) {
            console.error("Error fetching component meta (exception):", err);
        }
    }

    function processComponentData(meta: any) {
        console.log("Component Metadata Object:", meta, "Structure Type:", structureType);

        // Extract values from metadata object
        // Handle explicit string "null" or missing keys
        const rawE1 = meta.elv_1 !== undefined ? meta.elv_1 : (meta.Elv_1 !== undefined ? meta.Elv_1 : null);
        const rawE2 = meta.elv_2 !== undefined ? meta.elv_2 : (meta.Elv_2 !== undefined ? meta.Elv_2 : null);

        // Convert to number if valid
        const e1 = (rawE1 !== null && rawE1 !== "null" && rawE1 !== "") ? Number(rawE1) : null;
        const e2 = (rawE2 !== null && rawE2 !== "null" && rawE2 !== "") ? Number(rawE2) : null;

        if (structureType === 'platform') {
            // Smart Elevation Logic
            let calculatedElv = "";

            if (e1 !== null && e2 !== null && !isNaN(e1) && !isNaN(e2)) {
                // Logic:
                // 1. If one above MSL (>0) and one below (<0), take below.
                // 2. If both above (>0), take lowest.
                // 3. If both below (<0), take nearest to sea level (max value).

                if ((e1 > 0 && e2 < 0) || (e1 < 0 && e2 > 0)) {
                    calculatedElv = Math.min(e1, e2).toString(); // Take negative
                } else if (e1 >= 0 && e2 >= 0) {
                    calculatedElv = Math.min(e1, e2).toString(); // Take lowest positive
                } else if (e1 < 0 && e2 < 0) {
                    calculatedElv = Math.max(e1, e2).toString(); // Take max (closest to 0)
                }
            } else if (e1 !== null && !isNaN(e1)) {
                calculatedElv = e1.toString();
            } else if (e2 !== null && !isNaN(e2)) {
                calculatedElv = e2.toString();
            }

            console.log("Calculated Elevation:", calculatedElv);

            if (calculatedElv) {
                handleCommonChange('elevation', calculatedElv);
            }
        } else if (structureType === 'pipeline') {
            // For KP, prioritize 'FP' value from metadata
            // Check keys: FP, fp, KP, kp, kp_1, KP_1
            const fpValue = meta.FP || meta.fp || meta.Fp;
            const kpValue = meta.KP || meta.kp || meta.kp_1 || meta.KP_1;

            if (fpValue) {
                handleCommonChange('fpKp', `KP ${fpValue}`);
            } else if (kpValue) {
                handleCommonChange('fpKp', `KP ${kpValue}`);
            }
        }
    }

    async function fetchInspectionSchema(typeId: number) {
        if (!typeId) return;

        const { data, error } = await supabase
            .from('inspection_type')
            .select('default_properties')
            .eq('id', typeId)
            .single();

        if (data?.default_properties && Array.isArray(data.default_properties)) {
            setInspectionProperties(data.default_properties);

            // Initialize defaults safely (don't overwrite existing data)
            setFormData(prev => {
                const updates: Record<string, any> = {};
                data.default_properties.forEach((prop: InspectionProperty) => {
                    if (prop.default !== undefined && prev[prop.name] === undefined) {
                        updates[prop.name] = prop.default;
                    }
                });
                return { ...updates, ...prev };
            });
        }
    }

    async function fetchActiveTapes() {
        // Fetch active tapes, potentially filtered by job
        const { data } = await supabase
            .from('insp_video_tapes')
            .select('*')
            .eq('status', 'ACTIVE');

        setActiveTapes(data || []);
    }

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCommonChange = (field: string, value: any) => {
        setCommonData(prev => ({ ...prev, [field]: value }));
    };

    // Auto-calculate Tape Counter based on date and time
    useEffect(() => {
        const calculateCounter = async () => {
            if (!commonData.tapeId || !commonData.inspectionDate || !commonData.inspectionTime || fetchedRecordRef.current) return;
            try {
                // Fetch first log or tape creation date
                const { data: logData } = await supabase
                    .from('insp_video_logs')
                    .select('event_time')
                    .eq('tape_id', parseInt(commonData.tapeId))
                    .order('event_time', { ascending: true })
                    .limit(1)
                    .single();

                let startStr = logData?.event_time;
                if (!startStr) {
                    const { data: tapeData } = await supabase
                        .from('insp_video_tapes')
                        .select('cr_date')
                        .eq('tape_id', parseInt(commonData.tapeId))
                        .single();
                    if (tapeData?.cr_date) startStr = tapeData.cr_date;
                }

                if (startStr) {
                    // Try to calculate diff
                    const tapeStart = new Date(startStr).getTime();
                    // Fallback to today if date somehow empty but time present
                    const datePart = commonData.inspectionDate || new Date().toISOString().split('T')[0];
                    const inspTimeStr = commonData.inspectionTime.length === 5 ? `${commonData.inspectionTime}:00` : commonData.inspectionTime;
                    const inspDateTime = new Date(`${datePart}T${inspTimeStr}`).getTime();

                    if (!isNaN(tapeStart) && !isNaN(inspDateTime)) {
                        let diffSecs = Math.floor((inspDateTime - tapeStart) / 1000);
                        if (diffSecs < 0) diffSecs = 0; // Keep it at 0 if before start

                        const h = Math.floor(diffSecs / 3600).toString().padStart(2, '0');
                        const m = Math.floor((diffSecs % 3600) / 60).toString().padStart(2, '0');
                        const s = Math.floor(diffSecs % 60).toString().padStart(2, '0');
                        setCommonData(prev => ({ ...prev, tapeCounter: `${h}:${m}:${s}` }));
                    }
                }
            } catch (err) {
                console.error("Counter calc failed", err);
            }
        };
        // Debounce slightly if typing time
        const timeout = setTimeout(calculateCounter, 800);
        return () => clearTimeout(timeout);
    }, [commonData.tapeId, commonData.inspectionDate, commonData.inspectionTime]);

    // Use a ref to prevent auto-calc overriding existing data when opening
    const fetchedRecordRef = useState(!!currentRecord)[0] ? { current: true } : { current: false };
    useEffect(() => {
        if (open) {
            // Reset ref after 2 seconds so manual edits can trigger auto-calc
            setTimeout(() => {
                fetchedRecordRef.current = false;
            }, 2000);
        }
    }, [open]);


    const handleAnomalyChange = async (checked: boolean) => {
        // trying to untick?
        if (!checked && originalHasAnomaly && anomalyData.id) {
            // CHECK FOR SUBSEQUENT ANOMALIES
            // We need to fetch if there are any anomalies created AFTER this one for the same structure/job
            const { count, error } = await supabase
                .from('insp_anomalies')
                .select('*', { count: 'exact', head: true })
                .gt('anomaly_id', anomalyData.id) // Assuming ID is sequential. Better to use timestamp if unsure.
                // We should probably scope this to the same Job or Structure?
                // "no anomaly is recorded after this anomaly" - usually implies global sequence or job sequence.
                // Let's assume global structure sequence or job sequence.
                // Safe bet: Job Pack or Structure. Let's use Structure for now as ref no includes platform.
                // But simplified: gt anomaly_id is a strong enough signal for "later".
                ;

            if (count && count > 0) {
                alert("Cannot delete this anomaly record because subsequent anomalies have been recorded. Please close or rectify instead.");
                return; // Stop uncheck
            }

            const confirmed = window.confirm(
                "You have unchecked 'Anomaly / Defect Detected'. This will DELETE the existing anomaly record. Are you sure?"
            );
            if (!confirmed) {
                // User cancelled, do not change state
                return;
            }
        } else if (checked && !anomalyData.displayRefNo) {
            // Ticking for the first time? Generate a preview ref no
            const { refNo } = await generateAnomalyRef(false, "", false);
            setAnomalyData(prev => ({ ...prev, displayRefNo: refNo + " (Draft)" }));
        }
        // Proceed with change
        handleCommonChange('hasAnomaly', checked);
    };

    /**
     * Helper to generate Anomaly Reference Number
     * Format: {Year} / {Platform} / A-{Seq}{Postfix}
     */
    async function generateAnomalyRef(isUpdate: boolean, currentRef: string, isRectified: boolean): Promise<{ refNo: string, seqNo?: number }> {
        const year = new Date().getFullYear();
        // Platform Name: need to get it. 
        // rovJob only has structure_id. We need name. 
        // We can fetch it or use what we have. 
        // rovJob?.structure?.name is not directly available, but we have `sowItem?.inspection_name` or `currentRecord?.structure_name`?
        // Let's fetch structure name if missing.
        let platformName = "PLAT";
        // Try to get from existing data first
        if (platformTitle) {
            platformName = platformTitle;
        } else if (currentRecord?.structure_name) {
            platformName = currentRecord.structure_name;
        } else if (rovJob?.structure_id) {
            // Robust fetch logic with fallback
            let structureData: any = null;
            let usedTable = "";

            // 1. Try 'structure' table first
            const { data: sData, error: sError } = await supabase
                .from('structure')
                .select('*') // Select * to avoid column errors
                .eq('str_id', rovJob.structure_id)
                .single();

            if (!sError && sData) {
                structureData = sData;
                usedTable = "structure";
            } else {
                // 2. Fallback to 'u_structure'
                console.warn("Fetch from 'structure' failed, trying 'u_structure'", sError);
                const { data: uData, error: uError } = await supabase
                    .from('u_structure')
                    .select('*')
                    .eq('str_id', rovJob.structure_id)
                    .single();

                if (!uError && uData) {
                    structureData = uData;
                    usedTable = "u_structure";
                } else {
                    console.error("Fetch from 'u_structure' failed too", uError);
                }
            }

            if (structureData) {
                console.log(`Structure fetched from ${usedTable}:`, structureData);
                const type = (structureData.str_type || "").toUpperCase();

                if (type.includes('PLATFORM') && structureData.plat_id) {
                    // Fetch from 'platform' table
                    const { data: platData } = await supabase
                        .from('platform')
                        .select('title')
                        .eq('plat_id', structureData.plat_id)
                        .single();

                    if (platData?.title) platformName = platData.title;
                    else platformName = structureData.title || structureData.str_desc || "PLAT";

                } else if (type.includes('PIPELINE') && structureData.pipe_id) {
                    // Fetch from 'u_pipeline' table
                    const { data: pipeData } = await supabase
                        .from('u_pipeline')
                        .select('title')
                        .eq('pipe_id', structureData.pipe_id)
                        .single();

                    if (pipeData?.title) platformName = pipeData.title;
                    else platformName = structureData.title || structureData.str_desc || "PIPE";

                } else {
                    // Fallback
                    platformName = structureData.title || structureData.str_desc || "STR";
                }
            }
        }

        let seqNo = 0;
        let baseRef = "";

        if (isUpdate && currentRef) {
            // Keep existing base
            // split by / to find parts?
            // "2026 / PLAT / A-001"
            baseRef = currentRef;
            // logic to append Postfix 'A' if not already present? 
            // User said: "Postfix 'R' if ... rectified, 'A' if ... amendments".
            // Implementation: We append suffix dynamically based on state.

            // Clean existing suffix if re-saving?
            // Let's stripping existing suffixes 'R' or 'A' to get pure base is hard without strict regex.
            // Simplified: If Rectified, ensure ends with R. If Updated (and not R), ensure ends with A?
            // "A-001A" or "A-001R".

            // Just use the provided ref. We will modify the return value based on conditions.
            return { refNo: currentRef }; // Defer suffix logic to caller or handle here.
        } else {
            // New Sequence
            // Get max sequence_no for this structure/year
            // We need to query DB.
            // "SELECT MAX(sequence_no) FROM insp_anomalies ..."
            // This requires `sequence_no` column we just added.
            const { data: maxSeq } = await supabase
                .from('insp_anomalies')
                .select('sequence_no')
                .order('sequence_no', { ascending: false })
                .limit(1)
                .maybeSingle(); // We should filter by structure/year if strict, but let's go global sequential for simplicity if needed, or filter by this Job?

            // Better: Filter by JobPack or Structure.
            // let's do Structure level sequence.
            const { data: maxStrSeq } = await supabase
                .from('insp_anomalies')
                .select('sequence_no')
                // Join to insp_records to filter by structure? That's expensive.
                // Let's assume we want a simple sequential number for now or query max(anomaly_id) roughly.
                // To do it right:
                // We really need a backend function for this to be safe.
                // Client side approximate:
                // Count current anomalies for this rov job?
                // Let's use a simple counter for this Job.
                .limit(1);

            seqNo = (maxSeq?.sequence_no || 0) + 1;
            baseRef = `${year} / ${platformName} / A-${seqNo.toString().padStart(3, '0')}`;
        }

        return { refNo: baseRef, seqNo };
    }


    async function handleSave() {
        if (!rovJob || (!sowItem && !currentRecord)) {
            toast.error("Missing inspection context");
            return;
        }

        // Date Time Validation against ROV Job
        if (commonData.inspectionDate && commonData.inspectionTime && rovJob.dive_date) {
            const inspDate = new Date(`${commonData.inspectionDate}T${commonData.inspectionTime.length === 5 ? commonData.inspectionTime + ':00' : commonData.inspectionTime}`).getTime();

            // Try to find AT_WORKSITE and LEAVING_WORKSITE movements
            const { data: movements } = await supabase
                .from('insp_rov_movements')
                .select('movement_type, movement_time')
                .eq('rov_job_id', rovJob.rov_job_id);

            if (movements && movements.length > 0) {
                const atWorksite = movements.find(m => m.movement_type === 'AT_WORKSITE');
                const leavingWorksite = movements.find(m => m.movement_type === 'LEAVING_WORKSITE');

                if (atWorksite && atWorksite.movement_time) {
                    const startLimit = new Date(atWorksite.movement_time).getTime();
                    let endLimit = leavingWorksite?.movement_time ? new Date(leavingWorksite.movement_time).getTime() : new Date().getTime(); // up to current time if not left yet

                    if (inspDate < startLimit || (leavingWorksite && inspDate > endLimit)) {
                        const confirmed = window.confirm(
                            `Warning: The inspection time is outside the diver log actions (Diver At Worksite - Leaving Worksite).\nDo you still want to proceed?`
                        );
                        if (!confirmed) return;
                    }
                }
            }
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id || 'system';

            const status = commonData.isIncomplete ? 'INCOMPLETE' : 'COMPLETED';

            console.log("Saving Inspection - Form Data:", formData);
            if (Object.keys(formData).length === 0) {
                console.warn("WARNING: Form data is empty! Dynamic fields might be lost.");
            }

            // Calculate seconds from timecode or number string
            let tapeSeconds: number | null = null;
            if (commonData.tapeCounter) {
                if (commonData.tapeCounter.includes(":")) {
                    const parts = commonData.tapeCounter.split(':').map(Number);
                    if (parts.length === 3) tapeSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    else if (parts.length === 2) tapeSeconds = parts[0] * 60 + parts[1];
                } else {
                    const parsed = parseInt(commonData.tapeCounter);
                    if (!isNaN(parsed)) tapeSeconds = parsed;
                }
            }

            // Prepare payload
            const payload: any = {
                rov_job_id: rovJob.rov_job_id,
                structure_id: rovJob.structure_id,
                component_id: currentRecord?.component_id || sowItem?.component_id,
                component_type: currentRecord?.component_type || sowItem?.component_type || 'Unknown',
                jobpack_id: rovJob.jobpack_id,
                sow_report_no: currentRecord?.sow_report_no || sowItem?.report_number || rovJob.sow_report_no,

                // Ensure ID is passed for schema lookup. Prefer existing record's logic if available.
                inspection_type_id: currentRecord?.inspection_type_id || currentRecord?.inspection_type?.id || sowItem?.inspection_type_id,
                inspection_type_code: currentRecord?.inspection_type_code || currentRecord?.inspection_type?.code || sowItem?.inspection_code || sowItem?.inspection_type?.code || 'GEN',

                description: commonData.description,
                inspection_data: {
                    ...formData,
                    _meta_timecode: commonData.tapeCounter,
                    structure_name: platformTitle || 'Unknown',
                    rov_heading: commonData.rovHeading,
                    rov_depth: commonData.rovDepth,
                    rov_pitch: commonData.rovPitch,
                    rov_altitude: commonData.rovAltitude,
                    rov_roll: commonData.rovRoll,
                    rov_cp: commonData.rovCp
                },

                tape_id: commonData.tapeId ? parseInt(commonData.tapeId) : null,
                tape_count_no: tapeSeconds !== null ? tapeSeconds.toString() : null, // Store as string representation of seconds

                elevation: commonData.elevation ? parseFloat(commonData.elevation) : null,
                fp_kp: commonData.fpKp || null,

                has_anomaly: commonData.hasAnomaly,

                status: status,
                incomplete_reason: commonData.isIncomplete ? commonData.incompleteReason : null,
                workunit: rovJob.workunit || '000'
            };

            let insertedRecord;

            if (currentRecord?.insp_id) {
                // UPDATE: Maintain cr_date/cr_user, update md_date/md_user
                payload.md_date = new Date().toISOString();
                payload.md_user = currentUserId;

                // Preserve original inspection date/time explicitly
                payload.inspection_date = commonData.inspectionDate || currentRecord.inspection_date;
                payload.inspection_time = commonData.inspectionTime || currentRecord.inspection_time;

                const { data, error: updateError } = await supabase
                    .from('insp_records')
                    .update(payload)
                    .eq('insp_id', currentRecord.insp_id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                insertedRecord = data;
            } else {
                // INSERT: Set initial cr_date/cr_user and inspection date/time
                payload.cr_date = new Date().toISOString();
                payload.cr_user = currentUserId;
                payload.inspection_date = commonData.inspectionDate || new Date().toISOString().split('T')[0];
                payload.inspection_time = commonData.inspectionTime || new Date().toLocaleTimeString('en-GB', { hour12: false });

                const { data, error: insertError } = await supabase
                    .from('insp_records')
                    .insert(payload)
                    .select()
                    .single();

                if (insertError) throw insertError;
                insertedRecord = data;
            }

            // Handle Anomaly Record
            if (commonData.hasAnomaly && insertedRecord?.insp_id) {
                // Generate Ref No logic
                // Fetch platform name - use prop if available, fallback to existing logic
                console.log("Generating anomaly ref. Platform Title prop:", platformTitle);

                let platformName = platformTitle || "PLAT";

                if (!platformTitle) {
                    // Only fetch if prop is missing (secondary fallback)
                    const { data: strData } = await supabase.from('u_structure').select('str_desc').eq('str_id', rovJob.structure_id).maybeSingle();
                    if (strData?.str_desc) platformName = strData.str_desc;
                }

                let refNo = anomalyData.displayRefNo;
                let seqNo = 0;
                let isUpdate = !!anomalyData.id;

                if (!isUpdate || !refNo) {
                    // Generate New
                    const year = new Date().getFullYear();
                    // Get Max Seq
                    const { data: maxData } = await supabase
                        .rpc('get_max_anomaly_sequence', { structure_id_input: rovJob.structure_id, year_input: year }); // Ideal, but RPC might not exist.

                    // Fallback to simplistic count
                    const { count } = await supabase.from('insp_anomalies').select('*', { count: 'exact', head: true });
                    seqNo = (count || 0) + 1; // Global seq for safety if no strict structure

                    refNo = `${year} / ${platformName} / A-${seqNo.toString().padStart(3, '0')}`;
                }

                // Handle Postfix
                // remove existing suffixes to re-apply??
                // Check if already has R or A
                let baseRef = refNo;
                // Regex to strip existing trailing R or A?
                // For now, let's just append if not present, OR strict format.

                let postfix = "";
                if (anomalyData.isRectified) {
                    postfix = "R";
                } else if (isUpdate) {
                    postfix = "A"; // Amendment
                } else {
                    postfix = "";
                }

                // If ref already ends with R or A, replace or append?
                // "A-001R" -> "A-001A" if unrectified?
                // Let's assume baseRef is clean "A-001".
                // If we are updating, `refNo` from DB might be "A-001A".
                // logic:
                if (refNo.endsWith('R')) baseRef = refNo.slice(0, -1);
                else if (refNo.endsWith('A')) baseRef = refNo.slice(0, -1);
                else baseRef = refNo;

                let finalRefNo = (baseRef + postfix).trim();

                const anomalyPayload: any = {
                    inspection_id: insertedRecord.insp_id,
                    defect_type_code: anomalyData.defectCode,
                    defect_category_code: anomalyData.defectType,
                    priority_code: anomalyData.priority,
                    defect_description: anomalyData.description,
                    recommended_action: anomalyData.recommendation,

                    status: anomalyData.isRectified ? 'RECTIFIED' : 'OPEN',
                    anomaly_ref_no: finalRefNo,

                    is_rectified: anomalyData.isRectified,
                    rectified_remarks: anomalyData.isRectified ? anomalyData.rectifiedRemarks : null,
                    rectified_date: anomalyData.isRectified ? (anomalyData.rectifiedDate || new Date().toISOString()) : null,
                    rectified_by: anomalyData.isRectified ? (anomalyData.rectifiedBy || currentUserId) : null,

                    workunit: rovJob.workunit || '000'
                };

                if (seqNo > 0) anomalyPayload.sequence_no = seqNo;

                let anomalyError;
                if (anomalyData.id) {
                    // Update: Track modification
                    anomalyPayload.md_date = new Date().toISOString();
                    anomalyPayload.md_user = currentUserId;

                    const { error } = await supabase.from('insp_anomalies').update(anomalyPayload).eq('anomaly_id', anomalyData.id);
                    anomalyError = error;
                } else {
                    // Insert: Track creation
                    anomalyPayload.cr_date = new Date().toISOString();
                    anomalyPayload.cr_user = currentUserId;

                    const { error } = await supabase.from('insp_anomalies').insert(anomalyPayload);
                    anomalyError = error;
                }

                if (anomalyError) {
                    console.error("Anomaly save error:", anomalyError);
                    toast.error("Failed to save anomaly details");
                }
            } else if (!commonData.hasAnomaly && originalHasAnomaly && anomalyData.id) {
                // Anomaly was unchecked - DELETE existing anomaly
                console.log("Deleting unchecked anomaly:", anomalyData.id);
                const { error: delError } = await supabase
                    .from('insp_anomalies')
                    .delete()
                    .eq('anomaly_id', anomalyData.id);

                if (delError) console.error("Error deleting anomaly:", delError);
            }

            // Handle Attachments Upload
            if (insertedRecord?.insp_id && pendingAttachments.length > 0) {
                toast.info(`Uploading ${pendingAttachments.length} attachments...`);

                for (const pendingObj of pendingAttachments) {
                    const { file, title, description } = pendingObj;
                    const fileExt = file.name.split('.').pop();
                    // Clean filename to avoid issues
                    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${safeName}`;
                    const filePath = `inspection/${insertedRecord.insp_id}/${uniqueName}`;

                    // 1. Upload to Storage
                    const { error: uploadError } = await supabase.storage
                        .from('attachments')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.error("Upload error:", uploadError);
                        toast.error(`Failed to upload ${file.name}`);
                        continue;
                    }

                    // 2. Create DB Record
                    const { error: attError } = await supabase
                        .from('attachment')
                        .insert({
                            name: file.name,
                            source_id: insertedRecord.insp_id,
                            source_type: 'inspection',
                            path: filePath,
                            user_id: currentUserId,
                            meta: {
                                size: file.size,
                                type: file.type,
                                title: title,
                                description: description
                            }
                        });

                    if (attError) {
                        console.error("Attachment DB error:", attError);
                        toast.error(`Failed to link attachment ${file.name}`);
                    }
                }
            }

            if (sowItem || insertedRecord?.sow_report_no) {
                // Update SOW Item Status
                // Determine new status based on anomaly or incomplete
                let newSowStatus = 'completed';
                if (commonData.isIncomplete) newSowStatus = 'incomplete';
                else if (commonData.hasAnomaly) newSowStatus = 'anomaly'; // e.g. Anomaly state in SOW

                // If we have an exact sowItem object (from prop) update via ID,
                // Otherwise try to find and update via sow_report_no and component_id for generic cases
                if (sowItem?.id) {
                    const { error: sowError } = await supabase
                        .from('u_sow_items')
                        .update({
                            status: newSowStatus,
                            notes: commonData.isIncomplete ? commonData.incompleteReason : (commonData.hasAnomaly ? 'Anomaly Reported' : 'Inspection recorded'),
                            last_inspection_date: commonData.inspectionDate || new Date().toISOString().split('T')[0]
                        })
                        .eq('id', sowItem.id);

                    if (sowError) console.error("Error updating SOW item:", sowError);
                } else if (rovJob?.sow_report_no && (currentRecord?.component_id || sowItem?.component_id)) {
                    // Update fallback
                    const { error: sowError } = await supabase
                        .from('u_sow_items')
                        .update({
                            status: newSowStatus,
                            notes: commonData.isIncomplete ? commonData.incompleteReason : (commonData.hasAnomaly ? 'Anomaly Reported' : 'Inspection recorded'),
                            last_inspection_date: commonData.inspectionDate || new Date().toISOString().split('T')[0]
                        })
                        .eq('report_number', rovJob.sow_report_no)
                        .eq('component_id', currentRecord?.component_id || sowItem?.component_id);

                    if (sowError) console.error("Error updating SOW item (fallback):", sowError);
                }
            }

            // Log Video Event
            if (commonData.tapeId) {
                const logType = commonData.hasAnomaly ? 'ANOMALY' : 'INSPECTION';
                const remarks = `${sowItem?.inspection_code || 'INSP'} - ${commonData.description.substring(0, 50)}${commonData.description.length > 50 ? '...' : ''}`;

                // 1. Insert into DB (wrapped in try/catch to not block UI success if logging fails)
                try {
                    const { error: logError } = await supabase.from('insp_video_logs').insert({
                        tape_id: parseInt(commonData.tapeId),
                        event_type: logType,
                        event_time: new Date().toISOString(),
                        timecode_start: commonData.tapeCounter,
                        remarks: remarks,
                        inspection_id: insertedRecord.insp_id, // Link to the inspection record
                        cr_user: currentUserId,
                        workunit: rovJob.workunit || '000',
                    });

                    if (logError) {
                        console.error("Error logging video event:", logError);
                        // Do not show toast error here, just log it, as the main record is saved.
                    } else {
                        // 2. Update Atom (UI Overlay) only if DB save succeeded
                        const newLog: VideoLog = {
                            id: Math.random().toString(36).substr(2, 9),
                            timestamp: new Date().toISOString(),
                            timecode: commonData.tapeCounter,
                            event_type: logType,
                            remarks: remarks
                        };
                        setVideoLogs(prevLogs => [newLog, ...prevLogs]);
                    }
                } catch (logEx) {
                    console.error("Exception logging video event:", logEx);
                }
            }

            toast.success("Inspection recorded successfully");
            onSaved();
            onOpenChange(false);

        } catch (error: any) {
            console.error("Error saving inspection:", error);
            toast.error(error.message || "Failed to save inspection");
        } finally {
            setLoading(false);
        }
    }

    const generateAutoRemarks = async () => {
        // 1. Structured Remarks Generation

        // Look for Orientation in formData
        const orientationProp = inspectionProperties.find(p => p.label.toLowerCase().includes('orientation') || p.label.toLowerCase().includes('clock'));

        let sentence1 = "";
        let sentence2 = "";

        if (commonData.hasAnomaly) {
            sentence1 = `Anomaly detected: ${anomalyData.defectCode || 'Defect'} (${anomalyData.defectType || 'Unknown'})`;
        } else {
            sentence1 = "Visual inspection completed";
        }

        const whereParts = [];
        if (orientationProp && formData[orientationProp.name]) whereParts.push(`at ${formData[orientationProp.name]} o'clock`);
        if (commonData.elevation) whereParts.push(`at EL ${commonData.elevation}m`);
        if (commonData.fpKp) whereParts.push(`at ${commonData.fpKp}`);

        if (whereParts.length > 0) sentence1 += " " + whereParts.join(" ");

        if (commonData.hasAnomaly) {
            const dimProp = inspectionProperties.find(p => p.label.toLowerCase().includes('dimension') || p.label.toLowerCase().includes('size'));
            if (dimProp && formData[dimProp.name]) {
                sentence1 += `. Dimensions: ${formData[dimProp.name]}`;
            }
        }

        if (!sentence1.endsWith('.')) sentence1 += ".";

        // Sentence 2 construction
        const attrParts: string[] = [];
        const keyTerms = ['cleaning', 'marine growth', 'cp', 'potential', 'protection'];

        inspectionProperties.forEach(prop => {
            if (prop.label.toLowerCase().includes('orientation') ||
                prop.label.toLowerCase().includes('clock') ||
                prop.label.toLowerCase().includes('dimension') ||
                prop.label.toLowerCase().includes('size')) return;

            if (keyTerms.some(term => prop.label.toLowerCase().includes(term))) {
                const val = formData[prop.name];
                if (val) {
                    if (prop.type === 'boolean') {
                        attrParts.push(`${prop.label}: ${val ? 'Yes' : 'No'}`);
                    } else {
                        attrParts.push(`${prop.label}: ${val}`);
                    }
                }
            }
        });

        if (attrParts.length > 0) {
            sentence2 = attrParts.join(". ") + ".";
        }

        let finalRemark = [sentence1, sentence2].filter(Boolean).join(" ");

        // 2. AI Analysis
        if (pendingAttachments.length > 0) {
            const pendingObj = pendingAttachments[pendingAttachments.length - 1]; // Use latest
            if (pendingObj.file.type.startsWith('image/')) {
                const toastId = toast.loading("Analyzing image with AI...");
                try {
                    const promise = new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(pendingObj.file);
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = error => reject(error);
                    });

                    const base64 = await promise;
                    const res = await fetch('/api/ai/analyze-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image: base64,
                            prompt: commonData.hasAnomaly ? "Analyze this anomaly. Describe the defect type, severity, and potential cause." : "Describe the visual condition of this component."
                        })
                    });

                    const data = await res.json();
                    if (data.text) {
                        finalRemark += "\n\n[AI Finding]: " + data.text;
                        toast.success("AI Remarks added", { id: toastId });
                    } else {
                        toast.dismiss(toastId);
                    }
                } catch (e) {
                    console.error("AI Error", e);
                    toast.error("AI Analysis failed", { id: toastId });
                }
            }
        } else if (pendingAttachments.length === 0 && !finalRemark) {
            toast.info("Attach a photo to enable AI analysis.");
        } else {
            toast.info("Auto-remarks generated");
        }

        handleCommonChange('description', finalRemark);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-md">
                            <span className="font-bold text-blue-700">
                                {sowItem?.inspection_code || sowItem?.inspection_type?.code || currentRecord?.inspection_type_code || currentRecord?.inspection_type?.code || "INSP"}
                            </span>
                        </div>
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                <Save className="h-5 w-5 text-blue-600" />
                                {currentRecord ? `Edit Inspection Record - ${platformTitle || ''}` : `Close Visual Inspection - ${platformTitle || sowItem?.component_qid || '(New)'}`}
                            </DialogTitle>
                            <DialogDescription>
                                {sowItem?.inspection_name || currentRecord?.inspection_type?.name || "Inspection"}
                                {(sowItem?.component_qid || currentRecord?.component_qid) ? ` - ${sowItem?.component_qid || currentRecord?.component_qid}` : ""}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Common Fields */}
                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div className="space-y-2">
                            <Label>Video Tape</Label>
                            <Select
                                value={commonData.tapeId}
                                onValueChange={(v) => handleCommonChange('tapeId', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Tape" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeTapes.map(tape => (
                                        <SelectItem key={tape.tape_id} value={tape.tape_id.toString()}>
                                            {tape.tape_no}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Counter / Timecode</Label>
                            <Input
                                value={commonData.tapeCounter}
                                onChange={(e) => handleCommonChange('tapeCounter', e.target.value)}
                                placeholder="00:00:00 or Counter"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div className="space-y-2">
                            <Label>Inspection Date</Label>
                            <Input
                                type="date"
                                max={new Date().toISOString().split('T')[0]}
                                value={commonData.inspectionDate}
                                onChange={(e) => handleCommonChange('inspectionDate', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Inspection Time</Label>
                            <Input
                                type="time"
                                step="1"
                                value={commonData.inspectionTime}
                                onChange={(e) => handleCommonChange('inspectionTime', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        {structureType === 'platform' && (
                            <div className="space-y-2">
                                <Label>Elevation (m)</Label>
                                <Input
                                    type="number"
                                    value={commonData.elevation}
                                    onChange={(e) => handleCommonChange('elevation', e.target.value)}
                                    placeholder="e.g. -12.5"
                                />
                            </div>
                        )}
                        {structureType === 'pipeline' && (
                            <div className="space-y-2">
                                <Label>FP / KP</Label>
                                <Input
                                    value={commonData.fpKp}
                                    onChange={(e) => handleCommonChange('fpKp', e.target.value)}
                                    placeholder="e.g. KP 12.5"
                                />
                            </div>
                        )}
                        {/* Spacer if only one field is shown to keep grid layout or just let it flow */}
                    </div>

                    {/* Dynamic Fields */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Inspection Data</h4>

                            {/* Anomaly Checkbox */}
                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-full border border-red-100 dark:border-900/50">
                                <Checkbox
                                    id="hasAnomaly"
                                    checked={commonData.hasAnomaly}
                                    onCheckedChange={(c) => handleAnomalyChange(c === true)}
                                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                />
                                <Label htmlFor="hasAnomaly" className="text-xs font-bold text-red-700 dark:text-red-400 cursor-pointer flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" />
                                    Anomaly / Defect Detected
                                </Label>
                            </div>
                        </div>
                        {inspectionProperties.length === 0 ? (
                            <div className="p-4 bg-slate-50 text-center text-muted-foreground rounded-lg border border-dashed">
                                No specific fields defined for this inspection type.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {inspectionProperties.map((prop, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {prop.label} {prop.required && <span className="text-red-500">*</span>}
                                        </Label>

                                        {prop.type === 'select' ? (
                                            <Select
                                                value={formData[prop.name] === null || formData[prop.name] === "" ? "__clear__" : (formData[prop.name] || "__clear__")}
                                                onValueChange={(v) => handleInputChange(prop.name, v === "__clear__" ? "" : v)}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__clear__" className="text-muted-foreground italic">None / Clear Selection</SelectItem>
                                                    {prop.options?.map(opt => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : prop.type === 'boolean' ? (
                                            <div className="flex items-center gap-2 h-9">
                                                <Checkbox
                                                    checked={formData[prop.name] === true}
                                                    onCheckedChange={(c) => handleInputChange(prop.name, c === true)}
                                                />
                                                <span className="text-sm">{prop.label}</span>
                                            </div>
                                        ) : (
                                            <Input
                                                type={prop.type}
                                                className="h-9"
                                                value={formData[prop.name] || ""}
                                                onChange={(e) => handleInputChange(prop.name, e.target.value)}
                                                readOnly={false} // Ensure it's explicitly editable
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Findings & Incomplete */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Description / remarks {commonData.hasAnomaly && <span className="text-red-500 font-bold ml-1">(Required for Anomaly)</span>}</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                                    onClick={generateAutoRemarks}
                                >
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Auto Remark
                                </Button>
                            </div>
                            <Textarea
                                rows={4}
                                value={commonData.description}
                                onChange={(e) => handleCommonChange('description', e.target.value)}
                                placeholder={commonData.hasAnomaly ? "Describe the anomaly in detail..." : "Enter inspection findings..."}
                                className={commonData.hasAnomaly ? "border-red-300 focus-visible:ring-red-500 bg-red-50/50" : ""}
                            />
                        </div>

                        {/* Anomaly Section */}
                        {commonData.hasAnomaly && (
                            <div className="border border-red-200 dark:border-red-800 p-4 rounded-md mt-4 bg-red-50 dark:bg-red-950/20">
                                <h4 className="font-semibold text-red-600 mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                                        Anomaly Details
                                    </div>
                                    <div className="text-xs font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-red-100 dark:border-red-900">
                                        Ref: <strong>{anomalyData.displayRefNo || "(Pending)"}</strong>
                                    </div>
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-red-700 dark:text-red-400">Defect Code *</Label>
                                        <Select
                                            value={anomalyData.defectCode}
                                            onValueChange={(val) => setAnomalyData(prev => ({ ...prev, defectCode: val }))}
                                        >
                                            <SelectTrigger className="bg-white dark:bg-slate-950 border-red-200">
                                                <SelectValue placeholder="Select Code" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {defectCodes.map((item: any) => (
                                                    <SelectItem key={item.lib_id} value={item.lib_desc}>
                                                        {item.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-red-700 dark:text-red-400">Priority *</Label>
                                        <Select
                                            value={anomalyData.priority}
                                            onValueChange={(val) => setAnomalyData(prev => ({ ...prev, priority: val }))}
                                        >
                                            <SelectTrigger className="bg-white dark:bg-slate-950 border-red-200">
                                                <SelectValue placeholder="Select Priority" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {priorities.map((item: any) => (
                                                    <SelectItem key={item.lib_id} value={item.lib_desc}>
                                                        {item.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-red-700 dark:text-red-400">Defect Type</Label>
                                        <Select
                                            value={anomalyData.defectType}
                                            onValueChange={(val) => setAnomalyData(prev => ({ ...prev, defectType: val }))}
                                        >
                                            <SelectTrigger className="bg-white dark:bg-slate-950 border-red-200">
                                                <SelectValue placeholder="Select Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableDefectTypes.map((item: any) => (
                                                    <SelectItem key={item.lib_id} value={item.lib_desc}>
                                                        {item.lib_desc}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-red-700 dark:text-red-400">Anomaly Description</Label>
                                        <Textarea
                                            className="bg-white dark:bg-slate-950 border-red-200"
                                            value={anomalyData.description}
                                            onChange={(e) => setAnomalyData(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Detailed description of the anomaly..."
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-red-700 dark:text-red-400">Recommended Action</Label>
                                        <Textarea
                                            className="bg-white dark:bg-slate-950 border-red-200"
                                            value={anomalyData.recommendation}
                                            onChange={(e) => setAnomalyData(prev => ({ ...prev, recommendation: e.target.value }))}
                                            placeholder="Recommended remedial action..."
                                        />
                                    </div>



                                    {/* Rectification Section */}
                                    <div className="col-span-2 pt-4 border-t border-red-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Checkbox
                                                id="rectified"
                                                checked={anomalyData.isRectified}
                                                onCheckedChange={(c) => setAnomalyData(prev => ({ ...prev, isRectified: c === true }))}
                                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                            <Label htmlFor="rectified" className="font-bold text-green-700 dark:text-green-400 cursor-pointer">
                                                Rectify Anomaly
                                            </Label>
                                        </div>

                                        {anomalyData.isRectified && (
                                            <div className="space-y-3 bg-green-50 p-3 rounded border border-green-100">
                                                <div className="space-y-2">
                                                    <Label className="text-green-800">Rectification Remarks</Label>
                                                    <Textarea
                                                        value={anomalyData.rectifiedRemarks}
                                                        onChange={(e) => setAnomalyData(prev => ({ ...prev, rectifiedRemarks: e.target.value }))}
                                                        className="border-green-200 focus-visible:ring-green-500"
                                                        placeholder="Details of rectification..."
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs text-green-700">
                                                    <div>
                                                        <span className="font-semibold">Evaluated By:</span> {anomalyData.rectifiedBy || "Current User"}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Date:</span> {anomalyData.rectifiedDate ? new Date(anomalyData.rectifiedDate).toLocaleString() : "Now"}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attachments Section */}
                    <div className="border-t pt-4">
                        <AttachmentManager
                            sourceId={currentRecord?.insp_id || null}
                            sourceType="inspection"
                            onPendingFilesChange={setPendingAttachments}
                        />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-100 dark:border-amber-900 mt-4">
                        <Checkbox
                            id="incomplete"
                            checked={commonData.isIncomplete}
                            onCheckedChange={(c) => handleCommonChange('isIncomplete', c === true)}
                        />
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="incomplete" className="font-semibold cursor-pointer">Mark as Incomplete / Not Carried Out</Label>
                            {commonData.isIncomplete && (
                                <Textarea
                                    placeholder="Reason for incompletion..."
                                    value={commonData.incompleteReason}
                                    onChange={(e) => handleCommonChange('incompleteReason', e.target.value)}
                                    className="bg-white dark:bg-slate-950"
                                />
                            )}
                        </div>
                    </div>
                </div>


                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Inspection
                    </Button>
                </DialogFooter>

                {/* Debug Section - Remove in production */}
                <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-900 rounded text-[10px] font-mono overflow-auto max-h-32 opacity-50 hover:opacity-100">
                    <div className="font-bold">Debug Info:</div>
                    <div>Common: {JSON.stringify(commonData)}</div>
                    <div>Form Data (State): {JSON.stringify(formData)}</div>
                    <div>DB Record Data: {currentRecord?.inspection_data ? JSON.stringify(currentRecord.inspection_data) : 'N/A'}</div>
                </div>
            </DialogContent >
        </Dialog >
    );
}
