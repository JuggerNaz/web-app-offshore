import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = createClient();

        const { data: settings, error } = await supabase
            .from("company_settings" as any)
            .select("*")
            .eq("id", 1)
            .single() as any;

        if (error) {
            console.error("Error fetching company settings:", error);
            return NextResponse.json(
                { error: "Failed to fetch company settings" },
                { status: 500 }
            );
        }

        // Check if any structures exist
        const { count, error: countError } = await supabase
            .from("structure")
            .select("*", { count: "exact", head: true });

        const hasStructures = !countError && (count || 0) > 0;

        // If logo_path exists, get the public URL
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
}

export async function PUT(request: Request) {
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

        const { data, error } = await supabase
            .from("company_settings" as any)
            .upsert({ id: 1, ...updateData })
            .select()
            .single() as any;

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
}
