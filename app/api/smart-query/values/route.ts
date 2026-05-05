import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QUERY_CATEGORIES } from "@/utils/smart-query-schema";

export async function GET(request: NextRequest) {
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

    // Fetch up to 5000 rows to ensure we get a good spread of distinct values
    const { data, error } = await (supabase as any)
      .from(catDef.table)
      .select(field)
      .not(field, "is", null)
      .limit(5000);

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
}
