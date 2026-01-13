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

        const { company_name, department_name } = body;

        const { data, error } = await supabase
            .from("company_settings" as any)
            .update({
                company_name,
                department_name,
            })
            .eq("id", 1)
            .select()
            .single() as any;

        if (error) {
            console.error("Error updating company settings:", error);
            return NextResponse.json(
                { error: "Failed to update company settings" },
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
