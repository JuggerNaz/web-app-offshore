import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
    try {
        const supabase = createClient();
        const body = await request.json();

        const { templateId, category, entityId, inspectionType } = body;

        // Validate required fields
        if (!templateId || !category) {
            return NextResponse.json(
                { error: "Missing required fields: templateId, category" },
                { status: 400 }
            );
        }

        // TODO: Implement actual report generation logic
        // For now, return a mock response
        const reportData = {
            templateId,
            category,
            entityId,
            inspectionType,
            status: "generated",
            filename: `${templateId}_${entityId}_${new Date().toISOString().split("T")[0]}.pdf`,
            generatedAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            data: reportData,
        });
    } catch (error: any) {
        console.error("Error generating report:", error);
        return NextResponse.json(
            { error: "Failed to generate report", details: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // TODO: Return list of available report templates
        const templates = {
            structure: [
                { id: "structure-summary", name: "Structure Summary Report" },
                { id: "component-catalog", name: "Component Catalogue" },
                { id: "technical-specs", name: "Technical Specifications" },
            ],
            jobpack: [
                { id: "jobpack-summary", name: "Job Pack Summary" },
                { id: "work-scope", name: "Work Scope Report" },
                { id: "resource-allocation", name: "Resource Allocation" },
            ],
            planning: [
                { id: "inspection-schedule", name: "Inspection Schedule" },
                { id: "planning-overview", name: "Planning Overview" },
            ],
            inspection: [
                { id: "inspection-report", name: "Inspection Report" },
                { id: "defect-summary", name: "Defect Summary" },
                { id: "compliance-report", name: "Compliance Report" },
            ],
        };

        return NextResponse.json({
            success: true,
            data: templates,
        });
    } catch (error: any) {
        console.error("Error fetching templates:", error);
        return NextResponse.json(
            { error: "Failed to fetch templates", details: error.message },
            { status: 500 }
        );
    }
}
