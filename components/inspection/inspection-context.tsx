"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// --- Types ---

export interface InspectionState {
    // Step 1: Context
    inspectionMode: string;
    inspectionType: string;
    dateTime: string;
    supervisor: string;

    // Step 2: Component
    componentId: string;
    componentName: string;
    elevation: string;
    rovPosition: string;

    // Step 3: Observation
    observationType: string;
    description: string;
    isAnomaly: boolean;
    anomalyReference: string;

    // Step 4: Evidence
    evidence: {
        timecode: string | null;
        frameCaptured: boolean;
        segmentMarked: boolean;
    };

    // Meta
    isDraft: boolean;
    lastSaved: string | null;
}

interface InspectionContextType {
    state: InspectionState;
    updateState: (updates: Partial<InspectionState>) => void;
    saveEvent: (asDraft?: boolean) => void;
    validation: {
        context: boolean;
        component: boolean;
        position: boolean; // Derived from component selection + live data
        observation: boolean;
        evidence: boolean;
        saved: boolean;
        isValid: boolean;
        missingFields: string[];
    };
}

// --- Initial State ---

const initialState: InspectionState = {
    inspectionMode: "General Visual (GVI)",
    inspectionType: "Scheduled",
    dateTime: "", // Set on mount
    supervisor: "J. Doe (Pilot)",

    componentId: "",
    componentName: "",
    elevation: "",
    rovPosition: "N: 1234.5 E: 6789.0", // Mock live data

    observationType: "",
    description: "",
    isAnomaly: false,
    anomalyReference: "",

    evidence: {
        timecode: null,
        frameCaptured: false,
        segmentMarked: false,
    },

    isDraft: false,
    lastSaved: null,
};

// --- Context ---

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

export function InspectionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<InspectionState>(initialState);

    // Live Timer Mock
    useEffect(() => {
        const timer = setInterval(() => {
            setState((prev) => ({
                ...prev,
                dateTime: new Date().toLocaleString(),
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Update State Helper
    const updateState = (updates: Partial<InspectionState>) => {
        setState((prev) => ({ ...prev, ...updates, isDraft: true, lastSaved: null }));
    };

    // Validation Logic
    const validation = React.useMemo(() => {
        const contextValid = !!state.inspectionMode && !!state.supervisor;
        const componentValid = !!state.componentId;
        const positionValid = !!state.rovPosition; // Always true for now as it's auto
        const observationValid =
            !!state.observationType &&
            !!state.description &&
            (!state.isAnomaly || !!state.anomalyReference);

        // Evidence is optional but "Linked" status depends on it
        const evidenceValid = !!state.evidence.timecode || state.evidence.frameCaptured;

        const missingFields = [];
        if (!componentValid) missingFields.push("Component ID");
        if (!state.observationType) missingFields.push("Observation Type");
        if (!state.description) missingFields.push("Description");
        if (state.isAnomaly && !state.anomalyReference) missingFields.push("Anomaly Ref");

        return {
            context: contextValid,
            component: componentValid,
            position: positionValid,
            observation: observationValid,
            evidence: evidenceValid,
            saved: !!state.lastSaved && !state.isDraft,
            isValid: missingFields.length === 0,
            missingFields
        };
    }, [state]);

    // Save Logic
    const saveEvent = (asDraft = false) => {
        if (!asDraft && !validation.isValid) return;

        // Simulate API Call
        setTimeout(() => {
            setState((prev) => ({
                ...prev,
                isDraft: false,
                lastSaved: new Date().toISOString(),
            }));
            // In a real app, we'd append to a log here
            if (!asDraft) {
                // Reset form for next event? Or keep it? 
                // User asked for "Save & Next", but for "Save Event" maybe just mark saved.
                // Let's assume "Save Event" keeps values but marks saved.
            }
        }, 500);
    };

    return (
        <InspectionContext.Provider value={{ state, updateState, saveEvent, validation }}>
            {children}
        </InspectionContext.Provider>
    );
}

export function useInspection() {
    const context = useContext(InspectionContext);
    if (context === undefined) {
        throw new Error("useInspection must be used within an InspectionProvider");
    }
    return context;
}
