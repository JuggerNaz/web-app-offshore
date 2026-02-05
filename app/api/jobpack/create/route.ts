import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";

export async function POST(request: NextRequest) {
    const supabase = createClient();
    const body = await request.json();
    const {
        name, contractor, mode, scope, structures, componentTypes, components, inspectionType, inspectionTypes,
        // New Fields
        planType, startDate, endDate, companyRep, vessel, diveType, contractRef, contractorRef, estimatedTime, comments
    } = body;

    // Get Current User
    const { data: { user } } = await supabase.auth.getUser();

    // Generate INSPNO (Safety check: calculate max + 1)
    // We do this to ensure uniqueness even if UI sent one.
    // However, for now, let's respect the UI logic but RE-CALCULATE strictly to avoid collisions.
    const { data: maxData } = await supabase
        .from("workpl")
        .select("inspno")
        .order("inspno", { ascending: false })
        .limit(1)
        .single();

    let nextSeq = 1;
    if (maxData?.inspno) {
        const current = parseInt(maxData.inspno, 10);
        if (!isNaN(current)) {
            nextSeq = current + 1;
        }
    }
    const inspno = nextSeq.toString().padStart(11, "0");


    // Normalize inspection types to an array
    const selectedInspectionTypes = inspectionTypes && inspectionTypes.length > 0
        ? inspectionTypes
        : (inspectionType ? [inspectionType] : []);

    try {
        // Map Mode to correct DB String
        // STRUCTURE -> STRUCTURE
        // COMPONENT_TYPE -> COMP TYPE
        // COMPONENT -> COMPONENT
        const taskTypeMap: Record<string, string> = {
            "STRUCTURE": "STRUCTURE",
            "COMPONENT_TYPE": "COMP TYPE",
            "COMPONENT": "COMPONENT"
        };

        // 1. Insert into workpl
        const workData = {
            inspno, // Generated
            jobname: (name || "").substring(0, 20),
            tasktype: taskTypeMap[mode] || mode, // 1. TASKTYPE
            cr_user: (user?.email || "unknown").substring(0, 30), // 2. CR_USER (Truncated)
            cr_date: new Date().toISOString(), // 3. CR_DATE
            workunit: '000', // 4. WORKUNIT
            contrac: contractor?.lib_id, // 7. CONTRAC (Store ID)
            // contrac_logo removed: Retrieve from u_lib_list via contrac ID dynamically
            status: 'OPEN',
            topside: scope?.topside ? 1 : 0, // 5. TOPSIDE
            subsea: scope?.subsea ? 1 : 0, // 6. SUBSEA

            // New Fields Mapped to EXISTING Legacy Columns
            plantype: planType,       // Maps correctly to 'plantype'
            istart: startDate,        // Maps 'Start Date' to 'istart' per user request
            iend: endDate,            // Maps 'End Date' to 'iend' per user request
            comprep: companyRep,      // Maps correctly to 'comprep'
            vessel: (vessel || "").substring(0, 20),
            divetyp: diveType,        // Maps correctly to 'divetyp'
            contract_ref: contractRef,
            contractor_ref: contractorRef,
            idesc: comments,          // Maps 'comments' to 'idesc' (Description/Comments)
            site_hrs: parseInt(estimatedTime) || null // Parse 'estimated_time' to int for 'site_hrs'
        };

        const { error: workError } = await supabase.from('workpl').insert(workData);
        if (workError) {
            console.error("Error inserting into workpl:", workError);
            throw workError;
        }

        // 2. Handle assignments based on mode
        if (mode === 'STRUCTURE') {
            // Insert taskstr
            const taskStrRecords = structures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000'
            }));
            const { error: tsError } = await supabase.from('taskstr').insert(taskStrRecords);
            if (tsError) throw tsError;

            // Insert taskinsp (Structure Level Inspection)
            // Create record for EACH selected inspection type per structure
            const taskInspRecords = [];
            for (const strId of structures) {
                for (const type of selectedInspectionTypes) {
                    taskInspRecords.push({
                        inspno,
                        str_id: Number(strId),
                        inspcode: type,
                        comp_id: 0,
                        compcode: "",
                        workunit: '000',
                        topside: scope?.topside ? 1 : 0,
                        subsea: scope?.subsea ? 1 : 0
                    });
                }
            }
            if (taskInspRecords.length > 0) {
                const { error: tiError } = await supabase.from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }

        } else if (mode === 'COMPONENT_TYPE') {
            const { structureComponentSelections } = body;
            // Insert taskstr
            const uniqueStructures = Array.from(new Set(structures)) as string[];
            const taskStrRecords = uniqueStructures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000'
            }));
            const { error: tsError } = await supabase.from('taskstr').insert(taskStrRecords as any);
            if (tsError) throw tsError;

            // Insert taskinsp
            const taskInspRecords = [];
            for (const strId of uniqueStructures) {
                // Determine which component types apply to this structure
                let typesForStructure = componentTypes;

                // If specific selections exist for this structure, use them
                if (structureComponentSelections && structureComponentSelections[strId] && structureComponentSelections[strId].length > 0) {
                    typesForStructure = structureComponentSelections[strId];
                }

                for (const compCode of typesForStructure) {
                    for (const type of selectedInspectionTypes) {
                        taskInspRecords.push({
                            inspno,
                            str_id: Number(strId),
                            compcode: compCode,
                            inspcode: type,
                            comp_id: 0,
                            workunit: '000',
                            topside: scope?.topside ? 1 : 0,
                            subsea: scope?.subsea ? 1 : 0
                        });
                    }
                }
            }
            if (taskInspRecords.length > 0) {
                const { error: tiError } = await supabase.from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }

        } else if (mode === 'COMPONENT') {
            const { structureSpecificComponents } = body;

            // Insert taskstr
            const uniqueStructures = Array.from(new Set(structures)) as string[];
            const taskStrRecords = uniqueStructures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000'
            }));
            const { error: tsError } = await supabase.from('taskstr').insert(taskStrRecords as any);
            if (tsError) throw tsError;

            // Insert taskcomp WITH str_id linkage
            const taskCompRecords: any[] = [];

            if (structureSpecificComponents) {
                Object.entries(structureSpecificComponents).forEach(([strId, compIds]) => {
                    if (Array.isArray(compIds)) {
                        compIds.forEach(compId => {
                            taskCompRecords.push({
                                inspno,
                                str_id: Number(strId),
                                comp_id: Number(compId)
                            });
                        });
                    }
                });
            } else if (components && components.length > 0) {
                components.forEach((compId: string) => {
                    taskCompRecords.push({
                        inspno,
                        comp_id: Number(compId),
                        str_id: 0 // Fallback
                    });
                });
            }

            if (taskCompRecords.length > 0) {
                const { error: tcError } = await supabase.from('taskcomp').insert(taskCompRecords);
                if (tcError) throw tcError;
            }

            // Insert taskinsp
            // One record per Component per Inspection Type
            const taskInspRecords = [];

            for (const strId of uniqueStructures) {
                // Determine components for this structure
                let compsForStr: string[] = [];

                if (structureSpecificComponents && structureSpecificComponents[strId]) {
                    compsForStr = structureSpecificComponents[strId];
                }

                // Create TaskInsp for SPECIFIC components
                for (const compId of compsForStr) {
                    for (const type of selectedInspectionTypes) {
                        taskInspRecords.push({
                            inspno,
                            str_id: Number(strId),
                            comp_id: Number(compId),
                            inspcode: type,
                            compcode: "",
                            workunit: '000',
                            topside: scope?.topside ? 1 : 0,
                            subsea: scope?.subsea ? 1 : 0
                        });
                    }
                }
            }

            if (taskInspRecords.length > 0) {
                const { error: tiError } = await supabase.from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }
        }

        return apiSuccess({ inspno });
    } catch (error: any) {
        return apiError(error instanceof Error ? error.message : "Failed to create Work Pack");
    }
}
