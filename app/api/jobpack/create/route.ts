import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiError } from "@/utils/api-response";
import { withTenant } from "@/utils/tenant-auth";

export const POST = withTenant(async (request, { companyId, user }) => {
    const supabase = createClient();
    const body = await request.json();
    const {
        name, contractor, mode, scope, structures, componentTypes, components, inspectionType, inspectionTypes,
        planType, startDate, endDate, companyRep, vessel, diveType, contractRef, contractorRef, estimatedTime, comments
    } = body;

    const { data: maxData } = await (supabase as any)
        .from("workpl")
        .select("inspno")
        .eq("company_id", companyId)
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


    const selectedInspectionTypes = inspectionTypes && inspectionTypes.length > 0
        ? inspectionTypes
        : (inspectionType ? [inspectionType] : []);

    try {
        const taskTypeMap: Record<string, string> = {
            "STRUCTURE": "STRUCTURE",
            "COMPONENT_TYPE": "COMP TYPE",
            "COMPONENT": "COMPONENT"
        };

        const workData = {
            inspno,
            jobname: (name || "").substring(0, 20),
            tasktype: taskTypeMap[mode] || mode,
            cr_user: (user?.email || "unknown").substring(0, 30),
            cr_date: new Date().toISOString(),
            workunit: '000',
            contrac: contractor?.lib_id,
            status: 'OPEN',
            topside: scope?.topside ? 1 : 0,
            subsea: scope?.subsea ? 1 : 0,
            company_id: companyId,

            plantype: planType,
            istart: startDate,
            iend: endDate,
            comprep: companyRep,
            vessel: (vessel || "").substring(0, 20),
            divetyp: diveType,
            contract_ref: contractRef,
            contractor_ref: contractorRef,
            idesc: comments,
            site_hrs: parseInt(estimatedTime) || null
        };

        const { error: workError } = await (supabase as any).from('workpl').insert(workData);
        if (workError) {
            console.error("Error inserting into workpl:", workError);
            throw workError;
        }

        if (mode === 'STRUCTURE') {
            const taskStrRecords = structures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000',
                company_id: companyId
            }));
            const { error: tsError } = await (supabase as any).from('taskstr').insert(taskStrRecords);
            if (tsError) throw tsError;

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
                        subsea: scope?.subsea ? 1 : 0,
                        company_id: companyId
                    });
                }
            }
            if (taskInspRecords.length > 0) {
                const { error: tiError } = await (supabase as any).from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }

        } else if (mode === 'COMPONENT_TYPE') {
            const { structureComponentSelections } = body;
            const uniqueStructures = Array.from(new Set(structures)) as string[];
            const taskStrRecords = uniqueStructures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000',
                company_id: companyId
            }));
            const { error: tsError } = await (supabase as any).from('taskstr').insert(taskStrRecords as any);
            if (tsError) throw tsError;

            const taskInspRecords = [];
            for (const strId of uniqueStructures) {
                let typesForStructure = componentTypes;

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
                            subsea: scope?.subsea ? 1 : 0,
                            company_id: companyId
                        });
                    }
                }
            }
            if (taskInspRecords.length > 0) {
                const { error: tiError } = await (supabase as any).from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }

        } else if (mode === 'COMPONENT') {
            const { structureSpecificComponents } = body;

            const uniqueStructures = Array.from(new Set(structures)) as string[];
            const taskStrRecords = uniqueStructures.map((strId: string) => ({
                inspno,
                str_id: Number(strId),
                workunit: '000',
                company_id: companyId
            }));
            const { error: tsError } = await (supabase as any).from('taskstr').insert(taskStrRecords as any);
            if (tsError) throw tsError;

            const taskCompRecords: any[] = [];

            if (structureSpecificComponents) {
                Object.entries(structureSpecificComponents).forEach(([strId, compIds]) => {
                    if (Array.isArray(compIds)) {
                        compIds.forEach(compId => {
                            taskCompRecords.push({
                                inspno,
                                str_id: Number(strId),
                                comp_id: Number(compId),
                                company_id: companyId
                            });
                        });
                    }
                });
            } else if (components && components.length > 0) {
                components.forEach((compId: string) => {
                    taskCompRecords.push({
                        inspno,
                        comp_id: Number(compId),
                        str_id: 0,
                        company_id: companyId
                    });
                });
            }

            if (taskCompRecords.length > 0) {
                const { error: tcError } = await (supabase as any).from('taskcomp').insert(taskCompRecords);
                if (tcError) throw tcError;
            }

            const taskInspRecords = [];

            for (const strId of uniqueStructures) {
                let compsForStr: string[] = [];

                if (structureSpecificComponents && structureSpecificComponents[strId]) {
                    compsForStr = structureSpecificComponents[strId];
                }

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
                            subsea: scope?.subsea ? 1 : 0,
                            company_id: companyId
                        });
                    }
                }
            }

            if (taskInspRecords.length > 0) {
                const { error: tiError } = await (supabase as any).from('taskinsp').insert(taskInspRecords);
                if (tiError) throw tiError;
            }
        }

        return apiSuccess({ inspno });
    } catch (error: any) {
        return apiError(error instanceof Error ? error.message : "Failed to create Work Pack");
    }
});
