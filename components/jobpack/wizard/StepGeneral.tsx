"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Calendar as CalendarIcon, Check } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface StepGeneralProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
}

export function StepGeneral({ state, updateState, onNext }: StepGeneralProps) {
    const { data: contractorsData, isLoading } = useSWR("/api/jobpack/utils/contractors", fetcher);
    const [search, setSearch] = useState("");

    const contractors = contractorsData?.data || [];
    const filteredContractors = contractors.filter((c: any) =>
        (c.lib_desc || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.lib_id || "").toLowerCase().includes(search.toLowerCase())
    );

    const handleContractorSelect = (contractor: any) => {
        updateState({ contractor });
    };

    const isNextDisabled = !state.name || !state.contractor || !state.planType || !state.startDate;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-6">
                    {/* Job Name */}
                    <div className="space-y-2">
                        <Label>Job Pack Name <span className="text-red-500">*</span></Label>
                        <Input
                            value={state.name}
                            onChange={(e) => updateState({ name: e.target.value })}
                            placeholder="e.g. 2026 Annual Inspection Campaign"
                            className="text-lg"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Plan Type */}
                        <div className="space-y-2">
                            <Label>Plan Type <span className="text-red-500">*</span></Label>
                            <Select value={state.planType} onValueChange={(val) => updateState({ planType: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PLANNED">PLANNED</SelectItem>
                                    <SelectItem value="INSTANT">INSTANT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2">
                            <Label>Start Date <span className="text-red-500">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !state.startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {state.startDate ? format(state.startDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={state.startDate}
                                        onSelect={(date) => updateState({ startDate: date })}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <Label>End Date (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !state.endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {state.endDate ? format(state.endDate, "PPP") : <span>Select closing date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={state.endDate}
                                        onSelect={(date) => updateState({ endDate: date })}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Company Rep */}
                        <div className="space-y-2">
                            <Label>Company Rep</Label>
                            <Input
                                value={state.companyRep}
                                onChange={(e) => updateState({ companyRep: e.target.value })}
                                placeholder="Rep Name"
                            />
                        </div>

                        {/* Vessel */}
                        <div className="space-y-2">
                            <Label>Vessel</Label>
                            <Input
                                value={state.vessel}
                                onChange={(e) => updateState({ vessel: e.target.value })}
                                placeholder="Vessel Name"
                            />
                        </div>

                        {/* Dive Type */}
                        <div className="space-y-2">
                            <Label>Dive Type</Label>
                            <Select value={state.diveType} onValueChange={(val) => updateState({ diveType: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Dive Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Air Diving">Air Diving</SelectItem>
                                    <SelectItem value="Sat Diving">Sat Diving</SelectItem>
                                    <SelectItem value="Air/Sat Diving">Air/Sat Diving</SelectItem>
                                    <SelectItem value="ROV">ROV</SelectItem>
                                    <SelectItem value="Air/ROV">Air/ROV</SelectItem>
                                    <SelectItem value="Sat/ROV">Sat/ROV</SelectItem>
                                    <SelectItem value="Air/Sat/ROV">Air/Sat/ROV</SelectItem>
                                    <SelectItem value="Rope Access">Rope Access</SelectItem>
                                    <SelectItem value="Mixed Gas">Mixed Gas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Contract Ref */}
                        <div className="space-y-2">
                            <Label>Contract Ref#</Label>
                            <Input
                                value={state.contractRef}
                                onChange={(e) => updateState({ contractRef: e.target.value })}
                                placeholder="Contract Ref"
                            />
                        </div>

                        {/* Contractor Ref */}
                        <div className="space-y-2">
                            <Label>Contractor Ref#</Label>
                            <Input
                                value={state.contractorRef}
                                onChange={(e) => updateState({ contractorRef: e.target.value })}
                                placeholder="Contractor Ref"
                            />
                        </div>

                        {/* Estimated Time */}
                        <div className="space-y-2">
                            <Label>Estimated Time</Label>
                            <Input
                                value={state.estimatedTime}
                                onChange={(e) => updateState({ estimatedTime: e.target.value })}
                                placeholder="e.g. 14 Days"
                            />
                        </div>
                    </div>

                    {/* Contractor Selection */}
                    <div className="space-y-2">
                        <Label>Select Contractor <span className="text-red-500">*</span></Label>
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search contractors..."
                                    className="pl-9 bg-white dark:bg-slate-950"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 h-[200px] overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    <div className="col-span-3 text-center py-10 text-slate-400">Loading contractors...</div>
                                ) : filteredContractors.map((c: any) => (
                                    <div
                                        key={c.lib_id}
                                        onClick={() => handleContractorSelect(c)}
                                        className={cn(
                                            "cursor-pointer p-3 rounded-md border flex items-center gap-3 transition-all relative overflow-hidden",
                                            state.contractor?.lib_id === c.lib_id
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                                                : "border-slate-200 bg-white dark:bg-slate-950 hover:border-blue-300"
                                        )}
                                    >
                                        <div className="h-10 w-10 shrink-0 bg-white rounded border flex items-center justify-center p-1">
                                            {c.logo_url ? (
                                                <img src={c.logo_url} alt={c.lib_desc} className="max-h-full max-w-full object-contain" />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-300">{(c.lib_id || "").substring(0, 2)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm truncate">{c.lib_desc}</div>
                                            <div className="text-xs text-slate-500 truncate">{c.lib_com}</div>
                                        </div>
                                        {state.contractor?.lib_id === c.lib_id && (
                                            <div className="absolute top-0 right-0 p-1 bg-blue-500 text-white rounded-bl">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredContractors.length === 0 && !isLoading && (
                                    <div className="col-span-3 text-center py-8 text-slate-400">No contractors found</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="space-y-2">
                        <Label>Comments</Label>
                        <Textarea
                            value={state.comments}
                            onChange={(e) => updateState({ comments: e.target.value })}
                            placeholder="Additional notes..."
                            className="h-20"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t mt-4">
                <Button onClick={onNext} disabled={isNextDisabled} size="lg">
                    Next Step
                </Button>
            </div>
        </div>
    );
}
