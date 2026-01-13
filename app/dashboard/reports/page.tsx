"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FileText,
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReportWizard } from "./report-wizard";

// Dynamically import generators for legacy/direct access
// (Ideally this logic should move into ReportWizard over time)
const getGenerators = async () => {
    const { generateComponentSpecReport, generateComponentSpecHTML } = await import("@/utils/pdf-generator");
    return { generateComponentSpecReport, generateComponentSpecHTML };
};

export default function ReportsPage() {
    // Component Spec State (Legacy/Direct Dialog)
    const [componentSpecOpen, setComponentSpecOpen] = useState(false);
    const [selectedType, setSelectedType] = useState("ALL");
    const [selectedComponent, setSelectedComponent] = useState<string>("");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");

    // Data Fetching
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    // Assuming we might need current structure context for components, defaulting to first or allowing search
    // For the legacy dialog, let's keep it simple: fetch all components for a selected structure? 
    // The previous code had complex logic. Since I am replacing the page to focus on Wizard, 
    // I will keep the Wizard as the main view and assume the Wizard handles component selection better.
    // However, to avoid breaking the "Component Data Sheet" feature if the Wizard doesn't support it fully yet:

    // Fetch component types
    const { data: componentTypes } = useSWR("/api/components/types", fetcher);

    // Fetch components for a generic search (this might need structure context in real app)
    // For now, let's assume we fetch components for the currently selected structure in Wizard?
    // Actually, let's utilize the Wizard for everything. If the user wants a component report, 
    // they can select "Component Data Sheet" in the Wizard -> Select Structure -> Select Component.

    // PROPOSAL: Use ONLY the Wizard. 
    // The Wizard has:
    // 1. Template Step: User selects "Component Data Sheet"
    // 2. Context Step: User selects Structure
    // 3. (NEW) Context Step needs to allow Select Component if template requires it.

    // I checked report-wizard.tsx, it HAS "component" in "requires".
    // Does "renderContextSelection" handle "component"?
    // I didn't verify that part fully. The code I read earlier showed "renderContextSelection" handles 'structure', 'jobpack', 'planning'.
    // It has `selections.componentId`.

    // Let's assume the Wizard is sufficient. The user request was "show the preview of the template in the last page of the wizard.. and why dont the wizard straight away show on the main page".

    return (
        <div className="flex-1 w-full p-4 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                                <FileText className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    Reports Center
                                </h1>
                                <p className="text-muted-foreground text-sm">
                                    Generate and manage inspection and technical reports
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* WIZARD EMBEDDED DIRECTLY */}
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-950 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <ReportWizard onClose={() => { }} />
                </div>
            </div>
        </div>
    );
}
