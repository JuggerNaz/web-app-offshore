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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
    MARINE_GROWTH_LIST, 
    COATING_CONDITION_LIST, 
    COMPONENT_CONDITION_LIST, 
    ANODE_TYPE_LIST, 
    ANODE_DEPLETION_LIST,
    ANODE_DEPLETION_GROUPS 
} from "../constants";
import unitsData from "@/utils/types/units.json";

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
    unitSystem: "METRIC" | "IMPERIAL";
    dynamicProps: Record<string, any>;
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
    setDebouncedProps,
    unitSystem,
    dynamicProps
}: InspectionFieldProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const fieldName = String(p.label || p.name || '').toLowerCase();
    
    const isLocation = fieldName === 'location' || fieldName === 'loc' || fieldName === 'scour location' || fieldName === 'scour_location';
    const isPosition = fieldName.includes('position') || fieldName === 'pos' || fieldName.includes('clock');
    const isMarineGrowth = fieldName.includes('marine growth') || fieldName.includes('marinegrowth') || fieldName === 'mgi' || fieldName.includes('marine_growth');
    const isCoating = fieldName.includes('coating condition') || fieldName.includes('coatingcondition') || fieldName.includes('coating_condition');
    const isCompCondition = fieldName.includes('component condition') || fieldName.includes('componentcondition') || fieldName.includes('component_condition');

    const isAnodeType = fieldName === 'anode type' || fieldName === 'anode_type';
    const isAnodeDep = fieldName === 'anode depletion' || fieldName === 'anode_depletion';
    const isCpField = fieldName.includes('cp');

    const isTimeField = fieldName.includes('time') || fieldName.includes('counter') || p.type === 'time' || p.name === 'tape_count_no' || p.name === 'inspection_time';

    const isComboEligible = isLocation || isPosition || isMarineGrowth || isCoating || isCompCondition || isAnodeType || isAnodeDep || p.type === 'select' || p.type === 'combo' || !!p.lib_code;
    const borderClass = type === 'secondary' ? 'border-amber-300' : 'border-slate-300';
    const ringClass = type === 'secondary' ? 'focus-visible:ring-amber-500' : 'focus-visible:ring-slate-500';

    // Unit Management - Enriched for Multi-Unit Support
    const categoryUnits = p.unitCategory ? (unitsData as any)[p.unitCategory] : null;
    
    // Show BOTH metric and imperial units as requested
    const unitOptions = categoryUnits 
        ? Array.from(new Set([...(categoryUnits.metric || []), ...(categoryUnits.imperial || [])])) 
        : [];
        
    const defaultUnit = (unitSystem === "IMPERIAL" ? p.defaultImperial : p.defaultMetric) || p.defaultUnit || (categoryUnits 
        ? (unitSystem === "IMPERIAL" ? categoryUnits.defaultImperial : categoryUnits.defaultMetric) 
        : null);

    // Unit value management
    const unitFieldName = `${p.name || p.label}_unit`;
    const currentUnitValue = dynamicProps[unitFieldName] || defaultUnit;

    // Initialize unit in state if not present but category exists
    React.useEffect(() => {
        if (categoryUnits && !dynamicProps[unitFieldName] && defaultUnit) {
            handler(unitFieldName, defaultUnit);
        }
    }, [categoryUnits, unitFieldName, defaultUnit]);

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
                selectedComp.startLeg && selectedComp.startLeg !== '-' ? `Leg : ${selectedComp.startLeg}` : null,
                selectedComp.endLeg && selectedComp.endLeg !== '-' ? `Leg : ${selectedComp.endLeg}` : null,
                selectedComp.startNode && selectedComp.startNode !== '-' ? `Node : ${selectedComp.startNode}` : null,
                selectedComp.endNode && selectedComp.endNode !== '-' ? `Node : ${selectedComp.endNode}` : null,
                "At Midpoint"
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
                                    let val = e.target.value;
                                    if (isCpField && val) {
                                        const num = Number(val);
                                        if (!isNaN(num) && num > 0) {
                                            val = (-num).toString();
                                            handler(p.name || p.label, val);
                                        }
                                    }
                                    if (type === 'primary') {
                                        setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: val }));
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

    if (p.type === 'boolean') {
        const isChecked = currentValue === true || currentValue === "true" || currentValue === "Yes";
        return (
            <div className="flex items-center gap-2 h-9 px-1">
                <Checkbox 
                    id={`${p.name || p.label}-${type}`}
                    checked={isChecked}
                    onCheckedChange={(val) => {
                        const finalVal = val ? "Yes" : "No";
                        handler(p.name || p.label, finalVal);
                        if (type === 'primary') {
                            setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: finalVal }));
                        }
                    }}
                    className={`${type === 'secondary' ? 'border-amber-400 data-[state=checked]:bg-amber-600' : 'border-slate-300 data-[state=checked]:bg-blue-600'}`}
                />
                <label 
                    htmlFor={`${p.name || p.label}-${type}`}
                    className="text-xs font-bold text-slate-600 cursor-pointer select-none"
                >
                    {isChecked ? "Yes" : "No"}
                </label>
            </div>
        );
    }

    if (p.type === 'repeater') {
        const rows = Array.isArray(currentValue) ? currentValue : [];
        return (
            <div className="space-y-3">
                {rows.map((row: any, idx: number) => (
                    <div key={idx} className="p-3 border-2 border-slate-100 rounded-lg bg-white shadow-sm space-y-3 relative group-row transition-all hover:border-slate-200">
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute -right-2 -top-2 h-7 w-7 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 shadow-sm z-10"
                            onClick={() => {
                                const hasData = Object.values(row).some(v => v !== undefined && v !== null && v !== "");
                                if (hasData) {
                                    if (!window.confirm("This additional record contains data. Are you sure you want to delete it?")) return;
                                }
                                const newRows = [...rows];
                                newRows.splice(idx, 1);
                                handler(p.name || p.label, newRows);
                                if (type === 'primary') {
                                    setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: newRows }));
                                }
                            }}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(p.subFields || []).map((sf: any) => {
                                const sfCategoryUnits = sf.unitCategory ? (unitsData as any)[sf.unitCategory] : null;
                                const sfUnitFieldName = `${sf.name}_unit`;
                                const sfDefaultUnit = sfCategoryUnits 
                                    ? (unitSystem === "IMPERIAL" ? sfCategoryUnits.defaultImperial : sfCategoryUnits.defaultMetric) 
                                    : null;
                                const sfCurrentUnit = row[sfUnitFieldName] || sfDefaultUnit;
                                
                                const sfUnitOptions = sfCategoryUnits 
                                    ? Array.from(new Set([...(sfCategoryUnits.metric || []), ...(sfCategoryUnits.imperial || [])])) 
                                    : [];

                                return (
                                    <div key={sf.name} className="space-y-1">
                                        <label className="text-[10px] uppercase text-slate-400 font-black tracking-wider">{sf.label}</label>
                                        <div className="flex items-center gap-1">
                                            <Input
                                                type={sf.type === 'number' ? 'number' : 'text'}
                                                step={sf.step}
                                                value={row[sf.name] || ''}
                                                onChange={(e) => {
                                                    const newRows = [...rows];
                                                    newRows[idx] = { ...newRows[idx], [sf.name]: e.target.value };
                                                    // Auto-init unit if missing
                                                    if (sfDefaultUnit && !newRows[idx][sfUnitFieldName]) {
                                                        newRows[idx][sfUnitFieldName] = sfDefaultUnit;
                                                    }
                                                    handler(p.name || p.label, newRows);
                                                }}
                                                onBlur={(e) => {
                                                    if (type === 'primary') {
                                                        const newRows = [...rows];
                                                        newRows[idx] = { ...newRows[idx], [sf.name]: e.target.value };
                                                        setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: newRows }));
                                                    }
                                                }}
                                                className="h-9 text-sm font-medium border-slate-200 focus-visible:ring-slate-400 flex-1"
                                            />
                                            {sfCategoryUnits && (
                                                <div className="relative flex items-center h-9 px-2 border border-slate-200 rounded-md bg-slate-50 min-w-[60px] hover:border-slate-300 transition-colors">
                                                    <select
                                                        className="w-full bg-transparent border-none text-[10px] font-bold text-slate-500 focus:ring-0 cursor-pointer appearance-none pr-4"
                                                        value={sfCurrentUnit}
                                                        onChange={(e) => {
                                                            const newRows = [...rows];
                                                            newRows[idx] = { ...newRows[idx], [sfUnitFieldName]: e.target.value };
                                                            handler(p.name || p.label, newRows);
                                                            if (type === 'primary') {
                                                                setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: newRows }));
                                                            }
                                                        }}
                                                    >
                                                        {Array.from(new Set([...(sfCategoryUnits.metric || []), ...(sfCategoryUnits.imperial || [])])).map((unit: string) => (
                                                            <option key={unit} value={unit}>{unit}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 border-dashed border-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    onClick={() => {
                        const newRow: any = {};
                        (p.subFields || []).forEach((sf: any) => {
                            if (sf.unitCategory) {
                                const sfCategoryUnits = (unitsData as any)[sf.unitCategory];
                                if (sfCategoryUnits) {
                                    newRow[`${sf.name}_unit`] = unitSystem === "IMPERIAL" ? sfCategoryUnits.defaultImperial : sfCategoryUnits.defaultMetric;
                                }
                            }
                        });
                        handler(p.name || p.label, [...rows, newRow]);
                    }}
                >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Reading
                </Button>
            </div>
        );
    }

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        const digits = val.replace(/\D/g, "").slice(0, 6);
        let formatted = digits;
        if (digits.length > 2 && digits.length <= 4) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
        } else if (digits.length > 4) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
        }
        handler(p.name || p.label, formatted);
    };

    const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (!val) {
            if (type === 'primary') setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: "" }));
            return;
        }

        const parts = val.split(':');
        let normalized = parts.map(p => p.slice(0, 2).padStart(2, '0'));
        
        // Pad to 3 parts (HH:MM:SS) if incomplete
        while (normalized.length < 3) {
            normalized.push("00");
        }

        // Ensure values are within range (0-23 for hours, 0-59 for min/sec)
        if (normalized[0] && parseInt(normalized[0]) > 23) normalized[0] = "23";
        if (normalized[1] && parseInt(normalized[1]) > 59) normalized[1] = "59";
        if (normalized[2] && parseInt(normalized[2]) > 59) normalized[2] = "59";

        const finalVal = normalized.slice(0, 3).join(':');
        handler(p.name || p.label, finalVal);
        if (type === 'primary') {
            setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: finalVal }));
        }
    };

    return (
        <div className="relative flex items-center gap-1">
            <Input
                type={p.type === 'date' ? 'date' : (isTimeField ? 'text' : (p.type === 'number' ? 'number' : 'text'))}
                step={p.step}
                value={currentValue || ""}
                onChange={isTimeField ? handleTimeChange : (e) => handler(p.name || p.label, e.target.value)}
                onBlur={isTimeField ? handleTimeBlur : (e) => {
                    let val = e.target.value;
                    if (isCpField && val) {
                        const num = Number(val);
                        if (!isNaN(num) && num > 0) {
                            val = (-num).toString();
                            handler(p.name || p.label, val);
                        }
                    }
                    if (type === 'primary') {
                        setDebouncedProps((prev: any) => ({ ...prev, [p.name || p.label]: val }));
                    }
                }}

                placeholder={isTimeField ? "HH:MM:SS" : `Enter ${p.label || p.name}`}
                maxLength={isTimeField ? 8 : undefined}
                className={`h-9 text-xs font-semibold bg-white ${borderClass} ${ringClass} flex-1`}
            />
            {categoryUnits && (
                <select
                    className="h-7 px-1 text-[10px] font-bold border rounded bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={currentUnitValue}
                    onChange={(e) => {
                        handler(unitFieldName, e.target.value);
                        if (type === 'primary') {
                            setDebouncedProps((prev: any) => ({ ...prev, [unitFieldName]: e.target.value }));
                        }
                    }}
                >
                    {unitOptions.map((u: any) => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                </select>
            )}
        </div>
    );
};

export default InspectionField;

