"use client";

import React, { useState, useEffect } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PlusCircle, Box, MapPin, Waves, Navigation, Ruler } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { getUnitOptions, getDefaultUnit } from "@/utils/unit-helpers";

interface RegisterComponentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supabase: any;
    structureId: number | string;
    onSuccess: (newComp: any) => void;
    structureType: "platform" | "pipeline";
    unitSystem: "METRIC" | "IMPERIAL";
}

export function RegisterComponentDialog({
    open,
    onOpenChange,
    supabase,
    structureId,
    onSuccess,
    structureType,
    unitSystem
}: RegisterComponentDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        q_id: "",
        id_no: "",
        description: "",
        code: "",
        type: "",
        elv_1: "",
        elv_2: "",
        f_node: "",
        s_node: "",
        f_leg: "",
        s_leg: "",
        dist: "",
        dist_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "dist") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
        clk_pos: "",
        lvl: "",
        face: "",
        kp: "",
        x_cord: "",
        y_cord: "",
        top_und: "SUBSEA",
        comp_group: "",
        id_chk: 0,
        fp: null,
        del: 0,
        elv_1_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "elv_1") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
        elv_2_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "elv_2") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
        comp_id: null as number | null
    });

    // Sync units with global preference when it changes or dialog opens
    useEffect(() => {
        if (!open) return;
        const isImp = unitSystem === "IMPERIAL";
        setFormData(prev => ({
            ...prev,
            elv_1_unit: getDefaultUnit("LENGTH", isImp, "elv_1") || (isImp ? "ft" : "m"),
            elv_2_unit: getDefaultUnit("LENGTH", isImp, "elv_2") || (isImp ? "ft" : "m"),
            dist_unit: getDefaultUnit("LENGTH", isImp, "dist") || (isImp ? "ft" : "m")
        }));
    }, [unitSystem, open]);

    // Auto-generate ID_no
    useEffect(() => {
        if (formData.code && formData.q_id) {
            setFormData(prev => ({ ...prev, id_no: `${prev.code}/${prev.q_id}` }));
        } else {
            setFormData(prev => ({ ...prev, id_no: "" }));
        }
    }, [formData.code, formData.q_id]);

    // --- Component Types Library ---
    const { data: componentsLib } = useSWR(`/api/components`, fetcher);
    
    const filteredCompTypes = componentsLib?.data
        ? componentsLib.data.filter((c: any) => {
            const isPlatformMatch = structureType === "platform" && c.plat === 1;
            const isPipelineMatch = structureType === "pipeline" && c.pipe === 1;
            return c.is_active && (isPlatformMatch || isPipelineMatch);
        })
        : [];

    // --- Library Fetching (Mirroring ComponentSpecDialog) ---
    const { data: positionLib } = useSWR(`/api/library/POSITION`, fetcher);
    const { data: platformData } = useSWR(
        structureType === "platform" && structureId ? `/api/platform/${structureId}` : null,
        fetcher
    );
    const { data: levelData } = useSWR(
        structureType === "platform" && structureId ? `/api/platform/level/${structureId}` : null,
        fetcher
    );
    const { data: faceData } = useSWR(
        structureType === "platform" && structureId ? `/api/platform/faces/${structureId}` : null,
        fetcher
    );

    const legOptions = platformData?.data
        ? Array.from({ length: 20 }, (_, i) => {
            const key = `leg_t${i + 1}`;
            const val = platformData.data[key];
            return val ? { value: val, label: val } : null;
        }).filter(Boolean)
        : [];

    const levelOptions = levelData?.data?.map((x: any) => ({ value: x.level_name, label: x.level_name })) || [];
    const faceOptions = faceData?.data?.map((x: any) => ({ value: x.face, label: x.face })) || [];
    const clockOptions = positionLib?.data?.map((x: any) => ({ 
        value: x.lib_name || x.lib_desc, 
        label: x.lib_desc || x.lib_name 
    })) || [];

    // Structural group options (COMPGRP library)
    const { data: compGroupLib } = useSWR(`/api/library/COMPGRP`, fetcher);
    const groupOptions = compGroupLib?.data ? compGroupLib.data.map((item: any) => ({
        value: item.lib_id,
        label: item.lib_desc
    })) : [];

    const handleTypeChange = (val: string) => {
        const selected = filteredCompTypes.find((c: any) => c.code === val);
        setFormData(prev => ({
            ...prev,
            type: selected ? selected.descrip : val,
            code: val,
            comp_id: selected ? selected.id : null
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.q_id) {
            toast.error("Component Name (QID) is required");
            return;
        }
        if (!formData.comp_id) {
            toast.error("Please select a valid Component Category");
            return;
        }

        setIsSubmitting(true);
        try {
            // Check for duplicate QID under the same structure
            const { data: existingQid, error: checkError } = await supabase
                .from('structure_components')
                .select('q_id')
                .eq('structure_id', Number(structureId))
                .eq('q_id', formData.q_id)
                .is('is_deleted', false)
                .maybeSingle();

            if (existingQid) {
                toast.error(`A component with QID "${formData.q_id}" already exists in this structure.`);
                setIsSubmitting(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            
            const payload = {
                q_id: formData.q_id,
                id_no: formData.id_no,
                comp_id: formData.comp_id, // Mandatory field from table structure
                code: formData.code,
                structure_id: Number(structureId),
                metadata: {
                    fp: formData.fp,
                    del: formData.del,
                    lvl: formData.lvl,
                    code: formData.code,
                    dist: formData.dist ? parseFloat(formData.dist) : null,
                    face: formData.face,
                    elv_1: formData.elv_1 ? parseFloat(formData.elv_1) : null,
                    elv_2: formData.elv_2 ? parseFloat(formData.elv_2) : null,
                    f_leg: formData.f_leg,
                    s_leg: formData.s_leg,
                    f_node: formData.f_node,
                    id_chk: formData.id_chk,
                    s_node: formData.s_node,
                    x_cord: formData.x_cord,
                    y_cord: formData.y_cord,
                    clk_pos: formData.clk_pos,
                    top_und: formData.top_und,
                    comp_group: formData.comp_group,
                    description: formData.description,
                    kp: formData.kp,
                    type: formData.type,
                    elv_1_unit: formData.elv_1_unit,
                    elv_2_unit: formData.elv_2_unit,
                    dist_unit: formData.dist_unit
                },
                created_by: user?.id || null,
                modified_by: user?.id || null
            };

            const { data, error } = await supabase
                .from('structure_components')
                .insert(payload)
                .select('*')
                .single();

            if (error) throw error;

            toast.success(`Component "${formData.q_id}" registered successfully`);
            if (data) {
                const mappedComp = {
                    id: data.id,
                    name: data.q_id || data.name || `Node ${data.id}`,
                    raw: data,
                    tasks: [],
                    taskStatuses: []
                };
                onSuccess(mappedComp);
            }
            onOpenChange(false);
            // Reset form
            setFormData({
                q_id: "",
                id_no: "",
                description: "",
                code: "",
                type: "",
                elv_1: "",
                elv_2: "",
                f_node: "",
                s_node: "",
                f_leg: "",
                s_leg: "",
                dist: "",
                clk_pos: "",
                lvl: "",
                face: "",
                kp: "",
                x_cord: "",
                y_cord: "",
                top_und: "SUBSEA",
                comp_group: "",
                id_chk: 0,
                fp: null,
                del: 0,
                elv_1_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "elv_1") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
                elv_2_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "elv_2") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
                dist_unit: getDefaultUnit("LENGTH", unitSystem === "IMPERIAL", "dist") || (unitSystem === "IMPERIAL" ? "ft" : "m"),
                comp_id: null
            });
        } catch (error: any) {
            console.error("Error registering component:", error);
            toast.error("Failed to register component: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                            <PlusCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">
                                Register Component
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Add new structural element to inspection scope
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-1">
                    {/* Category Selection First */}
                    <div className="grid grid-cols-1 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                        <div className="space-y-1">
                            <Label htmlFor="type" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Category / Type <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.code} onValueChange={handleTypeChange}>
                                <SelectTrigger className="h-10 text-sm font-bold bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 text-slate-800 dark:text-slate-200 focus:ring-blue-500/20">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                    {filteredCompTypes.map((c: any) => (
                                        <SelectItem key={c.code} value={c.code} className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300">
                                            {c.descrip || c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <div className="flex justify-between items-end mb-1">
                                <Label htmlFor="q_id" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                    QID <span className="text-red-500">*</span>
                                </Label>
                                {formData.id_no && (
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase italic">
                                        ID: {formData.id_no}
                                    </span>
                                )}
                            </div>
                            <Input
                                id="q_id"
                                value={formData.q_id}
                                onChange={(e) => setFormData({ ...formData, q_id: e.target.value.toUpperCase() })}
                                placeholder="QID"
                                className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                required
                            />
                        </div>
                                <div className="space-y-1">
                            <Label htmlFor="description" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Description..."
                                className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                            />
                        </div>
                                <div className="space-y-1">
                            <Label htmlFor="code" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Code
                            </Label>
                            <Input
                                id="code"
                                value={formData.code}
                                readOnly
                                placeholder="AN"
                                className="h-9 text-xs font-bold bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Technical Specs */}
                    {structureType === "platform" ? (
                        <>
                             <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="f_node" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        Start Node
                                    </Label>
                                    <Input
                                        id="f_node"
                                        value={formData.f_node}
                                        onChange={(e) => setFormData({ ...formData, f_node: e.target.value.toUpperCase() })}
                                        placeholder="Node 1"
                                        className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor="f_leg" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        Start Leg
                                    </Label>
                                     {legOptions.length > 0 ? (
                                        <Select value={formData.f_leg} onValueChange={(v) => setFormData({...formData, f_leg: v})}>
                                            <SelectTrigger className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                                <SelectValue placeholder="Select Leg" />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                                {legOptions.map((opt: any) => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="f_leg"
                                            value={formData.f_leg}
                                            onChange={(e) => setFormData({ ...formData, f_leg: e.target.value.toUpperCase() })}
                                            placeholder="Leg 1"
                                            className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                        />
                                    )}
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor="elv_1" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        Elevation 1
                                    </Label>
                                    <div className="flex gap-1">
                                        <Input
                                            id="elv_1"
                                            value={formData.elv_1}
                                             onChange={(e) => setFormData({ ...formData, elv_1: e.target.value })}
                                            placeholder="0.00"
                                            className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200 flex-1"
                                        />
                                        <Select value={formData.elv_1_unit} onValueChange={(v) => setFormData({...formData, elv_1_unit: v})}>
                                            <SelectTrigger className="h-9 w-[60px] text-[10px] font-black bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 dark:text-slate-500 lowercase">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                                {getUnitOptions("LENGTH", unitSystem === "IMPERIAL").map((u) => (
                                                    <SelectItem key={u} value={u} className="lowercase dark:text-slate-300">{u}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="s_node" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        End Node
                                    </Label>
                                    <Input
                                        id="s_node"
                                        value={formData.s_node}
                                        onChange={(e) => setFormData({ ...formData, s_node: e.target.value.toUpperCase() })}
                                        placeholder="Node 2"
                                        className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s_leg" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        End Leg
                                    </Label>
                                    {legOptions.length > 0 ? (
                                        <Select value={formData.s_leg} onValueChange={(v) => setFormData({...formData, s_leg: v})}>
                                            <SelectTrigger className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                                <SelectValue placeholder="Select Leg" />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                                {legOptions.map((opt: any) => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="s_leg"
                                            value={formData.s_leg}
                                            onChange={(e) => setFormData({ ...formData, s_leg: e.target.value.toUpperCase() })}
                                            placeholder="Leg 2"
                                            className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                        />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="elv_2" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                        Elevation 2
                                    </Label>
                                    <div className="flex gap-1">
                                        <Input
                                            id="elv_2"
                                            value={formData.elv_2}
                                            onChange={(e) => setFormData({ ...formData, elv_2: e.target.value })}
                                            placeholder="0.00"
                                            className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200 flex-1"
                                        />
                                        <Select value={formData.elv_2_unit} onValueChange={(v) => setFormData({...formData, elv_2_unit: v})}>
                                            <SelectTrigger className="h-9 w-[60px] text-[10px] font-black bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 dark:text-slate-500 lowercase">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                                {getUnitOptions("LENGTH", unitSystem === "IMPERIAL").map((u) => (
                                                    <SelectItem key={u} value={u} className="lowercase dark:text-slate-300">{u}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="kp" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                    KP
                                </Label>
                                <div className="relative">
                                    <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                                    <Input
                                        id="kp"
                                        value={formData.kp}
                                        onChange={(e) => setFormData({ ...formData, kp: e.target.value })}
                                        placeholder="0.000"
                                        className="pl-8 h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="x_cord" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                    Easting
                                </Label>
                                <div className="relative">
                                    <Navigation className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                                    <Input
                                        id="x_cord"
                                        value={formData.x_cord}
                                        onChange={(e) => setFormData({ ...formData, x_cord: e.target.value })}
                                        placeholder="0.0"
                                        className="pl-8 h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="y_cord" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                    Northing
                                </Label>
                                <div className="relative">
                                    <Navigation className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-600 rotate-90" />
                                    <Input
                                        id="y_cord"
                                        value={formData.y_cord}
                                        onChange={(e) => setFormData({ ...formData, y_cord: e.target.value })}
                                        placeholder="0.0"
                                        className="pl-8 h-9 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Common Fields: Orientation */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="clk_pos" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Clock Position
                            </Label>
                            {clockOptions.length > 0 ? (
                                <Select value={formData.clk_pos} onValueChange={(v) => setFormData({...formData, clk_pos: v})}>
                                    <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                        <SelectValue placeholder="12:00" />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                        {clockOptions.map((opt: any) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[11px] font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="clk_pos"
                                    value={formData.clk_pos}
                                    onChange={(e) => setFormData({ ...formData, clk_pos: e.target.value })}
                                    placeholder="12:00"
                                    className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="lvl" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Level
                            </Label>
                            {levelOptions.length > 0 ? (
                                <Select value={formData.lvl} onValueChange={(v) => setFormData({...formData, lvl: v})}>
                                    <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                        <SelectValue placeholder="Select Level" />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                        {levelOptions.map((opt: any) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[11px] font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="lvl"
                                    value={formData.lvl}
                                    onChange={(e) => setFormData({ ...formData, lvl: e.target.value })}
                                    placeholder="Level"
                                    className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="face" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Face
                            </Label>
                            {faceOptions.length > 0 ? (
                                <Select value={formData.face} onValueChange={(v) => setFormData({...formData, face: v})}>
                                    <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                        <SelectValue placeholder="Select Face" />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                        {faceOptions.map((opt: any) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[11px] font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="face"
                                    value={formData.face}
                                    onChange={(e) => setFormData({ ...formData, face: e.target.value })}
                                    placeholder="Face"
                                    className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="dist" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Distance
                            </Label>
                            <div className="flex gap-1">
                                <Input
                                    id="dist"
                                    value={formData.dist}
                                    onChange={(e) => setFormData({ ...formData, dist: e.target.value })}
                                    placeholder="0.00"
                                    className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200 flex-1"
                                />
                                <Select value={formData.dist_unit} onValueChange={(v) => setFormData({...formData, dist_unit: v})}>
                                    <SelectTrigger className="h-9 w-[60px] text-[10px] font-black bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 dark:text-slate-500 lowercase">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                        {getUnitOptions("LENGTH", unitSystem === "IMPERIAL").map((u) => (
                                            <SelectItem key={u} value={u} className="lowercase dark:text-slate-300">{u}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                     <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="top_und" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Top / Und
                            </Label>
                            <Select value={formData.top_und} onValueChange={(v) => setFormData({...formData, top_und: v})}>
                                <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                    <SelectValue placeholder="SUBSEA" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                    <SelectItem value="SUBSEA" className="text-[11px] font-bold dark:text-slate-300">SUBSEA</SelectItem>
                                    <SelectItem value="ABOVE WATER" className="text-[11px] font-bold dark:text-slate-300">ABOVE WATER</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label htmlFor="comp_group" className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 tracking-widest ml-1">
                                Structural Group
                            </Label>
                            {groupOptions.length > 0 ? (
                                <Select value={formData.comp_group} onValueChange={(v) => setFormData({...formData, comp_group: v})}>
                                    <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                                        <SelectValue placeholder="Select Group" />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                                        {groupOptions.map((opt: any) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[11px] font-bold uppercase dark:text-slate-300">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="comp_group"
                                    value={formData.comp_group}
                                    onChange={(e) => setFormData({ ...formData, comp_group: e.target.value.toUpperCase() })}
                                    placeholder="Group"
                                    className="h-9 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200"
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Register Component"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
