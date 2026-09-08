import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QUERY_CATEGORIES } from "@/utils/smart-query-schema";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const field = searchParams.get("field");

    if (!category || !field) {
      return NextResponse.json({ error: "Missing category or field" }, { status: 400 });
    }

    const catDef = QUERY_CATEGORIES.find((c) => c.id === category);
    if (!catDef) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const fieldDef = catDef.fields.find((f) => f.key === field);
    if (!fieldDef) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    const supabase = await createClient();

    let query = (supabase as any)
      .from(catDef.table)
      .select(field)
      .not(field, "is", null);

    if (companyId) {
      if (category === "structures") {
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("id", strIds);
        } else {
          query = query.eq("id", -999999);
        }
      } else if (category === "components" || category === "sow" || category === "inspection_records" || category === "incomplete") {
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        } else {
          query = query.eq("structure_id", -999999);
        }
      } else if (category === "jobpacks") {
        const { data: tenantJobpacks } = await (supabase as any)
          .from("jobpack")
          .select("id")
          .eq("company_id", companyId);
        const jpIds = tenantJobpacks?.map((j: any) => j.id) || [];
        if (jpIds.length > 0) {
          query = query.in("id", jpIds);
        } else {
          query = query.eq("id", -999999);
        }
      } else if (category === "anomalies" || category === "findings") {
        const { data: tenantAnoms } = await (supabase as any)
          .from("insp_anomalies")
          .select("anomaly_id")
          .eq("company_id", companyId);
        const anomIds = tenantAnoms?.map((a: any) => a.anomaly_id) || [];
        if (anomIds.length > 0) {
          query = query.in("anomaly_id", anomIds);
        } else {
          query = query.eq("anomaly_id", -999999);
        }
      }
    }

    // Fetch up to 5000 rows to ensure we get a good spread of distinct values
    const { data, error } = await query.limit(5000);

    if (error) {
      console.error("[SmartQuery] Values API error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ values: [] });
    }

    // Extract distinct values
    const distinctValues = Array.from(new Set(data.map((row: any) => row[field]))).sort();

    // Limit to top 200 distinct values to avoid overwhelming the UI
    const limitedValues = distinctValues.slice(0, 200);

    return NextResponse.json({ values: limitedValues });
  } catch (error: any) {
    console.error("[SmartQuery] Critical error in values API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});
