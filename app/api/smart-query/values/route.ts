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

    const isStructureNameField = ["structure_name", "title", "structure_name_alt", "structure_names"].includes(field);
    const isJobpackNameField = ["jobpack_name", "jobpack_name_alt", "name"].includes(field) && (category === "jobpacks" || category === "sow" || category === "inspection_records" || category === "anomalies" || category === "findings" || category === "incomplete");
    const isInspectionTypeField = ["inspection_type_code", "disc_type"].includes(field);

    if (isStructureNameField) {
      // Fetch across platform, structure, pipeline, and view master tables to show all available structures
      const [{ data: platData }, { data: structData }, { data: pipeData }, { data: viewData }, { data: structViewData }] = await Promise.all([
        (supabase as any).from("platform").select("title").limit(5000),
        (supabase as any).from("structure").select("str_name").limit(5000),
        (supabase as any).from("u_pipeline").select("title").limit(5000),
        (supabase as any).from(catDef.table).select(field).not(field, "is", null).limit(5000),
        (supabase as any).from("v_smart_query_structures").select("title").limit(5000),
      ]);

      const valueSet = new Set<string>();
      (platData || []).forEach((p: any) => {
        if (p?.title) valueSet.add(String(p.title).trim());
      });
      (structData || []).forEach((s: any) => {
        if (s?.str_name) valueSet.add(String(s.str_name).trim());
      });
      (pipeData || []).forEach((pl: any) => {
        if (pl?.title) valueSet.add(String(pl.title).trim());
      });
      (structViewData || []).forEach((sv: any) => {
        if (sv?.title) valueSet.add(String(sv.title).trim());
      });
      (viewData || []).forEach((v: any) => {
        if (v && v[field]) valueSet.add(String(v[field]).trim());
      });

      const distinctValues = Array.from(valueSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return NextResponse.json({ values: distinctValues.slice(0, 500) });
    }

    if (isJobpackNameField) {
      const [{ data: jpData }, { data: viewData }] = await Promise.all([
        (supabase as any).from("jobpack").select("name").limit(5000),
        (supabase as any).from(catDef.table).select(field).not(field, "is", null).limit(5000),
      ]);

      const valueSet = new Set<string>();
      (jpData || []).forEach((j: any) => {
        if (j.name) valueSet.add(String(j.name).trim());
      });
      (viewData || []).forEach((v: any) => {
        if (v[field]) valueSet.add(String(v[field]).trim());
      });

      const distinctValues = Array.from(valueSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return NextResponse.json({ values: distinctValues.slice(0, 500) });
    }

    if (isInspectionTypeField) {
      const [{ data: itData }, { data: viewData }] = await Promise.all([
        (supabase as any).from("inspection_type").select("code, name").limit(5000),
        (supabase as any).from(catDef.table).select(field).not(field, "is", null).limit(5000),
      ]);

      const valueSet = new Set<string>();
      (itData || []).forEach((it: any) => {
        if (it.code) valueSet.add(String(it.code).trim().toUpperCase());
      });
      (viewData || []).forEach((v: any) => {
        if (v[field]) valueSet.add(String(v[field]).trim().toUpperCase());
      });

      const distinctValues = Array.from(valueSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return NextResponse.json({ values: distinctValues.slice(0, 500) });
    }

    let query = (supabase as any)
      .from(catDef.table)
      .select(field)
      .not(field, "is", null);

    if (companyId) {
      if (category === "structures") {
        const [{ data: structRes }, { data: platRes }] = await Promise.all([
          (supabase as any).from("structure").select("str_id").eq("company_id", companyId),
          (supabase as any).from("platform").select("plat_id").eq("company_id", companyId),
        ]);
        const strIds = Array.from(new Set([
          ...(structRes?.map((s: any) => s.str_id) || []),
          ...(platRes?.map((p: any) => p.plat_id) || [])
        ])).filter(Boolean);
        if (strIds.length > 0) {
          query = query.in("id", strIds);
        }
      } else if (category === "components" || category === "sow" || category === "inspection_records" || category === "incomplete") {
        const [{ data: structRes }, { data: platRes }] = await Promise.all([
          (supabase as any).from("structure").select("str_id").eq("company_id", companyId),
          (supabase as any).from("platform").select("plat_id").eq("company_id", companyId),
        ]);
        const strIds = Array.from(new Set([
          ...(structRes?.map((s: any) => s.str_id) || []),
          ...(platRes?.map((p: any) => p.plat_id) || [])
        ])).filter(Boolean);
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        }
      } else if (category === "jobpacks") {
        const { data: tenantJobpacks } = await (supabase as any)
          .from("jobpack")
          .select("id")
          .eq("company_id", companyId);
        const jpIds = tenantJobpacks?.map((j: any) => j.id) || [];
        if (jpIds.length > 0) {
          query = query.in("id", jpIds);
        }
      } else if (category === "anomalies" || category === "findings") {
        const { data: tenantAnoms } = await (supabase as any)
          .from("insp_anomalies")
          .select("anomaly_id")
          .eq("company_id", companyId);
        const anomIds = tenantAnoms?.map((a: any) => a.anomaly_id) || [];
        if (anomIds.length > 0) {
          query = query.in("anomaly_id", anomIds);
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
    const distinctValues = Array.from(new Set(data.map((row: any) => String(row[field]).trim()))).filter(Boolean).sort();

    // Limit to top 500 distinct values to avoid overwhelming the UI
    const limitedValues = distinctValues.slice(0, 500);

    return NextResponse.json({ values: limitedValues });
  } catch (error: any) {
    console.error("[SmartQuery] Critical error in values API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});
