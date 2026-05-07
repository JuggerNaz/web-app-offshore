"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { SeabedDebrisPlot } from '@/components/inspection/seabed-debris-plot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";

interface SeabedSurveyGuiDialogProps {
    open: boolean;
    onClose: () => void;
    structureId: number | string;
    jobpackId: number | string;
    sowRecordId: number | null;
    sowReportNo?: string;
    rovJob: any;
    tapeId?: string;
    tapeCounter?: string;
    telemetryData?: Array<{ label: string, targetField: string, value: string }>;
    isStreamRecording?: boolean;
    isStreamPaused?: boolean;
    onRefreshInspection?: () => void;
}

export function SeabedSurveyGuiInline({
    open, onClose, structureId, jobpackId, sowRecordId, sowReportNo, rovJob, tapeId, tapeCounter, telemetryData, isStreamRecording, isStreamPaused, onRefreshInspection
}: SeabedSurveyGuiDialogProps) {
    const supabase = createClient();
    const [existingDebris, setExistingDebris] = useState<any[]>([]);
    const [structureName, setStructureName] = useState<string>('');
    const [structureDepth, setStructureDepth] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newPoint, setNewPoint] = useState<any>(null);
    const [hoverInfo, setHoverInfo] = useState<any>(null);
    const [activeId, setActiveId] = useState<string | number | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
    const [formData, setFormData] = useState({
        category: 'Debris',
        description: '',
        material: 'Non-Metallic',
        size: '',
        intensity: 'Moderate',
        craterDiameter: '',
        craterDiameterUnit: 'm',
        craterDepth: '',
        craterDepthUnit: 'm',
        distanceUnit: 'm'
    });
    const [editFormData, setEditFormData] = useState<any>(null);
    const [selectedReference, setSelectedReference] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>('All');
    const [availableComparisons, setAvailableComparisons] = useState<any[]>([]);
    const [selectedComparison, setSelectedComparison] = useState<string>('none');
    const [comparisonDebris, setComparisonDebris] = useState<any[]>([]);
    const [availableSectors, setAvailableSectors] = useState<string[]>([]);
    const [legsMetadata, setLegsMetadata] = useState<any[]>([]);

    const generateQid = (geometry: any) => {
        if (!geometry || !geometry.startLeg || !geometry.endLeg) return '';
        return `S/BED(${geometry.startLeg}-${geometry.endLeg})-${geometry.nearestDistance}M`;
    };

    useEffect(() => {
        if (open && structureId) {
            fetchStructureContext();
            fetchExistingDebris();
            fetchAvailableComparisons();
            fetchAvailableSectors();
            fetchLegsMetadata();
        }
    }, [open, structureId, rovJob]);

    const fetchLegsMetadata = async () => {
        try {
            const { data } = await supabase.from('structure_components')
                .select('q_id, metadata')
                .eq('structure_id', Number(structureId))
                .eq('code', 'LG');
            if (data) {
                setLegsMetadata(data);
            }
        } catch (e) { console.error("Error fetching legs metadata:", e); }
    };

    const fetchAvailableSectors = async () => {
        try {
            const { data } = await supabase.from('structure_components')
                .select('q_id')
                .eq('structure_id', Number(structureId))
                .eq('code', 'SD');
            if (data) {
                setAvailableSectors(data.map(c => c.q_id));
            }
        } catch (e) { console.error("Error fetching available sectors:", e); }
    };

    const fetchAvailableComparisons = async () => {
        try {
            const { data, error } = await supabase
                .from('insp_records')
                .select('jobpack_id, sow_report_no, jobpack:jobpack_id(name)')
                .eq('structure_id', Number(structureId))
                .eq('inspection_type_code', 'RSEAB');
            
            if (error) throw error;
            if (data) {
                const unique = data.reduce((acc: any[], curr: any) => {
                    // Exclude current dataset
                    if (curr.jobpack_id === Number(jobpackId) && curr.sow_report_no === sowReportNo) return acc;
                    
                    const key = `${curr.jobpack_id}|${curr.sow_report_no}`;
                    if (!acc.find(a => a.key === key)) {
                        acc.push({
                            key,
                            jobpackId: curr.jobpack_id,
                            sowReportNo: curr.sow_report_no,
                            name: `${curr.jobpack?.name || 'JP' + curr.jobpack_id} - ${curr.sow_report_no}`
                        });
                    }
                    return acc;
                }, []);
                setAvailableComparisons(unique);
            }
        } catch (e) { console.error("Error fetching comparisons:", e); }
    };

    const fetchComparisonDebris = async (key: string) => {
        if (key === 'none') {
            setComparisonDebris([]);
            return;
        }
        const [jpId, sowNo] = key.split('|');
        try {
            const { data, error } = await supabase.from('insp_records')
                .select(`insp_id, inspection_data, description`)
                .eq('structure_id', Number(structureId))
                .eq('jobpack_id', Number(jpId))
                .eq('sow_report_no', sowNo)
                .eq('inspection_type_code', 'RSEAB');

            if (error) throw error;
            if (data) {
                const mapped = data.map((r: any, index: number) => {
                    const idraw = r.inspection_data || {};
                    const cat = idraw.category || (r.description?.includes('Gas Seepage') ? 'Gas Seepage' : r.description?.includes('Crater') ? 'Crater' : 'Debris');
                    return {
                        id: `ref-${r.insp_id}`,
                        x: parseFloat(idraw.x),
                        y: parseFloat(idraw.y),
                        label: (index + 1).toString(),
                        type: cat,
                        isMetallic: idraw.material === 'Metallic' || idraw.debris_material === 'Metallic',
                        description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/, '') || '',
                        material: idraw.material || idraw.debris_material || 'Unknown',
                        size: idraw.size_dimensions || idraw.dimension_1 || 'N/A',
                        intensity: idraw.seepage_intensity || 'Moderate',
                        craterDiameter: idraw.crater_diameter || '',
                        craterDepth: idraw.crater_depth || '',
                        face: idraw.face || '',
                        distance: idraw.distance_from_leg || idraw.distance || 0,
                        nearestLeg: idraw.nearest_leg || '',
                        distToNearestLeg: idraw.dist_to_nearest_leg || 0,
                    };
                }).filter(r => !isNaN(r.x) && !isNaN(r.y));
                setComparisonDebris(mapped);
            }
        } catch (e) { console.error("Error fetching comparison debris:", e); }
    };

    const fetchStructureContext = async () => {
        const { data } = await supabase.from('structures').select('name, water_depth').eq('id', structureId).single();
        if (data) {
            setStructureName(data.name);
            setStructureDepth(data.water_depth);
        }
    };

    const fetchExistingDebris = async () => {
        if (!rovJob) return;
        try {
            setIsSyncing(true);
            let query = supabase.from('insp_records')
            .select(`
                insp_id, inspection_data, description, status, tape_count_no, tape_id, cr_user, structure_components:component_id ( q_id )
            `)
            .eq('structure_id', Number(structureId))
            .eq('inspection_type_code', 'RSEAB');

            if (jobpackId) query = query.eq('jobpack_id', Number(jobpackId));
            
            // Apply SOW Report filtering
            const effectiveSowReport = sowReportNo || rovJob?.raw?.sow_report_no || rovJob?.sow_report_no;
            if (effectiveSowReport) {
                query = query.eq('sow_report_no', effectiveSowReport);
            }

            const { data, error } = await query.order('insp_id', { ascending: true });

        if (error || !data) {
            setExistingDebris([]);
            return;
        }
        
        const mapped = data.map((r: any, index: number) => {
            const idraw = r.inspection_data || {};
            const cat = idraw.category || (r.description?.includes('Gas Seepage') ? 'Gas Seepage' : r.description?.includes('Crater') ? 'Crater' : 'Debris');
            
            return {
                id: r.insp_id,
                x: parseFloat(idraw.x),
                y: parseFloat(idraw.y),
                label: (index + 1).toString(),
                qid: r.structure_components?.q_id || r.insp_id,
                isMetallic: idraw.material === 'Metallic' || idraw.debris_material === 'Metallic',
                face: idraw.face || '',
                distance: idraw.distance_from_leg || idraw.distance || 0,
                type: cat,
                description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/, '') || '',
                size: idraw.size_dimensions || idraw.dimension_1 || '',
                material: idraw.material || idraw.debris_material || 'Unknown',
                intensity: idraw.seepage_intensity || 'Moderate',
                craterDiameter: idraw.crater_diameter || '',
                craterDiameterUnit: idraw.crater_diameter_unit || 'm',
                craterDepth: idraw.crater_depth || '',
                craterDepthUnit: idraw.crater_depth_unit || 'm',
                distanceUnit: idraw.distance_from_leg_unit || 'm',
                nearestLeg: idraw.nearest_leg || '',
                distToNearestLeg: idraw.dist_to_nearest_leg || 0,
            };
        }).filter(r => !isNaN(r.x) && !isNaN(r.y));
        
        setExistingDebris(mapped);
        } catch (err) {
            console.error("fetchExistingDebris error:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (activeId) {
            // 1. Check live debris
            const liveItem = existingDebris.find(d => d.id === activeId);
            if (liveItem) {
                setSelectedReference(null);
                setEditFormData({
                    category: liveItem.type,
                    description: liveItem.description,
                    material: liveItem.material,
                    size: liveItem.size,
                    intensity: liveItem.intensity,
                    craterDiameter: liveItem.craterDiameter,
                    craterDiameterUnit: liveItem.craterDiameterUnit,
                    craterDepth: liveItem.craterDepth,
                    craterDepthUnit: liveItem.craterDepthUnit,
                    distanceUnit: liveItem.distanceUnit,
                    distance: liveItem.distance,
                    face: liveItem.face,
                    nearestLeg: liveItem.nearestLeg,
                    distToNearestLeg: liveItem.distToNearestLeg
                });
                return;
            }

            // 2. Check reference (historical) debris
            const refItem = comparisonDebris.find(d => d.id === activeId);
            if (refItem) {
                setSelectedReference(refItem);
                setEditFormData(null);
            }
        } else {
            setSelectedReference(null);
            setEditFormData(null);
        }
    }, [activeId, existingDebris, comparisonDebris]);

    const handleAddClick = (x: number, y: number, geometry: any) => {
        if (!isStreamRecording || isStreamPaused) {
            toast.error("Video log is currently STOPPED or PAUSED. New survey flags can only be added when a video log is active/recording in live mode.");
            return;
        }
        setNewPoint({ x, y, geometry });
        setIsAdding(true);
        setActiveId(null);
        setFormData({ 
            category: 'Debris', 
            description: '', 
            material: 'Non-Metallic', 
            size: '',
            intensity: 'Moderate',
            craterDiameter: '',
            craterDiameterUnit: 'm',
            craterDepth: '',
            craterDepthUnit: 'm',
            distanceUnit: 'm'
        });
    };

    const handleSaveNewDebris = async () => {
        if (!newPoint || isSaving) return;

        if (!isStreamRecording || isStreamPaused) {
            toast.error("Video log is currently STOPPED or PAUSED. New survey flags can only be added when a video log is active/recording in live mode.");
            return;
        }

        const generatedQid = generateQid(newPoint.geometry);

        try {
            setIsSaving(true);
            
            // Parallelize independent metadata fetches to reduce network latency
            const [inspTypeRes, authRes] = await Promise.all([
                supabase.from('inspection_type').select('id').eq('code', 'RSEAB').maybeSingle(),
                supabase.auth.getUser()
            ]);

            const findLegMeta = (legName: string) => {
                if (!legsMetadata || legsMetadata.length === 0) return null;
                
                const matches = legsMetadata.filter(c => {
                    const m = c.metadata || {};
                    // Rule 1: Undeleted components only (del is null or 0)
                    const isNotDeleted = m.del === 0 || m.del === null || m.del === undefined;
                    
                    // Rule 2: s_leg and f_leg should match the leg name (e.g. "A1")
                    // We also allow QID match as fallback for older data
                    const matchesLegName = (m.f_leg === legName && m.s_leg === legName) || 
                                         c.q_id.toUpperCase() === `LEG ${legName.toUpperCase()}` ||
                                         c.q_id.toUpperCase() === legName.toUpperCase();
                    
                    // Rule 3: s_node and f_node should be different
                    const nodesDifferent = m.f_node && m.s_node && m.f_node !== m.s_node;
                    
                    return isNotDeleted && matchesLegName && nodesDifferent;
                });
                
                if (matches.length === 0) return null;
                
                // Rule 4: elv_1 and elv_2 will be from top to bottom elevation
                // We sort to pick the one with lowest bottom elevation (elv_2)
                const sorted = matches.sort((a, b) => {
                    const elvA = parseFloat(a.metadata?.elv_2 || '0');
                    const elvB = parseFloat(b.metadata?.elv_2 || '0');
                    return elvA - elvB;
                });
                
                return sorted[0].metadata;
            };

            const startLegMeta = findLegMeta(newPoint.geometry.startLeg);
            const endLegMeta = findLegMeta(newPoint.geometry.endLeg);

            const authData = authRes.data;
            let inspTypeId = inspTypeRes.data?.id;

            if (!inspTypeId) {
                // Auto-create to prevent null insertion
                const { data: newType } = await supabase.from('inspection_type').insert({
                    code: 'RSEAB',
                    name: 'ROV Seabed Inspection'
                }).select('id').single();
                if (newType?.id) inspTypeId = newType.id;
            }

            // Ultimate fallback if insert fails
            if (!inspTypeId && typeof rovJob !== 'undefined') {
                if (rovJob?.raw?.inspection_type_id) inspTypeId = rovJob.raw.inspection_type_id;
                else if (rovJob?.inspection_type_id) inspTypeId = rovJob.inspection_type_id;
            }

            // 1. Check or Insert Component dynamically
            let componentId = null;
            const { data: existingComp } = await supabase.from('structure_components')
                .select('id').eq('structure_id', structureId).eq('q_id', generatedQid).maybeSingle();
            
            if (existingComp) {
                componentId = existingComp.id;
            } else {
                const componentTs = Math.floor(Date.now() / 1000);
                const { data: newComp, error: compErr } = await supabase.from('structure_components').insert({
                    structure_id: structureId,
                    q_id: generatedQid,
                    id_no: `SD/${componentTs}`,
                    code: 'SD',
                    comp_id: componentTs,
                    metadata: {
                        description: `Seabed Debris ${newPoint.geometry.startLeg}(Node:${startLegMeta?.f_node || startLegMeta?.start_node || 'N/A'}) to ${newPoint.geometry.endLeg}(Node:${endLegMeta?.f_node || endLegMeta?.start_node || 'N/A'}) at EL:${startLegMeta?.elv_2 || startLegMeta?.elevation_2 || structureDepth || 'N/A'}m, Range:${newPoint.geometry.nearestDistance}M`,
                        f_leg: newPoint.geometry.startLeg,
                        s_leg: newPoint.geometry.endLeg,
                        dist: newPoint.geometry.nearestDistance.toString(),
                        face: newPoint.geometry.face,
                        nearest_leg: newPoint.geometry.nearestLeg,
                        dist_to_nearest_leg: newPoint.geometry.distToNearestLeg.toFixed(1),
                        lvl: 'Seabed',
                        elv_1: startLegMeta?.elv_2 || startLegMeta?.elevation_2 || startLegMeta?.lvl || startLegMeta?.elevation || structureDepth || null,
                        elv_2: endLegMeta?.elv_2 || endLegMeta?.elevation_2 || endLegMeta?.lvl || endLegMeta?.elevation || structureDepth || null,
                        f_node: startLegMeta?.f_node || startLegMeta?.start_node || null,
                        s_node: endLegMeta?.f_node || endLegMeta?.start_node || null
                    }
                }).select('id').single();
                if (compErr) throw compErr;
                componentId = newComp.id;
            }

            // 2. Add to SOW if sowRecordId exists and not already mapped
            let sowItemId = null;

            if (sowRecordId && (componentId || generatedQid)) {
                // Check by QID and Type since SOW items often don't have component_id FK
                const { data: existingSow } = await supabase.from('u_sow_items')
                    .select('id')
                    .eq('sow_id', sowRecordId)
                    .eq('inspection_type_id', inspTypeId)
                    .eq('component_qid', generatedQid)
                    .maybeSingle();
                
                if (existingSow) {
                    sowItemId = existingSow.id;
                    console.log(`[SOW] Found existing item for ${generatedQid}: ${sowItemId}`);
                } else {
                    if (inspTypeId) {
                        const { data: it } = await supabase.from('inspection_type').select('name').eq('id', inspTypeId).single();
                        
                        const effectiveReportNo = sowReportNo || rovJob?.raw?.sow_report_no || "N/A";
                        
                        const sowPayload: any = {
                            sow_id: sowRecordId,
                            component_id: componentId,
                            component_qid: generatedQid,
                            component_type: 'SD',
                            inspection_type_id: inspTypeId,
                            inspection_code: 'RSEAB',
                            inspection_name: it?.name || 'Seabed Survey',
                            status: 'completed',
                            report_number: effectiveReportNo,
                            inspection_count: 1,
                            last_inspection_date: new Date().toISOString(),
                            created_by: authData?.user?.id || null,
                            updated_by: authData?.user?.id || null
                        };

                        console.log(`[SOW] Inserting new item for ${generatedQid}:`, sowPayload);

                        const { data: newSowData, error: sowErr } = await supabase.from('u_sow_items').insert(sowPayload).select('id');
                        
                        if (sowErr) {
                            console.error("[SOW] Insert error:", sowErr);
                            toast.error("SOW Task Creation Failed: " + (sowErr.message || "Unknown Error"));
                        } else if (newSowData && newSowData[0]) {
                            sowItemId = newSowData[0].id;
                            console.log(`[SOW] Successfully created item: ${sowItemId}`);

                            // Update u_sow counters
                            const { data: sowMeta } = await supabase.from('u_sow').select('total_items').eq('id', sowRecordId).maybeSingle();
                            if (sowMeta) {
                                await supabase.from('u_sow').update({
                                    total_items: (sowMeta.total_items || 0) + 1,
                                    updated_at: new Date().toISOString()
                                }).eq('id', sowRecordId);
                            }
                        }
                    }
                }
            }

            // 3. Create Insp Record
            // Capture telemetry if available
            const northingVal = telemetryData?.find(f => f.targetField === 'northing' || f.label.toLowerCase() === 'northing')?.value;
            const eastingVal = telemetryData?.find(f => f.targetField === 'easting' || f.label.toLowerCase() === 'easting')?.value;

            const inspectionData: any = {
                distance_from_leg: newPoint.geometry.distance.toFixed(1),
                distance_from_leg_unit: formData.distanceUnit,
                face: newPoint.geometry.face,
                nearest_leg: newPoint.geometry.nearestLeg,
                dist_to_nearest_leg: newPoint.geometry.distToNearestLeg.toFixed(1),
                x: newPoint.x.toFixed(2),
                y: newPoint.y.toFixed(2),
                category: formData.category,
                material: formData.material,
                size_dimensions: formData.size,
                seepage_intensity: formData.intensity,
                crater_diameter: formData.craterDiameter,
                crater_diameter_unit: formData.craterDiameterUnit,
                crater_depth: formData.craterDepth,
                crater_depth_unit: formData.craterDepthUnit,
                type: formData.category, // preserve for old code
                debris_material: formData.material, // preserve for old code
                dimension_1: formData.size, // preserve for old code
                finding_type: "Complete",
            };

            // Inject telemetry if data is connected/valid (not '--')
            if (northingVal && northingVal !== '--') inspectionData.northing = northingVal;
            if (eastingVal && eastingVal !== '--') inspectionData.easting = eastingVal;

            const now = new Date();
            const { error: recErr } = await supabase.from('insp_records').insert({
                rov_job_id: rovJob?.raw?.rov_job_id || rovJob?.id || null,
                structure_id: Number(structureId),
                jobpack_id: Number(jobpackId),
                component_id: componentId,
                component_type: 'SD',
                inspection_type_code: 'RSEAB',
                inspection_type_id: inspTypeId,
                sow_report_no: sowReportNo || rovJob?.raw?.sow_report_no || 'Unknown',
                description: formData.description ? `${formData.category}: ${formData.description}` : formData.category,
                inspection_data: inspectionData,
                status: 'COMPLETED',
                tape_id: typeof tapeId === 'string' && tapeId !== 'undefined' ? (parseInt(tapeId, 10) || null) : (typeof tapeId === 'number' ? tapeId : null),
                tape_count_no: tapeCounter,
                inspection_date: now.toISOString().split('T')[0],
                inspection_time: now.toTimeString().split(' ')[0],
                has_anomaly: false,
                elevation: 0,
                cr_user: authData?.user?.id || null
            });

            if (recErr) throw recErr;
            
            toast.success(`Registered Debris at ${generatedQid}`);
            setIsAdding(false);
            setNewPoint(null);
            if (onRefreshInspection) onRefreshInspection();
            fetchAvailableSectors(); // Update grid colors immediately
            fetchExistingDebris(); // Refresh markers

        } catch (err: any) {
            console.error(err);
            toast.error("Failed to register debris: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMoveDebris = async (id: string | number, x: number, y: number, geometry: any) => {
        if (isSaving) return;
        
        const generatedQid = generateQid(geometry);
        const currentRec = existingDebris.find(d => d.id === id);
        
        // Confirmation alert on QID change
        if (currentRec && currentRec.qid !== generatedQid) {
            const confirmed = confirm(`You are moving this marker into a different distance box: ${generatedQid}. \n\nThis will re-assign the QID and update Work Scope (SOW) statuses. \n\nDo you want to proceed?`);
            if (!confirmed) {
                fetchExistingDebris(); // Refresh to reset visual position
                return;
            }
        }

        try {
            setIsSaving(true);
            let componentId = undefined;
            let oldComponentId = null;
            let inspTypeId = null;

            // Fetch current record to identify old component
            const { data: recData } = await supabase.from('insp_records')
                .select('component_id, inspection_type_id').eq('insp_id', id).single();
            if (recData) {
                oldComponentId = recData.component_id;
                inspTypeId = recData.inspection_type_id;
            }

            if (currentRec && currentRec.qid !== generatedQid) {
                // Find or insert the new component since QID changed!
                const { data: existingComp } = await supabase.from('structure_components')
                    .select('id').eq('structure_id', structureId).eq('q_id', generatedQid).maybeSingle();
                
                if (existingComp) {
                    componentId = existingComp.id;
                } else {
                    const fetchLegDetails = async (legName: string) => {
                        const { data } = await supabase.from('structure_components')
                            .select('metadata, q_id')
                            .eq('structure_id', structureId)
                            .eq('code', 'LG');
                        if (!data) return null;
                        const matches = data.filter(c => c.q_id.toUpperCase().includes(legName.toUpperCase()) || (c.metadata?.description || '').toUpperCase().includes(legName.toUpperCase()));
                        if (matches.length === 0) return null;
                        const sorted = matches.sort((a, b) => {
                            const elvA = parseFloat(a.metadata?.lvl || a.metadata?.elevation || '0');
                            const elvB = parseFloat(b.metadata?.lvl || b.metadata?.elevation || '0');
                            return elvA - elvB;
                        });
                        return sorted[0].metadata;
                    };

                    const [startLegMeta, endLegMeta] = await Promise.all([
                        fetchLegDetails(geometry.startLeg),
                        fetchLegDetails(geometry.endLeg)
                    ]);

                    const componentTs = Math.floor(Date.now() / 1000);
                    const { data: newComp } = await supabase.from('structure_components').insert({
                        structure_id: structureId,
                        q_id: generatedQid,
                        id_no: `SD/${componentTs}`,
                        code: 'SD',
                        comp_id: componentTs,
                        metadata: {
                            description: `Seabed Survey ${geometry.startLeg}-${geometry.endLeg} ${geometry.nearestDistance}M`,
                            f_leg: geometry.startLeg,
                            s_leg: geometry.endLeg,
                            dist: geometry.nearestDistance.toString(),
                            face: geometry.face,
                            lvl: 'Seabed',
                            elv_1: startLegMeta?.lvl || startLegMeta?.elevation || null,
                            elv_2: endLegMeta?.lvl || endLegMeta?.elevation || null,
                            f_node: startLegMeta?.start_node || startLegMeta?.end_node || null,
                            s_node: endLegMeta?.start_node || endLegMeta?.end_node || null
                        }
                    }).select('id').single();
                    if (newComp) componentId = newComp.id;
                }
            }

            const { data: currentDbData } = await supabase.from('insp_records').select('inspection_data, description').eq('insp_id', id).single();

            const inspectionData = {
                ...(currentDbData?.inspection_data || {}),
                distance_from_leg: geometry.distance.toFixed(1),
                face: geometry.face,
                nearest_leg: geometry.nearestLeg,
                dist_to_nearest_leg: geometry.distToNearestLeg.toFixed(1),
                x: x.toFixed(2),
                y: y.toFixed(2),
                finding_type: "Complete",
            };

            const { data: authData } = await supabase.auth.getUser();
            const updatePayload: any = { 
                inspection_data: inspectionData,
                inspection_type_code: 'RSEAB',
                md_user: authData?.user?.id || null,
                md_date: new Date().toISOString()
            };
            if (componentId) updatePayload.component_id = componentId;

            // Ensure inspection_type_id is set
            if (!inspTypeId) {
                const { data: it } = await supabase.from('inspection_type').select('id').eq('code', 'RSEAB').maybeSingle();
                if (it?.id) inspTypeId = it.id;
            }
            if (inspTypeId) updatePayload.inspection_type_id = inspTypeId;

            const { error } = await supabase.from('insp_records')
                .update(updatePayload)
                .eq('insp_id', id);

            if (error) throw error;

            // --- SOW Status Updates ---
            if (sowRecordId && componentId && componentId !== oldComponentId) {
                try {
                    const effectiveReportNo = sowReportNo || rovJob?.raw?.sow_report_no || "N/A";
                    // 1. Mark NEW component as 'Completed'
                    const { data: existingNewSow } = await supabase.from('u_sow_items')
                        .select('id')
                        .eq('sow_id', sowRecordId)
                        .eq('inspection_type_id', inspTypeId)
                        .eq('component_qid', generatedQid)
                        .maybeSingle();
                    
                    let newSowItemId = existingNewSow?.id;

                    if (existingNewSow) {
                        newSowItemId = existingNewSow.id;
                        console.log(`[SOW] Found existing item for ${generatedQid}: ${newSowItemId}`);
                        await supabase.from('u_sow_items').update({ 
                            status: 'completed',
                            report_number: effectiveReportNo,
                            updated_by: authData?.user?.email || 'Auto-GUI',
                            updated_at: new Date().toISOString()
                        }).eq('id', existingNewSow.id);
                    } else if (inspTypeId) {
                        const { data: it } = await supabase.from('inspection_type').select('name').eq('id', inspTypeId).single();
                        const sowPayload: any = {
                            sow_id: sowRecordId,
                            component_id: componentId,
                            component_qid: generatedQid,
                            component_type: 'SD',
                            inspection_type_id: inspTypeId,
                            inspection_code: 'RSEAB',
                            inspection_name: it?.name || 'Seabed Survey',
                            status: 'completed',
                            report_number: effectiveReportNo,
                            inspection_count: 1,
                            last_inspection_date: new Date().toISOString(),
                            created_by: authData?.user?.email || 'Auto-GUI',
                            updated_by: authData?.user?.email || 'Auto-GUI'
                        };
                        console.log(`[SOW] Inserting moved item for ${generatedQid}:`, sowPayload);
                        const { data: nsiData, error: nsiErr } = await supabase.from('u_sow_items').insert(sowPayload).select('id');
                        
                        if (nsiErr) {
                            console.error("[SOW] Move insert error:", nsiErr);
                        } else if (nsiData && nsiData[0]) {
                            newSowItemId = nsiData[0].id;
                            // Update u_sow counters
                            const { data: sowMeta } = await supabase.from('u_sow').select('total_items').eq('id', sowRecordId).maybeSingle();
                            if (sowMeta) {
                                await supabase.from('u_sow').update({
                                    total_items: (sowMeta.total_items || 0) + 1,
                                    updated_at: new Date().toISOString()
                                }).eq('id', sowRecordId);
                            }
                        }
                    }

                    // 2. Mark OLD component as 'Pending' if no other records exist
                    if (oldComponentId) {
                        const { count } = await supabase.from('insp_records')
                            .select('*', { count: 'exact', head: true })
                            .eq('component_id', oldComponentId)
                            .eq('inspection_type_code', 'RSEAB');
                        
                        if (!count || count === 0) {
                            const { data: existingOldSow } = await supabase.from('u_sow_items')
                                .select('id').eq('sow_id', sowRecordId).eq('component_id', oldComponentId).maybeSingle();
                            if (existingOldSow) {
                                await supabase.from('u_sow_items').update({ status: 'pending' }).eq('id', existingOldSow.id);
                            }
                        }
                    }
                } catch (sowErr) {
                    console.warn("SOW Status Sync failed:", sowErr);
                }
            }

            toast.success("Relocated successfully");
            if (onRefreshInspection) onRefreshInspection();
            
            // Auto-flip page if moved outside current range
            if (geometry.distance) {
                const targetPage = Math.floor(geometry.distance / 21);
                if (targetPage !== currentPage && geometry.distance > 0) {
                    setCurrentPage(targetPage);
                }
            }

            fetchExistingDebris();
        } catch (err: any) {
            toast.error("Failed to move debris: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!activeId || !editFormData || isSaving) return;
        try {
            setIsSaving(true);
            const { data: record } = await supabase.from('insp_records')
                .select('inspection_data, component_id, inspection_type_id')
                .eq('insp_id', activeId)
                .single();
            
            // If distance or face changed, we need to recalculate QID and component
            let componentId = record?.component_id;
            const oldComponentId = record?.component_id;
            const distChanged = editFormData.distance !== (record?.inspection_data?.distance_from_leg);
            const faceChanged = editFormData.face !== (record?.inspection_data?.face);

            if (distChanged || faceChanged) {
                const parsedDist = parseFloat(editFormData.distance);
                // Match nearest 3m box for QID
                const boxDist = Math.round(parsedDist / 3) * 3 || 3;
                const legs = editFormData.face.split('-');
                const startLeg = legs[0];
                const endLeg = legs[1];
                const generatedQid = `S/BED(${startLeg}-${endLeg})-${boxDist}M`;

                if (!confirm(`Manual relocation detected. This will change the QID to ${generatedQid} and update Work Scope status. Proceed?`)) {
                    setIsSaving(false);
                    return;
                }

                // Find or create component
                const { data: existingComp } = await supabase.from('structure_components')
                    .select('id').eq('structure_id', structureId).eq('q_id', generatedQid).maybeSingle();
                
                if (existingComp) {
                    componentId = existingComp.id;
                } else {
                    const componentTs = Math.floor(Date.now() / 1000);
                    const { data: newComp } = await supabase.from('structure_components').insert({
                        structure_id: structureId,
                        q_id: generatedQid,
                        id_no: `SD/${componentTs}`,
                        code: 'SD',
                        comp_id: componentTs,
                        metadata: {
                            description: `Seabed Survey Manual Shift ${generatedQid}`,
                            f_leg: startLeg,
                            s_leg: endLeg,
                            dist: boxDist.toString(),
                            face: editFormData.face,
                            lvl: 'Seabed'
                        }
                    }).select('id').single();
                    if (newComp) componentId = newComp.id;
                }
            }

            const newData = {
                ...(record?.inspection_data || {}),
                category: editFormData.category,
                material: editFormData.material,
                size_dimensions: editFormData.size,
                seepage_intensity: editFormData.intensity,
                crater_diameter: editFormData.craterDiameter,
                crater_diameter_unit: editFormData.craterDiameterUnit,
                crater_depth: editFormData.craterDepth,
                crater_depth_unit: editFormData.craterDepthUnit,
                distance_from_leg: editFormData.distance,
                face: editFormData.face,
                distance_from_leg_unit: editFormData.distanceUnit,
                nearest_leg: editFormData.nearestLeg,
                dist_to_nearest_leg: editFormData.distToNearestLeg,
                type: editFormData.category, 
                debris_material: editFormData.material,
                dimension_1: editFormData.size,
            };

            const { data: authData } = await supabase.auth.getUser();
            const { error } = await supabase.from('insp_records')
                .update({ 
                    inspection_data: newData,
                    component_id: componentId,
                    description: editFormData.description ? `${editFormData.category}: ${editFormData.description}` : editFormData.category,
                    md_user: authData?.user?.id || null,
                    md_date: new Date().toISOString()
                })
                .eq('insp_id', activeId);

            if (error) throw error;

            // SOW Sync for manual shift
            if (sowRecordId && componentId !== oldComponentId) {
                 try {
                     // 1. Mark NEW component as 'Completed'
                     const { data: existingNewSow } = await supabase.from('u_sow_items')
                        .select('id').eq('sow_id', sowRecordId).eq('component_id', componentId).maybeSingle();
                     if (existingNewSow) {
                        await supabase.from('u_sow_items').update({ status: 'completed' }).eq('id', existingNewSow.id);
                     } else if (record?.inspection_type_id) {
                        await supabase.from('u_sow_items').insert({
                            sow_id: sowRecordId,
                            component_id: componentId,
                            inspection_type_id: record.inspection_type_id,
                            status: 'completed',
                            report_number: sowReportNo || rovJob?.raw?.sow_report_no || "Auto-RSEAB"
                        });
                     }

                     // 2. Mark OLD component as 'Pending' if no other records exist
                     if (oldComponentId) {
                        const { count } = await supabase.from('insp_records')
                            .select('*', { count: 'exact', head: true })
                            .eq('component_id', oldComponentId)
                            .eq('inspection_type_code', 'RSEAB');
                        
                        if (!count || count === 0) {
                            const { data: existingOldSow } = await supabase.from('u_sow_items')
                                .select('id').eq('sow_id', sowRecordId).eq('component_id', oldComponentId).maybeSingle();
                            if (existingOldSow) {
                                await supabase.from('u_sow_items').update({ status: 'pending' }).eq('id', existingOldSow.id);
                            }
                        }
                     }
                 } catch (sowSyncErr) {
                     console.warn("Manual shift SOW sync failed:", sowSyncErr);
                 }
            }

            toast.success("Details updated successfully");
            if (onRefreshInspection) onRefreshInspection();
            fetchExistingDebris();
        } catch(e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDebris = async () => {
        if (!activeId || isSaving) return;
        if (!confirm("Are you sure you want to delete this debris record?")) return;

        try {
            setIsSaving(true);
            
            // 1. Fetch metadata before deletion to identify SOW link
            const { data: record } = await supabase.from('insp_records')
                .select('component_id, inspection_type_id')
                .eq('insp_id', activeId)
                .single();

            // 2. Perform deletion
            const { error } = await supabase.from('insp_records')
                .delete()
                .eq('insp_id', activeId);

            if (error) throw error;
            
            // 3. Update SOW Status if it was the last record for this component/task
            if (sowRecordId && record?.component_id && record?.inspection_type_id) {
                try {
                    const { count } = await supabase.from('insp_records')
                        .select('*', { count: 'exact', head: true })
                        .eq('component_id', record.component_id)
                        .eq('inspection_type_id', record.inspection_type_id);
                    
                    if (!count || count === 0) {
                        const { data: sowItem } = await supabase.from('u_sow_items')
                            .select('id')
                            .eq('sow_id', sowRecordId)
                            .eq('component_id', record.component_id)
                            .eq('inspection_type_id', record.inspection_type_id)
                            .maybeSingle();
                        
                        if (sowItem) {
                            await supabase.from('u_sow_items').update({ status: 'pending' }).eq('id', sowItem.id);
                        }
                    }
                } catch (sowErr) {
                    console.warn("SOW deletion sync failed:", sowErr);
                }
            }

            toast.success("Debris record deleted");
            if (onRefreshInspection) onRefreshInspection();
            setActiveId(null);
            fetchExistingDebris();
        } catch (err: any) {
            toast.error("Failed to delete debris: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const minDistance = currentPage * 21;
    const maxDistance = (currentPage + 1) * 21;
    const itemsForCurrentPage = existingDebris
        .filter(d => d.distance > minDistance && d.distance <= maxDistance)
        .filter(d => typeFilter === 'All' || d.type === typeFilter);
    const activeItem = existingDebris.find(d => d.id === activeId);

    if (!open) return null;

    return (
        <Card className="h-full w-full flex flex-col p-0 overflow-hidden shadow-lg border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 animate-in slide-in-from-right-8 duration-300">
            <div className="px-6 py-4 border-b bg-white dark:bg-slate-950 flex items-center justify-between">
                <h2 className="text-xl font-bold">Seabed Survey Multi-Drop GUI</h2>
                <div className="flex items-center gap-4">
                    {/* Comparison Selector */}
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md shadow-sm">
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Compare:
                        </span>
                        {availableComparisons.length > 0 ? (
                            <Select 
                                value={selectedComparison} 
                                onValueChange={(v) => {
                                    setSelectedComparison(v);
                                    fetchComparisonDebris(v);
                                }}
                            >
                                <SelectTrigger className="h-7 w-56 text-[10px] bg-white border-amber-200 focus:ring-amber-500">
                                    <SelectValue placeholder="Select Previous Survey" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Comparison</SelectItem>
                                    {availableComparisons.map(c => (
                                        <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-[10px] font-bold text-amber-600/60 italic px-2">No historical survey data found</span>
                        )}
                    </div>

                    <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm">
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>Prev Range</Button>
                        <div className="px-3 font-bold text-slate-600 border-x border-slate-200">
                            Page {currentPage + 1}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => p + 1)}>Next Range</Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                {/* Items List Sidebar (Left) */}
                <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col z-10 shadow-[2px_0_10px_rgba(0,0,0,0.05)]">
                    <div className="px-4 py-3 border-b border-slate-200 bg-white font-bold text-sm text-slate-800 flex justify-between items-center">
                        <span className="flex items-center gap-2">
                            Items Registered
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-black">{itemsForCurrentPage.length}</span>
                        </span>
                    </div>
                    {/* Filter Options */}
                    <div className="px-2 py-2 border-b border-slate-200 bg-slate-50/80 flex flex-col gap-1.5">
                        <div className="px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter by Type:</div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar scrollbar-hide pb-0.5">
                            {['All', 'Debris', 'Gas Seepage', 'Crater'].map(t => (
                                <Button 
                                    key={t}
                                    variant={typeFilter === t ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-7 px-2.5 text-[10px] uppercase font-black tracking-wider transition-all ${
                                        typeFilter === t 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'text-slate-500 hover:bg-slate-200'
                                    }`}
                                    onClick={() => setTypeFilter(t)}
                                >
                                    {t === 'Gas Seepage' ? 'Seepage' : t}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {itemsForCurrentPage.length === 0 ? (
                            <div className="text-center p-4 text-xs text-slate-500 bg-white rounded border border-slate-200 border-dashed">No items plotted</div>
                        ) : (
                            itemsForCurrentPage.map(item => (
                                <div key={item.id} 
                                     onClick={() => { setActiveId(item.id); setIsAdding(false); }}
                                     className={`p-2 rounded border text-xs cursor-pointer transition-all hover:-translate-y-[1px] ${activeId === item.id ? 'bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                                    <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white shadow-sm shrink-0 ${
                                            item.type === 'Gas Seepage' 
                                                ? 'bg-green-600' 
                                                : item.type === 'Crater' 
                                                    ? 'bg-purple-600' 
                                                    : item.isMetallic 
                                                        ? 'bg-blue-700' 
                                                        : 'bg-orange-600'
                                        }`}>
                                            {item.label}
                                        </div>
                                        <span className="truncate">{item.type || 'Debris'}</span>
                                        <span className="ml-auto text-[9px] font-bold font-mono bg-slate-200/60 text-slate-600 px-1 rounded border border-slate-200">{item.distance}m</span>
                                    </div>
                                    
                                    {item.description && (
                                        <div className="text-slate-600 text-[10px] leading-tight mb-1.5 line-clamp-2 px-0.5">
                                            {item.description}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-1 mt-0.5 border-t border-slate-100">
                                        <span className="text-[9px] font-mono text-slate-400 truncate pr-2" title={item.qid}>{item.qid}</span>
                                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
                                            <span className="w-1 h-1 rounded-full bg-slate-400 block"></span> 
                                            {item.face}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Plotter Area */}
                <div className="flex-1 bg-slate-200/50 p-6 flex flex-col items-center justify-center relative shadow-inner"
                     onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                     onMouseLeave={() => { setMousePos(null); setHoverInfo(null); }}
                >
                    <div className="w-full h-full max-w-2xl max-h-full flex items-center justify-center">
                            <SeabedDebrisPlot
                                layoutType={structureName.includes('8') ? 'rectangular' : 'rectangular'}
                                legCount={structureName.includes('8') ? 8 : 4}
                                gridDistances={[...Array(7)].map((_, i) => (currentPage * 7 + i + 1) * 3)}
                                distanceOffset={currentPage * 21}
                                debrisItems={itemsForCurrentPage}
                                onAddDebris={handleAddClick}
                                onDebrisMove={handleMoveDebris}
                                onSelectDebris={(id) => { setActiveId(id); setIsAdding(false); }}
                                activeDebrisId={activeId}
                                readOnly={false}
                                referenceItems={comparisonDebris.filter(d => typeFilter === 'All' || d.type === typeFilter)}
                                registeredQids={availableSectors}
                                legsMetadata={legsMetadata}
                            />
                            {!isAdding && !activeId && (
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm font-bold text-slate-700 text-sm border-l-4 border-blue-500">
                                    Click anywhere on the grid to drop a new debris marker.
                                </div>
                            )}

                            {isSyncing && (
                                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex flex-col items-center justify-center z-50 rounded-lg animate-in fade-in duration-300">
                                    <div className="bg-white/90 p-4 rounded-xl shadow-xl flex flex-col items-center gap-3 border border-blue-100">
                                        <div className="relative">
                                            <div className="absolute inset-0 blur-md bg-blue-400/30 rounded-full animate-pulse" />
                                            <Loader2 className="w-10 h-10 animate-spin text-blue-600 relative" />
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Syncing Seabed Data</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Fetching live multi-drop coordinates...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Form */}
                    {isAdding && newPoint && (
                        <div className="w-80 bg-white border-l p-6 space-y-6 overflow-y-auto animate-in slide-in-from-right">
                            <div>
                                <h3 className="font-black text-slate-800 uppercase tracking-wider mb-1">New Log Entry</h3>
                                <p className="text-xs text-slate-500 font-medium">Registering marker at X:{newPoint.x.toFixed(0)}, Y:{newPoint.y.toFixed(0)}</p>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t">
                                <div className="bg-blue-50 py-2 px-3 rounded text-sm text-blue-800 font-bold border border-blue-100 flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-xs opacity-70">
                                        <span>Face: {newPoint.geometry.face}</span>
                                        <span>Dist (Face): {newPoint.geometry.distance.toFixed(1)}m</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs opacity-70 border-t border-blue-200/50 pt-1 mt-1">
                                        <span>Nearest Leg: {newPoint.geometry.nearestLeg}</span>
                                        <span>Dist (Leg): {newPoint.geometry.distToNearestLeg.toFixed(1)}m</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-blue-200/50 pt-1 mt-1">
                                        <span className="text-xs uppercase tracking-widest font-black opacity-70">Target QID</span>
                                        <span className="font-mono">{generateQid(newPoint.geometry)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Item Category</Label>
                                    <Select value={formData.category} onValueChange={v => setFormData(p => ({...p, category: v}))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Debris">Debris</SelectItem>
                                            <SelectItem value="Gas Seepage">Gas Seepage</SelectItem>
                                            <SelectItem value="Crater">Crater</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.category === 'Debris' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Material</Label>
                                            <Select value={formData.material} onValueChange={v => setFormData(p => ({...p, material: v}))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Metallic">Metallic</SelectItem>
                                                    <SelectItem value="Non-Metallic">Non-Metallic</SelectItem>
                                                    <SelectItem value="Unknown">Unknown</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Size / Dimensions</Label>
                                            <Input 
                                                className="h-8 text-xs"
                                                placeholder="e.g. 2m x 0.5m" 
                                                value={formData.size}
                                                onChange={e => setFormData(p => ({...p, size: e.target.value}))}
                                            />
                                        </div>
                                    </>
                                )}

                                {formData.category === 'Gas Seepage' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs">Seepage Intensity</Label>
                                        <Select value={formData.intensity} onValueChange={v => setFormData(p => ({...p, intensity: v}))}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Light">Light Seepage</SelectItem>
                                                <SelectItem value="Moderate">Moderate Bubbling</SelectItem>
                                                <SelectItem value="Heavy">Heavy / High Pressure</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {formData.category === 'Crater' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Diameter</Label>
                                            <div className="flex gap-1">
                                                <Input 
                                                    type="number"
                                                    className="h-8 text-xs flex-1"
                                                    placeholder="e.g. 5" 
                                                    value={formData.craterDiameter}
                                                    onChange={e => setFormData(p => ({...p, craterDiameter: e.target.value}))}
                                                />
                                                <select 
                                                    className="h-8 px-1 text-[10px] font-bold border rounded bg-slate-50 text-slate-600 focus:outline-none"
                                                    value={formData.craterDiameterUnit}
                                                    onChange={e => setFormData(p => ({...p, craterDiameterUnit: e.target.value}))}
                                                >
                                                    <option value="m">m</option>
                                                    <option value="mm">mm</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Depth</Label>
                                            <div className="flex gap-1">
                                                <Input 
                                                    type="number"
                                                    className="h-8 text-xs flex-1"
                                                    placeholder="e.g. 2" 
                                                    value={formData.craterDepth}
                                                    onChange={e => setFormData(p => ({...p, craterDepth: e.target.value}))}
                                                />
                                                <select 
                                                    className="h-8 px-1 text-[10px] font-bold border rounded bg-slate-50 text-slate-600 focus:outline-none"
                                                    value={formData.craterDepthUnit}
                                                    onChange={e => setFormData(p => ({...p, craterDepthUnit: e.target.value}))}
                                                >
                                                    <option value="m">m</option>
                                                    <option value="mm">mm</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <Label className="text-xs text-slate-500 font-bold uppercase">General Description</Label>
                                    <Input 
                                        placeholder="e.g. Scaffolding pipe" 
                                        value={formData.description}
                                        onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button className="flex-1" variant="outline" onClick={() => setIsAdding(false)} disabled={isSaving}>Cancel</Button>
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50" onClick={handleSaveNewDebris} disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Record"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Selected Item View */}
                    {activeId && !isAdding && (
                        <div className="w-80 bg-white border-l p-6 space-y-6 overflow-y-auto animate-in slide-in-from-right">
                             {selectedReference ? (
                                 // --- HISTORICAL VIEW ---
                                 <div className="space-y-6">
                                     <div className="flex items-center justify-between">
                                         <div>
                                             <div className="flex items-center gap-2 mb-1">
                                                 <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">HISTORICAL</Badge>
                                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref#{selectedReference.label}</span>
                                             </div>
                                             <h3 className="font-black text-slate-800 uppercase tracking-wider">{selectedReference.type}</h3>
                                         </div>
                                     </div>

                                     <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
                                         <div className="space-y-1">
                                             <Label className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">Historical Description</Label>
                                             <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                                 {selectedReference.description || "No description provided in previous survey."}
                                             </p>
                                         </div>

                                         <div className="grid grid-cols-2 gap-4 pt-2">
                                             <div className="space-y-1">
                                                 <Label className="text-[10px] font-bold text-slate-400 uppercase">Material</Label>
                                                 <p className="text-xs font-bold text-slate-600">{selectedReference.material || 'N/A'}</p>
                                             </div>
                                             <div className="space-y-1">
                                                 <Label className="text-[10px] font-bold text-slate-400 uppercase">Dimensions</Label>
                                                 <p className="text-xs font-bold text-slate-600">{selectedReference.size || 'N/A'}</p>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                             <span>Spatial Context</span>
                                             <span className="text-slate-300">Historical Sync</span>
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <div className="bg-white p-2 rounded border border-slate-200 flex flex-col gap-0.5">
                                                 <span className="text-[9px] text-slate-400 uppercase font-black">X-Coord</span>
                                                 <span className="text-xs font-mono font-bold text-slate-600">{selectedReference.x}</span>
                                             </div>
                                             <div className="bg-white p-2 rounded border border-slate-200 flex flex-col gap-0.5">
                                                 <span className="text-[9px] text-slate-400 uppercase font-black">Y-Coord</span>
                                                 <span className="text-xs font-mono font-bold text-slate-600">{selectedReference.y}</span>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="pt-4 border-t border-slate-100">
                                        <p className="text-[10px] text-slate-400 italic leading-normal mb-4">
                                            This is a read-only record from a previous survey. To update this item, you must drop a new flag in the current live grid.
                                        </p>
                                        <Button className="w-full" variant="ghost" onClick={() => setActiveId(null)}>
                                            Deselect
                                        </Button>
                                     </div>
                                </div>
                             ) : activeItem ? (
                                // --- LIVE EDIT VIEW ---
                                <>
                                     <div>
                                        <h3 className="font-black text-slate-800 uppercase tracking-wider mb-1">Marker #{activeItem.label}</h3>
                                        <p className="text-xs text-slate-500 font-medium">Original QID: {activeItem.qid}</p>
                                    </div>
        
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="bg-slate-50 py-2 px-3 rounded text-sm text-slate-600 font-bold border border-slate-100 flex flex-col gap-1">
                                            <div className="flex justify-between items-center text-xs opacity-70">
                                                <span>Face: {activeItem.face}</span>
                                                <div className="flex items-center gap-1">
                                                    <span>Dist (Face): {activeItem.distance}m</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-xs opacity-70 border-t border-slate-200/50 pt-1 mt-1">
                                                <span>Nearest Leg: {activeItem.nearestLeg}</span>
                                                <span>Dist (Leg): {activeItem.distToNearestLeg}m</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs border-t border-slate-200/50 pt-1 mt-1">
                                                <span>X: {activeItem.x}</span>
                                                <span>Y: {activeItem.y}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                             ) : null}

                             {editFormData && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800 leading-normal">
                                        <span className="font-bold uppercase block mb-1 flex items-center gap-1">Relocate Marker (Manual)</span>
                                        Update the distance or face below to move this marker to another page or distance range.
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold">Distance (m)</Label>
                                            <Input 
                                                type="number"
                                                className="h-8 text-xs font-mono"
                                                value={editFormData.distance}
                                                onChange={e => {
                                                    const d = parseFloat(e.target.value);
                                                    setEditFormData((p: any) => ({...p, distance: e.target.value}));
                                                    // Sync page if distance moved out of current range
                                                    if (!isNaN(d)) {
                                                        const p = Math.floor(d / 21);
                                                        if (p !== currentPage && d > 0) setCurrentPage(p);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold">Face</Label>
                                            <Select value={editFormData.face} onValueChange={v => setEditFormData((p: any) => ({...p, face: v}))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="A1-A2">A1-A2</SelectItem>
                                                    <SelectItem value="B1-B2">B1-B2</SelectItem>
                                                    <SelectItem value="A1-B1">A1-B1</SelectItem>
                                                    <SelectItem value="A2-B2">A2-B2</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-bold text-slate-700">Edit Details</h4>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Item Category</Label>
                                        <Select value={editFormData.category} onValueChange={v => setEditFormData((p: any) => ({...p, category: v}))}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Debris">Debris</SelectItem>
                                                <SelectItem value="Gas Seepage">Gas Seepage</SelectItem>
                                                <SelectItem value="Crater">Crater</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Description</Label>
                                        <Input 
                                            className="h-8 text-xs"
                                            value={editFormData.description}
                                            onChange={e => setEditFormData((p: any) => ({...p, description: e.target.value}))}
                                        />
                                    </div>

                                    {editFormData.category === 'Debris' && (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Material</Label>
                                                <Select value={editFormData.material} onValueChange={v => setEditFormData((p: any) => ({...p, material: v}))}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Metallic">Metallic</SelectItem>
                                                        <SelectItem value="Non-Metallic">Non-Metallic</SelectItem>
                                                        <SelectItem value="Unknown">Unknown</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Size / Dimensions</Label>
                                                <Input 
                                                    className="h-8 text-xs"
                                                    value={editFormData.size}
                                                    onChange={e => setEditFormData((p: any) => ({...p, size: e.target.value}))}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {editFormData.category === 'Gas Seepage' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">Seepage Intensity</Label>
                                            <Select value={editFormData.intensity} onValueChange={v => setEditFormData((p: any) => ({...p, intensity: v}))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Light">Light Seepage</SelectItem>
                                                    <SelectItem value="Moderate">Moderate Bubbling</SelectItem>
                                                    <SelectItem value="Heavy">Heavy / High Pressure</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {editFormData.category === 'Crater' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Diameter</Label>
                                                <div className="flex gap-1">
                                                    <Input 
                                                        type="number"
                                                        className="h-8 text-xs flex-1"
                                                        value={editFormData.craterDiameter}
                                                        onChange={e => setEditFormData((p: any) => ({...p, craterDiameter: e.target.value}))}
                                                    />
                                                    <select 
                                                        className="h-8 px-1 text-[10px] font-bold border rounded bg-slate-50 text-slate-600 focus:outline-none"
                                                        value={editFormData.craterDiameterUnit}
                                                        onChange={e => setEditFormData((p: any) => ({...p, craterDiameterUnit: e.target.value}))}
                                                    >
                                                        <option value="m">m</option>
                                                        <option value="mm">mm</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Depth</Label>
                                                <div className="flex gap-1">
                                                    <Input 
                                                        type="number"
                                                        className="h-8 text-xs flex-1"
                                                        value={editFormData.craterDepth}
                                                        onChange={e => setEditFormData((p: any) => ({...p, craterDepth: e.target.value}))}
                                                    />
                                                    <select 
                                                        className="h-8 px-1 text-[10px] font-bold border rounded bg-slate-50 text-slate-600 focus:outline-none"
                                                        value={editFormData.craterDepthUnit}
                                                        onChange={e => setEditFormData((p: any) => ({...p, craterDepthUnit: e.target.value}))}
                                                    >
                                                        <option value="m">m</option>
                                                        <option value="mm">mm</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50" onClick={handleSaveEdit} disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save Edits"}
                                    </Button>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                                {!selectedReference && (
                                    <Button 
                                        className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" 
                                        variant="outline" 
                                        onClick={handleDeleteDebris} 
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Deleting..." : "Delete This Record"}
                                    </Button>
                                )}
                                <Button className="w-full" variant="ghost" onClick={() => setActiveId(null)}>
                                    Deselect
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
        </Card>
    );
}
