import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = createClient();

        let settings: any = null;

        // Settings lookup and structure existence check are independent — run
        // them in parallel; the exists-style check avoids an exact count scan.
        const [settingsRes, structureRes] = await Promise.all([
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
        ]);
        const { data: byCompany, error: byCompanyError } = settingsRes;
        const hasStructures = !structureRes.error && (structureRes.data || []).length > 0;

        if (byCompanyError) {
            console.error("Error fetching company settings by company_id:", byCompanyError);
        }

        if (byCompany) {
            settings = byCompany;
        } else {
            const { data: fallback, error: fallbackError } = await (supabase as any)
                .from("company_settings")
                .select("*")
                .eq("id", 1)
                .maybeSingle();

            if (fallbackError) {
                console.error("Error fetching company settings fallback:", fallbackError);
                return NextResponse.json(
                    { error: "Failed to fetch company settings" },
                    { status: 500 }
                );
            }
            settings = fallback;
        }

        if (!settings) {
            return NextResponse.json({ data: null });
        }

        let logoUrl = null;
        if (settings.logo_path) {
            const { data: publicUrlData } = supabase.storage
                .from("company-assets")
                .getPublicUrl(settings.logo_path);

            logoUrl = publicUrlData.publicUrl;
        }

        return NextResponse.json({
            data: {
                ...settings,
                logo_url: logoUrl,
                has_structures: hasStructures,
                def_unit: settings.def_unit || "METRIC",
                storage_provider: settings.storage_provider || "Supabase",
                storage_config: settings.storage_config || {}
            },
        });
    } catch (error) {
        console.error("Error in GET /api/company-settings:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
});

export const PUT = withTenant(async (request, { companyId }) => {
    try {
        const supabase = createClient();
        const body = await request.json();
        console.log("[PUT /api/company-settings] Received body:", JSON.stringify(body, null, 2));

        const { company_name, department_name, def_unit, storage_provider, storage_config } = body;

        const updateData: any = {
            company_name,
            department_name,
            def_unit,
        };

        if (storage_provider) updateData.storage_provider = storage_provider;
        if (storage_config) updateData.storage_config = storage_config;

        const { data, error } = await (supabase as any)
            .from("company_settings")
            .upsert({ company_id: companyId, ...updateData })
            .select()
            .single();

        if (error) {
            console.error("Error updating company settings:", error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error("Error in PUT /api/company-settings:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
});
