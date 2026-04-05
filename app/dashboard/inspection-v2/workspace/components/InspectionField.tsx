"use client";

import React, { useState } from "react";
import { 
    ChevronDown, 
    Plus, 
    Search, 
    Trash2, 
    X 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
    MARINE_GROWTH_LIST, 
    COATING_CONDITION_LIST, 
    COMPONENT_CONDITION_LIST, 
    ANODE_TYPE_LIST, 
    ANODE_DEPLETION_LIST,
    ANODE_DEPLETION_GROUPS 
} from "../constants";

interface InspectionFieldProps {
    p: any;
    type: 'primary' | 'secondary';
    handler: (name: string, value: any) => void;
    currentValue: any;
    libOptionsMap: Record<string, any[]>;
    openPopovers: Record<string, boolean>;
    setOpenPopovers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    selectedComp: any;
    setDebouncedProps: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const InspectionField = ({ 
    p, 
    type, 
    handler, 
    currentValue, 
    libOptionsMap, 
    openPopovers, 
    setOpenPopovers, 
    selectedComp, 
    setDebouncedProps 
}: InspectionFieldProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const fieldName = String(p.label || p.name || '').toLowerCase();
    
    const isLocation = fieldName === 'location' || fieldName === 'loc';
    const isPosition = fieldName === 'position' || fieldName === 'pos';
    const isMarineGrowth = fieldName.includes('marine growth') || fieldName.includes('marinegrowth') || fieldName === 'mgi' || fieldName.includes('marine_growth');
    const isCoating = fieldName.includes('coating condition') || fieldName.includes('coatingcondition') || fieldName.includes('coating_condition');
    const isCompCondition = fieldName.includes('component condition') || fieldName.includes('componentcondition') || fieldName.includes('component_condition');

    const isAnodeType = fieldName === 'anode type' || fieldName === 'anode_type';
    const isAnodeDep = fieldName === 'anode depletion' || fieldName === 'anode_depletion';

    const isComboEligible = isLocation || isPosition || isMarineGrowth || isCoating || isCompCondition || isAnodeType || isAnodeDep || p.type === 'select' || p.type === 'combo' || !!p.lib_code;
    const borderClass = type === 'secondary' ? 'border-amber-300' : 'border-slate-300';
    const ringClass = type === 'secondary' ? 'focus-visible:ring-amber-500' : 'focus-visible:ring-slate-500';

    if (isComboEligible) {
        let options = [...(p.options || [])];
        
        if (p.lib_code) {
            const libOpts = libOptionsMap[p.lib_code];
            if (libOpts && Array.isArray(libOpts)) {
                const libDescriptions = libOpts.map((o: any) => o.lib_desc);
                options = Array.from(new Set([...options, ...libDescriptions]));
            }
        }

        if (isLocation && selectedComp) {
            const locOptions = [
                selectedComp.startNode !== '-' ? `At Node : ${selectedComp.startNode}` : null,
                selectedComp.endNode !== '-' ? `At Node : ${selectedComp.endNode}` : null
            ].filter(Boolean) as string[];
            options = Array.from(new Set([...options, ...locOptions]));
        } else if (isPosition && options.length === 0) {
            options = [
                "AT 12 O'CLK", "AT 01 O'CLK", "AT 02 O'CLK", "AT 03 O'CLK", "AT 04 O'CLK", "AT 05 O'CLK",
                "AT 06 O'CLK", "AT 07 O'CLK", "AT 08 O'CLK", "AT 09 O'CLK", "AT 10 O'CLK", "AT 11 O'CLK"
            ];
        } else if (isMarineGrowth) {
            options = Array.from(new Set([...options, ...MARINE_GROWTH_LIST]));
        } else if (isCoating) {
            options = Array.from(new Set([...options, ...COATING_CONDITION_LIST]));
        } else if (isCompCondition) {
            options = Array.from(new Set([...options, ...COMPONENT_CONDITION_LIST]));
        } else if (isAnodeType && options.length === 0) {
            options = [...ANODE_TYPE_LIST];
        } else if (isAnodeDep && options.length === 0) {
            options = [...ANODE_DEPLETION_LIST];
        }

        const isGrouped = isAnodeDep && options.length > 0 && ANODE_DEPLETION_GROUPS.length > 0;

        const filteredOptions = options.filter(opt => 
            String(opt).toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="relative group/combo">
                <Popover 
                    open={openPopovers[p.name || p.label] || false} 
                    onOpenChange={(val) => {
                        setOpenPopovers((prev: any) => ({ ...prev, [p.name || p.label]: val }));
                        if (!val) setSearchTerm(""); // Reset search on close
                    }}
                >
                    <PopoverTrigger asChild>
                        <div className="relative">
                            <Input
                                placeholder={`Select or enter ${p.label || p.name}`}
                                className={`h-9 text-sm bg-white pr-16 ${type === 'secondary' ? 'border-amber-200' : 'border-slate-200'}`}
                                value={currentValue}
                                onChange={(e) => handler(p.name || p.label, e.target.value)}
                                onBlur={(e) => {
                                    if (type === 'primary') {
                                        setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: e.target.value }));
                                    }
                                }}
                            />
                            <div className="absolute right-1 top-1 flex items-center gap-0.5">
                                {currentValue && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handler(p.name || p.label, "");
                                            if (type === 'primary') {
                                                setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: "" }));
                                            }
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                                <div className="h-7 w-7 flex items-center justify-center text-slate-500">
                                    <ChevronDown className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border border-slate-200 shadow-xl z-[200] overflow-hidden rounded-lg" align="start">
                        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                                <Input 
                                    placeholder="Search..." 
                                    className="h-8 pl-8 text-xs bg-white border-slate-200 focus-visible:ring-slate-400"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                            {isGrouped && !searchTerm ? (
                                <div className="space-y-1">
                                    {ANODE_DEPLETION_GROUPS.map((group) => (
                                        <div key={group.type}>
                                            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 rounded sticky top-0 z-10 border-b border-slate-100">
                                                {group.type}
                                            </div>
                                            <div className="space-y-0.5 mt-0.5">
                                                {group.options.map((opt) => (
                                                    <button
                                                        key={opt}
                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 rounded transition-colors font-medium flex items-center justify-between group"
                                                        onClick={() => {
                                                            handler(p.name || p.label, opt);
                                                            if (type === 'primary') {
                                                                setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: opt }));
                                                            }
                                                            setOpenPopovers((prev: any) => ({ ...prev, [p.name || p.label]: false }));
                                                        }}
                                                    >
                                                        <span>{opt.split(': ')[1]}</span>
                                                        {currentValue === opt && <div className={`w-1.5 h-1.5 ${type === 'secondary' ? 'bg-amber-500' : 'bg-blue-600'} rounded-full`} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredOptions.length > 0 ? (
                                <div className="space-y-0.5">
                                    {filteredOptions.map((opt) => (
                                        <button
                                            key={opt}
                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded transition-colors font-medium flex items-center justify-between group"
                                            onClick={() => {
                                                handler(p.name || p.label, opt);
                                                if (type === 'primary') {
                                                    setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: opt }));
                                                }
                                                setOpenPopovers((prev: any) => ({ ...prev, [p.name || p.label]: false }));
                                            }}
                                        >
                                            {opt}
                                            {currentValue === opt && <div className={`w-1.5 h-1.5 ${type === 'secondary' ? 'bg-amber-500' : 'bg-slate-800'} rounded-full`} />}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 text-center text-xs text-slate-400 italic">No matches found</div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    if (p.type === 'select') {
        return (
            <select
                value={currentValue}
                onChange={(e) => {
                    handler(p.name || p.label, e.target.value);
                    if (type === 'primary') {
                        setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: e.target.value }));
                    }
                }}
                className={`flex h-9 w-full rounded-md border ${borderClass} bg-white px-2.5 text-xs font-semibold ${ringClass}`}
            >
                <option value="">Select {p.label}</option>
                {(p.options || []).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    if (p.type === 'repeater') {
        const rows = Array.isArray(currentValue) ? currentValue : [];
        return (
            <div className="space-y-2">
                {rows.map((row: any, idx: number) => (
                    <div key={idx} className="p-2 border rounded-md bg-slate-50/50 space-y-2 relative group-row">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-1 -top-1 h-6 w-6 text-red-400 hover:text-red-600 opacity-0 group-row-hover:opacity-100 transition-opacity"
                            onClick={() => {
                                const newRows = [...rows];
                                newRows.splice(idx, 1);
                                handler(p.name || p.label, newRows);
                            }}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                            {(p.subFields || []).map((sf: any) => (
                                <div key={sf.name} className="space-y-1">
                                    <label className="text-[10px] uppercase text-slate-400 font-bold">{sf.label}</label>
                                    <Input
                                        type={sf.type === 'number' ? 'number' : 'text'}
                                        step={sf.step}
                                        value={row[sf.name] || ''}
                                        onChange={(e) => {
                                            const newRows = [...rows];
                                            newRows[idx] = { ...newRows[idx], [sf.name]: e.target.value };
                                            handler(p.name || p.label, newRows);
                                        }}
                                        onBlur={(e) => {
                                            if (type === 'primary') {
                                                const newRows = [...rows];
                                                newRows[idx] = { ...newRows[idx], [sf.name]: e.target.value };
                                                setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: newRows }));
                                            }
                                        }}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 border-dashed border-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    onClick={() => {
                        handler(p.name || p.label, [...rows, {}]);
                    }}
                >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Reading
                </Button>
            </div>
        );
    }

    return (
        <Input
            type={p.type === 'number' ? 'number' : 'text'}
            step={p.step}
            value={currentValue || ""}
            onChange={(e) => handler(p.name || p.label, e.target.value)}
            onBlur={(e) => {
                if (type === 'primary') {
                    setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: e.target.value }));
                }
            }}
            placeholder={`Enter ${p.label}`}
            className={`h-9 text-xs font-semibold bg-white ${borderClass} ${ringClass}`}
        />
    );
};

export default InspectionField;
