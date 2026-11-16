import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

function isUserAdmin(membership: any, memberships: any[]): boolean {
    const role = (membership?.role || "").toLowerCase().trim();
    if (role === "super_admin" || role === "company_admin" || role === "admin" || role === "administrator") {
        return true;
    }
    if (Array.isArray(memberships) && memberships.some((m: any) => {
        const r = (m?.role || "").toLowerCase().trim();
        return r === "super_admin" || r === "company_admin" || r === "admin";
    })) {
        return true;
    }
    return false;
}

function maskStorageSecrets(config: any): any {
    if (!config || typeof config !== "object") return {};
    const masked: Record<string, any> = { ...config };
    const sensitiveKeys = [
        "secretAccessKey", "secret_access_key", "secretKey", "secret_key",
        "applicationKey", "application_key", "b2AppKey", "appKey", "app_key",
        "accessKeyId", "access_key_id", "keyId", "key_id", "b2KeyId", "applicationKeyId",
        "serviceAccount", "service_account", "clientSecret", "client_secret",
        "private_key", "api_secret", "apiKey", "api_key", "token", "password"
    ];
    for (const k of Object.keys(masked)) {
        const lower = k.toLowerCase();
        if (
            sensitiveKeys.includes(k) ||
            lower.includes("secret") ||
            lower.includes("key") ||
            lower.includes("token") ||
            lower.includes("password")
        ) {
            if (typeof masked[k] === "string" && masked[k].length > 0) {
                masked[k] = "********";
            } else if (typeof masked[k] === "object" && masked[k] !== null) {
                masked[k] = "********";
            }
        }
    }
    return masked;
}

export const GET = withTenant(async (request, { companyId, company, membership, memberships }) => {
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

        const clientShort = settings.client_short || settings.storage_config?.client_short || companyRecord?.short_name || "";

        const isAdmin = isUserAdmin(membership, memberships);
        const finalStorageConfig = isAdmin
            ? (settings.storage_config || {})
            : maskStorageSecrets(settings.storage_config || {});

        return NextResponse.json({
            data: {
                ...settings,
                company_name: companyRecord?.name || settings.company_name || "Company",
                client_short: clientShort,
                logo_url: logoUrl,
                has_structures: hasStructures,
                def_unit: normalizedUnit,
                storage_provider: settings.storage_provider || "Supabase",
                storage_config: finalStorageConfig
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

export const PUT = withTenant(async (request, { companyId, company, membership, memberships }) => {
    try {
        const isAdmin = isUserAdmin(membership, memberships);
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden: Only administrators can modify company settings and storage configuration" },
                { status: 403 }
            );
        }

        const supabase = createClient();
        const body = await request.json();

        const { company_name, client_short, department_name, def_unit, storage_provider, storage_config } = body;

        let normalizedUnit = def_unit || "METRIC";
        if (normalizedUnit === "M") normalizedUnit = "METRIC";
        if (normalizedUnit === "I") normalizedUnit = "IMPERIAL";

        const mergedStorageConfig = {
            ...(storage_config || {}),
            client_short: client_short !== undefined ? client_short : (storage_config?.client_short || "")
        };

        // Check if a row already exists for this company
        const { data: existing } = await (supabase as any)
            .from("company_settings")
            .select("id, storage_config")
            .eq("company_id", companyId)
            .maybeSingle();

        // Preserve existing secrets if masked values ("********") were sent back
        if (existing?.storage_config && typeof existing.storage_config === "object") {
            for (const [k, v] of Object.entries(mergedStorageConfig)) {
                if (v === "********" && existing.storage_config[k]) {
                    mergedStorageConfig[k] = existing.storage_config[k];
                }
            }
        }

        const updateData: any = {
            company_name: company_name || company?.name || "Company",
            department_name: department_name || null,
            def_unit: normalizedUnit,
            storage_provider: storage_provider || "Supabase",
            storage_config: mergedStorageConfig,
            company_id: companyId,
            updated_at: new Date().toISOString(),
        };

        let resultData: any;
        let resultError: any;

        // Try with client_short column first, fallback gracefully if column doesn't exist yet in DB
        const saveWithColumn = { ...updateData, client_short: client_short || null };

        if (existing?.id) {
            // Update existing record
            let res = await (supabase as any)
                .from("company_settings")
                .update(saveWithColumn)
                .eq("id", existing.id)
                .select()
                .single();

            if (res.error && (res.error.code === "42703" || res.error.message?.includes("client_short"))) {
                res = await (supabase as any)
                    .from("company_settings")
                    .update(updateData)
                    .eq("id", existing.id)
                    .select()
                    .single();
            }
            resultData = res.data;
            resultError = res.error;
        } else {
            // Insert new record for this company
            let res = await (supabase as any)
                .from("company_settings")
                .insert(saveWithColumn)
                .select()
                .single();

            if (res.error && (res.error.code === "42703" || res.error.message?.includes("client_short"))) {
                res = await (supabase as any)
                    .from("company_settings")
                    .insert(updateData)
                    .select()
                    .single();
            }

            resultData = res.data;
            resultError = res.error;

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

        return NextResponse.json({
            data: {
                ...resultData,
                client_short: client_short !== undefined ? client_short : (resultData?.client_short || mergedStorageConfig.client_short || "")
            }
        });
    } catch (error: any) {
        console.error("Error in PUT /api/company-settings:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
});
