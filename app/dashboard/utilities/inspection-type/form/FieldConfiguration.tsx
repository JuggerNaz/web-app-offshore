"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, LayoutList, GripVertical, Settings2, Component, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface FieldDef {
    name: string;
    label: string;
    type: string;
}

export interface ComponentOverride {
    component_types: string[];
    fields: FieldDef[];
}

export interface DefaultProperties {
    fields: FieldDef[];
    component_overrides: ComponentOverride[];
}

interface FieldConfigurationProps {
    properties: DefaultProperties;
    onChange: (props: DefaultProperties) => void;
}

export function FieldConfiguration({ properties, onChange }: FieldConfigurationProps) {
    const [activeTab, setActiveTab] = useState<'global' | 'overrides'>('global');
    
    // Field Editor State
    const [isEditingField, setIsEditingField] = useState(false);
    const [editingFieldContext, setEditingFieldContext] = useState<{ type: 'global', index: number } | { type: 'override', overrideIndex: number, fieldIndex: number } | null>(null);
    const [fieldForm, setFieldForm] = useState<FieldDef>({ name: "", label: "", type: "text" });

    // Override Editor State
    const [isEditingOverride, setIsEditingOverride] = useState(false);
    const [editingOverrideIndex, setEditingOverrideIndex] = useState<number | null>(null);
    const [overrideFormTypes, setOverrideFormTypes] = useState<string>("");

    // Component Types Search
    const { data: compData } = useSWR('/api/components', fetcher);
    const componentTypesResponse = compData?.data || [];
    const [compSearch, setCompSearch] = useState("");
    const [compDropdownOpen, setCompDropdownOpen] = useState(false);

    const toggleType = (code: string) => {
        const types = overrideFormTypes.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
        if (types.includes(code)) {
            setOverrideFormTypes(types.filter(t => t !== code).join(', '));
        } else {
            setOverrideFormTypes([...types, code].join(', '));
        }
    };

    const handleSaveField = () => {
        if (!fieldForm.name || !fieldForm.label) {
            toast.error("Field name and label are required");
            return;
        }

        const newProps = { ...properties };
        
        // Ensure arrays exist
        if (!newProps.fields) newProps.fields = [];
        if (!newProps.component_overrides) newProps.component_overrides = [];

        if (editingFieldContext?.type === 'global') {
            if (editingFieldContext.index >= 0) {
                newProps.fields[editingFieldContext.index] = fieldForm;
            } else {
                newProps.fields.push(fieldForm);
            }
        } else if (editingFieldContext?.type === 'override') {
            const override = newProps.component_overrides[editingFieldContext.overrideIndex];
            if (!override.fields) override.fields = [];
            
            if (editingFieldContext.fieldIndex >= 0) {
                override.fields[editingFieldContext.fieldIndex] = fieldForm;
            } else {
                override.fields.push(fieldForm);
            }
        }

        onChange(newProps);
        setIsEditingField(false);
    };

    const handleSaveOverride = () => {
        if (!overrideFormTypes.trim()) {
            toast.error("Please enter at least one component type");
            return;
        }

        const types = overrideFormTypes.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
        const newProps = { ...properties };
        if (!newProps.component_overrides) newProps.component_overrides = [];

        if (editingOverrideIndex !== null && editingOverrideIndex >= 0) {
            newProps.component_overrides[editingOverrideIndex].component_types = types;
        } else {
            newProps.component_overrides.push({ component_types: types, fields: [] });
        }

        onChange(newProps);
        setIsEditingOverride(false);
    };

    const deleteField = (type: 'global', index: number) => {
        const newProps = { ...properties };
        newProps.fields.splice(index, 1);
        onChange(newProps);
    };

    const deleteOverrideField = (overrideIndex: number, fieldIndex: number) => {
        const newProps = { ...properties };
        newProps.component_overrides[overrideIndex].fields.splice(fieldIndex, 1);
        onChange(newProps);
    };

    const deleteOverride = (index: number) => {
        const newProps = { ...properties };
        newProps.component_overrides.splice(index, 1);
        onChange(newProps);
    };

    const renderFieldList = (fields: FieldDef[], onDelete: (idx: number) => void, onEdit: (idx: number) => void) => (
        <div className="space-y-2 mt-4">
            {(!fields || fields.length === 0) ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <p className="text-sm font-medium text-slate-500">No fields configured</p>
                </div>
            ) : fields.map((field, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center gap-4">
                        <GripVertical className="h-4 w-4 text-slate-300 cursor-move" />
                        <div>
                            <div className="text-sm font-bold text-slate-900">{field.label}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">{field.name}</Badge>
                                <span className="text-[10px] font-medium text-slate-500 uppercase">{field.type}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={() => onEdit(idx)}>
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => onDelete(idx)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden mt-8">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center">
                        <LayoutList className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Dynamic Field Configuration</CardTitle>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global & Component Overrides</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="flex border-b border-slate-100">
                    <button 
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'global' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        onClick={() => setActiveTab('global')}
                    >
                        Global Default Fields
                    </button>
                    <button 
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'overrides' ? 'bg-white text-orange-600 border-b-2 border-orange-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        onClick={() => setActiveTab('overrides')}
                    >
                        Component Overrides
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'global' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500">These fields appear on the inspection form when no component override matches.</p>
                                <Button 
                                    size="sm" 
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold gap-2"
                                    onClick={() => {
                                        setFieldForm({ name: "", label: "", type: "text" });
                                        setEditingFieldContext({ type: 'global', index: -1 });
                                        setIsEditingField(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4" /> Add Global Field
                                </Button>
                            </div>
                            {renderFieldList(
                                properties.fields || [], 
                                (idx) => deleteField('global', idx),
                                (idx) => {
                                    setFieldForm({ ...properties.fields[idx] });
                                    setEditingFieldContext({ type: 'global', index: idx });
                                    setIsEditingField(true);
                                }
                            )}
                        </div>
                    )}

                    {activeTab === 'overrides' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500">Define specific field lists for particular component types (e.g. ANODE, RISER, WELD).</p>
                                <Button 
                                    size="sm" 
                                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold gap-2"
                                    onClick={() => {
                                        setOverrideFormTypes("");
                                        setEditingOverrideIndex(-1);
                                        setIsEditingOverride(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4" /> Add Component Override
                                </Button>
                            </div>

                            {(!properties.component_overrides || properties.component_overrides.length === 0) ? (
                                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                    <Component className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-slate-500">No component overrides defined</p>
                                </div>
                            ) : properties.component_overrides.map((override, oIdx) => (
                                <div key={oIdx} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    <div className="bg-slate-50/80 p-4 border-b border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Settings2 className="h-5 w-5 text-orange-500" />
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Component Types</div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {override.component_types.map(t => (
                                                        <Badge key={t} className="bg-orange-100 text-orange-800 hover:bg-orange-200 font-black">{t}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setOverrideFormTypes(override.component_types.join(", "));
                                                setEditingOverrideIndex(oIdx);
                                                setIsEditingOverride(true);
                                            }}>Edit Types</Button>
                                            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteOverride(oIdx)}>Remove</Button>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-slate-600 font-bold text-xs hover:bg-slate-50 gap-1"
                                                onClick={() => {
                                                    const newProps = { ...properties };
                                                    const globalFields = newProps.fields ? JSON.parse(JSON.stringify(newProps.fields)) : [];
                                                    if (!newProps.component_overrides[oIdx].fields) newProps.component_overrides[oIdx].fields = [];
                                                    
                                                    let addedCount = 0;
                                                    globalFields.forEach((gf: FieldDef) => {
                                                        if (!newProps.component_overrides[oIdx].fields.some(existing => existing.name === gf.name)) {
                                                            newProps.component_overrides[oIdx].fields.push(gf);
                                                            addedCount++;
                                                        }
                                                    });
                                                    
                                                    onChange(newProps);
                                                    if (addedCount > 0) toast.success(`Imported ${addedCount} missing global field(s)`);
                                                    else toast.info("No new global fields to import");
                                                }}
                                                title="Import fields from the Global Defaults list into this component"
                                            >
                                                <LayoutList className="h-3 w-3" /> Copy Global Fields
                                            </Button>

                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-indigo-600 font-bold text-xs hover:bg-indigo-50"
                                                onClick={() => {
                                                    setFieldForm({ name: "", label: "", type: "text" });
                                                    setEditingFieldContext({ type: 'override', overrideIndex: oIdx, fieldIndex: -1 });
                                                    setIsEditingField(true);
                                                }}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add Field to Override
                                            </Button>
                                        </div>
                                        {renderFieldList(
                                            override.fields || [],
                                            (fIdx) => deleteOverrideField(oIdx, fIdx),
                                            (fIdx) => {
                                                setFieldForm({ ...override.fields[fIdx] });
                                                setEditingFieldContext({ type: 'override', overrideIndex: oIdx, fieldIndex: fIdx });
                                                setIsEditingField(true);
                                            }
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Field Editor Dialog */}
            <Dialog open={isEditingField} onOpenChange={setIsEditingField}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{(editingFieldContext?.type === 'global' ? editingFieldContext.index : (editingFieldContext as any)?.fieldIndex) >= 0 ? 'Edit Field' : 'Add Field'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Label (Human Readable)</Label>
                            <Input 
                                placeholder="e.g. Node Weld Condition" 
                                value={fieldForm.label} 
                                onChange={e => {
                                    const label = e.target.value;
                                    // Auto-generate name from label if name is empty or was autogenerated
                                    const oldAuto = fieldForm.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                    const updateName = !fieldForm.name || fieldForm.name === oldAuto;
                                    
                                    setFieldForm(prev => ({
                                        ...prev,
                                        label,
                                        name: updateName ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : prev.name
                                    }));
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Database Key (snake_case)</Label>
                            <Input 
                                placeholder="e.g. node_weld_condition" 
                                value={fieldForm.name} 
                                onChange={e => setFieldForm(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Input Type</Label>
                            <Select value={fieldForm.type} onValueChange={v => setFieldForm(prev => ({...prev, type: v}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Text / String</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="select">Dropdown (Select)</SelectItem>
                                    <SelectItem value="boolean">Checkbox (Yes/No)</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveField}>Save Field</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Override Editor Dialog */}
            <Dialog open={isEditingOverride} onOpenChange={setIsEditingOverride}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingOverrideIndex !== null && editingOverrideIndex >= 0 ? 'Edit Component Mapping' : 'New Component Override'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <Label>Component Types</Label>
                            <Popover open={compDropdownOpen} onOpenChange={setCompDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <div className="min-h-12 w-full border border-slate-200 rounded-md p-2 text-sm flex flex-wrap gap-1.5 cursor-pointer bg-slate-50 hover:border-orange-300 transition-colors items-center focus:ring-2 focus:ring-orange-500/20">
                                        {overrideFormTypes.trim() === '' ? <span className="text-slate-400 font-medium px-2 italic text-xs">Select component types...</span> : 
                                            overrideFormTypes.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                                                <Badge key={t} variant="secondary" className="font-mono text-[10px] pl-2 pr-1 h-6 bg-white border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-sm">
                                                    {t}
                                                    <div 
                                                        className="hover:bg-red-100 hover:text-red-500 rounded-full cursor-pointer p-0.5 transition-colors text-slate-400"
                                                        onClick={(e) => { e.stopPropagation(); toggleType(t); }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </div>
                                                </Badge>
                                            ))
                                        }
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0 border-slate-200 shadow-xl" align="start">
                                    <div className="flex items-center border-b border-slate-100 px-3 bg-slate-50/50">
                                        <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                                        <input 
                                            autoFocus
                                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 font-medium" 
                                            placeholder="Search component type name or code..."
                                            value={compSearch}
                                            onChange={e => setCompSearch(e.target.value)}
                                        />
                                    </div>
                                    <ScrollArea className="h-64">
                                        <div className="p-1.5 space-y-0.5">
                                            {componentTypesResponse
                                                .filter((c: any) => 
                                                    !compSearch || 
                                                    (c.name || '').toLowerCase().includes(compSearch.toLowerCase()) || 
                                                    (c.code || '').toLowerCase().includes(compSearch.toLowerCase())
                                                )
                                                .map((c: any) => {
                                                    const isSelected = overrideFormTypes.split(',').map(t => t.trim().toUpperCase()).includes(c.code);
                                                    return (
                                                        <div 
                                                            key={c.code}
                                                            className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'hover:bg-slate-50'}`}
                                                            onClick={(e) => { e.preventDefault(); toggleType(c.code); }}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className={`text-xs ${isSelected ? 'font-bold text-orange-900' : 'font-medium text-slate-700'}`}>{c.name}</span>
                                                                <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-orange-600' : 'text-slate-400'}`}>{c.code}</span>
                                                            </div>
                                                            {isSelected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                                                        </div>
                                                    );
                                                })
                                            }
                                            {componentTypesResponse.filter((c: any) => 
                                                !compSearch || 
                                                (c.name || '').toLowerCase().includes(compSearch.toLowerCase()) || 
                                                (c.code || '').toLowerCase().includes(compSearch.toLowerCase())
                                            ).length === 0 && (
                                                <div className="p-8 text-center text-xs text-slate-500 italic">No component types found matching your search.</div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Search and select the specific component types from the dictionary that should receive this dedicated field list instead of the global defaults.</p>
                        </div>
                        <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700" onClick={handleSaveOverride}>Save Mapping</Button>
                    </div>
                </DialogContent>
            </Dialog>

        </Card>
    );
}
