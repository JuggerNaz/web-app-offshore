"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { SeabedDebrisPlot } from '@/components/inspection/seabed-debris-plot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

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
}

export function SeabedSurveyGuiInline({
    open, onClose, structureId, jobpackId, sowRecordId, sowReportNo, rovJob, tapeId, tapeCounter
}: SeabedSurveyGuiDialogProps) {
    const supabase = createClient();
    const [existingDebris, setExistingDebris] = useState<any[]>([]);
    const [structureName, setStructureName] = useState<string>('');
    const [isAdding, setIsAdding] = useState(false);
    const [newPoint, setNewPoint] = useState<any>(null);
    const [hoverInfo, setHoverInfo] = useState<any>(null);
    const [activeId, setActiveId] = useState<string | number | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
    const [formData, setFormData] = useState({
        type: '',
        material: 'Non-Metallic',
        size: '',
    });

    const generateQid = (geometry: any) => {
        if (!geometry || !geometry.startLeg || !geometry.endLeg) return '';
        return `S/BED(${geometry.startLeg}-${geometry.endLeg})-${geometry.nearestDistance}M`;
    };

    useEffect(() => {
        if (open && structureId) {
            fetchStructureContext();
            fetchExistingDebris();
        }
    }, [open, structureId, rovJob]);

    const fetchStructureContext = async () => {
        const { data } = await supabase.from('structures').select('name').eq('id', structureId).single();
        if (data) setStructureName(data.name);
    };

    const fetchExistingDebris = async () => {
        if (!rovJob) return;
        const { data, error } = await supabase.from('insp_records')
            .select(`
                insp_id, inspection_data, structure_components:component_id ( q_id )
            `)
            .eq('structure_id', Number(structureId))
            .eq('inspection_type_code', 'RSEAB')
            // Filter by RSEAB maybe? The JSON contains distance_from_leg, x, y
            .not('inspection_data->x', 'is', null)
            .order('insp_id', { ascending: true });

        if (error || !data) return;
        
        const mapped = data.map((r: any, index: number) => ({
            id: r.insp_id,
            x: parseFloat(r.inspection_data.x),
            y: parseFloat(r.inspection_data.y),
            label: (index + 1).toString(),
            qid: r.structure_components?.q_id || r.insp_id,
            isMetallic: r.inspection_data.debris_material?.toLowerCase().includes('metal') || false,
            face: r.inspection_data.face || '',
            distance: r.inspection_data.distance_from_leg || 0
        })).filter(r => !isNaN(r.x) && !isNaN(r.y));
        
        setExistingDebris(mapped);
    };

    const handleAddClick = (x: number, y: number, geometry: any) => {
        setNewPoint({ x, y, geometry });
        setIsAdding(true);
        setFormData({ type: '', material: 'Non-Metallic', size: '' });
    };

    const handleSaveNewDebris = async () => {
        if (!newPoint) return;
        
        const generatedQid = generateQid(newPoint.geometry);

        try {
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
                        description: `Seabed Debris ${newPoint.geometry.startLeg}-${newPoint.geometry.endLeg} ${newPoint.geometry.nearestDistance}M`,
                        f_leg: newPoint.geometry.startLeg,
                        s_leg: newPoint.geometry.endLeg,
                        dist: newPoint.geometry.nearestDistance.toString(),
                        face: newPoint.geometry.face,
                        lvl: 'Seabed'
                    }
                }).select('id').single();
                if (compErr) throw compErr;
                componentId = newComp.id;
            }

            // 2. Add to SOW if sowRecordId exists and not already mapped
            let sowItemId = null;
            let inspTypeId = null;
            const { data: inspType } = await supabase.from('inspection_types').select('id').eq('code', 'RSEAB').single();
            if (inspType) inspTypeId = inspType.id;

            if (sowRecordId && componentId) {
                const { data: existingSow } = await supabase.from('u_sow_items')
                    .select('id').eq('sow_id', sowRecordId).eq('component_id', componentId).maybeSingle();
                
                if (existingSow) {
                    sowItemId = existingSow.id;
                } else {
                    if (inspTypeId) {
                        const { data: newSowInfo, error: sowErr } = await supabase.from('u_sow_items').insert({
                            sow_id: sowRecordId,
                            component_id: componentId,
                            inspection_type_id: inspTypeId,
                            scope_status: 'Completed', 
                            report_number: sowReportNo || rovJob?.raw?.sow_report_no || "Auto-RSEAB"
                        }).select('id').single();
                        if (!sowErr && newSowInfo) sowItemId = newSowInfo.id;
                    }
                }
            }

            // 3. Create Insp Record
            const inspectionData = {
                distance_from_leg: newPoint.geometry.distance.toFixed(1),
                face: newPoint.geometry.face,
                x: newPoint.x.toFixed(2),
                y: newPoint.y.toFixed(2),
                debris_material: formData.material,
                dimension_1: formData.size,
                finding_type: "Anomaly",
            };

            const { data: authData } = await supabase.auth.getUser();
            const now = new Date();
            const { error: recErr } = await supabase.from('insp_records').insert({
                rov_job_id: rovJob.raw?.rov_job_id || rovJob.id,
                structure_id: Number(structureId),
                jobpack_id: Number(jobpackId),
                component_id: componentId,
                component_type: 'SD',
                inspection_type_code: 'RSEAB',
                inspection_type_id: inspTypeId,
                sow_report_no: sowReportNo || rovJob?.raw?.sow_report_no || 'Unknown',
                description: `Seabed Debris: ${formData.type}`,
                inspection_data: inspectionData,
                status: 'COMPLETED',
                tape_id: tapeId ? parseInt(tapeId as string, 10) : null,
                tape_count_no: tapeCounter,
                inspection_date: now.toISOString().split('T')[0],
                inspection_time: now.toTimeString().split(' ')[0],
                has_anomaly: true,
                elevation: 0,
                cr_user: authData?.user?.id || null
            });

            if (recErr) throw recErr;
            
            toast.success(`Registered Debris at ${generatedQid}`);
            setIsAdding(false);
            setNewPoint(null);
            fetchExistingDebris(); // Refresh map

        } catch (err: any) {
            console.error(err);
            toast.error("Failed to register debris: " + err.message);
        }
    };

    const handleMoveDebris = async (id: string | number, x: number, y: number, geometry: any) => {
        try {
            const inspectionData = {
                distance_from_leg: geometry.distance.toFixed(1),
                face: geometry.face,
                x: x.toFixed(2),
                y: y.toFixed(2),
                finding_type: "Anomaly",
            };

            const { error } = await supabase.from('insp_records')
                .update({ 
                    inspection_data: inspectionData,
                    description: `Moved Debris: ${geometry.face} @ ${geometry.distance.toFixed(1)}m` 
                })
                .eq('insp_id', id);

            if (error) throw error;
            fetchExistingDebris();
        } catch (err: any) {
            toast.error("Failed to move debris: " + err.message);
        }
    };

    const handleDeleteDebris = async () => {
        if (!activeId) return;
        if (!confirm("Are you sure you want to delete this debris record?")) return;

        try {
            const { error } = await supabase.from('insp_records')
                .delete()
                .eq('insp_id', activeId);

            if (error) throw error;
            toast.success("Debris record deleted");
            setActiveId(null);
            fetchExistingDebris();
        } catch (err: any) {
            toast.error("Failed to delete debris: " + err.message);
        }
    };

    const activeItem = existingDebris.find(d => d.id === activeId);

    if (!open) return null;

    return (
        <Card className="h-full w-full flex flex-col p-0 overflow-hidden shadow-lg border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 animate-in slide-in-from-right-8 duration-300">
            <div className="px-6 py-4 border-b bg-white dark:bg-slate-950 flex items-center justify-between">
                <h2 className="text-xl font-bold">Seabed Survey Multi-Drop GUI</h2>
                <Button variant="outline" size="sm" onClick={onClose}>Close Planner</Button>
            </div>
            <div className="flex-1 flex overflow-hidden">
                {/* Plotter Area */}
                <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center relative shadow-inner"
                     onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                     onMouseLeave={() => { setMousePos(null); setHoverInfo(null); }}
                >
                    <div className="w-full h-full max-w-2xl max-h-full flex items-center justify-center">
                            <SeabedDebrisPlot
                                layoutType={structureName.includes('8') ? 'rectangular' : 'rectangular'}
                                legCount={structureName.includes('8') ? 8 : 4}
                                debrisItems={existingDebris}
                                onAddDebris={handleAddClick}
                                onDebrisMove={handleMoveDebris}
                                onSelectDebris={(id) => { setActiveId(id); setIsAdding(false); }}
                                activeDebrisId={activeId}
                                readOnly={false}
                            />
                            {!isAdding && !activeId && (
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm font-bold text-slate-700 text-sm border-l-4 border-blue-500">
                                    Click anywhere on the grid to drop a new debris marker.
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
                                        <span>Dist: {newPoint.geometry.distance.toFixed(1)}m</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-blue-200/50 pt-1 mt-1">
                                        <span className="text-xs uppercase tracking-widest font-black opacity-70">Target QID</span>
                                        <span className="font-mono">{generateQid(newPoint.geometry)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Debris Type / Description</Label>
                                    <Input 
                                        placeholder="e.g. Scaffolding pipe" 
                                        value={formData.type}
                                        onChange={e => setFormData(p => ({...p, type: e.target.value}))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Material</Label>
                                    <Select value={formData.material} onValueChange={v => setFormData(p => ({...p, material: v}))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Metallic">Metallic</SelectItem>
                                            <SelectItem value="Non-Metallic">Non-Metallic</SelectItem>
                                            <SelectItem value="Unknown">Unknown</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Size / Dimensions</Label>
                                    <Input 
                                        placeholder="e.g. 2m x 0.5m" 
                                        value={formData.size}
                                        onChange={e => setFormData(p => ({...p, size: e.target.value}))}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button className="flex-1" variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveNewDebris}>Save Record</Button>
                            </div>
                        </div>
                    )}

                    {/* Selected Item View */}
                    {activeId && activeItem && !isAdding && (
                        <div className="w-80 bg-white border-l p-6 space-y-6 overflow-y-auto animate-in slide-in-from-right">
                             <div>
                                <h3 className="font-black text-slate-800 uppercase tracking-wider mb-1">Marker #{activeItem.label}</h3>
                                <p className="text-xs text-slate-500 font-medium">Original QID: {activeItem.qid}</p>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div className="bg-slate-50 py-2 px-3 rounded text-sm text-slate-600 font-bold border border-slate-100 flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-xs opacity-70">
                                        <span>Face: {activeItem.face}</span>
                                        <span>Dist: {activeItem.distance}m</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs border-t border-slate-200/50 pt-1 mt-1">
                                        <span>X: {activeItem.x}</span>
                                        <span>Y: {activeItem.y}</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800 leading-normal">
                                    <span className="font-bold uppercase block mb-1">Draggable Marker</span>
                                    You can drag this # {activeItem.label} marker directly on the map to update its coordinates in the registry.
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-4">
                                <Button className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" variant="outline" onClick={handleDeleteDebris}>
                                    Delete This Record
                                </Button>
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
