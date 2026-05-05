import { NextRequest, NextResponse } from "next/server";
import { QUERY_CATEGORIES } from "@/utils/smart-query-schema";

/**
 * GET /api/smart-query/schema
 * Returns all available query categories with their field definitions.
 */
export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      data: QUERY_CATEGORIES.map(cat => ({
        id: cat.id,
        label: cat.label,
        description: cat.description,
        icon: cat.icon,
        table: cat.table,
        fields: cat.fields,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load schema" },
      { status: 500 }
    );
  }
}
