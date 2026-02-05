"use client";

import { InspectionLayout } from "@/components/inspection/inspection-layout";
import { InspectionChecklist } from "@/components/inspection/inspection-checklist";
import { InspectionForm } from "@/components/inspection/inspection-form";
import { Inspection3DView } from "@/components/inspection/inspection-3d-view";
import { InspectionProvider } from "@/components/inspection/inspection-context";

export default function InspectionPage() {
    return (
        <InspectionProvider>
            <InspectionLayout
                leftPanel={<InspectionChecklist />}
                centerPanel={<InspectionForm />}
                rightPanel={<Inspection3DView />}
            />
        </InspectionProvider>
    );
}
