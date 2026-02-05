"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { StepGeneral } from "./StepGeneral";
import { StepMode } from "./StepMode";
import { StepStructureSelect } from "./StepStructureSelect";
import { StepCompTypeSelect } from "./StepCompTypeSelect";
import { StepComponentSelect } from "./StepComponentSelect";
import { StepInspection } from "./StepInspection";
import { toast } from "sonner";

export type WizardMode = "STRUCTURE" | "COMPONENT_TYPE" | "COMPONENT";

export interface WizardState {
    inspno: string;
    name: string;
    contractor: any | null;
    mode: WizardMode;
    scope: { topside: boolean; subsea: boolean };
    structures: string[]; // str_ids
    componentTypes: string[]; // codes
    components: string[]; // comp_ids
    inspectionTypes: string[]; // array of method codes
    inspectionType?: string; // deprecated
    structureComponentSelections: Record<string, string[]>; // map str_id -> array of codes (for COMP_TYPE mode)
    structureSpecificComponents: Record<string, string[]>; // map str_id -> array of comp_ids (for COMPONENT mode)
    structureSpecificInspectionTypes: Record<string, string[]>; // map str_id -> array of inspection codes

    // New Fields
    planType: "PLANNED" | "INSTANT";
    startDate: Date | undefined;
    endDate: Date | undefined;
    companyRep: string;
    vessel: string;
    diveType: string;
    contractRef: string;
    contractorRef: string;
    estimatedTime: string;
    comments: string;
}

const INITIAL_STATE: WizardState = {
    inspno: "",
    name: "",
    contractor: null,
    mode: "STRUCTURE",
    scope: { topside: false, subsea: false },
    structures: [],
    componentTypes: [],
    components: [],
    inspectionTypes: [],
    inspectionType: "",
    structureComponentSelections: {},
    structureSpecificComponents: {},
    structureSpecificInspectionTypes: {},

    planType: "PLANNED",
    startDate: undefined,
    endDate: undefined,
    companyRep: "",
    vessel: "",
    diveType: "",
    contractRef: "",
    contractorRef: "",
    estimatedTime: "",
    comments: "",
};

export function WizardDialog() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [state, setState] = useState<WizardState>(INITIAL_STATE);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch next sequence
    const { data: seqData } = useSWR(open ? "/api/jobpack/utils/next-seq" : null, fetcher);

    useEffect(() => {
        if (seqData?.data?.nextInspNo) {
            setState((prev) => ({ ...prev, inspno: seqData.data.nextInspNo }));
        }
    }, [seqData]);

    const updateState = (updates: Partial<WizardState>) => {
        setState((prev) => ({ ...prev, ...updates }));
    };

    const handleNext = () => {
        setStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setStep((prev) => prev - 1);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/jobpack/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(state),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.message || "Failed to create Work Pack");

            toast.success("Work Pack created successfully!");
            setOpen(false);
            setStep(1);
            setState(INITIAL_STATE);
            // Trigger revalidation/refresh if needed
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Determine which step component to render
    const renderStep = () => {
        switch (step) {
            case 1:
                return <StepGeneral state={state} updateState={updateState} onNext={handleNext} />;
            case 2:
                return <StepMode state={state} updateState={updateState} onNext={handleNext} onBack={handleBack} />;
            case 3:
                // Dynamic step based on mode
                if (state.mode === "STRUCTURE") {
                    return <StepStructureSelect state={state} updateState={updateState} onNext={handleNext} onBack={handleBack} />;
                } else if (state.mode === "COMPONENT_TYPE") {
                    return <StepCompTypeSelect state={state} updateState={updateState} onNext={handleNext} onBack={handleBack} />;
                } else {
                    return <StepComponentSelect state={state} updateState={updateState} onNext={handleNext} onBack={handleBack} />;
                }
            case 4:
                return <StepInspection state={state} updateState={updateState} onNext={handleSave} onBack={handleBack} isSubmitting={isSubmitting} />;
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="shadow-lg shadow-blue-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Create Work Pack
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="bg-slate-50 dark:bg-slate-900 border-b p-6 flex flex-row justify-between items-center space-y-0">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-bold">New Work Pack Wizard</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">Step {step} of 4</DialogDescription>
                    </div>
                    {state.inspno && <div className="text-sm font-mono bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{state.inspno}</div>}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {renderStep()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
