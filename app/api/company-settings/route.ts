import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, company }) => {
    try {
        const supabase = createClient();

        let settings: any = null;

        // Settings lookup and structure existence check strictly for this company
        const [settingsRes, structureRes, companyRes] = await Promise.all([
            (supabase as any)
                .from("company_settings")
                .select("*")
                .eq("company_id", companyId)
                .maybeSingle(),
            (supabase as any)
                .from("structure")
                .select("id")
                .eq("company_id", companyId)
                .limit(1),
            (supabase as any)
                .from("companies")
                .select("id, name, logo_url, serial_no")
                .eq("id", companyId)
                .maybeSingle(),
        ]);
        const { data: byCompany, error: byCompanyError } = settingsRes;
        const hasStructures = !structureRes.error && (structureRes.data || []).length > 0;
        const companyRecord = companyRes?.data || company;

        if (byCompanyError) {
            console.warn("[GET /api/company-settings] byCompany error:", byCompanyError.message);
        }

        if (byCompany) {
            settings = byCompany;
        } else {
            // New / uninitialized tenant: strictly isolated defaults (never borrow logo from another company)
            settings = {
                company_name: companyRecord?.name || "Company",
                department_name: "Inspection Department",
                serial_no: companyRecord?.serial_no || null,
                def_unit: "METRIC",
                storage_provider: "Supabase",
                storage_config: {},
                company_id: companyId,
                logo_path: null,
            };
        }

        let logoUrl: string | null = null;
        if (settings?.logo_path) {
            const { data: publicUrlData } = supabase.storage
                .from("company-assets")
                .getPublicUrl(settings.logo_path);

            logoUrl = publicUrlData.publicUrl;
        } else if (!byCompany && companyRecord?.logo_url) {
            logoUrl = companyRecord.logo_url;
        }

        // Normalize def_unit to either METRIC or IMPERIAL for the frontend
        let normalizedUnit = settings.def_unit || "METRIC";
        if (normalizedUnit === "M") normalizedUnit = "METRIC";
        if (normalizedUnit === "I") normalizedUnit = "IMPERIAL";

        return NextResponse.json({
            data: {
                ...settings,
                company_name: companyRecord?.name || settings.company_name || "Company",
                logo_url: logoUrl,
                has_structures: hasStructures,
                def_unit: normalizedUnit,
                storage_provider: settings.storage_provider || "Supabase",
                storage_config: settings.storage_config || {}
            },
        });
    } catch (error: any) {
        console.error("Error in GET /api/company-settings:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
});

export const PUT = withTenant(async (request, { companyId, company }) => {
    try {
        const supabase = createClient();
        const body = await request.json();

        const { company_name, department_name, def_unit, storage_provider, storage_config } = body;

        let normalizedUnit = def_unit || "METRIC";
        if (normalizedUnit === "M") normalizedUnit = "METRIC";
        if (normalizedUnit === "I") normalizedUnit = "IMPERIAL";

        const updateData: any = {
            company_name: company_name || company?.name || "Company",
            department_name: department_name || null,
            def_unit: normalizedUnit,
            storage_provider: storage_provider || "Supabase",
            storage_config: storage_config || {},
            company_id: companyId,
            updated_at: new Date().toISOString(),
        };

        // Check if a row already exists for this company
        const { data: existing } = await (supabase as any)
            .from("company_settings")
            .select("id")
            .eq("company_id", companyId)
            .maybeSingle();

        let resultData: any;
        let resultError: any;

        if (existing?.id) {
            // Update existing record
            const { data, error } = await (supabase as any)
                .from("company_settings")
                .update(updateData)
                .eq("id", existing.id)
                .select()
                .single();
            resultData = data;
            resultError = error;
        } else {
            // Insert new record for this company
            const { data, error } = await (supabase as any)
                .from("company_settings")
                .insert(updateData)
                .select()
                .single();
            resultData = data;
            resultError = error;

            if (resultError) {
                console.warn("[PUT /api/company-settings] Insert fallback:", resultError.message);
                const { data: fbData, error: fbError } = await (supabase as any)
                    .from("company_settings")
                    .update(updateData)
                    .eq("company_id", companyId)
                    .select()
                    .single();
                resultData = fbData;
                resultError = fbError;
            }
        }

        if (resultError) {
            console.error("Error saving company settings:", resultError);
            return NextResponse.json({ error: resultError.message }, { status: 500 });
        }

        return NextResponse.json({ data: resultData });
    } catch (error: any) {
        console.error("Error in PUT /api/company-settings:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
});
